/**
 * Edit this file to point the audit at your site and describe your UI specs.
 * Everything else (crawling, viewport switching, reporting) is automatic.
 */

export type ViewName = "Desktop" | "Mobile";

export interface UiSpec {
  /** Human-readable component name shown in the report. */
  component: string;
  /** CSS selector for the element. First match wins. */
  selector: string;
  /** Must the element exist? Default true. */
  required?: boolean;
  /** Expected rendered width in CSS px (per view). */
  width?: Partial<Record<ViewName, number>>;
  /** Allowed +/- deviation in px for width. Default 0. */
  widthTolerance?: number;
  /**
   * Expected horizontal alignment within the element's parent container,
   * per view. Use "none" when alignment is not audited.
   */
  alignment?: Partial<Record<ViewName, "left" | "center" | "right">>;
  /** Alignment tolerance in px. Default 8. */
  alignmentTolerance?: number;
  /**
   * Expected link target.
   * - a string  -> element (or its closest <a>) must link exactly there
   * - null      -> element must NOT be hyperlinked
   * - undefined -> link not audited
   */
  href?: string | null;
}

export const auditConfig = {
  /** Root URL the crawl starts from. */
  baseUrl: "https://pensionuk.aptia-group.com/aptia",
  /** Also try <origin>/sitemap.xml for page discovery. */
  useSitemap: true,
  /** Max pages to audit. */
  maxPages: 40,
  /** Only crawl URLs whose pathname starts with one of these (empty = same origin). */
  includePathPrefixes: [] as string[],
  /** Skip URLs matching any of these regexes. */
  excludePatterns: [/\.(pdf|jpg|jpeg|png|svg|zip|docx?)$/i, /\/logout/i],
  /** Optional explicit URL list. When non-empty, crawling is skipped. */
  urls: [] as string[],

  viewports: {
    Desktop: { width: 1440, height: 900 },
    Mobile: { width: 390, height: 844 },
  } satisfies Record<ViewName, { width: number; height: number }>,

  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

  specs: [
    {
      component: "Header Logo",
      selector: "header img[src*='logo'], header .logo img, header img[alt*='Aptia' i]",
      width: { Desktop: 98, Mobile: 98 },
      alignment: { Desktop: "center", Mobile: "right" },
      href: "https://aptia-group.com/en-gb",
    },
    {
      component: "Footer Logo",
      selector: "footer img[src*='logo'], footer .logo img, footer img[alt*='Aptia' i]",
      width: { Desktop: 98, Mobile: 98 },
      alignment: { Desktop: "left", Mobile: "right" },
      href: null,
    },
    {
      component: "Privacy Notice",
      selector: "footer a[href*='privacy']",
      href: "https://aptia-group.com/en-gb/privacy-notice",
    },
    {
      component: "Cookie Notice",
      selector: "footer a[href*='cookie']",
      href: "https://aptia-group.com/en-gb/cookie-notice",
    },
  ] satisfies UiSpec[],
};
