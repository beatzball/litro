import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
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
    {
      name: 'playground-fast',
      testDir: './e2e/playground-fast',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3038' },
    },
    {
      name: 'playground-starlight-fast',
      testDir: './e2e/playground-starlight-fast',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3035' },
    },
    {
      name: 'playground-elena',
      testDir: './e2e/playground-elena',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3036' },
    },
    {
      name: 'playground-starlight-elena',
      testDir: './e2e/playground-starlight-elena',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3037' },
    },
    {
      name: 'docs-ssr',
      testDir: './e2e/docs-ssr',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3034' },
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
    {
      name: 'playground-fast',
      command: 'cd playground-fast && node ../packages/framework/dist/cli/index.js dev --port 3038',
      url: 'http://localhost:3038',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'playground-starlight-fast',
      command: 'cd playground-starlight-fast && node ../packages/framework/dist/cli/index.js dev --port 3035',
      url: 'http://localhost:3035',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'playground-elena',
      command: 'cd playground-elena && node ../packages/framework/dist/cli/index.js dev --port 3036',
      url: 'http://localhost:3036',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'playground-starlight-elena',
      command: 'cd playground-starlight-elena && node ../packages/framework/dist/cli/index.js dev --port 3037',
      url: 'http://localhost:3037',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      name: 'docs-ssr',
      command: 'cd docs-ssr && node ../packages/framework/dist/cli/index.js dev --port 3034',
      url: 'http://localhost:3034',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
