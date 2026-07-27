export type AuditRow = {
  page: string;
  view: "Desktop" | "Mobile";
  component: string;
  present: string;
  widthCorrect: string;
  alignmentCorrect: string;
  hyperlink: string;
  actualUrl: string;
  result: "Pass" | "Fail";
  comments: string;
};

export async function fetchAuditRows(): Promise<AuditRow[]> {
  const res = await fetch(`/audit-report/audit.json?t=${Date.now()}`);
  if (!res.ok) throw new Error("No audit report found. Run `bun run audit` first.");
  return (await res.json()) as AuditRow[];
}

export type Stats = { total: number; pass: number; fail: number; rate: number };

export function summarize(rows: AuditRow[]): Stats {
  const pass = rows.filter((r) => r.result === "Pass").length;
  const total = rows.length;
  return { total, pass, fail: total - pass, rate: total ? (pass / total) * 100 : 0 };
}

export function groupBy<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()];
}

export function shortPath(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "/" : u.pathname;
  } catch {
    return url;
  }
}
