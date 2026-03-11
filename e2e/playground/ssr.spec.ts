import { test, expect } from '@playwright/test';

test('home page SSR renders content without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Welcome to Litro');
  await context.close();
});

test('home page contains DSD shadow root markup in HTML source', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();
  expect(body).toContain('shadowrootmode');
  expect(body).toContain('Welcome to Litro');
});

test('API route returns JSON', async ({ request }) => {
  const response = await request.get('/api/hello');
  const json = await response.json();
  expect(json).toHaveProperty('message');
  expect(json).toHaveProperty('timestamp');
});

test('dynamic route renders DSD markup', async ({ request }) => {
  const response = await request.get('/blog/hello-world');
  const body = await response.text();
  expect(body).toContain('shadowrootmode');
});
