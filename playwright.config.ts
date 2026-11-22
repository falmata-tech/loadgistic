import { defineConfig, devices } from '@playwright/test';

const localBrowserBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: localBrowserBaseUrl,
    // The test fixture routes browser requests to attach local-only rate-limit
    // identities. Chromium otherwise attributes a redirected GET handled by
    // the worker to the original POST, hiding the actual 303 from Playwright.
    // The PWA suite exercises the service worker with its own opt-in.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : {
    command: 'npm run test:e2e:server',
    url: `${localBrowserBaseUrl}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ]
});
