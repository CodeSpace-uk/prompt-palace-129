import { mkdirSync, writeFileSync } from "node:fs";

export type Row = {
  page: string;
  view: "Desktop" | "Mobile";
  component: string;
  present: "Yes" | "No";
  widthCorrect: string;
  alignmentCorrect: string;
  hyperlink: string;
  actualUrl: string;
  result: "Pass" | "Fail";
  comments: string;
};

export const HEADER = [
  "Page URL",
  "View",
  "Component",
  "Present",
  "Width Correct",
  "Alignment Correct",
  "Hyperlink Status",
  "Actual URL",
  "Pass/Fail",
  "Comments",
];

const cells = (r: Row) => [
  r.page,
  r.view,
  r.component,
  r.present,
  r.widthCorrect,
  r.alignmentCorrect,
  r.hyperlink,
  r.actualUrl,
  r.result,
  r.comments,
];

/** Writes <name>.json/.csv/.md into audit-report/. */
export function writeReport(name: string, rows: Row[]) {
  mkdirSync("audit-report", { recursive: true });
  writeFileSync(`audit-report/${name}.json`, JSON.stringify(rows, null, 2));
  writeFileSync(
    `audit-report/${name}.csv`,
    [
      HEADER.join(","),
      ...rows.map((r) =>
        cells(r)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n"),
  );
  writeFileSync(
    `audit-report/${name}.md`,
    [
      `| ${HEADER.join(" | ")} |`,
      `| ${HEADER.map(() => "---").join(" | ")} |`,
      ...rows.map((r) => `| ${cells(r).join(" | ")} |`),
    ].join("\n"),
  );
}
