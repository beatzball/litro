import { test, expect } from '@playwright/test';

test('home renders page-home component', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('page-home')).toBeVisible();
});

test('blog index renders', async ({ page }) => {
  await page.goto('/blog');
  await page.waitForSelector('page-blog');
  await expect(page.locator('page-blog')).toBeVisible();
});

test('blog post renders with h1', async ({ page }) => {
  await page.goto('/blog/hello-world');
  await page.waitForSelector('page-blog-slug');
  await expect(page.locator('page-blog-slug h1')).toBeVisible();
});
