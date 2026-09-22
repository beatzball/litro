import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * `<litro-hero-video>` — the supernova landing page's recording section.
 *
 * WHY THIS SPEC HAS ITS OWN PAGE. The landing page at `/` ships no clip: the
 * recipe carries no media at all, so that section is commented out with a note
 * on what to drop in. The parts of this component worth checking only exist in
 * a browser — a poster that loads no video, a button whose word follows the
 * video, and the reduced motion rule — so the harness page at `/hero-video`
 * renders it instead, twice, once with sources and once without. Nothing in
 * `pages/index.ts` or the landing page's own spec is touched.
 *
 * WHY PLAYBACK IS STUBBED. `/demo/clip.webm` has no file behind it, because
 * shipping one would put a binary in the recipe for the sake of a test. What
 * matters is WHEN the component asks for playback, not whether Chromium can
 * decode something, so `stubPlayback` replaces `HTMLMediaElement.play` before
 * the page loads and counts the requests. The real decoder is not under test;
 * the rule about when to call it is.
 */

const ROUTE = '/hero-video';

/**
 * Count playback requests instead of making them.
 *
 * `paused` is redefined alongside, and the matching events are fired, because
 * the component follows the video rather than leading it — take the events
 * away and the button's word would stop being tested at all.
 */
async function stubPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = window as unknown as { __playCalls: number };
    store.__playCalls = 0;

    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      store.__playCalls += 1;
      Object.defineProperty(this, 'paused', { value: false, configurable: true });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };

    HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { value: true, configurable: true });
      this.dispatchEvent(new Event('pause'));
    };
  });
}

/** How many times playback has been asked for since the page loaded. */
function playCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __playCalls: number }).__playCalls);
}

/**
 * Open the harness and return the live page element, once the router has
 * swapped it in (TEST-001).
 *
 * The motion preference is set here, before the navigation, rather than with
 * `test.use({ reducedMotion })`. The component reads `matchMedia` on its first
 * paint, so the preference has to be in place before the page loads at all —
 * and a describe-level `test.use` did not reach `matchMedia` in this project:
 * a probe read `(prefers-reduced-motion: reduce)` as false inside a describe
 * that asked for `reduce`. `emulateMedia` does reach it.
 */
async function openHarness(page: Page, motion: 'reduce' | 'no-preference') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(ROUTE);
  await page.waitForSelector('litro-outlet[data-litro-settled]');
  return page.locator('page-hero-video:not([hidden])');
}

// ---------------------------------------------------------------------------
// What the server sends
// ---------------------------------------------------------------------------

/**
 * The landing page must read with JavaScript off, so the poster, the
 * accessible name and the caption have to be in the server's HTML. This reads
 * that HTML directly rather than asking a browser, so nothing a client script
 * does can make it pass.
 */
test('the server HTML carries the poster, the name and the caption', async ({
  request,
}) => {
  const response = await request.get(ROUTE);
  expect(response.status()).toBe(200);
  const body = await response.text();

  // A shadow root at all: without one the element reached the reader empty.
  expect(body).toContain('<template shadowroot');
  expect(body).toContain('poster="/demo/poster.jpg"');
  expect(body).toContain('aria-label="What the tool does, in 15 seconds"');
  expect(body).toContain('A short caption under the recording.');
  expect(body).toContain('src="/demo/clip.webm"');
});

/**
 * A hero clip is the heaviest thing on a landing page and most readers scroll
 * past it, so a visitor who never presses play must download none of it.
 */
test('the server HTML asks for no video up front', async ({ request }) => {
  const response = await request.get(ROUTE);
  const body = await response.text();

  expect(body).toContain('preload="none"');
  expect(body).not.toContain('autoplay');
  expect(body).not.toContain('preload="auto"');
  expect(body).not.toContain('preload="metadata"');
});

// ---------------------------------------------------------------------------
// With no sources
// ---------------------------------------------------------------------------

/**
 * The state a user is really in after scaffolding: a poster and nothing to
 * play. It must render, and it must not offer a button that could do nothing.
 */
test('with no sources there is a poster and no button', async ({ page }) => {
  const root = await openHarness(page, 'no-preference');
  const video = root.locator('#no-sources video');

  await expect(video).toHaveAttribute('poster', '/demo/poster.jpg');
  await expect(root.locator('#no-sources button')).toHaveCount(0);
  await expect(root.locator('#no-sources source')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Motion allowed
// ---------------------------------------------------------------------------

test.describe('with motion allowed', () => {
  /**
   * ONCE, not twice. On a first load the server's HTML hydrates and then the
   * router builds a fresh page element and swaps it in, dropping the hydrated
   * one. Both copies used to autostart, so the clip — the heaviest file on a
   * landing page — was fetched twice and the first copy thrown away. An
   * assertion of "more than zero" is what let that through, so this counts.
   */
  test('the clip starts by itself, once, muted, and the button says Pause', async ({
    page,
  }) => {
    await stubPlayback(page);
    const root = await openHarness(page, 'no-preference');
    const button = root.locator('#with-sources button');

    await expect(button).toHaveText('Pause');
    expect(await playCalls(page)).toBe(1);

    // Muted, because a landing page that makes noise by itself is a bug.
    const muted = await root.locator('#with-sources video').evaluate(
      (node) => (node as HTMLVideoElement).muted,
    );
    expect(muted).toBe(true);
  });

  test('the button pauses the clip, and then plays it again', async ({ page }) => {
    await stubPlayback(page);
    const root = await openHarness(page, 'no-preference');
    const button = root.locator('#with-sources button');

    await expect(button).toHaveText('Pause');
    await button.click();
    await expect(button).toHaveText('Play');

    const before = await playCalls(page);
    await button.click();
    await expect(button).toHaveText('Pause');
    expect(await playCalls(page)).toBe(before + 1);
  });

  /**
   * The button follows the video rather than leading it. A clip paused by the
   * native controls, by a keystroke or by another script must still leave the
   * right word on the button.
   */
  test('the button keeps in step when the video is paused elsewhere', async ({
    page,
  }) => {
    await stubPlayback(page);
    const root = await openHarness(page, 'no-preference');
    const button = root.locator('#with-sources button');
    const video = root.locator('#with-sources video');

    await expect(button).toHaveText('Pause');

    // Pause it the way something other than the button would.
    await video.evaluate((node) => (node as HTMLVideoElement).pause());
    await expect(button).toHaveText('Play');

    await video.evaluate((node) => void (node as HTMLVideoElement).play());
    await expect(button).toHaveText('Pause');
  });
});

// ---------------------------------------------------------------------------
// Less motion asked for
// ---------------------------------------------------------------------------

test.describe('with less motion asked for', () => {
  /**
   * `prefers-reduced-motion: reduce` is a reader telling the page to hold
   * still. A clip starting by itself is exactly the motion they asked it not
   * to make.
   */
  test('the clip stays on the poster and the button says Play', async ({ page }) => {
    await stubPlayback(page);
    const root = await openHarness(page, 'reduce');

    await expect(root.locator('#with-sources button')).toHaveText('Play');
    expect(await playCalls(page)).toBe(0);
  });

  /** A press of the button is a request, not motion the page decided on. */
  test('a press of the button still plays it', async ({ page }) => {
    await stubPlayback(page);
    const root = await openHarness(page, 'reduce');
    const button = root.locator('#with-sources button');

    await button.click();
    await expect(button).toHaveText('Pause');
    expect(await playCalls(page)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The clip is fetched once, and only when it is going to be played
// ---------------------------------------------------------------------------

/**
 * Route every clip URL to a 404 and count the requests.
 *
 * Nothing is stubbed here: the real `play()` runs and the browser really goes
 * looking for the file, which is the only way to count what a visitor's
 * connection would carry. The recipe ships no media, so a 404 is what there is
 * to serve — and what the file answers with does not change how many times it
 * was asked for.
 */
async function count404Clips(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route('**/demo/clip.*', async (route) => {
    asked.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 404, contentType: 'text/plain', body: '' });
  });
  return asked;
}

test('the clip is requested once on a first load', async ({ page }) => {
  const asked = await count404Clips(page);
  const root = await openHarness(page, 'no-preference');

  // Wait for the failure to land, so the count is final rather than early.
  await expect(root.locator('#with-sources button')).toHaveText('Play');

  expect(asked.filter((u) => u === '/demo/clip.webm')).toHaveLength(1);
});

test('the clip is not requested at all when less motion is asked for', async ({
  page,
}) => {
  const asked = await count404Clips(page);
  const root = await openHarness(page, 'reduce');

  await expect(root.locator('#with-sources button')).toHaveText('Play');
  expect(asked).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// When the clip cannot be played at all
// ---------------------------------------------------------------------------

/**
 * The failure that does not reject.
 *
 * With `<source>` children that all fail, Chromium fires `play` and then
 * `waiting`, leaves `HTMLMediaElement.play()` pending for good, and keeps
 * `paused` false. A component that trusts the promise leaves "Pause" on the
 * button over a poster that will never move. The component reads the
 * element's own state instead.
 */
test('the button goes back to Play when every source 404s', async ({ page }) => {
  await count404Clips(page);
  const root = await openHarness(page, 'no-preference');

  await expect(root.locator('#with-sources button')).toHaveText('Play');
  // ...and a reader who cannot see the poster is told, rather than left
  // wondering why a press did nothing.
  await expect(root.locator('#with-sources .announce')).toHaveText(
    'The recording could not be played.',
  );
});

// ---------------------------------------------------------------------------
// With JavaScript off
// ---------------------------------------------------------------------------

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  /**
   * The button is the one part that needs JavaScript. Without it the poster is
   * the whole picture, and a button that could do nothing is worse than none.
   */
  test('the poster is shown and the button is not', async ({ page }) => {
    await page.goto(ROUTE);

    const video = page.locator('#with-sources video').first();
    await expect(video).toHaveAttribute('poster', '/demo/poster.jpg');
    await expect(video).toHaveAttribute('preload', 'none');

    // Still in the HTML, hidden by `@media (scripting: none)`.
    await expect(page.locator('#with-sources button').first()).toBeHidden();
  });
});
