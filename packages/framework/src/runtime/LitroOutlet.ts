/**
 * LitroOutlet — <litro-outlet>
 *
 * The router mount point custom element. This is where LitroRouter renders
 * the current route's page component into the document.
 *
 * Design decisions:
 *
 * 1. LIGHT DOM (`createRenderRoot() { return this; }`)
 *    LitroRouter calls appendChild() on the outlet element directly. If
 *    LitroOutlet used shadow DOM, the appended children would land inside the
 *    shadow root but would be invisible to the light DOM document flow and
 *    would break CSS inheritance and slot composition. Light DOM keeps the
 *    router's subtree in the normal document tree.
 *
 * 2. NO LIT BINDINGS INSIDE THE ELEMENT
 *    Lit's reconciler only touches nodes it owns (those created by its template
 *    renderer). Because LitroOutlet renders nothing (render() is not defined),
 *    Lit never touches the element's children. LitroRouter can freely
 *    append/replace children without Lit clobbering them on re-render.
 *
 * 3. ROUTER MOUNTED IN firstUpdated()
 *    The outlet element must already be attached to the DOM before calling
 *    `new LitroRouter(outlet)`. constructor() and connectedCallback() fire too
 *    early in some upgrade scenarios. firstUpdated() is the correct Lit hook
 *    because it fires after the first render and the element is guaranteed to
 *    be in the DOM.
 *
 * 4. THE ROUTER IS CLIENT-ONLY, BUT THIS MODULE IS NOT
 *    LitroRouter accesses window, history and document, so it is loaded by a
 *    dynamic import inside firstUpdated(), which never runs on the server.
 *    Only the TYPE is imported at module scope, and a type is erased. An
 *    older version of this header said the module must never be imported
 *    server-side; that stopped being true when the import was made lazy, and
 *    the same correction applies to LitroLink.
 *
 *    The outlet does not need a server-side registration the way LitroLink
 *    does: the shell writes `<litro-outlet>` into the document itself, and
 *    the element renders its children into light DOM, so an unregistered tag
 *    still shows the SSR'd page.
 */

import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
// LitroRouter accesses `window` at runtime. We only import the TYPE here
// (erased at runtime); the value is loaded lazily via a dynamic import inside
// firstUpdated() so the module is never evaluated in Node.js.
import type { LitroRouter, Route } from '@beatzball/litro-router';

/**
 * Warn, loudly and by name, when Lit's hydration support never installed.
 *
 * `@lit-labs/ssr-client/lit-element-hydrate-support.js` does not patch anything
 * itself. It only assigns `globalThis.litElementHydrateSupport`. The patch is
 * applied by `lit-element` itself, on this one line of its module body:
 *
 *   globalThis.litElementHydrateSupport?.({ LitElement });
 *
 * That line runs ONCE, when `lit-element` is evaluated, and the `?.` makes a
 * missing hook a silent no-op. So if anything evaluates `lit-element` before
 * the hydrate-support module, no element is ever patched, for the life of the
 * page. Nothing throws and nothing is logged: the server-rendered DOM is
 * discarded and re-rendered on the client, which looks almost right and is
 * measurably slower.
 *
 * The patch's first act is to add `defer-hydration` to
 * `LitElement.observedAttributes`, so that one array answers whether it ran.
 *
 * This is not a theoretical ordering hazard. From Vite 8.1 (Rolldown 1.1.5)
 * onward, Rolldown can leave `lit-element` in a chunk the entry imports
 * STATICALLY, and a static import evaluates before the importing module's own
 * body — so source order inside `app.ts` is not enough to guarantee the
 * sequence. See BUILD-009 for the trigger and the bootstrap-entry fix.
 *
 * Deliberately a `console.error` and not a throw: a page that hydrated twice
 * still works, and breaking it would turn a performance fault into an outage.
 */
function assertHydrateSupportInstalled(): void {
  let observed: unknown;
  try {
    observed = (LitElement as unknown as { observedAttributes: unknown }).observedAttributes;
  } catch {
    // A non-standard Lit build could throw here. An unreadable list is not
    // evidence of a broken install, so say nothing rather than cry wolf.
    return;
  }

  if (Array.isArray(observed) && observed.includes('defer-hydration')) {
    return;
  }

  console.error(
    '[litro] Lit hydration support is NOT installed, so server-rendered markup ' +
      'is being thrown away and re-rendered on the client.\n' +
      "  Cause: something evaluated 'lit-element' before " +
      "'@lit-labs/ssr-client/lit-element-hydrate-support.js'. lit-element reads that " +
      'hook once, at module evaluation, and a missing hook is a silent no-op.\n' +
      '  Fix: make the client entry a two-statement bootstrap — import the hydrate ' +
      "support, then `void import('./app-main.js')` — so no static import can " +
      'evaluate ahead of the entry body. See BUILD-009.'
  );
}

@customElement('litro-outlet')
export class LitroOutlet extends LitElement {
  /**
   * Use light DOM so LitroRouter's appended children land in the normal
   * document tree, not inside an isolated shadow root.
   */
  override createRenderRoot() {
    return this;
  }

  /**
   * The array of Route objects. Set by the client entry after
   * routes.generated.ts is imported.
   *
   * Plain getter/setter — NOT a Lit reactive property (@property / static
   * properties). Routes are always assigned programmatically, never via an
   * HTML attribute, so Lit's reactive property system is not needed here.
   *
   * Why not a Lit reactive property: Lit's createProperty() installs its own
   * accessor that calls requestUpdate(), scheduling a render cycle. Because
   * LitroOutlet uses light DOM (no render()), Lit's ChildPart marker nodes are
   * never written — but a requestUpdate() could still interfere with the router
   * managing children. The plain setter forwards route changes directly to the
   * router without touching Lit's render pipeline.
   *
   * Example:
   *   [
   *     { path: '/', component: 'page-home', action: async () => { await import('./pages/index.js'); } },
   *     { path: '/about', component: 'page-about', action: async () => { await import('./pages/about.js'); } },
   *   ]
   */
  private _routes: Route[] = [];
  private router?: LitroRouter;

  get routes(): Route[] {
    return this._routes;
  }

  set routes(value: Route[]) {
    this._routes = value;
    // If the router is already initialized (i.e. routes arrived after
    // firstUpdated()), forward them immediately. This handles the timing race
    // where app.ts sets outlet.routes inside a DOMContentLoaded callback that
    // fires after Lit's first-update microtask.
    if (this.router) {
      this.router.setRoutes(value);
    }
  }

  /**
   * Mount the router after the first render.
   *
   * firstUpdated() fires once, after the component's first render cycle
   * completes and the element is in the DOM. At this point `this` is a real,
   * attached DOM node that the router can use as its outlet container.
   *
   * litro-router is imported dynamically here so it is never evaluated in
   * Node.js. The module accesses `window` at runtime; a dynamic import
   * inside this client-only lifecycle method is safe because firstUpdated()
   * never runs on the server.
   */
  override async firstUpdated() {
    assertHydrateSupportInstalled();
    const { LitroRouter } = await import('@beatzball/litro-router');
    // Do NOT clear SSR'd children here. The router's _resolve() already does an
    // atomic clear-then-append when it commits a navigation:
    //   while (outlet.lastChild) outlet.removeChild(outlet.lastChild);
    //   outlet.appendChild(el);
    // Clearing here would blank the page for the duration of the async _resolve()
    // (dynamic import + onBeforeEnter microtask), causing a visible FOUC on every
    // initial page load. Leaving the SSR'd content in place means it stays visible
    // until the router atomically swaps it out — no blank flash.
    this.router = new LitroRouter(this);
    this.router.setRoutes(this._routes);
  }
}

/**
 * Programmatic entry point for bootstrapping the router outside of the custom
 * element lifecycle (e.g., from a plain app.ts without a wrapper element).
 *
 * Usage:
 *   import { initRouter } from '@beatzball/litro/runtime/LitroOutlet.js';
 *   initRouter(routes);
 *
 * This function waits for DOMContentLoaded (if not already fired), finds the
 * first <litro-outlet> element in the document, and sets its routes property.
 * The outlet's firstUpdated() then creates and configures the router instance.
 */
export function initRouter(routes: Route[]): void {
  const apply = () => {
    const outlet = document.querySelector('litro-outlet') as LitroOutlet | null;
    if (!outlet) {
      console.warn(
        '[litro] initRouter() called but no <litro-outlet> found in the document. ' +
          'Make sure <litro-outlet> exists in the HTML shell.'
      );
      return;
    }
    outlet.routes = routes;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
}
