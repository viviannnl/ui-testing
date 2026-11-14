import { defineConfig } from "@playwright/test";

/**
 * UI test suite config (template from the ui-testing skill).
 *
 * EDIT the three marked values:
 *  1. PORT
 *  2. webServer.command — start the app in its DETERMINISTIC mode: pinned date,
 *     fixed data, offline/fake providers for anything that costs money.
 *  3. APP_SCRIPT_MATCH (in fixtures.ts env or here) — which script URLs count
 *     toward coverage.
 */
const PORT = Number(process.env.E2E_PORT ?? 8790); // 1. EDIT

process.env.APP_SCRIPT_MATCH ??= "/static/"; // 3. EDIT: regex matched against script URLs

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // a retry hides flakiness; fix the cause instead
  reporter: [["list"], ["html", { open: "never" }]],
  expect: {
    // 0.2% of pixels: absorbs sub-pixel anti-aliasing noise, still fails on a
    // changed colour, border or spacing anywhere visible.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome", // installed Google Chrome; no browser download
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      // Small screens run only specs tagged @responsive (layout, visual, a11y, edge).
      name: "mobile",
      grep: /@responsive/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: `echo "EDIT webServer.command in playwright.config.ts" && exit 1`, // 2. EDIT, e.g. `cd .. && APP_TODAY=2026-11-25 python -m app serve --port ${PORT}`
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false, // a fresh server per run keeps state deterministic
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30_000,
  },
});
