import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: { trace: 'on-first-retry' },
  projects: [
    {
      name: 'playground',
      testDir: './e2e/playground',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3030' },
    },
    {
      name: 'playground-11ty',
      testDir: './e2e/playground-11ty',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3031' },
    },
    {
      name: 'playground-starlight',
      testDir: './e2e/playground-starlight',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3032' },
    },
    {
      name: 'docs',
      testDir: './e2e/docs',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3033' },
    },
  ],
  webServer: [
    {
      name: 'playground',
      command: 'cd playground && node ../packages/framework/dist/cli/index.js dev --port 3030',
      url: 'http://localhost:3030',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'playground-11ty',
      command: 'cd playground-11ty && node ../packages/framework/dist/cli/index.js dev --port 3031',
      url: 'http://localhost:3031',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'playground-starlight',
      command: 'cd playground-starlight && node ../packages/framework/dist/cli/index.js dev --port 3032',
      url: 'http://localhost:3032',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'docs',
      command: 'cd docs && node ../packages/framework/dist/cli/index.js dev --port 3033',
      url: 'http://localhost:3033',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
