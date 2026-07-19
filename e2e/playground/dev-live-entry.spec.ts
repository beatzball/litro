import { test, expect } from '@playwright/test';

/**
 * Regression for issue #97 — `litro dev` must serve the LIVE client entry
 * through Vite, never the stale pre-built `dist/client/app.js`.
 *
 * These tests run against the dev server (playwright `webServer` = `litro dev`).
 * On the old behavior the HTML shell referenced `/_litro/app.js`, which Nitro's
 * `publicAssets` static handler served from a pre-built bundle — so source edits
 * to `app.ts` never reflected in the browser. Each assertion below FAILS on that
 * old behavior.
 */

/** Marker only present in Vite's PRODUCTION bundle (the stale-bundle tell). */
const BUILT_BUNDLE_MARKER = '__vite__mapDeps';

function extractAppScriptSrc(html: string): string {
  const match = html.match(/<script type="module" src="([^"]+)"><\/script>/);
  if (!match) throw new Error('no module entry <script> found in shell');
  return match[1];
}

test('dev shell references a root-relative source entry, not /_litro/app.js', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const src = extractAppScriptSrc(html);
  // Dev must NOT point at the /_litro/ static mount (that path serves the stale
  // pre-built bundle). It should reference the root-relative `.ts` source entry.
  expect(src).not.toBe('/_litro/app.js');
  expect(src).toMatch(/\/app\.ts(\?.*)?$/);
});

test('dev client entry is served as live Vite source, not the built bundle', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const src = extractAppScriptSrc(html);

  const res = await request.get(src);
  expect(res.status()).toBe(200);
  const body = await res.text();

  // Live, Vite-transformed source: no production-bundle marker, and imports are
  // rewritten to Vite's dev module URLs (`/@fs/…`, `/@vite/…`, `/node_modules/…`).
  expect(body).not.toContain(BUILT_BUNDLE_MARKER);
  expect(body).toMatch(/\/(@fs|@vite|@id|node_modules)\//);
});

test('dev client entry transitive imports resolve (live module graph)', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const entry = await (await request.get(extractAppScriptSrc(html))).text();

  // The live entry's imports are rewritten to Vite dev module URLs. Pick the
  // first one and confirm it resolves — proving the whole graph is served live
  // (on the old behavior these `/_litro/`-prefixed URLs 404'd and the browser
  // fell back to the stale built bundle).
  const firstImport = entry.match(/\bimport\s+(?:[^'"]*from\s*)?["'](\/[^"']+)["']/);
  expect(firstImport, 'live entry should have a rewritten module import').not.toBeNull();
  const res = await request.get(firstImport![1]);
  expect(res.status()).toBe(200);
});

test('page hydrates from the live entry (client navigation works)', async ({ page }) => {
  let fullReloadCount = 0;
  page.on('load', () => fullReloadCount++);

  await page.goto('/');
  await page.waitForSelector('litro-outlet');
  // A working SPA navigation proves the live entry loaded, ran, and wired the
  // router — i.e. the client bundle is real, not a 404/stale artifact.
  await page.evaluate(() => {
    history.pushState({}, '', '/blog');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForURL('**/blog');
  await expect(page.locator('h1').first()).toContainText('Blog');
  expect(fullReloadCount).toBe(1);
});
