/**
 * LitroOutlet (FAST) — <litro-outlet>
 *
 * FAST Element implementation of the router mount point. Mirrors the Lit
 * version's behavior exactly:
 *
 * 1. LIGHT DOM — the router appends children directly to this element.
 *    FAST uses `shadowOptions: null` to opt out of shadow DOM.
 *
 * 2. NO TEMPLATE — the element renders nothing; LitroRouter manages children.
 *
 * 3. ROUTER MOUNTED AFTER FIRST CONNECTION — equivalent to Lit's firstUpdated().
 *    FAST doesn't have firstUpdated(), so we use connectedCallback() with a
 *    one-shot flag. The element is in the DOM at this point.
 *
 * 4. CLIENT-ONLY — never import in server code paths.
 */

import { FASTElement } from '@microsoft/fast-element';
import type { LitroRouter, Route } from '@beatzball/litro-router';

export class LitroOutlet extends FASTElement {
  private _routes: Route[] = [];
  private router?: LitroRouter;
  private _initialized = false;

  get routes(): Route[] {
    return this._routes;
  }

  set routes(value: Route[]) {
    this._routes = value;
    if (this.router) {
      this.router.setRoutes(value);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();

    if (!this._initialized) {
      this._initialized = true;
      // Mount the router after the element is connected to the DOM.
      // Dynamic import keeps litro-router out of server bundles.
      void import('@beatzball/litro-router').then(({ LitroRouter }) => {
        this.router = new LitroRouter(this);
        this.router.setRoutes(this._routes);
      });
    }
  }
}

LitroOutlet.define({
  name: 'litro-outlet',
  shadowOptions: null,
});

/**
 * Programmatic entry point for bootstrapping the router.
 * Same contract as the Lit version.
 */
export function initRouter(routes: Route[]): void {
  const apply = () => {
    const outlet = document.querySelector('litro-outlet') as LitroOutlet | null;
    if (!outlet) {
      console.warn(
        '[litro] initRouter() called but no <litro-outlet> found in the document. ' +
          'Make sure <litro-outlet> exists in the HTML shell.',
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
