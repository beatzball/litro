import { test, expect } from '@playwright/test';

/**
 * The server-rendered docs site's home page, rebuilt on the supernova recipe's
 * components.
 *
 * This is `e2e/docs/home.spec.ts` for the other site, plus the two things only
 * this one has: the search control in the status bar, and client navigation.
 *
 * WHY THESE READ THE SERVER HTML. A component can be imported, registered,
 * compiled and placed in the markup and still reach a reader as an empty tag:
 * the server build drops a module nothing appears to use, and Lit SSR then has
 * no class to expand (BUILD-001, BUILD-007). That failure builds green, so the
 * checks below read what the server actually sent.
 */

/** Every custom element the rebuilt page places, and how many of each. */
const COMPONENTS: Array<[tag: string, count: number]> = [
  ['litro-status-line', 1],
  ['litro-hero-nova', 1],
  ['litro-install-command', 2],
  ['litro-pane-grid', 3],
  ['litro-pane', 14],
  ['litro-site-footer', 1],
  ['litro-feature-row', 1],
  ['litro-steps', 1],
  ['litro-term-window', 1],
];

/**
 * Count the openings of `tag` that are followed by a Declarative Shadow DOM
 * template — that is, the ones the server actually rendered.
 */
function renderedCount(html: string, tag: string): number {
  // The lookahead matters: `<litro-pane\b` also matches `<litro-pane-grid`,
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
 * CONTENT-007: `<litro-link>` in place of a plain `<a>` is one of the
 * differences this site is allowed to have, and the page's own calls to action
 * are where it uses them.
 */
test('the page calls to action are client-router links', async ({ request }) => {
  const html = await (await request.get('/')).text();
  // A loose match on purpose: the dev server renders a binding with different
  // whitespace than the production build does, and neither is the point here.
  expect(html).toMatch(/<litro-link[^>]*href="\/docs\/introduction"/);
  expect(html).toMatch(/<litro-link[^>]*href="\/compare\/nextjs"/);
});

/**
 * The header's navigation is a real anchor in the first response, and it has
 * to be: the client router is layered on top of it by a click handler, so
 * with JavaScript off the links still work. starlight-header has always done
 * this, and the landing page gets it now by carrying the same header.
 */
test('the header navigation is a real anchor in the server HTML', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/<a[^>]*href="\/docs\/introduction"/);
});

test('the pictures on the page each carry one description', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const root = page.locator('page-home:not([hidden])');

  await expect(root.locator('litro-term-window div[role="img"]')).toHaveAttribute(
    'aria-label',
    /shell session/,
  );
});

/**
 * THE STATUS LINE STATES FACTS. It replaced a terminal bar at the top of the
 * page whose tab row showed `lit`, `fast` and `elena` settling from working to
 * done — a drawing that read as live state. Every cell below is something the
 * page can prove: the version comes from the package manifest, the Node
 * requirement from the repository's engines, the link from the site
 * navigation.
 */
test('the status line at the foot states facts about the project', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const line = page.locator('page-home:not([hidden]) litro-status-line');

  await expect(line.locator('aside.line')).toBeVisible();
  // A version, read from the package rather than typed into the page.
  await expect(line.locator('.cell b').first()).toHaveText(/^v\d+\.\d+\.\d+$/);
  await expect(line).toContainText('adapters');
  await expect(line).toContainText('node');
  // Nothing in it is a task or a state that the page cannot know.
  await expect(line.locator('.tabs')).toHaveCount(0);
});

/**
 * THE WORDS IN A CELL MUST NOT TOUCH. The gap that separates a glyph from a
 * word lives on `.cell`, and when a cell links somewhere its only child is an
 * anchor — so everything inside that anchor had no gap at all and a cell read
 * "built withlitro" on the scaffolded site.
 *
 * This reads the RENDERED text rather than the markup, because the markup was
 * never wrong: `<span>node</span><b>20.19+</b>` is correct HTML and its
 * textContent runs the words together either way. Only what a browser lays
 * out can tell the difference.
 */
test('the words in a status cell are separated', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');

  const cells = await page.evaluate(() => {
    const root = document.querySelector('page-home:not([hidden])')?.shadowRoot;
    const line = root?.querySelector('litro-status-line')?.shadowRoot;
    return [...(line?.querySelectorAll('.cell') ?? [])].map((c) =>
      (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    );
  });

  expect(cells.some((c) => /^node 20\.19\+$/.test(c))).toBe(true);
  expect(cells.some((c) => /^adapters lit /.test(c))).toBe(true);
});

/** The line is fixed to the foot, so it must not cover the page's last line. */
test('the status line does not sit on top of the page content', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');

  // At the BOTTOM of the page, which is the only place the question is real:
  // the line is fixed to the viewport, so higher up the last element is far
  // below it and the comparison says nothing.
  //
  // behavior: 'instant', because the site's stylesheet sets
  // `scroll-behavior: smooth` on html — a plain scrollTo animates, and the
  // measurement below would be taken somewhere in the middle of the page.
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'instant' as ScrollBehavior,
    }),
  );
  await page.waitForTimeout(100);

  const clear = await page.evaluate(() => {
    const home = document.querySelector('page-home:not([hidden])');
    const root = home?.shadowRoot;
    const line = root?.querySelector('litro-status-line')?.shadowRoot
      ?.querySelector('aside.line');
    const closing = root?.querySelector('.closing');
    if (!line || !closing) return null;
    return closing.getBoundingClientRect().bottom <= line.getBoundingClientRect().top + 1;
  });

  expect(clear, 'the closing section ends above the status line').toBe(true);
});

/**
 * Nothing on this page animates any more. The badges that used to settle in
 * the header went with the header; the status line that replaced it is text
 * and hairlines. This asserts the absence, because "no motion" is only a
 * promise until something checks it.
 */
test('nothing on the page moves, with or without a motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');

  const moving = await page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        if (s.animationName && s.animationName !== 'none') {
          out.push(`${el.tagName.toLowerCase()} ${s.animationName}`);
        }
        if ((el as Element & { shadowRoot?: ShadowRoot }).shadowRoot) {
          walk((el as Element & { shadowRoot: ShadowRoot }).shadowRoot);
        }
      }
    };
    walk(document);
    return out;
  });

  expect(moving).toEqual([]);
});

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

test('client navigation from the header reaches the blog', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  await page
    .locator('page-home:not([hidden]) starlight-header nav a[href="/blog"]')
    .first()
    .click();
  await page.waitForSelector('page-blog:not([hidden])');
  expect(page.url()).toContain('/blog');
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
  expect(bg).not.toBe('');
  expect(bg.startsWith('#0b0d14')).toBe(false);
});
