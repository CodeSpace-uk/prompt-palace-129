import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { auditConfig, type UiSpec, type ViewName } from "./audit.config";
import { discoverPages } from "./crawler";

type Row = {
  page: string;
  view: ViewName;
  component: string;
  present: "Yes" | "No";
  widthCorrect: string;
  alignmentCorrect: string;
  hyperlink: string;
  actualUrl: string;
  result: "Pass" | "Fail";
  comments: string;
};

const rows: Row[] = [];

/** Measured geometry + link for one spec on the current page. */
async function measure(page: Page, spec: UiSpec) {
  return page.evaluate(
    ({ selector }) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const parent = (el.offsetParent as HTMLElement | null) ?? document.body;
      const pr = parent.getBoundingClientRect();
      const anchor = el.closest("a") as HTMLAnchorElement | null;
      return {
        width: Math.round(r.width),
        left: r.left - pr.left,
        right: pr.right - r.right,
        parentWidth: pr.width,
        href: anchor ? anchor.href : null,
        visible: r.width > 0 && r.height > 0,
      };
    },
    { selector: spec.selector },
  );
}

function checkAlignment(
  m: NonNullable<Awaited<ReturnType<typeof measure>>>,
  expected: "left" | "center" | "right",
  tolerance: number,
) {
  const centerOffset = Math.abs(m.left + m.width / 2 - m.parentWidth / 2);
  if (expected === "left") return m.left <= tolerance;
  if (expected === "right") return m.right <= tolerance;
  return centerOffset <= tolerance;
}

function sameUrl(a: string, b: string) {
  const strip = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  return strip(a) === strip(b);
}

test.describe("UI spec audit", () => {
  test("audit every page at Desktop and Mobile", async ({ browser }) => {
    const pages = await discoverPages(browser);
    expect(pages.length, "no pages discovered").toBeGreaterThan(0);
    test.setTimeout(60_000 * pages.length);

    const failures: string[] = [];

    for (const view of Object.keys(auditConfig.viewports) as ViewName[]) {
      const context = await browser.newContext({
        viewport: auditConfig.viewports[view],
        userAgent: auditConfig.userAgent,
        ignoreHTTPSErrors: true,
        isMobile: view === "Mobile",
        hasTouch: view === "Mobile",
      });
      const page = await context.newPage();

      for (const url of pages) {
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
        } catch {
          rows.push({
            page: url,
            view,
            component: "(page load)",
            present: "No",
            widthCorrect: "N/A",
            alignmentCorrect: "N/A",
            hyperlink: "N/A",
            actualUrl: "-",
            result: "Fail",
            comments: "Page failed to load",
          });
          failures.push(`${url} [${view}] failed to load`);
          continue;
        }

        for (const spec of auditConfig.specs) {
          const m = await measure(page, spec);
          const comments: string[] = [];
          let pass = true;

          if (!m || !m.visible) {
            const required = spec.required !== false;
            if (required) {
              pass = false;
              comments.push("Element not found / not visible");
            }
            rows.push({
              page: url,
              view,
              component: spec.component,
              present: "No",
              widthCorrect: "N/A",
              alignmentCorrect: "N/A",
              hyperlink: "N/A",
              actualUrl: "-",
              result: pass ? "Pass" : "Fail",
              comments: comments.join("; ") || "Optional element absent",
            });
            if (!pass) failures.push(`${url} [${view}] ${spec.component}: missing`);
            continue;
          }

          // Width
          let widthCell = "N/A";
          const expectedWidth = spec.width?.[view];
          if (expectedWidth != null) {
            const tol = spec.widthTolerance ?? 0;
            const ok = Math.abs(m.width - expectedWidth) <= tol;
            widthCell = ok ? "Yes" : "No";
            if (!ok) {
              pass = false;
              comments.push(`Width ${m.width}px, expected ${expectedWidth}px`);
            }
          }

          // Alignment
          let alignCell = "N/A";
          const expectedAlign = spec.alignment?.[view];
          if (expectedAlign) {
            const ok = checkAlignment(m, expectedAlign, spec.alignmentTolerance ?? 8);
            alignCell = ok ? "Yes" : "No";
            if (!ok) {
              pass = false;
              comments.push(
                `Alignment not ${expectedAlign} (left gap ${Math.round(m.left)}px, right gap ${Math.round(m.right)}px)`,
              );
            }
          }

          // Hyperlink
          let linkCell = "Not Applicable";
          if (spec.href === null) {
            linkCell = m.href ? "Incorrect" : "Correct";
            if (m.href) {
              pass = false;
              comments.push(`Should not be hyperlinked, links to ${m.href}`);
            }
          } else if (typeof spec.href === "string") {
            const ok = !!m.href && sameUrl(m.href, spec.href);
            linkCell = ok ? "Correct" : "Incorrect";
            if (!ok) {
              pass = false;
              comments.push(m.href ? `Links to ${m.href}, expected ${spec.href}` : "Not clickable");
            }
          }

          rows.push({
            page: url,
            view,
            component: spec.component,
            present: "Yes",
            widthCorrect: widthCell,
            alignmentCorrect: alignCell,
            hyperlink: linkCell,
            actualUrl: m.href ?? "-",
            result: pass ? "Pass" : "Fail",
            comments: comments.join("; ") || "Meets spec",
          });
          if (!pass)
            failures.push(`${url} [${view}] ${spec.component}: ${comments.join("; ")}`);
        }
      }

      await context.close();
    }

    // Reports
    mkdirSync("audit-report", { recursive: true });
    const header = [
      "Page URL",
      "View",
      "Component",
      "Present",
      "Width Correct",
      "Alignment Correct",
      "Hyperlink Status",
      "Actual URL",
      "Pass/Fail",
      "Comments",
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.page,
          r.view,
          r.component,
          r.present,
          r.widthCorrect,
          r.alignmentCorrect,
          r.hyperlink,
          r.actualUrl,
          r.result,
          r.comments,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    writeFileSync("audit-report/audit.csv", csv);

    const md = [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...rows.map(
        (r) =>
          `| ${r.page} | ${r.view} | ${r.component} | ${r.present} | ${r.widthCorrect} | ${r.alignmentCorrect} | ${r.hyperlink} | ${r.actualUrl} | ${r.result} | ${r.comments} |`,
      ),
    ].join("\n");
    writeFileSync("audit-report/audit.md", md);
    writeFileSync("audit-report/audit.json", JSON.stringify(rows, null, 2));

    console.log(`\nAudited ${pages.length} pages x 2 views -> audit-report/audit.md`);
    for (const f of failures) console.log(`FAIL: ${f}`);

    expect(failures, `${failures.length} spec violations:\n${failures.join("\n")}`).toEqual([]);
  });
});
