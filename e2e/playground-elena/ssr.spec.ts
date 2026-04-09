import { test, expect } from '@playwright/test';

test('home page SSR renders content without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Welcome to Litro (Elena)');
  await context.close();
});

test('home page SSR produces light DOM HTML (no DSD)', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();
  // Elena renders light DOM — no Declarative Shadow DOM wrappers
  expect(body).not.toContain('shadowrootmode');
  expect(body).toContain('Welcome to Litro (Elena)');
  // Component output is plain HTML inside the custom element tag
  expect(body).toContain('<page-home');
  expect(body).toContain('<h1>');
});

test('home page SSR does NOT include DSD polyfill', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();
  // The DSD polyfill script checks for shadowrootmode support — should be absent
  expect(body).not.toContain('attachShadow');
});

test('API route returns JSON', async ({ request }) => {
  const response = await request.get('/api/hello');
  const json = await response.json();
  expect(json).toHaveProperty('message');
  expect(json).toHaveProperty('timestamp');
});

test('about page renders light DOM HTML', async ({ request }) => {
  const response = await request.get('/about');
  const body = await response.text();
  expect(body).not.toContain('shadowrootmode');
  expect(body).toContain('Elena playground');
});
