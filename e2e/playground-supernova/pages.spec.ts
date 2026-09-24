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
  await expect(root.locator('litro-card')).toHaveCount(4);
});

/**
 * The landing page has a header of its own now. starlight-header stays on the
 * docs pages; if it came back here the page would have two headers and two
 * looks, which is the thing the status bar exists to avoid.
 */
test('home renders its own status bar and not the docs header', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const root = page.locator('page-home:not([hidden])');
  await expect(root.locator('litro-status-bar')).toHaveCount(1);
  await expect(root.locator('litro-status-bar')).toBeVisible();
  await expect(root.locator('starlight-header')).toHaveCount(0);
});

/**
 * The bar must show the same title and the same links the docs header shows,
 * from server/starlight.config.js, so the two halves of the site read as one.
 */
test('the status bar carries the site title and the site navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const bar = page.locator('page-home:not([hidden]) litro-status-bar');

  await expect(bar.locator('.seg-name')).toHaveText('playground-supernova');
  await expect(bar.locator('.home')).toHaveAttribute('href', '/');
  await expect(bar.locator('a[slot="nav"][href="/docs"]')).toHaveText('Docs');
  await expect(bar.locator('a[slot="nav"][href="/blog"]')).toHaveText('Blog');

  // The same links the docs header renders, on a docs page.
  const header = page.locator('starlight-header');
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug:not([hidden])');
  await expect(header.first().locator('.site-title')).toHaveText('playground-supernova');
  await expect(header.first().locator('nav a[href="/docs"]')).toBeVisible();
});

test('the status bar draws a tab per entry, each with a state badge', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const bar = page.locator('page-home:not([hidden]) litro-status-bar');

  await expect(bar.locator('litro-state-badge')).toHaveCount(4);
  // The row is one picture with one description, not four unlabeled glyphs.
  // A div, not a list: ARIA in HTML does not allow role="img" on an ol, and
  // axe-core reports aria-allowed-role when it finds one there.
  await expect(bar.locator('div[role="img"].tabs')).toHaveAttribute(
    'aria-label',
    /build is done/,
  );
  await expect(bar.locator('ol')).toHaveCount(0);
  await expect(bar.locator('li')).toHaveCount(0);
});

/**
 * The settle is the page's one moving part, and it is CSS, so a reader who
 * asks for less motion must get the SETTLED row from the first frame — never
 * the starting glyph. The starting glyph is taken out of the layout, not just
 * faded, so this asserts it is not there at all.
 */
test('the status bar renders already settled with reduced motion', async ({ page }) => {
  // page.emulateMedia, not test.use({ reducedMotion }): the `use` form did
  // not reach matchMedia in this project, and a check that silently runs
  // without the preference set would pass against a broken rule.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const badge = page
    .locator('page-home:not([hidden]) litro-status-bar litro-state-badge')
    .first();

  await expect(badge.locator('.from')).toBeHidden();
  await expect(badge.locator('.to')).toBeVisible();
  await expect(badge.locator('.to')).toHaveText('[+]');
});

test('the status bar keeps both glyphs when motion is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  const badge = page
    .locator('page-home:not([hidden]) litro-status-bar litro-state-badge')
    .first();

  // Both glyphs are in the layout; the crossfade is opacity only, which is
  // why the swap never moves the tab name beside it.
  await expect(badge.locator('.from')).toBeVisible();
  await expect(badge.locator('.to')).toBeVisible();
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
  expect(body).toContain('class="layer core"');
  expect(body).toContain('radial-gradient');
  // litro-card, through litro-card-grid.
  expect(body).toContain('Structured documentation with sidebar');

  // litro-status-bar: the title segment, and the links it was given.
  expect(body).toContain('class="seg seg-name"');
  expect(body).toContain('Four tasks: build is done');
  expect(body).toContain('slot="nav"');
  // litro-state-badge, inside the bar's tabs. Both glyphs of a settling
  // badge are in the HTML, because the settle is CSS and nothing waits for
  // a script to start it.
  expect(body).toContain('class="from working"');
  expect(body).toContain('class="to done"');
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
