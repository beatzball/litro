/**
 * pages/index.ts — Home page (route: /)
 *
 * Demonstrates the Litro data fetching convention:
 *
 *   1. `pageData` (named export) — tells the SSR handler to call the fetcher
 *      before rendering. The result is serialized into the HTML shell as:
 *      <script type="application/json" id="__litro_data__">{...}</script>
 *
 *   2. `LitroPage` base class — on first SSR load, `onBeforeEnter()` reads
 *      the script tag via `getServerData()` and stores it in `this.serverData`.
 *      On client navigation, it calls `fetchData()` instead (which hits /api/hello).
 *
 *   3. `fetchData()` override — called only on client-side navigation (not on
 *      the initial SSR load). Returns data matching the server data shape.
 */

import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitroPage } from 'litro/runtime';
import { definePageData } from 'litro';

/** Shape of data returned by both the SSR fetcher and the /api/hello route. */
export interface HomePageData {
  message: string;
  timestamp: string;
}

/**
 * Server-side data fetcher.
 *
 * The SSR handler detects this export (via `__litroPageData: true` sentinel)
 * and calls it during the request, before rendering the component.
 * The result is injected into the HTML shell as a JSON script tag.
 *
 * The H3Event parameter gives access to headers, cookies, query params, and
 * all other request context — use it to hit a database, call an internal
 * service, or read auth tokens.
 */
export const pageData = definePageData(async (_event) => {
  return {
    message: 'Hello from the server!',
    timestamp: new Date().toISOString(),
  } satisfies HomePageData;
});

@customElement('page-home')
export class HomePage extends LitroPage {
  // Narrow the type from `unknown` (mixin default) to the concrete data shape.
  @state() declare serverData: HomePageData | null;

  /**
   * Called by LitroPage.onBeforeEnter() on client-side navigation only.
   * On the first SSR load, onBeforeEnter() reads the injected script tag
   * and never reaches this method.
   */
  override async fetchData() {
    // Hit the API route — returns the same shape as the SSR fetcher above.
    const res = await fetch('/api/hello');
    return res.json() as Promise<HomePageData>;
  }

  render() {
    if (this.loading) {
      return html`<p>Loading...</p>`;
    }

    return html`
      <h1>Welcome to Litro</h1>
      <p>${this.serverData?.message ?? 'No data yet'}</p>
      <p><small>Timestamp: ${this.serverData?.timestamp ?? '—'}</small></p>
    `;
  }
}

export default HomePage;
