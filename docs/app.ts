/**
 * Client entry — a two-statement bootstrap. Keep it that way.
 *
 * The only job of this file is to install Lit's hydration support before any
 * Lit code is evaluated. Everything else lives in app-main.ts, behind a DYNAMIC
 * import, because a static import cannot be trusted to come second.
 *
 * `@lit-labs/ssr-client/lit-element-hydrate-support.js` patches nothing itself.
 * It only assigns `globalThis.litElementHydrateSupport`. The patch is applied by
 * `lit-element`, on one line of its own module body:
 *
 *   globalThis.litElementHydrateSupport?.({ LitElement });
 *
 * That line runs ONCE, when `lit-element` is evaluated, and the `?.` makes a
 * missing hook a permanent silent no-op. Nothing throws and nothing is logged:
 * every server-rendered page is quietly discarded and re-rendered in the
 * browser, which looks almost right and is measurably slower.
 *
 * Putting the import first in source order is NOT enough. All of a module's
 * static imports evaluate before its own body, so if the bundler leaves
 * `lit-element` in a chunk this entry imports statically, that chunk wins. From
 * Vite 8.1.6 (Rolldown 1.1.5) onward it does exactly that whenever the entry
 * and a page component both reach the same app-level barrel.
 *
 * A dynamic import is the one thing that cannot be hoisted ahead of this body.
 * So adding an ordinary `import` line here reintroduces the fault — add it to
 * app-main.ts instead. `scripts/verify-scaffolded-apps.mjs` fails the build if
 * anyone does. See BUILD-009.
 */

// Statement 1 — assign the hydration hook.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

// Statement 2 — the real entry, which may now evaluate Lit freely.
void import('./app-main.js');
