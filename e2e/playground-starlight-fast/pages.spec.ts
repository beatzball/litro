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
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('page-home:not([hidden]) h1')).toContainText('playground-starlight-fast');
});

test('home page renders starlight-header', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('starlight-header').first()).toBeVisible();
});

test('home page renders feature cards', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const cards = page.locator('litro-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBe(4);
});

test('feature card renders icon and title inline', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  // card-header lives inside litro-card's shadow root
  const hasCardHeader = await page.locator('litro-card').first().evaluate(
    (el) => !!el.shadowRoot?.querySelector('.card-header'),
  );
  expect(hasCardHeader).toBe(true);
});

test('docs getting-started page renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  await expect(page.locator('page-docs-slug:not([hidden]) h1')).toContainText('Getting Started');
});

test('blog index renders', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForSelector('page-blog:not([hidden])');
  await expect(page.locator('page-blog:not([hidden]) h1')).toBeVisible();
});

test('blog post renders', async ({ page }) => {
  await page.goto('/blog/welcome');
  await page.waitForSelector('page-blog-slug:not([hidden])');
  await expect(page.locator('page-blog-slug:not([hidden]) h1')).toContainText('Welcome');
});

test('blog post renders Markdown body content', async ({ page }) => {
  await page.goto('/blog/welcome');
  await page.waitForSelector('page-blog-slug:not([hidden])');
  // Markdown body is rendered via :innerHTML — verify paragraphs exist
  const paragraphs = page.locator('page-blog-slug:not([hidden]) p');
  await expect(paragraphs.first()).toBeVisible();
  expect(await paragraphs.count()).toBeGreaterThan(0);
});

test('docs page renders Markdown body content', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  const paragraphs = page.locator('page-docs-slug:not([hidden]) p');
  await expect(paragraphs.first()).toBeVisible();
  expect(await paragraphs.count()).toBeGreaterThan(0);
});

test('docs page applies syntax highlighting to code blocks', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  // applyHighlighting replaces language-* class with hljs class
  const highlighted = page.locator('page-docs-slug:not([hidden]) code.hljs');
  await expect(highlighted.first()).toBeVisible();
});

test('docs page renders prev/next navigation', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  // getting-started is the first doc — should have a "next" link but no "prev"
  const navLinks = page.locator('page-docs-slug:not([hidden]) nav[aria-label="Previous and next pages"] a');
  await expect(navLinks.first()).toBeVisible();
});

test('docs page renders sidebar with current page highlighted', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('starlight-sidebar');
  const currentLink = page.locator('starlight-sidebar a[aria-current="page"]');
  await expect(currentLink).toBeVisible();
  await expect(currentLink).toContainText('Getting Started');
});

test('tag page renders filtered posts', async ({ page }) => {
  await page.goto('/blog/tags/welcome');
  await page.waitForSelector('page-blog-tags-tag:not([hidden])');
  await expect(page.locator('page-blog-tags-tag:not([hidden]) h1')).toContainText('#welcome');
  // Should list at least one post with the "welcome" tag
  const posts = page.locator('page-blog-tags-tag:not([hidden]) ul li');
  await expect(posts.first()).toBeVisible();
});

test('page components have DSD shadow roots', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const hasShadow = await page.locator('page-home:not([hidden])').evaluate(
    (el) => !!el.shadowRoot,
  );
  expect(hasShadow).toBe(true);
});

test('SPA navigation works between pages', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');

  // Navigate to blog via a link click
  const blogLink = page.locator('a[href="/blog"]').first();
  await blogLink.click();
  await page.waitForSelector('page-blog:not([hidden])');
  await expect(page.locator('page-blog:not([hidden]) h1')).toBeVisible();

  // URL should have changed without a full reload
  expect(page.url()).toContain('/blog');
});

test('all prerendered routes return 200', async ({ request }) => {
  for (const route of PRERENDERED_ROUTES) {
    const response = await request.get(route);
    expect(response.status(), `Expected 200 for ${route}`).toBe(200);
  }
});
