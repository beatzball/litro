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

test('home page renders site title in h1', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('page-home h1')).toContainText('playground-starlight');
});

test('home page renders starlight-header', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('starlight-header')).toBeVisible();
});

test('home page renders feature cards', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const cards = page.locator('litro-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBe(4);
});

test('feature card renders icon and title inline', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  // card-header lives inside litro-card's shadow root
  const hasCardHeader = await page.locator('litro-card').first().evaluate(
    (el) => !!el.shadowRoot?.querySelector('.card-header'),
  );
  expect(hasCardHeader).toBe(true);
});

test('docs getting-started page renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  await expect(page.locator('page-docs-slug h1')).toContainText('Getting Started');
});

test('blog index renders', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForSelector('page-blog');
  await expect(page.locator('page-blog h1')).toBeVisible();
});

test('blog post renders', async ({ page }) => {
  await page.goto('/blog/welcome');
  await page.waitForSelector('page-blog-slug');
  await expect(page.locator('page-blog-slug h1')).toContainText('Welcome');
});

test('all prerendered routes return 200', async ({ request }) => {
  for (const route of PRERENDERED_ROUTES) {
    const response = await request.get(route);
    expect(response.status(), `Expected 200 for ${route}`).toBe(200);
  }
});
