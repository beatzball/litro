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
  await expect(root.locator('starlight-header')).toHaveCount(1);
  await expect(root.locator('litro-status-line')).toHaveCount(1);
  await expect(root.locator('.hero h1')).toBeVisible();
  await expect(root.locator('litro-feature-row')).toHaveCount(3);
  await expect(root.locator('litro-term-window')).toHaveCount(2);
  await expect(root.locator('litro-steps')).toHaveCount(1);
  await expect(root.locator('litro-key-hints')).toHaveCount(1);
  // Not an exact count: scaffolding without a blog drops the Blog pane.
  expect(await root.locator('litro-pane').count()).toBeGreaterThanOrEqual(9);
  await expect(root.locator('litro-pane-grid')).toHaveCount(3);
  await expect(root.locator('litro-site-footer')).toHaveCount(1);
});

/**
 * THE LANDING PAGE CARRIES THE SAME HEADER THE DOCS PAGES DO. It used to have
 * a terminal bar of its own here, which meant a reader met two different
 * headers on one site. Both halves now read the same name and the same links
 * out of server/starlight.config.js — change that file and both follow.
 */
test('the header carries the site title and the site navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const header = page.locator('page-home starlight-header');

  await expect(header.locator('.site-title')).not.toBeEmpty();
  await expect(header.locator('.site-title')).toHaveAttribute('href', '/');
  await expect(header.locator('nav a[href="/docs/getting-started"]')).toHaveText('Docs');
});

/**
 * THE STATUS LINE STATES FACTS. The terminal character moved to the foot of
 * the window, where a status line belongs and where it has a page to
 * describe. Every cell it ships with is something a freshly scaffolded site
 * can prove — which the row of settling tabs it replaced never was.
 *
 * Edit the cells in pages/index.ts and this test follows; delete them all and
 * the line renders nothing, which is what it should do with nothing to say.
 */
test('the status line at the foot states facts, not tasks', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');
  const line = page.locator('page-home litro-status-line');

  await expect(line.locator('aside.line')).toBeVisible();
  await expect(line.locator('.mode')).not.toBeEmpty();
  await expect(line).toContainText('built with');
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
  await page.waitForSelector('page-home');

  const cells = await page.evaluate(() => {
    const root = document.querySelector('page-home')?.shadowRoot;
    const line = root?.querySelector('litro-status-line')?.shadowRoot;
    return [...(line?.querySelectorAll('.cell') ?? [])].map((c) =>
      (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    );
  });

  expect(cells).toContain('built with litro');
  expect(cells.join(' | ')).not.toMatch(/\w\w(litro|docs)\b/);
});

/** Fixed to the foot, so it must not cover the last line of the page. */
test('the status line does not sit on top of the page content', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('page-home');

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
    const root = document.querySelector('page-home')?.shadowRoot;
    const line = root?.querySelector('litro-status-line')?.shadowRoot
      ?.querySelector('aside.line');
    const credit = root?.querySelector('litro-site-footer');
    if (!line || !credit) return null;
    return credit.getBoundingClientRect().bottom <= line.getBoundingClientRect().top + 1;
  });

  expect(clear, 'the credit line ends above the status line').toBe(true);
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
  expect(body).toContain('class="layer wash"');       // litro-hero-nova
  expect(body).toContain('radial-gradient');          // litro-hero-nova
  expect(body).toContain('Structured documentation with sidebar'); // litro-pane
  expect(body).toContain('class="site-title"');       // starlight-header
  expect(body).toContain('class="cell mode"');        // litro-status-line
  expect(body).toContain('built with');               // litro-status-line
  expect(body).toContain('litro-state-badge');        // litro-state-badge
  expect(body).toContain('class="row hot"');          // litro-term-window
  expect(body).toContain('Three tasks listed by state'); // litro-term-window
});

/**
 * The video section ships as a comment and nothing else, so the page carries
 * no video tag and asks for no poster image it does not have. Delete this
 * test once you uncomment the section and drop your own clip in.
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
