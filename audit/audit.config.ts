/**
 * Edit this file to point the audit at your site and describe your UI specs.
 * Everything else (crawling, viewport switching, reporting) is automatic.
 */

export type ViewName = "Desktop" | "Mobile";

export interface UiSpec {
  /** Human-readable component name shown in the report. */
  component: string;
  /** CSS selector for the element. */
  selector: string;
  /**
   * Which match to use among visible matches. 0 = first (default),
   * -1 = last. Useful when header and footer share the same markup.
   */
  index?: number;
  /** Alignment is measured inside the viewport (default) or the element's parent. */
  alignmentContainer?: "viewport" | "parent";
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
  /** Ms to wait after load for SPA/hydrated content to render. */
  settleMs: 4000,
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

  /** Visual regression snapshots (audit/__screenshots__). */
  visual: {
    enabled: true,
    /** Capture the whole scrollable page instead of just the viewport. */
    fullPage: true,
    /** Fraction of pixels allowed to differ before a snapshot fails. */
    maxDiffPixelRatio: 0.02,
    /** Elements hidden before capture (carousels, timestamps, cookie banners...). */
    maskSelectors: ["iframe", "video", "[id*='cookie' i]", "[class*='cookie' i]"],
    /** Extra CSS injected before capture (kills animations/caret flicker). */
    stabilizeCss:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  },

  /** SPA interaction checks. */
  interactions: {
    enabled: true,
    /** Mobile nav toggle. Tested at the Mobile viewport only. */
    mobileMenu: {
      toggleSelector:
        "button[aria-label*='menu' i], button[class*='burger' i], button[class*='hamburger' i], [class*='navbar-toggle' i], [class*='menu-toggle' i]",
      /** Panel expected to become visible after tapping the toggle. */
      panelSelector: "nav, [class*='nav-menu' i], [class*='mobile-menu' i], [role='navigation']",
    },
    /** Click internal links and assert client-side routing (no full reload). */
    routeTransitions: {
      enabled: true,
      /** Max internal links exercised per page. */
      linksPerPage: 3,
      /** Element that must survive a route change (shared shell). */
      persistentSelector: "img[src*='/document/']",
    },
  },

  specs: [
    {
      component: "Header Logo",
      // First visible brand-sized image on the page (site renders no <header> tag).
      selector: "img[src*='/document/'], header img, .logo img",
      index: 0,
      width: { Desktop: 98, Mobile: 98 },
      alignment: { Desktop: "center", Mobile: "right" },
      href: "https://aptia-group.com/en-gb",
    },
    {
      component: "Footer Logo",
      // Last visible brand image on the page.
      selector: "img[src*='/document/'], footer img, footer .logo img",
      index: -1,
      width: { Desktop: 98, Mobile: 98 },
      alignment: { Desktop: "left", Mobile: "right" },
      href: null,
    },
    {
      component: "Privacy Notice",
      selector: "a[href*='privacy']",
      href: "https://aptia-group.com/en-gb/privacy-notice",
    },
    {
      component: "Cookie Notice",
      selector: "a[href*='cookie']",
      href: "https://aptia-group.com/en-gb/cookie-notice",
    },
  ] satisfies UiSpec[],
};
