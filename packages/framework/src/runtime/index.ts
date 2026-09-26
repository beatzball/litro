/**
 * Litro runtime — public API barrel
 *
 * This is the entry point for `import ... from '@beatzball/litro/runtime'`.
 *
 * NOTE: every module behind this barrel loads in Node. The modules that use
 * litro-router load it with a dynamic import inside a browser-only lifecycle
 * method, so nothing here touches window, history or document at module
 * scope. An older version of this note said the barrel must not be imported
 * server-side; that stopped being true when those imports were made lazy.
 *
 * What the barrel still cannot do is REGISTER an element in the server's
 * custom element registry. It re-exports `LitroOutlet` and `LitroLink` as
 * NAMES, and Rollup drops a re-export that nothing uses, so the element is
 * never defined and SSR prints a bare tag (BUILD-007). Import
 * `litro/runtime/LitroLink.js` or `litro/runtime/LitroOutlet.js` directly
 * when you need the side effect — those paths are listed in the package's
 * `sideEffects` (BUILD-001). The framework's own adapters already import
 * `LitroLink.js` into the server bundle from `manifestPreamble()`, so a page
 * does not have to.
 *
 * Data fetching exports:
 *   getServerData  — reads the server-injected data script tag on first load
 *   LitroPage      — optional base class with onBeforeEnter + fetchData()
 *   LitroPageMixin — mixin form for multiple inheritance scenarios
 *
 * Note: `definePageData` is intentionally NOT exported here. It is a
 * server-only export (references H3Event) and belongs in the main 'litro'
 * entry point, which is only imported in server/page source files.
 */

export { LitroOutlet, initRouter } from './LitroOutlet.js';
export { LitroLink } from './LitroLink.js';
export { getServerData } from './page-data.js';
export { LitroPage, LitroPageMixin } from './LitroPage.js';

// The shadow-root box model. `LitroPage` already carries it; import it
// directly to compose it into a component that cannot extend `LitroPage`,
// or into a page that declares its own `static override styles`.
export { pageReset } from './page-reset.js';
export { pageResetCss } from './page-reset-css.js';

// Re-export the Route type so consumers don't need a direct litro-router
// dependency just to type their route arrays.
export type { Route, LitroLocation } from '@beatzball/litro-router';
