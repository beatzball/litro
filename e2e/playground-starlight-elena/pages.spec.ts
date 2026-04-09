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
  '/blog/tags/welcome',
  '/blog/tags/release',
];

test('home page renders site title in h1', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('page-home h1')).toContainText('playground-starlight-elena');
});

test('home page renders header with nav links', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  // Elena light DOM — nav links are directly queryable
  const navLink = page.locator('page-home a[href="/docs/getting-started"]');
  await expect(navLink.first()).toBeVisible();
});

test('home page renders feature cards', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  // Cards are rendered inline in Elena (not as child custom elements)
  const cards = page.locator('page-home .feature-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBe(4);
});

test('docs getting-started page renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  await expect(page.locator('page-docs-slug h1').first()).toContainText('Getting Started');
});

test('blog index renders', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForSelector('page-blog');
  await expect(page.locator('page-blog h1')).toBeVisible();
});

test('blog post renders', async ({ page }) => {
  await page.goto('/blog/welcome');
  await page.waitForSelector('page-blog-slug');
  await expect(page.locator('page-blog-slug h1').first()).toContainText('Welcome');
});

test('blog post renders Markdown body content', async ({ page }) => {
  await page.goto('/blog/welcome');
  await page.waitForSelector('page-blog-slug');
  const paragraphs = page.locator('page-blog-slug p');
  await expect(paragraphs.first()).toBeVisible();
  expect(await paragraphs.count()).toBeGreaterThan(0);
});

test('docs page renders Markdown body content', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  const paragraphs = page.locator('page-docs-slug p');
  await expect(paragraphs.first()).toBeVisible();
  expect(await paragraphs.count()).toBeGreaterThan(0);
});

test('docs page applies syntax highlighting to code blocks', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  const highlighted = page.locator('page-docs-slug code.hljs');
  await expect(highlighted.first()).toBeVisible();
});

test('docs page renders prev/next navigation', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  const navLinks = page.locator('page-docs-slug nav[aria-label="Previous and next pages"] a');
  await expect(navLinks.first()).toBeVisible();
});

test('docs page renders sidebar with current page highlighted', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  // Elena light DOM — sidebar links are directly in the page
  const currentLink = page.locator('page-docs-slug .sb-nav a[aria-current="page"]');
  await expect(currentLink.first()).toBeVisible();
  await expect(currentLink.first()).toContainText('Getting Started');
});

test('tag page renders filtered posts', async ({ page }) => {
  await page.goto('/blog/tags/welcome');
  await page.waitForSelector('page-blog-tags-tag');
  await expect(page.locator('page-blog-tags-tag h1')).toContainText('#welcome');
  const posts = page.locator('page-blog-tags-tag ul li');
  await expect(posts.first()).toBeVisible();
});

test('page components use light DOM (no shadow root)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const hasShadow = await page.locator('page-home').evaluate(
    (el) => !!el.shadowRoot,
  );
  expect(hasShadow).toBe(false);
});

test('page HTML contains @scope CSS', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  const hasScope = await page.locator('page-docs-slug style').evaluate(
    (el) => el.textContent?.includes('@scope') ?? false,
  );
  expect(hasScope).toBe(true);
});

test('SPA navigation works between pages', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');

  const blogLink = page.locator('a[href="/blog"]').first();
  await blogLink.click();
  await page.waitForSelector('page-blog');
  await expect(page.locator('page-blog h1')).toBeVisible();

  expect(page.url()).toContain('/blog');
});

test('all prerendered routes return 200', async ({ request }) => {
  for (const route of PRERENDERED_ROUTES) {
    const response = await request.get(route);
    expect(response.status(), `Expected 200 for ${route}`).toBe(200);
  }
});
