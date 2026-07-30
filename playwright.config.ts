import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./audit",
  snapshotPathTemplate: "audit/__screenshots__/{arg}{ext}",
  timeout: 0,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "audit-report", open: "never" }],
    ["json", { outputFile: "audit-report/results.json" }],
  ],
  use: {
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
