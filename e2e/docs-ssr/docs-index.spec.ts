import { test, expect } from '@playwright/test';

/**
 * /docs is the section landing page.
 *
 * It exists because /docs used to be a 404 — only /docs/<slug> did. A reader
 * who types the obvious path, or trims a URL back one segment, must land on
 * something. These checks guard the page and, with the no-JavaScript one
 * below, the server HTML a static host serves.
 */

test('/docs returns 200 and renders the docs landing page', async ({ page }) => {
  const response = await page.goto('/docs');
  expect(response?.status()).toBe(200);
  await page.waitForSelector('page-docs:not([hidden])');
  await expect(page.locator('page-docs:not([hidden])')).toBeVisible();
});

test('/docs lists every sidebar group as a section', async ({ page }) => {
  await page.goto('/docs');
  await page.waitForSelector('page-docs:not([hidden])');
  const groups = page.locator('page-docs:not([hidden]) .doc-group');
  expect(await groups.count()).toBeGreaterThan(1);
  await expect(groups.first().locator('h2')).toBeVisible();
});

test('/docs links to the first doc page', async ({ page }) => {
  await page.goto('/docs');
  await page.waitForSelector('page-docs:not([hidden])');
  const link = page.locator('page-docs:not([hidden]) litro-link[href="/docs/introduction"]');
  await expect(link.first()).toBeVisible();
});

test('the server HTML carries the links, so /docs works with no JavaScript', async ({ request }) => {
  const response = await request.get('/docs');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('href="/docs/introduction"');
  expect(body).toContain('Documentation');
});
