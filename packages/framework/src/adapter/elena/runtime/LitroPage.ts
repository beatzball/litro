/**
 * LitroPage (Elena) — Optional base class for pages with framework-managed data fetching.
 *
 * Elena implementation mirroring the Lit/FAST LitroPage contract:
 *
 * - `serverData` — populated from SSR global, client script tag, or fetchData()
 * - `loading` — true while fetchData() is running
 * - `onBeforeEnter(location)` — router lifecycle hook
 * - `fetchData(location)` — override for client-side data fetching
 *
 * Elena uses `static props` for reactive properties (equivalent to Lit's @state
 * or FAST's @observable). Props declared in this array trigger batched re-renders.
 *
 * SSR data flow:
 *   Elena SSR calls `constructor()` then `render()` — no connectedCallback().
 *   The constructor reads `globalThis.__litro_ssr_page_data__` (set by the
 *   adapter's renderPage() before calling ssr()). This is safe because
 *   Node.js SSR is single-threaded and sequential.
 *
 * Client data flow:
 *   connectedCallback() reads from the server-injected <script id="__litro_data__">
 *   tag (same as Lit/FAST). On SPA navigation, onBeforeEnter() calls fetchData().
 */

import { Elena } from '@elenajs/core';
import { getServerData } from '../../../runtime/page-data.js';
import type { LitroLocation } from '@beatzball/litro-router';

export interface LitroPageInterface {
  serverData: unknown;
  loading: boolean;
  onBeforeEnter(location: LitroLocation): Promise<void>;
  fetchData(location: LitroLocation): Promise<unknown>;
}

export class LitroPage extends Elena(HTMLElement) implements LitroPageInterface {
  static props = ['serverData', 'loading'];

  serverData: unknown = null;
  loading = false;

  constructor() {
    super();
    // SSR path: Elena SSR calls constructor() → render(). No connectedCallback.
    // Read server data from the global set by the adapter's renderPage().
    if (typeof (globalThis as any).__litro_ssr_page_data__ !== 'undefined') {
      this.serverData = (globalThis as any).__litro_ssr_page_data__;
    }
  }

  override connectedCallback(): void {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }

    if (this.serverData === null) {
      // Client path: read from the server-injected script tag.
      if (typeof document !== 'undefined') {
        const scriptEl = document.getElementById('__litro_data__');
        if (scriptEl) {
          try {
            this.serverData = JSON.parse(scriptEl.textContent || '');
          } catch {
            // malformed JSON — ignore
          }
        }
      }
    }
  }

  async onBeforeEnter(location: LitroLocation): Promise<void> {
    const initial = getServerData();
    if (initial !== null) {
      this.serverData = initial;
      return;
    }

    this.loading = true;
    try {
      this.serverData = await this.fetchData(location);
    } finally {
      this.loading = false;
    }
  }

  async fetchData(location: LitroLocation): Promise<unknown> {
    try {
      const res = await fetch(location.pathname + location.search, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }
}
