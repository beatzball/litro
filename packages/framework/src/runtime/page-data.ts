/**
 * page-data.ts — Server/client data fetching bridge
 *
 * Server side:
 *   `definePageData(fetcher)` declares a data fetcher that the SSR handler
 *   invokes before rendering. The result is serialized into a
 *   <script type="application/json" id="__litro_data__"> tag in the HTML shell,
 *   making it available to the client without an extra round-trip.
 *
 * Client side:
 *   `getServerData()` reads and parses that script tag on first page load.
 *   After client-side navigation the tag is gone (it is removed after first
 *   read), so the function returns null — the page component is then
 *   responsible for fetching its own data via fetchData() / fetch().
 *
 * Import discipline:
 *   - `definePageData` must only be imported in page source files and server
 *     code. It references `H3Event` from 'h3', which is server-only.
 *   - `getServerData` is safe to import client-side; it guards on
 *     `typeof document === 'undefined'` and never imports any server module.
 */

import type { H3Event } from 'h3';

/**
 * The shape produced by `definePageData()`.
 *
 * The `__litroPageData` sentinel lets the SSR handler detect this export via
 * a simple duck-type check without relying on instanceof or a class registry.
 */
export interface PageDataFetcher<T> {
  __litroPageData: true;
  fetcher: (event: H3Event) => Promise<T>;
}

/**
 * Declares a server-side data fetcher for a page.
 *
 * Export the return value as `pageData` from your page file:
 *
 * ```ts
 * // pages/index.ts
 * export const pageData = definePageData(async (event) => {
 *   const db = useDatabase(event);
 *   return db.getItems();
 * });
 * ```
 *
 * The SSR handler automatically detects the `pageData` export, calls the
 * fetcher with the H3 event (so you can read headers, cookies, params, etc.),
 * and serializes the result into the HTML shell as:
 *
 * ```html
 * <script type="application/json" id="__litro_data__">{"key":"value"}</script>
 * ```
 *
 * On the client, read the data with `getServerData<T>()`.
 *
 * @param fetcher - An async function that receives the H3 event and returns
 *                  the data object for this page. Must return a
 *                  JSON-serializable value.
 */
export function definePageData<T>(
  fetcher: (event: H3Event) => Promise<T>,
): PageDataFetcher<T> {
  return { __litroPageData: true, fetcher };
}

/**
 * Reads the server-serialized page data on first client load.
 *
 * On a fresh SSR page load the server injects a
 * `<script type="application/json" id="__litro_data__">` tag. This function
 * parses that tag and removes it so that subsequent client-side navigations
 * (which do NOT hit the server) cannot read stale data.
 *
 * Returns `null` in three cases:
 *   1. Called server-side (no `document` global — SSR execution context).
 *   2. The tag is absent (client-side navigation after initial load).
 *   3. The tag content is not valid JSON.
 *
 * Usage in a page component:
 * ```ts
 * connectedCallback() {
 *   super.connectedCallback();
 *   const data = getServerData<MyData>();
 *   if (data) {
 *     this.myProp = data;
 *   }
 * }
 * ```
 *
 * Or via `LitroPage` base class which calls this automatically in
 * `onBeforeEnter()`.
 */
export function getServerData<T>(): T | null {
  // Guard: this function is safe to call in isomorphic code; server-side it
  // always returns null because there is no document global.
  if (typeof document === 'undefined') return null;

  const el = document.getElementById('__litro_data__');
  if (!el) return null;

  try {
    const data = JSON.parse(el.textContent || '');
    // Remove the tag after reading so client navigations do not read stale
    // data from a previous SSR load.
    el.remove();
    return data as T;
  } catch {
    // Malformed JSON — treat as no data.
    return null;
  }
}
