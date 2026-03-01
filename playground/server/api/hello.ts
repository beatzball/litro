/**
 * GET /api/hello
 *
 * Returns data matching the `HomePageData` shape used by the home page.
 * Called by `HomePage.fetchData()` on client-side navigation (after the
 * initial SSR load, when `getServerData()` returns null).
 *
 * On SSR load the data comes from `pageData.fetcher()` in pages/index.ts.
 * On client navigation the data comes from this route — same shape, same
 * fields, allowing the page component to use one unified `serverData` state.
 */

import { defineEventHandler } from 'h3';

export default defineEventHandler(() => ({
  message: 'Hello from the API!',
  timestamp: new Date().toISOString(),
}));
