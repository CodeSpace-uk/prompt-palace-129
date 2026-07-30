import { test, expect } from "@playwright/test";
import { auditConfig, type ViewName } from "./audit.config";
import { discoverPages } from "./crawler";
import { writeReport, type Row } from "./report";

const { visual } = auditConfig;

function slug(url: string) {
  const u = new URL(url);
  return (u.pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "root").toLowerCase();
}

test.describe("Visual regression", () => {
  test.skip(!visual.enabled, "visual regression disabled in audit.config.ts");

  test("snapshot every page at Desktop and Mobile", async ({ browser }) => {
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
        const name = `${slug(url)}-${view.toLowerCase()}.png`;
        let result: Row["result"] = "Pass";
        let comments = "Matches baseline";
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
          await page.waitForTimeout(auditConfig.settleMs);
          await page.addStyleTag({ content: visual.stabilizeCss });

          await expect(page).toHaveScreenshot(name, {
            fullPage: visual.fullPage,
            animations: "disabled",
            maxDiffPixelRatio: visual.maxDiffPixelRatio,
            mask: visual.maskSelectors.map((s) => page.locator(s)),
            timeout: 30_000,
          });
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          if (/A snapshot doesn't exist|writing actual/i.test(msg)) {
            comments = "Baseline created on this run";
          } else {
            result = "Fail";
            comments = msg.split("\n")[0].slice(0, 200);
          }
        }

        rows.push({
          page: url,
          view,
          component: "Visual Snapshot",
          present: "Yes",
          widthCorrect: "N/A",
          alignmentCorrect: "N/A",
          hyperlink: "Not Applicable",
          actualUrl: name,
          result,
          comments,
        });
      }

      await context.close();
    }

    writeReport("visual", rows);
    const failures = rows.filter((r) => r.result === "Fail");
    expect(
      failures.map((f) => `${f.page} [${f.view}]: ${f.comments}`),
      "visual diffs detected",
    ).toEqual([]);
  });
});
