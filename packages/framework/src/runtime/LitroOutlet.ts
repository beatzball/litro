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
 * 4. litro-router IS CLIENT-ONLY
 *    This module must NEVER be imported in server-side code paths. LitroRouter
 *    accesses window, history, and document at runtime and will crash Node.js.
 */

import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
// LitroRouter accesses `window` at runtime. We only import the TYPE here
// (erased at runtime); the value is loaded lazily via a dynamic import inside
// firstUpdated() so the module is never evaluated in Node.js.
import type { LitroRouter, Route } from '@beatzball/litro-router';

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
   * Example:
   *   [
   *     { path: '/', component: 'page-home', action: async () => { await import('./pages/index.js'); } },
   *     { path: '/about', component: 'page-about', action: async () => { await import('./pages/about.js'); } },
   *   ]
   */
  @property({ type: Array }) routes: Route[] = [];

  private router?: LitroRouter;

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
    const { LitroRouter } = await import('@beatzball/litro-router');
    // Remove any SSR'd children before the router takes over. The SSR'd page
    // component is streamed inside <litro-outlet> so content is visible before
    // JS loads. The router renders a new instance and manages the outlet from
    // here; the old SSR node must be cleared first or the router will append a
    // second copy alongside it (duplicate content bug).
    while (this.lastChild) {
      this.removeChild(this.lastChild);
    }
    this.router = new LitroRouter(this);
    this.router.setRoutes(this.routes);
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
