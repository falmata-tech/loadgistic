import { defineConfig, devices } from '@playwright/test';

const localBrowserBaseUrl = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || localBrowserBaseUrl,
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
