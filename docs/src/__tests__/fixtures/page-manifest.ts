/**
 * Test double for the #litro/page-manifest virtual module.
 *
 * `docs/vitest.config.ts` aliases '#litro/page-manifest' here, because the
 * real module is generated inside a Nitro build and is not on disk when the
 * unit tests run.
 *
 * The routes are scanned from docs/pages/ rather than written out, so the
 * handlers under test see the app's real pages. docs-ssr/pages/ holds the same
 * files plus search.ts, which the sitemap excludes anyway; the completeness
 * test asserts that, so this single manifest stays correct for both apps.
 */

import { scanRoutes } from './scan-pages.js';

export const routes = scanRoutes('docs');

export const pageModules: Record<string, Record<string, unknown>> = {};

export default routes;
