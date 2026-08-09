// Playwright config — Chromium only, run serially, against a freshly started
// server so no stale bundle is served. Issue #46's e2e proof (cups-solo) drives
// real pointer input through all ten levels of Follow the Cup.
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 3210;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Real UI flows are timing-sensitive; give each spec room but not forever.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Serial: one browser, one worker, no shared-server races.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start the real app fresh so we never test an old bundle. reuseExistingServer
  // is off in CI to guarantee a clean process.
  webServer: {
    command: `node server/index.js`,
    env: { PORT: String(PORT) },
    url: BASE_URL + '/healthz',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
