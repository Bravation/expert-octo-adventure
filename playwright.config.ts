import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Lovable share-button e2e tests.
 *
 * Run with: npx playwright test
 * Install browsers first: npx playwright install
 *
 * Override the base URL for the running preview/dev server with PLAYWRIGHT_BASE_URL.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Auto-grant clipboard so navigator.clipboard.writeText works
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
});