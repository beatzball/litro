import { test, expect } from '@playwright/test';

/**
 * The static docs site's home page, rebuilt on the supernova recipe's
 * components.
 *
 * WHY THESE READ THE SERVER HTML. A component can be imported, registered,
 * compiled and placed in the markup and still reach a reader as an empty tag:
 * the server build drops a module nothing appears to use, and Lit SSR then has
 * no class to expand (BUILD-001, BUILD-007). That failure builds green, so the
 * checks below read what the server actually sent.
 *
 * The page's promise is that it reads with JavaScript turned off, which is the
 * same thing said a different way: every claim and every link has to be in the
 * first response.
 */

/** Every custom element the rebuilt page places, and how many of each. */
const COMPONENTS: Array<[tag: string, count: number]> = [
  ['litro-status-bar', 1],
  ['litro-hero-nova', 1],
  ['litro-install-command', 2],
  ['litro-card-grid', 1],
  ['litro-card', 7],
  ['litro-feature-row', 1],
  ['litro-steps', 1],
  ['litro-term-window', 1],
];

/**
 * Count the openings of `tag` that are followed by a Declarative Shadow DOM
 * template — that is, the ones the server actually rendered.
 */
function renderedCount(html: string, tag: string): number {
  // The lookahead matters: `<litro-card\b` also matches `<litro-card-grid`,
  // because a hyphen ends a word. Requiring whitespace or the tag's end after
  // the name keeps the two apart.
  const opening = new RegExp(`<${tag}(?=[\\s/>])[^>]*>`, 'g');
  let rendered = 0;
  for (const match of html.matchAll(opening)) {
    const after = html.slice(match.index + match[0].length);
    if (/^\s*(<!--[^>]*-->\s*)*<template shadowroot/.test(after)) rendered += 1;
  }
  return rendered;
}

test('every component on the home page is rendered by the server', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const html = await res.text();

  for (const [tag, count] of COMPONENTS) {
    expect(renderedCount(html, tag), `${tag} with a server-rendered shadow root`).toBe(
      count,
    );
  }
});

test('the home page keeps every call to action and link it had', async ({ request }) => {
  const html = await (await request.get('/')).text();

  for (const href of [
    '/docs/introduction',
    '/blog',
    '/compare',
    '/why-web-components',
    '/compare/nextjs',
    '/compare/nuxt',
    '/compare/enhance',
    'https://github.com/beatzball/litro',
  ]) {
    expect(html, `link to ${href}`).toContain(`href="${href}"`);
  }
});

test('the home page copy is in the server HTML', async ({ request }) => {
  const html = await (await request.get('/')).text();
  // Lit SSR writes comment markers between static text and a binding, which
  // splits a sentence in two. Strip them so these assertions test the text.
  const text = html.replace(/<!--.*?-->/gs, '');

  for (const claim of [
    'Fullstack Web Framework',
    'Built on the Web Platform',
    'Why Web Components?',
    'Learn more about web standards longevity',
    'How Litro Compares',
    'Web Components',
    'Nitro Server',
    'Streaming SSR',
    'File-System Routing',
    'Static Generation',
    'Content Layer',
    'AI Agents',
    'pnpm create @beatzball/litro my-app',
  ]) {
    expect(text, `copy: ${claim}`).toContain(claim);
  }
});

/**
 * The terminal picture and the tab row are decoration. A screen reader gets
 * one sentence for each of them and nothing inside is read on its own.
 */
test('the pictures on the page each carry one description', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const root = page.locator('page-home:not([hidden])');

  await expect(root.locator('litro-status-bar div[role="img"].tabs')).toHaveAttribute(
    'aria-label',
    /Three framework adapters/,
  );
  await expect(root.locator('litro-term-window div[role="img"]')).toHaveAttribute(
    'aria-label',
    /shell session/,
  );
});

/**
 * The settle is the page's one moving part, and it is CSS, so a reader who
 * asks for less motion gets the SETTLED row from the first frame.
 */
test('the status bar renders already settled with reduced motion', async ({ page }) => {
  // page.emulateMedia, not test.use({ reducedMotion }): the `use` form did not
  // reach matchMedia in this project.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const badge = page
    .locator('page-home:not([hidden]) litro-status-bar litro-state-badge')
    .first();

  await expect(badge.locator('.from')).toBeHidden();
  await expect(badge.locator('.to')).toBeVisible();
});

/**
 * The copy button is the one part of the page that needs JavaScript, and it
 * has two endings. With clipboard permission it says "Copied". Without it, it
 * selects the command instead and says "Selected" — a page must not claim a
 * copy it did not make.
 */
test('the install command says Copied when the clipboard allows it', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  // The router swaps in a client element rather than hydrating in place, so
  // the visible server HTML has no handlers until it settles (TEST-001).
  await page.waitForSelector('litro-outlet[data-litro-settled]');

  const button = page.locator('litro-install-command').first().locator('button');
  await button.click();
  await expect(button).toHaveText('Copied');

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe('pnpm create @beatzball/litro my-app');
});

test('the install command says Selected when the clipboard is refused', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('litro-outlet[data-litro-settled]');

  // Take the clipboard away, the way an insecure origin or a withheld
  // permission does.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  const button = page.locator('litro-install-command').first().locator('button');
  await button.click();
  await expect(button).toHaveText('Selected');
});

/**
 * The landing page is dark whichever theme the reader chose, while the docs
 * pages follow the choice. The two must not fight: the page may not redefine
 * a --sl-* token globally, because the docs pages read those too.
 */
test('the docs pages keep their own theme after the landing page', async ({ page }) => {
  await page.goto('/docs/introduction');
  await page.waitForSelector('page-docs-slug:not([hidden])');

  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--sl-color-bg').trim(),
  );
  // The global light-mode value, untouched by the landing page's token block.
  expect(bg).not.toBe('');
  expect(bg.startsWith('#0b0d14')).toBe(false);
});
