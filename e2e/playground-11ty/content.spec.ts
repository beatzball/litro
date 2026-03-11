import { test, expect } from '@playwright/test';

test('home page renders site title', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('page-home h1')).toContainText('playground-11ty');
});

test('home page lists recent posts', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const items = page.locator('page-home ul li');
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  // At least one post should mention "Hello"
  const texts = await items.allTextContents();
  expect(texts.some(t => t.toLowerCase().includes('hello'))).toBe(true);
});

test('blog index renders', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForSelector('page-blog');
  await expect(page.locator('page-blog h1')).toContainText('Blog');
});

test('blog post renders title', async ({ page }) => {
  await page.goto('/blog/hello-world');
  await page.waitForSelector('page-blog-slug');
  await expect(page.locator('page-blog-slug h1')).toBeVisible();
});

test('blog post has rendered HTML body', async ({ page }) => {
  await page.goto('/blog/hello-world');
  await page.waitForSelector('page-blog-slug');
  // The post body is inside shadow DOM — use evaluate to reach shadow root text
  const text = await page.locator('page-blog-slug').evaluate(
    el => (el.shadowRoot?.textContent ?? '').trim(),
  );
  expect(text.length).toBeGreaterThan(0);
});

test('tags page renders filtered posts', async ({ page }) => {
  await page.goto('/tags/welcome');
  await page.waitForSelector('page-tags-tag');
  // Should show at least one post link
  const links = page.locator('page-tags-tag a[href*="/blog/"]');
  await expect(links.first()).toBeVisible();
});

test('DSD markup on blog post route', async ({ request }) => {
  const response = await request.get('/blog/hello-world');
  const body = await response.text();
  expect(body).toContain('shadowrootmode');
});
