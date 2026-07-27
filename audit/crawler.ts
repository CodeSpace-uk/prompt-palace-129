import type { Browser } from "@playwright/test";
import { auditConfig } from "./audit.config";

const { baseUrl, maxPages, excludePatterns, includePathPrefixes, useSitemap, userAgent } =
  auditConfig;

function allowed(url: string, origin: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.origin !== origin) return false;
  if (excludePatterns.some((re) => re.test(u.pathname))) return false;
  if (includePathPrefixes.length && !includePathPrefixes.some((p) => u.pathname.startsWith(p)))
    return false;
  return true;
}

function normalize(url: string): string {
  const u = new URL(url);
  u.hash = "";
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

/** Discover pages via sitemap.xml, then breadth-first internal link crawl. */
export async function discoverPages(browser: Browser): Promise<string[]> {
  if (auditConfig.urls.length) return auditConfig.urls.map(normalize);

  const origin = new URL(baseUrl).origin;
  const context = await browser.newContext({ userAgent, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const found = new Set<string>([normalize(baseUrl)]);

  if (useSitemap) {
    try {
      const res = await page.request.get(`${origin}/sitemap.xml`, { timeout: 20_000 });
      if (res.ok()) {
        const xml = await res.text();
        for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
          if (allowed(m[1], origin)) found.add(normalize(m[1]));
        }
      }
    } catch {
      /* sitemap unavailable — fall back to link crawl */
    }
  }

  const queue = [...found];
  const visited = new Set<string>();

  while (queue.length && found.size < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    } catch {
      continue;
    }

    const hrefs = await page.$$eval("a[href]", (as) =>
      as.map((a) => (a as HTMLAnchorElement).href),
    );
    for (const href of hrefs) {
      if (!allowed(href, origin)) continue;
      const n = normalize(href);
      if (found.has(n)) continue;
      found.add(n);
      queue.push(n);
      if (found.size >= maxPages) break;
    }
  }

  await context.close();
  return [...found].slice(0, maxPages);
}
