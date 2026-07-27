import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchAuditRows,
  groupBy,
  shortPath,
  summarize,
  type AuditRow,
} from "@/lib/audit-data";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "UI Spec Audit Dashboard — Pass/Fail by Page & Viewport" },
      {
        name: "description",
        content:
          "Live dashboard of Playwright UI spec audit results: pass and fail rates broken down by page, viewport and component.",
      },
      { property: "og:title", content: "UI Spec Audit Dashboard" },
      {
        property: "og:description",
        content: "Live pass/fail rates by page and viewport from the Playwright UI audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function RateBar({ pass, total }: { pass: number; total: number }) {
  const pct = total ? (pass / total) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          backgroundColor:
            pct === 100 ? "var(--chart-2)" : pct >= 50 ? "var(--chart-4)" : "var(--destructive)",
        }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          tone === "bad" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Breakdown({ title, rows, keyFn }: { title: string; rows: AuditRow[]; keyFn: (r: AuditRow) => string }) {
  const groups = groupBy(rows, keyFn).sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="mt-4 space-y-4">
        {groups.map(([name, group]) => {
          const s = summarize(group);
          return (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="truncate font-medium text-foreground">{name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {s.pass}/{s.total} · {s.rate.toFixed(0)}%
                </span>
              </div>
              <div className="mt-2">
                <RateBar pass={s.pass} total={s.total} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Dashboard() {
  const [onlyFails, setOnlyFails] = useState(false);
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["audit-rows"],
    queryFn: fetchAuditRows,
    refetchInterval: 5000,
  });

  const rows = useMemo(() => data ?? [], [data]);
  const overall = summarize(rows);
  const matrix = useMemo(() => {
    const pages = [...new Set(rows.map((r) => r.page))].sort();
    const views = [...new Set(rows.map((r) => r.view))];
    return { pages, views };
  }, [rows]);

  const tableRows = onlyFails ? rows.filter((r) => r.result === "Fail") : rows;

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              UI Spec Audit Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pass/fail rates by page and viewport · auto-refreshing every 5s
              {dataUpdatedAt ? ` · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyFails}
              onChange={(e) => setOnlyFails(e.target.checked)}
              className="size-4 accent-[var(--destructive)]"
            />
            Failures only
          </label>
        </header>

        {isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading audit results…</p>}
        {error && (
          <p className="mt-10 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}

        {!isLoading && !error && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Checks" value={String(overall.total)} />
              <Stat label="Passing" value={String(overall.pass)} />
              <Stat label="Failing" value={String(overall.fail)} tone="bad" />
              <Stat label="Pass rate" value={`${overall.rate.toFixed(1)}%`} />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Breakdown title="By viewport" rows={rows} keyFn={(r) => r.view} />
              <Breakdown title="By component" rows={rows} keyFn={(r) => r.component} />
              <Breakdown title="By page" rows={rows} keyFn={(r) => shortPath(r.page)} />
            </div>

            <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-5 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Page × viewport matrix
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-5 py-2 font-medium">Page</th>
                      {matrix.views.map((v) => (
                        <th key={v} className="px-5 py-2 font-medium">
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.pages.map((p) => (
                      <tr key={p} className="border-b border-border last:border-0">
                        <td className="px-5 py-3 font-medium text-foreground">{shortPath(p)}</td>
                        {matrix.views.map((v) => {
                          const s = summarize(rows.filter((r) => r.page === p && r.view === v));
                          return (
                            <td key={v} className="px-5 py-3 tabular-nums">
                              <span
                                className={
                                  s.fail ? "text-destructive" : "text-foreground"
                                }
                              >
                                {s.pass}/{s.total} ({s.rate.toFixed(0)}%)
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
              <h2 className="border-b border-border px-5 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Detail ({tableRows.length} checks)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {["Page", "View", "Component", "Result", "Actual URL", "Comments"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-5 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0 align-top">
                        <td className="px-5 py-3 text-foreground">{shortPath(r.page)}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.view}</td>
                        <td className="px-5 py-3 text-muted-foreground">{r.component}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.result === "Pass"
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {r.result}
                          </span>
                        </td>
                        <td className="max-w-[18rem] truncate px-5 py-3 text-muted-foreground">
                          {r.actualUrl}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{r.comments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
