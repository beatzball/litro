import { test, expect } from '@playwright/test';

test('server data is visible in SSR output (curl test)', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();
  // The __litro_data__ script tag should be in the HTML
  expect(body).toContain('__litro_data__');
  // The server data JSON should contain our message
  expect(body).toContain('Hello from the server');
});

test('home page displays server data after hydration', async ({ page }) => {
  await page.goto('/');
  // Wait for Lit hydration to complete. Use :not([hidden]) to target the
  // visible element — the router's pre-render swap briefly creates a hidden
  // duplicate alongside the SSR'd original before swapping.
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('page-home:not([hidden])')).toContainText('Hello');
});

test('dynamic slug injected into __litro_data__', async ({ request }) => {
  const response = await request.get('/blog/hello-world');
  const body = await response.text();
  expect(body).toContain('__litro_data__');
  expect(body).toContain('"slug"');
});

test('blog post renders slug after hydration', async ({ page }) => {
  await page.goto('/blog/hello-world');
  await page.waitForSelector('page-blog-slug:not([hidden])');
  await expect(page.locator('page-blog-slug:not([hidden])')).toContainText('hello-world');
});
