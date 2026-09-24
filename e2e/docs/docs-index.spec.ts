import { test, expect } from '@playwright/test';
import { docGroupSections, docGroupText } from '../_shared/docs-index-html.js';

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
  // Scoped to the index list: a Playwright CSS selector pierces shadow roots,
  // so an unscoped a[href="/docs/introduction"] matches the sidebar's copy too.
  const link = page.locator('page-docs:not([hidden]) .doc-group a[href="/docs/introduction"]');
  await expect(link.first()).toBeVisible();
});

test('the server HTML carries the links, so /docs works with no JavaScript', async ({ request }) => {
  const response = await request.get('/docs');
  expect(response.status()).toBe(200);
  const body = await response.text();

  // Everything below is read out of the index's OWN <section class="doc-group">
  // blocks. The sidebar renders on /docs too and emits the same
  // <a href="/docs/<slug>"> links, and the __litro_data__ script repeats every
  // label as JSON text, so a check against the whole body passes on a page
  // whose group list rendered nothing.
  const sections = docGroupSections(body);
  expect(sections.length, 'no doc-group sections in the server HTML').toBeGreaterThan(1);
  expect(sections.join(' ')).toContain('href="/docs/introduction"');

  const text = docGroupText(body);
  for (const label of ['Getting Started', 'Introduction']) {
    expect(text, `missing "${label}" in the index list`).toContain(label);
  }
});
