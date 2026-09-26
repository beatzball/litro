import { expect, type Page } from '@playwright/test';

/**
 * Scroll-position checks shared by the docs and docs-ssr suites.
 *
 * Both sites read the same content through the same router, but they navigate
 * differently: the static site's sidebar is plain anchors, so a link click is
 * a document load, while the server-rendered site uses `litro-link`, so it is
 * a same-document move. The four rules below have to hold either way, which
 * is why the body of each check lives here and each suite only points it at
 * its own pages.
 *
 * Scroll position is measured, not assumed. The docs stylesheet sets
 * `scroll-behavior: smooth`, so every move animates over several frames and a
 * reading taken too early is a number in the middle of an animation.
 */

/** The outlet attribute the router sets once the page element is live (TEST-001). */
const SETTLED = 'litro-outlet[data-litro-settled]';

/** How long a scroll position may take to arrive. A restore waits for load. */
const ARRIVE_MS = 10_000;
/** How long the position then has to stay put, so a reading is not mid-animation. */
const STAY_MS = 800;

export async function waitForPage(page: Page): Promise<void> {
  await page.waitForSelector(SETTLED);
  // The page also has to be tall enough to scroll. Under a parallel run the
  // stylesheet can still be on its way when `load` fires, and a page that is
  // one viewport tall makes every position on it zero.
  await page.waitForFunction(
    () => document.documentElement.scrollHeight - window.innerHeight > 200,
    undefined,
    { timeout: ARRIVE_MS },
  );
}

export function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => Math.round(window.scrollY));
}

/**
 * How far off a position may land.
 *
 * The browser clamps a restored offset to the document's height at the moment
 * it restores, and a stylesheet or an image that arrives late moves that by a
 * few pixels. Measured drift on the docs pages is under 15px, against the
 * hundreds of pixels the bug moved the reader.
 */
const TOLERANCE = 25;

/**
 * Waits for the scroll position to reach `target`, then checks it stays there.
 *
 * Both halves matter. The browser's restore does not start until after load and
 * animates over several frames, so a reading taken early is 0 — and a reading
 * taken while the router is still working can pass by accident, a moment before
 * something scrolls the page away.
 */
export async function expectScrollSettlesAt(
  page: Page,
  target: number,
  tolerance = TOLERANCE,
): Promise<void> {
  const deadline = Date.now() + ARRIVE_MS;
  let y = await scrollY(page);
  while (Date.now() < deadline && Math.abs(y - target) > tolerance) {
    await page.waitForTimeout(100);
    y = await scrollY(page);
  }
  expect(Math.abs(y - target), `scroll position should arrive at ${target}, got ${y}`)
    .toBeLessThanOrEqual(tolerance);

  await page.waitForTimeout(STAY_MS);
  const after = await scrollY(page);
  expect(Math.abs(after - target), `scroll position should stay at ${target}, got ${after}`)
    .toBeLessThanOrEqual(tolerance);
}

/** Scrolls to a fraction of the page's own scrollable range and returns where it stopped. */
export async function scrollToFraction(page: Page, fraction: number): Promise<number> {
  const target = await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const to = Math.round(max * f);
    window.scrollTo({ top: to, behavior: 'instant' });
    return to;
  }, fraction);
  expect(target, 'the page must be long enough to scroll').toBeGreaterThan(200);
  await expectScrollSettlesAt(page, target);
  return target;
}

/**
 * Reloading a scrolled page returns the reader to where they were.
 *
 * The browser restores the position on its own. The router used to scroll to
 * the top on the first resolve after any load, which threw that away and sent
 * the reader back to the top of the page (issue 196).
 */
export async function checksReloadRestore(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForPage(page);
  const before = await scrollToFraction(page, 0.5);

  await page.reload();
  await waitForPage(page);

  await expectScrollSettlesAt(page, before);
}

/** Clicking a link to another page still starts that page at the top. */
export async function checksLinkStartsAtTop(page: Page, from: string, to: string): Promise<void> {
  await page.goto(from);
  await waitForPage(page);
  await scrollToFraction(page, 0.5);

  await clickSidebarLink(page, to);
  await waitForPage(page);

  expect(new URL(page.url()).pathname).toBe(to);
  await expectScrollSettlesAt(page, 0);
}

/**
 * A link to a heading still lands on that heading.
 *
 * Content headings are rendered inside a shadow root, which native fragment
 * scrolling cannot reach — the router walks the shadow tree itself.
 */
export async function checksHashLandsOnHeading(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForPage(page);
  const id = await lastHeadingId(page);

  // Leave the page first. Going from `/x` to `/x#id` is a fragment move inside
  // the same document, which never reaches the router — what a reader follows
  // from somewhere else is a document load.
  await page.goto('/');
  await page.waitForSelector(SETTLED);

  await page.goto(`${path}#${id}`);
  await waitForPage(page);
  await waitForScroll(page);

  const shown = await page.evaluate((wanted) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(`#${CSS.escape(wanted)}`);
      if (direct) return direct;
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          const found = find(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    };
    const el = find(document);
    return {
      inShadowRoot: !document.getElementById(wanted),
      top: el ? Math.round(el.getBoundingClientRect().top) : null,
      viewport: window.innerHeight,
      y: Math.round(window.scrollY),
    };
  }, id);

  expect(shown.inShadowRoot, 'the heading is inside a shadow root').toBe(true);
  expect(shown.y, 'the page scrolled down to reach the heading').toBeGreaterThan(100);
  expect(shown.top).not.toBeNull();
  expect(shown.top!).toBeGreaterThanOrEqual(0);
  expect(shown.top!).toBeLessThan(shown.viewport);
}

/** Back and forward land where they should: the position each page was left at. */
export async function checksHistoryRestore(page: Page, from: string, to: string): Promise<void> {
  await page.goto(from);
  await waitForPage(page);
  const leftAt = await scrollToFraction(page, 0.5);

  await clickSidebarLink(page, to);
  await waitForPage(page);
  await expectScrollSettlesAt(page, 0);

  await page.goBack();
  await waitForPage(page);
  expect(new URL(page.url()).pathname).toBe(from);
  await expectScrollSettlesAt(page, leftAt);

  await page.goForward();
  await waitForPage(page);
  expect(new URL(page.url()).pathname).toBe(to);
  await expectScrollSettlesAt(page, 0);
}

/**
 * Clicks the sidebar entry for `href`, whichever element carries it.
 *
 * The static site renders a plain `<a>` and the server-rendered site a
 * `litro-link`, and both live inside a shadow root.
 */
async function clickSidebarLink(page: Page, href: string): Promise<void> {
  const clicked = await page.evaluate((wanted) => {
    const find = (root: Document | ShadowRoot): HTMLElement | null => {
      for (const el of root.querySelectorAll('a, litro-link')) {
        if (el.getAttribute('href') === wanted) return el as HTMLElement;
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          const found = find(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    };
    const el = find(document);
    el?.click();
    return !!el;
  }, href);
  expect(clicked, `a sidebar link to ${href}`).toBe(true);
}

/** The id of the last content heading — far enough down the page to need a scroll. */
async function lastHeadingId(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const ids: string[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('h2[id], h3[id]')) ids.push(el.id);
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(document);
    return ids[ids.length - 1] ?? '';
  });
  expect(id, 'the page has a heading with an id').not.toBe('');
  return id;
}

/** Waits for the page to be scrolled somewhere and to stop moving. */
async function waitForScroll(page: Page): Promise<number> {
  const deadline = Date.now() + ARRIVE_MS;
  while (Date.now() < deadline && (await scrollY(page)) === 0) {
    await page.waitForTimeout(100);
  }
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await scrollY(page);
    if (y === last) return y;
    last = y;
    await page.waitForTimeout(100);
  }
  return last;
}
