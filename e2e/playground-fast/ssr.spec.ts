import { test, expect } from '@playwright/test';

test('home page SSR renders content without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Welcome to Litro (FAST)');
  await context.close();
});

test('home page SSR produces DSD shadow root markup', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();
  expect(body).toContain('shadowrootmode');
  expect(body).toContain('Welcome to Litro (FAST)');
  expect(body).toContain('<page-home');
});

test('home page SSR includes DSD polyfill', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();
  expect(body).toContain('attachShadow');
});

test('API route returns JSON', async ({ request }) => {
  const response = await request.get('/api/hello');
  const json = await response.json();
  expect(json).toHaveProperty('message');
  expect(json).toHaveProperty('timestamp');
});

test('about page renders DSD markup', async ({ request }) => {
  const response = await request.get('/about');
  const body = await response.text();
  expect(body).toContain('shadowrootmode');
  expect(body).toContain('FAST Element playground');
});
