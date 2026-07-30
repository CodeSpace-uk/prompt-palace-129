# UI audit suite (Playwright)

Crawls every page of a site and runs three audits at **Desktop** and **Mobile** viewports:

1. **Spec assertions** (`ui-spec.audit.spec.ts`) - presence, width, alignment, hyperlinks.
2. **Visual regression** (`visual.audit.spec.ts`) - pixel snapshots vs. committed baselines.
3. **SPA interactions** (`interaction.audit.spec.ts`) - mobile menu toggle, client-side route
   transitions, shared-shell persistence, destination content.

## Run

```bash
bun run audit                 # all three audits
bun run audit:spec            # spec assertions only
bun run audit:visual          # visual regression only
bun run audit:visual:update   # accept current pixels as the new baseline
bun run audit:interactions    # interaction tests only
bun run audit:report          # open the HTML report
```

Outputs land in `audit-report/` as `audit.*`, `visual.*`, `interactions.*`
(`.md` table | `.csv` | `.json`), plus the Playwright HTML report with screenshots,
diff images and traces. Every run republishes the merged rows to
`public/audit-report/audit.json`, which feeds the live dashboard at `/`.

Baselines live in `audit/__screenshots__/` - commit them so diffs are meaningful.

Each test fails when a check is violated, so the suite can gate CI.

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


- `visual` - `enabled`, `fullPage`, `maxDiffPixelRatio`, `maskSelectors` (dynamic regions to hide),
  `stabilizeCss` (kills animations before capture).
- `interactions` - `mobileMenu.toggleSelector` / `panelSelector`, and
  `routeTransitions.linksPerPage` / `persistentSelector` (the shared shell element that must
  survive a route change).

## Note on browsers

The runner needs a Chromium build: `bunx playwright install chromium`.
