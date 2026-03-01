/**
 * Litro runtime — public API barrel
 *
 * This is the entry point for `import ... from 'litro/runtime'`.
 *
 * NOTE: This barrel re-exports client-side modules that import @vaadin/router.
 * It must NOT be imported in server-side (Nitro/Node.js) code paths.
 * @vaadin/router accesses window at module evaluation time and will crash Node.js.
 *
 * Use `litro/runtime/LitroOutlet.js` or `litro/runtime/LitroLink.js` for
 * direct imports if you need finer-grained control.
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

// Re-export the @vaadin/router Route type so consumers don't need a direct
// @vaadin/router dependency just to type their route arrays.
export type { Route } from '@vaadin/router';
