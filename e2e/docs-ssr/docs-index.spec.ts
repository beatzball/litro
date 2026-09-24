import { test, expect } from '@playwright/test';

/**
 * /docs is the section landing page.
 *
 * It exists because /docs used to be a 404 — only /docs/<slug> did. A reader
 * who types the obvious path, or trims a URL back one segment, must land on
 * something. These checks guard the page and the server HTML behind it.
 *
 * NOT checked here: that the links work with JavaScript off. CONTENT-007 makes
 * <litro-link> a deliberate docs-ssr-only difference, and <litro-link> gets no
 * shadow root on the server, so its inner <a> never reaches the HTML. An
 * assertion on `href="/docs/introduction"` would match <litro-link>'s OWN
 * attribute and pass whether or not a browser could follow it. That gap is
 * site-wide and pre-existing — issue 198 tracks it. The static docs/ build uses
 * plain <a href> and e2e/docs/docs-index.spec.ts checks it there.
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

test('the server renders the groups and their labels into the HTML', async ({ request }) => {
  const response = await request.get('/docs');
  expect(response.status()).toBe(200);
  const body = await response.text();

  // page-docs is server-rendered into a declarative shadow root, so its group
  // sections and headings are in the HTML before any client JavaScript runs.
  // Strip the tags: every label below has to survive as visible TEXT, which is
  // what fails if the page's registration is tree-shaken out of the server
  // bundle and the element is printed unexpanded.
  expect(body).toContain('shadowrootmode');
  const visible = body.replace(/<!--.*?-->/gs, '').replace(/<[^>]*>/g, ' ');
  for (const label of ['Getting Started', 'Core Concepts', 'Introduction', 'Data Fetching']) {
    expect(visible, `missing "${label}" in the server HTML`).toContain(label);
  }

  // More than one group section, so a page that renders a single empty shell
  // cannot pass.
  const groupCount = (body.match(/class="doc-group"/g) ?? []).length;
  expect(groupCount).toBeGreaterThan(1);
});
