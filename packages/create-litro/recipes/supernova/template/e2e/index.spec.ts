import { test, expect } from '@playwright/test';

const PRERENDERED_ROUTES = [
  '/',
  '/docs/getting-started',
  '/docs/installation',
  '/docs/configuration',
  '/docs/guides-first-page',
  '/docs/guides-deploying',
  '/blog',
  '/blog/welcome',
  '/blog/release-notes',
];

test('home renders page-home component', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  await expect(page.locator('page-home')).toBeVisible();
});

test('home renders the landing page sections', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const root = page.locator('page-home');
  await expect(root.locator('.hero h1')).toBeVisible();
  await expect(root.locator('litro-feature-row')).toHaveCount(3);
  await expect(root.locator('litro-steps')).toHaveCount(1);
  await expect(root.locator('litro-key-hints')).toHaveCount(1);
  // Not an exact count: scaffolding without a blog drops the Blog card.
  expect(await root.locator('litro-card').count()).toBeGreaterThanOrEqual(3);
});

/**
 * The copy button is the one part of the page that needs JavaScript, and it
 * has two endings. With clipboard permission it says "Copied". Without it, it
 * selects the command instead and says "Selected" — a page must not claim a
 * copy it did not make.
 */
test('the install command copies, and says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.waitForSelector('litro-outlet[data-litro-settled]');

  const button = page.locator('litro-install-command').first().locator('button');
  await button.click();
  await expect(button).toHaveText('Copied');
});

test('the install command selects the text when the clipboard is refused', async ({ page }) => {
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

test('/docs/getting-started renders', async ({ page }) => {
  await page.goto('/docs/getting-started');
  await page.waitForSelector('page-docs-slug');
  await expect(page.locator('page-docs-slug')).toBeVisible();
});

/**
 * The landing page must read with JavaScript off. It is rendered on the
 * server, so every heading, paragraph, command and link is in the HTML the
 * server sends. This reads that HTML directly rather than through a browser,
 * so nothing a client script does can make the test pass.
 */
test('landing page copy is in the server HTML', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const body = await response.text();

  expect(body).toContain('Say what your product does, in one line.');
  expect(body).toContain('Name the first thing it does');
  expect(body).toContain('npm install');
  expect(body).toContain('/docs/getting-started');
  // Every component expanded on the server, rather than reaching the reader
  // as an empty tag. Each line below names content that ONLY that component
  // renders, so a bare tag cannot satisfy it.
  expect(body).toContain('Install it');               // litro-steps
  expect(body).toContain('Point it at your work');    // litro-steps
  expect(body).toContain('<kbd>');                    // litro-key-hints
  expect(body).toContain('Stop the current run');     // litro-key-hints
  expect(body).toContain('class="layer core"');       // litro-hero-nova
  expect(body).toContain('radial-gradient');          // litro-hero-nova
  expect(body).toContain('Structured documentation with sidebar'); // litro-card
});

/**
 * The hero art is drawn in CSS, and the page as shipped carries no media at
 * all. An image creeping in would still look right and would simply cost a
 * request on every visit, so this asserts on the HTML rather than on the eye.
 * Delete this test if your own page gains a picture on purpose.
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
