/**
 * LitroPage.ts — Optional base class for pages that use framework-managed data fetching.
 *
 * Provides two things:
 *   1. `LitroPageMixin` — a class mixin for page authors who need to compose
 *      multiple base classes (e.g. combining LitroPage with another mixin).
 *   2. `LitroPage` — a ready-to-extend concrete base class equivalent to
 *      `LitroPageMixin(LitElement)`.
 *
 * Both are entirely optional. Page authors can implement `onBeforeEnter`
 * directly without using this base class if they prefer explicit control.
 *
 * ## Data flow
 *
 *   SSR load:
 *     Server calls `pageData.fetcher(event)`, serializes the result into the
 *     HTML shell as <script type="application/json" id="__litro_data__">.
 *     The client bootstraps, LitroRouter fires `onBeforeEnter()` on the
 *     page element, which calls `getServerData()` to read the script tag and
 *     stores the parsed value in `this.serverData`.
 *
 *   Client navigation (after initial SSR load):
 *     The script tag is gone (removed after first read). `getServerData()`
 *     returns null. `onBeforeEnter()` falls through to calling `fetchData()`,
 *     which the subclass overrides to hit an API route.
 *
 * ## Import note
 *
 *   This file imports from 'lit', 'lit/decorators.js', and type-only from
 *   './litro-router.js'. It is safe to include in both the client bundle and
 *   SSR module graph. However, it must NOT be imported in Nitro server code
 *   directly — use it only in page source files and the client runtime barrel
 *   (litro/runtime).
 *
 *   The LitroLocation type import is type-only (erased at runtime) so it
 *   has zero runtime cost and will not trigger any window/DOM access.
 */

import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { getServerData } from './page-data.js';
import type { LitroLocation } from 'litro-router';

// Generic constructor constraint used by the mixin pattern.
type Constructor<T = LitElement> = new (...args: any[]) => T;

/**
 * Public API surface of the mixin — used as the explicit return type to
 * avoid TS4094 ("private/protected member of anonymous class type").
 */
export interface LitroPageInterface {
  serverData: unknown;
  loading: boolean;
  onBeforeEnter(location: LitroLocation): Promise<void>;
  fetchData(location: LitroLocation): Promise<unknown>;
}

/**
 * Mixin that adds framework-managed data fetching to any LitElement subclass.
 *
 * Usage:
 * ```ts
 * class MyPage extends LitroPageMixin(LitElement) {
 *   override async fetchData(location: LitroLocation) {
 *     const res = await fetch(`/api/items/${location.params.id}`);
 *     return res.json();
 *   }
 *   render() {
 *     return html`...`;
 *   }
 * }
 * ```
 */
export const LitroPageMixin = <T extends Constructor>(Base: T): (new (...args: any[]) => LitroPageInterface) & T => {
  class LitroPageClass extends Base {
    /**
     * The page data, populated either from the server-injected script tag
     * (on SSR load) or from `fetchData()` (on client navigation).
     *
     * Type is `unknown` at the mixin level; subclasses should narrow it:
     * ```ts
     * @state() declare serverData: MyDataShape | null;
     * ```
     */
    @state() serverData: unknown = null;

    /**
     * True while `fetchData()` is running on a client navigation.
     * Use this to show a loading indicator.
     */
    @state() loading = false;

    /**
     * LitroRouter lifecycle hook — called before the element enters the DOM.
     *
     * On first SSR load: reads server-serialized data from the script tag
     * (via `getServerData()`) and stores it in `this.serverData`. This is
     * synchronous from the component's perspective — the data is already in
     * the DOM as JSON.
     *
     * On client navigation: `getServerData()` returns null (the script tag
     * was consumed on first load). Falls through to calling `fetchData()` with
     * the current router location.
     *
     * @param location - The target LitroLocation (pathname, params, search, hash).
     */
    async onBeforeEnter(location: LitroLocation): Promise<void> {
      // Attempt to read SSR-injected data first.
      const initial = getServerData();
      if (initial !== null) {
        this.serverData = initial;
        return;
      }

      // No SSR data available — this is a client-side navigation.
      // Call the subclass hook to fetch data from an API route.
      this.loading = true;
      try {
        this.serverData = await this.fetchData(location);
      } finally {
        this.loading = false;
      }
    }

    /**
     * Override in page components to fetch data during client-side navigation.
     *
     * This is NOT called on the first SSR page load — data is read from the
     * server-injected script tag instead. It IS called on every subsequent
     * client navigation to this page.
     *
     * ```ts
     * override async fetchData(location: LitroLocation) {
     *   const res = await fetch(`/api/items/${location.params.id}`);
     *   return res.json();
     * }
     * ```
     *
     * @param _location - The target LitroLocation with params and query.
     * @returns A JSON-serializable value that will be stored in `this.serverData`.
     */
    async fetchData(_location: LitroLocation): Promise<unknown> {
      return null;
    }
  }

  return LitroPageClass as unknown as (new (...args: any[]) => LitroPageInterface) & T;
};

/**
 * Convenience base class for page components.
 *
 * Equivalent to `LitroPageMixin(LitElement)`. Extend this class when you
 * do not need to compose multiple mixins:
 *
 * ```ts
 * @customElement('page-home')
 * export class HomePage extends LitroPage {
 *   @state() declare serverData: { message: string } | null;
 *
 *   override async fetchData() {
 *     const res = await fetch('/api/hello');
 *     return res.json();
 *   }
 *
 *   render() {
 *     if (this.loading) return html`<p>Loading...</p>`;
 *     return html`<h1>${this.serverData?.message}</h1>`;
 *   }
 * }
 * ```
 */
export class LitroPage extends LitroPageMixin(LitElement) {}
