# UI spec audit (Playwright)

Crawls every page of a site and asserts your UI specs at **Desktop** and **Mobile** viewports.

## Run

```bash
bun run audit          # run the audit
bun run audit:report   # open the HTML report
```

Outputs land in `audit-report/`:

- `audit.md` — the report table (Page URL | View | Component | Present | Width Correct | Alignment Correct | Hyperlink Status | Actual URL | Pass/Fail | Comments)
- `audit.csv` / `audit.json` — same data for spreadsheets / tooling
- Playwright HTML report with screenshots and traces for failures

The test fails when any spec is violated, so it can gate CI.

## Configure

Everything lives in `audit/audit.config.ts`:

- `baseUrl`, `useSitemap`, `maxPages`, `includePathPrefixes`, `excludePatterns` — page discovery
  (sitemap.xml first, then internal-link crawl). Set `urls: [...]` to skip crawling.
- `settleMs` — wait after load so SPA/hydrated content renders.
- `viewports` — Desktop / Mobile sizes.
- `specs[]` — one entry per audited element:
  - `selector` + `index` (`0` = first visible match, `-1` = last — handy when header and
    footer reuse the same markup)
  - `width` per view, with optional `widthTolerance`
  - `alignment` per view (`left` / `center` / `right`), measured against the viewport by
    default or the parent via `alignmentContainer: "parent"`, with `alignmentTolerance`
  - `href`: a URL (must link there), `null` (must NOT be hyperlinked), or omitted (not audited)
  - `required: false` to allow an element to be absent

## Note on browsers

The runner needs a Chromium build: `bunx playwright install chromium`.
