import { test, expect } from '@playwright/test';
import { docGroupSections, docGroupText } from '../_shared/docs-index-html.js';

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
  // Scoped to the index list: a Playwright CSS selector pierces shadow roots,
  // so an unscoped [href="/docs/introduction"] matches the sidebar's copy too.
  const link = page.locator('page-docs:not([hidden]) .doc-group litro-link[href="/docs/introduction"]');
  await expect(link.first()).toBeVisible();
});

test('the server renders the groups and their labels into the HTML', async ({ request }) => {
  const response = await request.get('/docs');
  expect(response.status()).toBe(200);
  const body = await response.text();

  // page-docs is server-rendered into a declarative shadow root, so its group
  // sections and headings are in the HTML before any client JavaScript runs.
  expect(body).toContain('shadowrootmode');

  // More than one <section class="doc-group">. This is the assertion that
  // fails when the page's registration is tree-shaken out of the server
  // bundle and the element is printed unexpanded: no groups are emitted at
  // all. It is also the only one an empty group list cannot satisfy.
  const sections = docGroupSections(body);
  expect(sections.length, 'no doc-group sections in the server HTML').toBeGreaterThan(1);

  // The labels have to survive as visible TEXT inside those sections. Read
  // from the sections, not the whole body: the sidebar carries every label
  // too, and so does the __litro_data__ script, whose JSON is text once the
  // tags are stripped.
  const visible = docGroupText(body);
  for (const label of ['Getting Started', 'Core Concepts', 'Introduction', 'Data Fetching']) {
    expect(visible, `missing "${label}" in the index list`).toContain(label);
  }
});
