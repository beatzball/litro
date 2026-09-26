/**
 * Issue 185: the shell wrote its skip links as bare anchors at the top of
 * `<body>`, outside every landmark, so axe-core's `region` rule fired on
 * every page. They now sit in a `<nav aria-label="Skip links">`.
 *
 * See `e2e/_shared/landmarks.ts` for why this runs in a browser and at two
 * widths.
 */
import { test } from '@playwright/test';
import { testAllContentInLandmarks } from '../_shared/landmarks.js';

testAllContentInLandmarks(test, ['/', '/docs', '/docs/introduction', '/blog']);
