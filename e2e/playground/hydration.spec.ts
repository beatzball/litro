import { test, expect } from '@playwright/test';

/**
 * Does Lit's hydration patch actually install in a real browser?
 *
 * Every other hydration test here checks the DOM, and the DOM looks almost
 * right either way: when the patch is missing, Lit tears the server's shadow
 * root down and renders the same markup again, so the page reads correctly and
 * is only slower. That is why this fault shipped unnoticed.
 *
 * So this asserts the PATCH, not the output. The first thing
 * `@lit-labs/ssr-client/lit-element-hydrate-support.js` does once installed is
 * add `defer-hydration` to `LitElement.observedAttributes`, and every
 * LitElement subclass inherits that getter. An element whose
 * `observedAttributes` lists `defer-hydration` was built after the patch ran;
 * one that does not was built before it, which means the patch never ran at
 * all — `lit-element` reads the hook once, when its module body runs.
 *
 * See BUILD-009 for the bundler fault this guards against, and
 * scripts/verify-scaffolded-apps.mjs for the build-time half of the check.
 */
test('Lit hydration support is installed, so SSR markup is reused', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  // The router's own signal that it has finished its first navigation, so
  // every element the page needs is registered by now.
  await page.waitForSelector('litro-outlet[data-litro-settled]');

  const patched = await page.evaluate(() => {
    const report: Record<string, string> = {};
    for (const tag of ['litro-outlet', 'litro-link', 'page-home']) {
      const ctor = customElements.get(tag) as (CustomElementConstructor & {
        observedAttributes?: string[];
      }) | undefined;
      if (!ctor) {
        report[tag] = 'not registered';
        continue;
      }
      const observed = ctor.observedAttributes ?? [];
      report[tag] = observed.includes('defer-hydration') ? 'patched' : 'NOT patched';
    }
    return report;
  });

  expect(patched).toEqual({
    'litro-outlet': 'patched',
    'litro-link': 'patched',
    'page-home': 'patched',
  });

  // LitroOutlet.firstUpdated() logs exactly this when the patch is missing.
  // A silent failure is the whole problem, so an absent error is part of the
  // assertion rather than a side note.
  expect(consoleErrors.filter((text) => text.includes('Lit hydration support is NOT installed'))).toEqual([]);
});
