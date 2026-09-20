import { test, expect } from '@playwright/test';

const PRERENDERED_ROUTES = [
  '/',
  '/docs/getting-started',
  '/docs/installation',
  '/docs/configuration',
  '/docs/guides-first-page',
  '/docs/guides-deploying',
  '/blog',
  '/blog/welcome',
  '/blog/release-notes',
];

test('home renders page-home component', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('page-home')).toBeVisible();
});

test('home renders the landing page sections', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const root = page.locator('page-home');
  await expect(root.locator('.hero h1')).toBeVisible();
  await expect(root.locator('.rows .row')).toHaveCount(3);
  // Not an exact count: scaffolding without a blog drops the Blog card.
  expect(await root.locator('litro-card').count()).toBeGreaterThanOrEqual(3);
});

test('/docs/getting-started renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  await expect(page.locator('page-docs-slug')).toBeVisible();
});

/**
 * The landing page must read with JavaScript off. It is rendered on the
 * server, so every heading, paragraph, command and link is in the HTML the
 * server sends. This reads that HTML directly rather than through a browser,
 * so nothing a client script does can make the test pass.
 */
test('landing page copy is in the server HTML', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const body = await response.text();

  expect(body).toContain('Say what your product does, in one line.');
  expect(body).toContain('Name the first thing it does');
  expect(body).toContain('npm install');
  expect(body).toContain('/docs/getting-started');
});

test('all prerendered routes return 200', async ({ request }) => {
  for (const route of PRERENDERED_ROUTES) {
    const response = await request.get(route);
    expect(response.status(), `Expected 200 for ${route}`).toBe(200);
  }
});
