import { test, expect } from '@playwright/test';

/**
 * playground-supernova is the supernova recipe as a dev app: the starlight
 * docs site with a product landing page in front of it.
 *
 * The docs and blog halves are already covered by e2e/playground-starlight,
 * which runs the same files. This suite stays on what supernova adds — the
 * landing page and its components — plus one check that the inherited half is
 * still reachable.
 */

const PRERENDERED_ROUTES = [
  '/',
  '/docs',
  '/docs/getting-started',
  '/blog',
  '/blog/welcome',
];

test('home renders the landing page, not the starlight splash', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('page-home:not([hidden]) .hero h1')).toContainText(
    'Say what your product does',
  );
});

test('home renders every landing page component', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const root = page.locator('page-home:not([hidden])');
  await expect(root.locator('litro-hero-nova')).toHaveCount(1);
  await expect(root.locator('litro-feature-row')).toHaveCount(3);
  await expect(root.locator('litro-steps')).toHaveCount(1);
  await expect(root.locator('litro-key-hints')).toHaveCount(1);
  await expect(root.locator('litro-install-command')).toHaveCount(2);
  await expect(root.locator('litro-pane')).toHaveCount(12);
  await expect(root.locator('litro-pane-grid')).toHaveCount(4);
  await expect(root.locator('litro-site-footer')).toHaveCount(1);
});

/**
 * The landing page has a header of its own now. starlight-header stays on the
 * docs pages; if it came back here the page would have two headers and two
 * looks, which is the thing the status bar exists to avoid.
 */
test('home carries the same header the docs pages do', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const root = page.locator('page-home:not([hidden])');
  await expect(root.locator('starlight-header')).toHaveCount(1);
  await expect(root.locator('starlight-header')).toBeVisible();
  // The terminal bar this page used to carry instead is gone.
  await expect(root.locator('litro-status-bar')).toHaveCount(0);
});

/**
 * The landing page and the docs pages must show the same title and the same
 * links, from server/starlight.config.js, so the two halves read as one site.
 * They do because they are the same element now, handed the same data.
 */
test('the header carries the site title and the site navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const header = page.locator('page-home:not([hidden]) starlight-header');

  await expect(header.locator('.site-title')).toContainText('playground-supernova');
  await expect(header.locator('.site-title')).toHaveAttribute('href', '/');
  await expect(header.locator('nav a[href="/docs"]')).toHaveText('Docs');
  await expect(header.locator('nav a[href="/blog"]')).toHaveText('Blog');
});

/**
 * THE STATUS LINE STATES FACTS. It replaced a terminal bar at the top of the
 * page whose tab row showed four tasks settling from working to done — a
 * drawing that read as live state, on a page that had no tasks. Every cell it
 * ships with is something a freshly scaffolded site can prove.
 */
test('the status line at the foot states facts, not tasks', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const line = page.locator('page-home:not([hidden]) litro-status-line');

  await expect(line.locator('aside.line')).toBeVisible();
  await expect(line.locator('.mode')).toHaveText('playground-supernova');
  await expect(line).toContainText('docs');
  await expect(line).toContainText('built with');
  // No tab row, and nothing claiming a state the page cannot know.
  await expect(line.locator('.tabs')).toHaveCount(0);
});

/**
 * THE WORDS IN A CELL MUST NOT TOUCH. The gap that separates a glyph from a
 * word lives on `.cell`, and when a cell links somewhere its only child is an
 * anchor — so everything inside that anchor had no gap at all and the line
 * read "built withlitro".
 *
 * This reads the RENDERED text rather than the markup, because the markup was
 * never wrong: `<span>built with</span><b>litro</b>` is correct HTML and its
 * textContent runs the words together either way. Only what a browser lays
 * out can tell the difference.
 */
test('the words in a linked status cell are separated', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');

  const cells = await page.evaluate(() => {
    const root = document.querySelector('page-home:not([hidden])')?.shadowRoot;
    const line = root?.querySelector('litro-status-line')?.shadowRoot;
    return [...(line?.querySelectorAll('.cell') ?? [])].map((c) =>
      (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    );
  });

  expect(cells).toContain('built with litro');
  expect(cells.join(' | ')).not.toMatch(/\w\w(litro|docs)\b/);
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
    const root = document.querySelector('page-home:not([hidden])')?.shadowRoot;
    const line = root?.querySelector('litro-status-line')?.shadowRoot
      ?.querySelector('aside.line');
    const credit = root?.querySelector('litro-site-footer');
    if (!line || !credit) return null;
    return credit.getBoundingClientRect().bottom <= line.getBoundingClientRect().top + 1;
  });

  expect(clear, 'the credit line ends above the status line').toBe(true);
});

/**
 * Nothing on this page animates any more. The badges that settled in the old
 * header went with the header, and the status line that replaced it is text
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
        const style = getComputedStyle(el);
        if (style.animationName && style.animationName !== 'none') {
          out.push(`${el.tagName.toLowerCase()} ${style.animationName}`);
        }
        const shadow = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
        if (shadow) walk(shadow);
      }
    };
    walk(document);
    return out;
  });

  expect(moving).toEqual([]);
});

/**
 * The terminal picture is decoration. A screen reader gets one sentence for
 * the whole window, and nothing inside it is read on its own.
 */
test('a feature row carries a terminal window in its figure slot', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const root = page.locator('page-home:not([hidden])');

  await expect(root.locator('litro-term-window[slot="figure"]')).toHaveCount(2);
  await expect(
    root.locator('litro-term-window').first().locator('div[role="img"]'),
  ).toHaveAttribute('aria-label', /deploy is blocked/);
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
  expect(copied).toBe('npm install playground-supernova');
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

test('docs page from the inherited starlight half renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  await expect(page.locator('page-docs-slug:not([hidden]) h1')).toContainText(
    'Getting Started',
  );
});

test('client navigation from the landing page to the blog works', async ({ page }) => {
  await page.goto('/');
  // The router swaps in a client element rather than hydrating in place, so
  // the visible server HTML has no handlers until it settles (TEST-001).
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  await page.locator('a[href="/blog"]').first().click();
  await page.waitForSelector('page-blog:not([hidden])');
  expect(page.url()).toContain('/blog');
});

/**
 * The landing page must read with JavaScript off. It is rendered on the
 * server, so this reads the server's HTML directly instead of asking a
 * browser, and nothing a client script does can make it pass.
 *
 * A component reaches the reader as an EMPTY TAG when its module is dropped
 * from the server build, which builds green and looks right in a browser. So
 * each assertion below names content that only that component renders.
 */
test('every component put its content in the server HTML', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const body = await response.text();

  expect(body).toContain('Say what your product does, in one line.');
  expect(body).toContain('npm install playground-supernova');
  expect(body).toContain('/docs/getting-started');

  // litro-feature-row: its heading and one of its command chips.
  expect(body).toContain('Name the first thing it does');
  expect(body).toContain('playground-supernova init');
  // litro-steps.
  expect(body).toContain('Point it at your work');
  // litro-key-hints.
  expect(body).toContain('<kbd>');
  expect(body).toContain('Stop the current run');
  // litro-hero-nova, drawn in CSS and not from an image file.
  expect(body).toContain('class="layer wash"');
  expect(body).toContain('radial-gradient');
  // litro-pane, through litro-pane-grid.
  expect(body).toContain('Structured documentation with sidebar');

  // starlight-header: the site title and the links it was given.
  expect(body).toContain('class="site-title"');
  expect(body).toContain('/docs/getting-started');
  // litro-status-line: the mode segment and a cell, both server-rendered.
  expect(body).toContain('class="cell mode"');
  expect(body).toContain('built with');
  // litro-state-badge, inside the terminal pictures further down the page.
  // A badge with no `from` draws one glyph and no crossfade, which is what a
  // terminal row wants — the two-glyph `to`/`from` markup only appeared while
  // the old status bar's tabs were settling.
  expect(body).toContain('litro-state-badge');
  expect(body).toContain('[+]');
  // litro-term-window, in a feature row's figure slot: rows in one, and a
  // slotted transcript in the other.
  expect(body).toContain('Three tasks listed by state');
  expect(body).toContain('class="row hot"');
  expect(body).toContain('playground-supernova build');
  expect(body).toContain('done in 1.4s');
});

/**
 * The video section ships as a comment, and nothing else. The component
 * arrives in the next phase; until then the page must not carry a video tag
 * or ask for a poster image it does not have.
 */
test('the page ships no video yet', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();

  expect(body).not.toContain('<video');
  expect(body).not.toContain('litro-hero-video');
});

/**
 * The hero art is drawn in CSS, and the page as shipped carries no media at
 * all. An image creeping in would still look right and would simply cost a
 * request on every visit, so this asserts on the HTML rather than on the eye.
 */
test('the landing page asks for no image', async ({ request }) => {
  const response = await request.get('/');
  const body = await response.text();

  expect(body).not.toContain('<img');
  expect(body).not.toContain('url(');
  // ...and the art really is there, so two absences are not passing against
  // a page that rendered nothing at all.
  expect(body).toContain('radial-gradient');
});

test('all prerendered routes return 200', async ({ request }) => {
  for (const route of PRERENDERED_ROUTES) {
    const response = await request.get(route);
    expect(response.status(), `Expected 200 for ${route}`).toBe(200);
  }
});

/**
 * /docs is the section landing page the starlight half brings with it.
 * Supernova inherits it; this check proves the inherited page survived the
 * template overlay.
 */
test('the inherited docs index renders', async ({ page }) => {
  await page.goto('/docs');
  await page.waitForSelector('page-docs:not([hidden])');
  await expect(page.locator('page-docs:not([hidden]) .doc-group').first().locator('h2')).toBeVisible();
});

/**
 * The band's code is highlighted, so every token sits inside its own span and
 * `&quot;` stands in for a quote. Reading a claim out of that needs the tags
 * gone and the entities back — which is also a check in its own right: if the
 * highlighter returned nothing, there is no text here to find.
 */
function plainText(html: string): string {
  return html
    .replace(/<!--.*?-->/gs, '')
    // A component's own CSS rides along inside its shadow template, and a
    // rule named after a class would otherwise read as page copy.
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * THE "ONE THING, PROVED" BAND, WHICH IS ALMOST ENTIRELY GENERATED MARKUP.
 *
 * The code and the data are highlighted by `highlightBlock()` inside
 * `definePageData`. A mistake there does not throw — it returns an empty
 * string, the page still builds, and the band arrives as two empty boxes with
 * captions over them. This insists the band has content.
 *
 * It also pins that the recipe's copy stays GENERIC. A scaffolded site is
 * somebody else's product, so nothing in this section may name Litro or any
 * of its features.
 */
test('the example band arrives with its code, its data and its card', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const text = plainText(html);

  expect(html.match(/class="hljs-keyword"/g)?.length ?? 0, 'highlighted keywords').toBeGreaterThan(1);
  expect(text, 'the strip names the file').toContain('summary.ts');

  for (const claim of [
    'Name the thing only you do',
    'export function summary',
    'A program gets',
    '"label": "Open tasks"',
    '"count": 12',
    'A reader sees',
  ]) {
    expect(text, `example band: ${claim}`).toContain(claim);
  }

  const card = plainText(
    html.slice(html.indexOf('class="ai-card"'), html.indexOf('class="ai-card"') + 900),
  );
  for (const value of ['Open tasks', '12', '3 due today']) {
    expect(card, `the card shows ${value}`).toContain(value);
  }
});

/**
 * The recipe is a template for somebody else's product. Its landing page must
 * not talk about Litro, or about agents, or about anything this scaffold does
 * not actually ship.
 */
test('the example band says nothing about Litro', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const start = html.indexOf('aria-label="One thing it does"');
  expect(start, 'the section is on the page').toBeGreaterThan(-1);
  const band = plainText(html.slice(start, html.indexOf('</section>', start)));
  for (const forbidden of ['Litro', 'litro-agent', 'defineTool', 'MCP', 'weather-card']) {
    expect(band.includes(forbidden), `the generic band must not mention ${forbidden}`).toBe(false);
  }
});

/**
 * The code block scrolls sideways on a phone, so it has to be reachable
 * without a pointer (WCAG 2.1.1) and it has to say what it is.
 */
test('the example code block is a named, reachable scroll region', async ({ page }) => {
  await page.goto('/');
  const pre = page.locator('page-home:not([hidden]) .ai-band-src pre');
  await expect(pre).toHaveAttribute('tabindex', '0');
  await expect(pre).toHaveAttribute('role', 'img');
  const label = await pre.getAttribute('aria-label');
  expect(label ?? '', 'a real sentence, not a word').toContain('summary function');
});
