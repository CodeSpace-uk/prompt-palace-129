// Merges every audit report into public/audit-report/audit.json for the live dashboard.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const parts = ["audit", "visual", "interactions"];
const rows = [];

for (const name of parts) {
  const file = `audit-report/${name}.json`;
  if (!existsSync(file)) continue;
  try {
    rows.push(...JSON.parse(readFileSync(file, "utf8")));
  } catch {
    console.warn(`skipped unreadable ${file}`);
  }
}

mkdirSync("public/audit-report", { recursive: true });
writeFileSync("public/audit-report/audit.json", JSON.stringify(rows, null, 2));
console.log(`published ${rows.length} rows to public/audit-report/audit.json`);
