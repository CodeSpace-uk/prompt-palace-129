import { test, expect, type Page } from "@playwright/test";
import { auditConfig, type ViewName } from "./audit.config";
import { discoverPages } from "./crawler";
import { writeReport, type Row } from "./report";

const { interactions } = auditConfig;

async function settle(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(auditConfig.settleMs);
}

function row(partial: Partial<Row> & Pick<Row, "page" | "view" | "component" | "result">): Row {
  return {
    present: "Yes",
    widthCorrect: "N/A",
    alignmentCorrect: "N/A",
    hyperlink: "Not Applicable",
    actualUrl: "-",
    comments: "",
    ...partial,
  } as Row;
}

test.describe("SPA interactions", () => {
  test.skip(!interactions.enabled, "interaction tests disabled in audit.config.ts");

  test("mobile menu + client-side route transitions", async ({ browser }) => {
    test.setTimeout(0);
    const pages = await discoverPages(browser);
    expect(pages.length, "no pages discovered").toBeGreaterThan(0);

    const rows: Row[] = [];

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
        await settle(page, url);

        // 1. Mobile menu toggle (Mobile viewport only).
        if (view === "Mobile") {
          const toggle = page.locator(interactions.mobileMenu.toggleSelector).first();
          const panel = page.locator(interactions.mobileMenu.panelSelector).first();
          if ((await toggle.count()) === 0) {
            rows.push(
              row({
                page: url,
                view,
                component: "Mobile Menu Toggle",
                present: "No",
                result: "Fail",
                comments: "No menu toggle found at 390px — navigation may be unreachable",
              }),
            );
          } else {
            try {
              await toggle.click({ timeout: 10_000 });
              await page.waitForTimeout(600);
              const opened = await panel.isVisible().catch(() => false);
              await toggle.click({ timeout: 10_000 }).catch(() => {});
              await page.waitForTimeout(600);
              rows.push(
                row({
                  page: url,
                  view,
                  component: "Mobile Menu Toggle",
                  result: opened ? "Pass" : "Fail",
                  comments: opened
                    ? "Toggle opens the navigation panel"
                    : "Toggle clicked but navigation panel never became visible",
                }),
              );
            } catch (err) {
              rows.push(
                row({
                  page: url,
                  view,
                  component: "Mobile Menu Toggle",
                  result: "Fail",
                  comments: (err as Error).message.split("\n")[0].slice(0, 160),
                }),
              );
            }
          }
        }

        // 2. Client-side route transitions.
        if (!interactions.routeTransitions.enabled) continue;
        const origin = new URL(url).origin;
        const targets = (
          await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href))
        )
          .filter((h) => {
            try {
              const u = new URL(h);
              return u.origin === origin && u.href.replace(/#.*$/, "") !== url;
            } catch {
              return false;
            }
          })
          .filter((h, i, arr) => arr.indexOf(h) === i)
          .slice(0, interactions.routeTransitions.linksPerPage);

        for (const target of targets) {
          await settle(page, url);
          // Marker survives client-side routing, dies on a full reload.
          await page.evaluate(() => {
            (window as unknown as { __spaMarker?: boolean }).__spaMarker = true;
          });

          const link = page.locator(`a[href$="${new URL(target).pathname}"]`).first();
          let result: Row["result"] = "Pass";
          const notes: string[] = [];
          try {
            await link.click({ timeout: 10_000 });
            await page.waitForTimeout(interactions.routeTransitions.enabled ? 2500 : 0);

            const softNav = await page.evaluate(
              () => (window as unknown as { __spaMarker?: boolean }).__spaMarker === true,
            );
            notes.push(softNav ? "Client-side transition (no reload)" : "Full page reload");

            const arrived = page.url().replace(/\/+$/, "") === target.replace(/\/+$/, "");
            if (!arrived) notes.push(`Landed on ${page.url()}`);

            const shellOk = await page
              .locator(interactions.routeTransitions.persistentSelector)
              .first()
              .isVisible()
              .catch(() => false);
            if (!shellOk) {
              result = "Fail";
              notes.push("Shared header/footer shell missing after transition");
            }
            const errors = await page.evaluate(() => document.body.innerText.length);
            if (errors < 50) {
              result = "Fail";
              notes.push("Destination rendered almost no content");
            }
          } catch (err) {
            result = "Fail";
            notes.push((err as Error).message.split("\n")[0].slice(0, 160));
          }

          rows.push(
            row({
              page: url,
              view,
              component: `Route Transition -> ${new URL(target).pathname}`,
              actualUrl: target,
              result,
              comments: notes.join("; "),
            }),
          );
        }
      }

      await context.close();
    }

    writeReport("interactions", rows);
    const failures = rows.filter((r) => r.result === "Fail");
    expect(
      failures.map((f) => `${f.page} [${f.view}] ${f.component}: ${f.comments}`),
      "interaction failures",
    ).toEqual([]);
  });
});
