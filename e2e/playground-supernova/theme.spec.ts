import { test, expect } from '@playwright/test';

/**
 * Which theme a page opens in.
 *
 * WHAT WENT WRONG, so it cannot go wrong the same way twice.
 *
 * The head script in `src/route-meta.ts` runs synchronously in `<head>` and
 * sets `data-theme` before the first paint, from the reader's stored choice or,
 * when they have made none, from `prefers-color-scheme`. That part was right.
 *
 * `starlight-header` then resolved the theme A SECOND TIME in its first update
 * and wrote the answer back — with a bare `?? 'light'` fallback and no look at
 * the system preference. So on a dark system every page carrying the header
 * flipped to light a moment after it loaded, while the landing page, which has
 * `litro-status-bar` instead, stayed dark. Clicking from the landing page into
 * the docs went from dark to light.
 *
 * The rules these tests hold to:
 *
 *   1. No stored choice, dark system  → dark, on every page.
 *   2. No stored choice, light system → light, on every page.
 *   3. A stored choice wins over the system, on every page.
 *   4. The system is followed LIVE while no choice is stored.
 *   5. It works with JavaScript off, as far as CSS can carry it.
 *
 * Every assertion reads the computed `--sl-color-bg`, not a class name: what
 * matters is the color a reader actually sees.
 */

/** The two grounds, from `public/styles/starlight.css`. */
const DARK_BG = '#17181c';
const LIGHT_BG = '#fff';

/** The pages a reader moves between: the landing page, the docs, the blog. */
const PAGES = ['/', '/docs/getting-started', '/blog'];

/** The ground color the page is actually painting. */
async function ground(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--sl-color-bg')
      .trim(),
  );
}

// ---------------------------------------------------------------------------
// No choice stored: follow the system
// ---------------------------------------------------------------------------

test.describe('a reader who has chosen nothing follows the system', () => {
  test.use({ colorScheme: 'dark' });

  for (const path of PAGES) {
    test(`${path} opens dark on a dark system`, async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector('litro-outlet[data-litro-settled]');
      expect(await ground(page)).toBe(DARK_BG);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });
  }
});

test.describe('a light system is followed too', () => {
  test.use({ colorScheme: 'light' });

  test('/docs/getting-started opens light on a light system', async ({ page }) => {
    await page.goto('/docs/getting-started');
    await page.waitForSelector('litro-outlet[data-litro-settled]');
    expect(await ground(page)).toBe(LIGHT_BG);
  });
});

// ---------------------------------------------------------------------------
// A stored choice wins
// ---------------------------------------------------------------------------

test.describe('a reader who has chosen keeps that choice', () => {
  test.use({ colorScheme: 'dark' });

  test('light stays light on a dark system, on every page', async ({ page }) => {
    // Seed the choice the way the toggle does, before any page script runs.
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sl-theme', 'light'));

    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForSelector('litro-outlet[data-litro-settled]');
      expect(await ground(page), `${path} with light stored`).toBe(LIGHT_BG);
    }
  });

  test('the toggle stores the choice and it survives a reload', async ({ page }) => {
    await page.goto('/docs/getting-started');
    await page.waitForSelector('litro-outlet[data-litro-settled]');
    expect(await ground(page)).toBe(DARK_BG);

    const toggle = page.getByRole('button', { name: /switch to light mode/i }).first();
    await toggle.click();
    expect(await ground(page)).toBe(LIGHT_BG);
    expect(await page.evaluate(() => localStorage.getItem('sl-theme'))).toBe('light');

    await page.reload();
    await page.waitForSelector('litro-outlet[data-litro-settled]');
    expect(await ground(page), 'the choice survived the reload').toBe(LIGHT_BG);
  });
});

// ---------------------------------------------------------------------------
// The system is followed live
// ---------------------------------------------------------------------------

test('the page follows a system change while no choice is stored', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/docs/getting-started');
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  expect(await ground(page)).toBe(DARK_BG);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect
    .poll(() => ground(page), { message: 'the page followed the system to light' })
    .toBe(LIGHT_BG);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() => ground(page), { message: 'and back to dark' })
    .toBe(DARK_BG);
});

test('a system change does NOT override a stored choice', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/docs/getting-started');
  await page.evaluate(() => localStorage.setItem('sl-theme', 'light'));
  await page.reload();
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  expect(await ground(page)).toBe(LIGHT_BG);

  await page.emulateMedia({ colorScheme: 'dark' });
  // Give the listener the same chance to run that the test above relies on.
  await page.waitForTimeout(250);
  expect(await ground(page), 'the reader chose light, so light it stays').toBe(
    LIGHT_BG,
  );
});

// ---------------------------------------------------------------------------
// With JavaScript off
// ---------------------------------------------------------------------------

/**
 * With no JavaScript nothing sets `data-theme` at all, so the only thing that
 * can follow a dark system is the `@media (prefers-color-scheme: dark)` block
 * in the stylesheet. Its `:not([data-theme="light"])` guard is what still lets
 * a reader's choice win when scripts ARE running.
 */
test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'dark' });

  test('a dark system still gets a dark page', async ({ page }) => {
    await page.goto('/docs/getting-started');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await ground(page)).toBe(DARK_BG);
  });
});

test.describe('with JavaScript off on a light system', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'light' });

  test('a light system still gets a light page', async ({ page }) => {
    await page.goto('/docs/getting-started');
    expect(await ground(page)).toBe(LIGHT_BG);
  });
});
