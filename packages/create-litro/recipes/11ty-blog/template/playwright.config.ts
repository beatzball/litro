import { defineConfig, devices } from '@playwright/test';

// Deliberately not 3000. That port is commonly held by something else on a
// developer machine, and `litro dev` will quietly move to the next free one --
// leaving the suite pointed at a stranger's server. Override with LITRO_E2E_PORT.
const PORT = Number(process.env.LITRO_E2E_PORT ?? 4321);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never reuse. If an unrelated app is already listening here, reuse would
    // run the whole suite against it and report confusing 404s instead of
    // starting the app under test.
    reuseExistingServer: false,
    timeout: 60000,
  },
});
