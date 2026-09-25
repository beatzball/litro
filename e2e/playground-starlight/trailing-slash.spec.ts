/**
 * Trailing slash and 404 status — issue 203.
 *
 * Two defects that only showed up together. The client router used a
 * `URLPattern` anchored to the exact pathname, and the scaffolded server
 * handler built a RegExp ending in `$` with no optional slash, so neither
 * matched `/docs/getting-started/`. On a static host the request still
 * answered 200 with every asset, because an SSG build writes
 * `docs/getting-started/index.html` — so the page arrived, the component was
 * never defined, and the recipe's `:not(:defined) { visibility: hidden }` rule
 * hid a document that was fully present in the DOM.
 *
 * Every route assertion in the suite used the canonical path, so none of them
 * could catch it. These request a page BOTH ways and compare.
 *
 * The second defect: the not-found branch set a body but never a status, so a
 * miss went out 200 OK.
 */

import { test, expect } from '@playwright/test';

const CANONICAL = '/docs/getting-started';

test('a static route renders the same with and without a trailing slash', async ({ page }) => {
  await page.goto('/docs');
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  const canonical = await page.locator('page-docs:not([hidden]) h1').textContent();

  await page.goto('/docs/');
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  await expect(page.locator('page-docs:not([hidden])')).toBeVisible();
  await expect(page.locator('page-docs:not([hidden]) h1')).toHaveText(canonical!.trim());
});

test('a dynamic route renders the same with and without a trailing slash', async ({ page }) => {
  await page.goto(CANONICAL);
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  const canonical = await page.locator('page-docs-slug:not([hidden]) h1').textContent();
  expect(canonical).toContain('Getting Started');

  await page.goto(`${CANONICAL}/`);
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  // Visibility is the assertion that matters: the whole document was in the
  // DOM before the fix too, hidden by the :not(:defined) rule.
  await expect(page.locator('page-docs-slug:not([hidden])')).toBeVisible();
  await expect(page.locator('page-docs-slug:not([hidden]) h1')).toHaveText(canonical!.trim());
});

test('the server answers a trailing-slash URL with the page, not a 404', async ({ page }) => {
  const res = await page.request.get(`${CANONICAL}/`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('Getting Started');
  expect(html).not.toContain('404');
});

test('a miss returns a real 404 status, not 200', async ({ page }) => {
  // The status is the assertion, not the body. This spec runs against both
  // `litro dev` (where the catch-all handler renders the 404 page) and
  // `litro preview` over the static build (where Nitro's own static handler
  // answers first, with a different body). Both must say 404.
  const res = await page.request.get('/no-such-page-at-all');
  expect(res.status()).toBe(404);
});

test('a miss with a trailing slash is also a 404', async ({ page }) => {
  const res = await page.request.get('/no-such-page-at-all/');
  expect(res.status()).toBe(404);
});
