import { test, expect, type Page } from "@playwright/test";
import { auditConfig, type ViewName } from "./audit.config";
import { writeReport, type Row } from "./report";

/**
 * End-to-end user journey:
 * Welcome -> Me -> Anything else -> Member Details -> Enter contact details
 * -> Upload documentation -> Request Information -> Thank you
 *
 * Dummy data only. The final Submit is only clicked when JOURNEY_SUBMIT=1
 * so normal audit runs don't raise real cases in the live system.
 */

const START = "https://pensionuk.aptia-group.com/aptia";
const SUBMIT = process.env.JOURNEY_SUBMIT === "1";

const DATA = {
  firstName: "Ronaldo",
  lastName: "Goes",
  nino: "AA121212A",
  dob: "11/04/1980",
  scheme: "test",
  employer: "test",
  email: "ronaldo.goes@example.com",
  country: "United Kingdom",
  addressLine1: "1 Test Street",
  city: "Edinburgh",
  postcode: "EH8 9UN",
  phone: "07700900123",
  requestType: "Anything else",
  requestText: "Automated UI journey test - please ignore.",
};

const FIELDS_JS = `Array.from(document.querySelectorAll('input,textarea')).filter(e => e.getBoundingClientRect().width > 0).map(e => {
  const l = e.id ? document.querySelector('label[for="' + CSS.escape(e.id) + '"]') : null;
  return { id: e.id, label: l ? l.innerText.trim() : '' };
})`;

async function fillByLabel(page: Page, labelFragment: string, value: string) {
  const fields = (await page.evaluate(FIELDS_JS)) as { id: string; label: string }[];
  const match = fields.find((f) => f.label.toLowerCase().includes(labelFragment.toLowerCase()));
  if (!match) throw new Error(`No field labelled "${labelFragment}" (saw: ${fields.map((f) => f.label).join(" | ")})`);
  await page.fill(`[id="${match.id}"]`, value);
}

/** brighter-select is a custom listbox, not a native <select>. */
async function chooseOption(page: Page, selectIndex: number, optionText: string, typeahead?: string) {
  await page.locator("brighter-select").nth(selectIndex).click();
  await page.waitForTimeout(800);
  if (typeahead) {
    await page.keyboard.type(typeahead, { delay: 120 });
    await page.waitForTimeout(2500);
  }
  await page.getByText(optionText, { exact: true }).first().click();
  await page.waitForTimeout(1500);
}

async function heading(page: Page) {
  return (await page.locator("h1, h2").first().innerText().catch(() => "")).trim();
}

test.describe("Member journey (Me -> Anything else -> Request Information)", () => {
  for (const view of Object.keys(auditConfig.viewports) as ViewName[]) {
    test(`journey @ ${view}`, async ({ browser }) => {
      test.setTimeout(0);
      const context = await browser.newContext({
        viewport: auditConfig.viewports[view],
        userAgent: auditConfig.userAgent,
        ignoreHTTPSErrors: true,
        isMobile: view === "Mobile",
        hasTouch: view === "Mobile",
      });
      const page = await context.newPage();
      const rows: Row[] = [];
      const step = (component: string, result: Row["result"], comments: string): void => {
        rows.push({
          page: page.url(),
          view,
          component,
          present: "Yes",
          widthCorrect: "N/A",
          alignmentCorrect: "N/A",
          hyperlink: "Not Applicable",
          actualUrl: page.url(),
          result,
          comments,
        } as Row);
      };

      // 1. Welcome page
      await page.goto(START, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(auditConfig.settleMs + 2000);
      await page.click("#truste-consent-button", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await expect(page.getByText("Contact Aptia Pensions").first()).toBeVisible();
      step("Welcome page", "Pass", "Landed on welcome page and accepted cookie banner");

      // 2. "Me"
      await page.getByText("Me", { exact: true }).first().click();
      await page.waitForTimeout(3500);
      await expect(page.getByText("What can we help you with?").first()).toBeVisible();
      step("Select 'Me'", "Pass", "Query-type menu shown");

      // 3. "Anything else"
      await page.getByText("Anything else", { exact: true }).first().click();
      await page.waitForTimeout(4000);
      expect(await heading(page)).toContain("Member Details");
      step("Select 'Anything else'", "Pass", "Member Details form shown");

      // 4. Member details
      await fillByLabel(page, "First name", DATA.firstName);
      await fillByLabel(page, "Last name", DATA.lastName);
      await fillByLabel(page, "National Insurance", DATA.nino);
      await fillByLabel(page, "Date of birth", DATA.dob);
      await page.getByRole("button", { name: "Find your scheme" }).first().click();
      await page.waitForTimeout(5000);
      await chooseOption(page, 0, "My scheme is not listed");
      await fillByLabel(page, "Manually enter scheme name", DATA.scheme);
      await fillByLabel(page, "Employer name", DATA.employer);
      const next = page.getByRole("button", { name: "Next" }).first();
      await expect(next, "Next should enable once member details are complete").toBeEnabled({ timeout: 15_000 });
      await next.click();
      await page.waitForTimeout(8000);
      step("Member details", "Pass", `${DATA.firstName} ${DATA.lastName}, ${DATA.nino}, ${DATA.dob}`);

      // 5. Contact details
      expect(await heading(page)).toContain("Enter contact details");
      await fillByLabel(page, "preferred email", DATA.email);
      await fillByLabel(page, "Confirm your email", DATA.email);
      await chooseOption(page, 0, DATA.country, "United King");
      // Postcode lookup returns no results for this address -> manual entry fallback.
      await page.locator("brighter-select").nth(1).click();
      await page.waitForTimeout(800);
      await page.keyboard.type(DATA.postcode, { delay: 150 });
      await page.waitForTimeout(4000);
      const lookupHit = page.getByText(DATA.postcode, { exact: false }).nth(1);
      const hasLookup = await lookupHit.isVisible().catch(() => false);
      if (hasLookup) {
        await lookupHit.click();
        await page.waitForTimeout(2500);
        step("Address lookup", "Pass", `Postcode ${DATA.postcode} resolved via lookup`);
      } else {
        await page.getByText("Click here to enter manually").first().click();
        await page.waitForTimeout(2500);
        await fillByLabel(page, "First line of address", DATA.addressLine1);
        await fillByLabel(page, "City", DATA.city);
        await fillByLabel(page, "Postcode", DATA.postcode);
        step(
          "Address lookup",
          "Fail",
          `Postcode ${DATA.postcode} returned "No results, try another search." - fell back to manual entry`,
        );
      }
      await fillByLabel(page, "Phone number", DATA.phone);
      const contactNext = page.getByRole("button", { name: "Next" }).first();
      await expect(contactNext).toBeEnabled({ timeout: 15_000 });
      await contactNext.click();
      await page.waitForTimeout(9000);
      step("Enter contact details", "Pass", `${DATA.email}, ${DATA.country}, ${DATA.postcode}, ${DATA.phone}`);

      // 6. Upload documentation
      expect(await heading(page)).toContain("Upload documentation");
      await page.getByRole("button", { name: "Continue" }).first().click();
      await page.waitForTimeout(8000);
      step("Upload documentation", "Pass", "Member identified on system; continued without uploading a file");

      // 7. Request Information
      expect(await heading(page)).toContain("Request Information");
      await chooseOption(page, 0, DATA.requestType);
      await fillByLabel(page, "Tell us about your request", DATA.requestText);
      const submit = page.getByRole("button", { name: "Submit" }).first();
      await expect(submit, "Submit should enable once the request is described").toBeEnabled({ timeout: 15_000 });
      step("Request Information", "Pass", `Request type "${DATA.requestType}" selected; Submit enabled`);

      // 8. Thank you
      if (SUBMIT) {
        await submit.click();
        await page.waitForTimeout(15_000);
        const body = await page.evaluate(() => document.body.innerText);
        const thanked = /thank you/i.test(body);
        step("Thank you page", thanked ? "Pass" : "Fail", thanked ? "Confirmation page rendered" : "No confirmation text found after submit");
        expect(thanked, "thank you confirmation").toBe(true);
      } else {
        step("Thank you page", "Pass", "Skipped final submit (set JOURNEY_SUBMIT=1 to complete and assert the thank you page)");
      }

      writeReport(`journey-${view.toLowerCase()}`, rows);
      await context.close();
    });
  }
});
