/**
 * Issue 137: every docs page must fit on a phone.
 *
 * The bug it guards: a padded full-width box inside a shadow root that the
 * document's `box-sizing: border-box` reset cannot reach, so it computes as
 * content-box and is its width PLUS its gutters. A second shape is a Markdown
 * table whose widest unbreakable token sets a floor wider than the screen.
 * See `.agents/rules/adapters-ssr.md` (SSR-008).
 */
import { test } from '@playwright/test';
import { testNoSideScroll } from '../_shared/mobile-overflow.js';

testNoSideScroll(test, [
  '/',
  '/docs',
  '/docs/introduction',
  '/docs/packages/litro',
  '/blog',
  '/benchmarks',
  '/why-web-components',
]);
