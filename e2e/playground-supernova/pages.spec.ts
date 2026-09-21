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

test('home renders the shared starlight header', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home:not([hidden])');
  await expect(page.locator('starlight-header').first()).toBeVisible();
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
