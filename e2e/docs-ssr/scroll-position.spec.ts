import { test } from '@playwright/test';
import {
  checksReloadRestore,
  checksLinkStartsAtTop,
  checksHashLandsOnHeading,
  checksHistoryRestore,
} from '../_shared/scroll-position.js';

/**
 * Scroll position on the server-rendered docs site, where the sidebar uses
 * `litro-link`, so a link click is a same-document move. Issue 196: reloading
 * a scrolled page came back at the top, and a back move landed short of where
 * the reader had been, clamped to the height of the page they were leaving.
 *
 * The four checks pull against each other, so all four run on both docs sites.
 */

const PAGE = '/docs/introduction';
const OTHER = '/docs/getting-started';

test('reloading a scrolled page returns to the same position', async ({ page }) => {
  await checksReloadRestore(page, PAGE);
});

test('clicking a link to another page starts at the top', async ({ page }) => {
  await checksLinkStartsAtTop(page, PAGE, OTHER);
});

test('a link to a heading lands on the heading, inside its shadow root', async ({ page }) => {
  await checksHashLandsOnHeading(page, OTHER);
});

test('back and forward land where each page was left', async ({ page }) => {
  await checksHistoryRestore(page, PAGE, OTHER);
});
