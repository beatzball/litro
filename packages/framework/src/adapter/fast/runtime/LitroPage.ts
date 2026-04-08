/**
 * LitroPage (FAST) — Optional base class for pages with framework-managed data fetching.
 *
 * FAST Element implementation mirroring the Lit LitroPage contract:
 *
 * - `serverData` — populated from SSR script tag or fetchData()
 * - `loading` — true while fetchData() is running
 * - `onBeforeEnter(location)` — router lifecycle hook
 * - `fetchData(location)` — override for client-side data fetching
 *
 * FAST uses `@observable` for reactive properties (equivalent to Lit's @state).
 * Observable properties trigger template re-evaluation when changed.
 */

// Ensure the DOM shim is installed before @microsoft/fast-element loads.
// This file is loaded externally by Node ESM (not inlined by Rollup), so
// the manifest preamble's bundled shim runs too late. The ensure-dom module
// conditionally imports the shim only on the server (no-op in browser).
import '../ensure-dom.js';

import { FASTElement, observable } from '@microsoft/fast-element';
import { getServerData } from '../../../runtime/page-data.js';
import type { LitroLocation } from '@beatzball/litro-router';

export interface LitroPageInterface {
  serverData: unknown;
  loading: boolean;
  onBeforeEnter(location: LitroLocation): Promise<void>;
  fetchData(location: LitroLocation): Promise<unknown>;
}

export class LitroPage extends FASTElement implements LitroPageInterface {
  @observable serverData: unknown = null;
  @observable loading = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.serverData === null) {
      // SSR path: the FAST adapter sets serverData on globalThis because
      // FAST SSR's string-based rendering has no property binding mechanism
      // (unlike Lit's .serverData=${value}). Safe because SSR is single-threaded.
      if (typeof (globalThis as any).__litro_ssr_page_data__ !== 'undefined') {
        this.serverData = (globalThis as any).__litro_ssr_page_data__;
        return;
      }
      // Client path: read from the server-injected script tag (same as Lit).
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
