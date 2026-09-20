import { test, expect } from '@playwright/test';

/**
 * playground-supernova is the supernova recipe as a dev app: the starlight
 * docs site with a product landing page in front of it.
 *
 * The docs and blog halves are already covered by e2e/playground-starlight,
 * which runs the same files. This suite stays on what supernova adds — the
 * landing page — plus one check that the inherited half is still reachable.
 */

const PRERENDERED_ROUTES = [
  '/',
  '/docs/getting-started',
  '/blog',
  '/blog/welcome',
];

test('home renders the landing page, not the starlight splash', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('page-home:not([hidden]) .hero h1')).toContainText(
    'Say what your product does',
  );
});

test('home renders three feature rows and four cards', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('page-home:not([hidden]) .rows .row')).toHaveCount(3);
  await expect(page.locator('page-home:not([hidden]) litro-card')).toHaveCount(4);
});

test('home renders the shared starlight header', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('starlight-header').first()).toBeVisible();
});

test('docs page from the inherited starlight half renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  await expect(page.locator('page-docs-slug:not([hidden]) h1')).toContainText(
    'Getting Started',
  );
});

test('client navigation from the landing page to the blog works', async ({ page }) => {
  await page.goto('/');
  // The router swaps in a client element rather than hydrating in place, so
  // the visible server HTML has no handlers until it settles (TEST-001).
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  await page.locator('a[href="/blog"]').first().click();
  await page.waitForSelector('page-blog:not([hidden])');
  expect(page.url()).toContain('/blog');
});

/**
 * The landing page must read with JavaScript off. It is rendered on the
 * server, so this reads the server's HTML directly instead of asking a
 * browser, and nothing a client script does can make it pass.
 */
test('landing page copy is in the server HTML', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const body = await response.text();

  expect(body).toContain('Say what your product does, in one line.');
  expect(body).toContain('Name the first thing it does');
  expect(body).toContain('npm install playground-supernova');
  expect(body).toContain('/docs/getting-started');
});

test('all prerendered routes return 200', async ({ request }) => {
  for (const route of PRERENDERED_ROUTES) {
    const response = await request.get(route);
    expect(response.status(), `Expected 200 for ${route}`).toBe(200);
  }
});
