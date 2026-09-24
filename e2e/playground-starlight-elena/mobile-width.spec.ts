/**
 * Issue 137: every starlight-shaped page must fit on a phone.
 *
 * The bug it guards: `<main>` is sized `width: 100%` PLUS `padding: 0 1.5rem`,
 * which is only correct under `box-sizing: border-box`. The recipe's reset
 * lives in a document stylesheet, and that cannot cross into `page-home`'s
 * shadow root, so `<main>` computed as content-box and landed at 438px on a
 * 390px screen. See `.agents/rules/adapters-ssr.md` (SSR-008).
 */
import { test } from '@playwright/test';
import { testNoSideScroll } from '../_shared/mobile-overflow.js';

testNoSideScroll(test, ['/', '/docs', '/docs/getting-started', '/blog', '/blog/welcome']);
