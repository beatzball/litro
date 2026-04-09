/**
 * LitroOutlet (Elena) — <litro-outlet>
 *
 * Elena implementation of the router mount point. Mirrors the Lit/FAST
 * version's behavior:
 *
 * 1. LIGHT DOM — the router appends children directly to this element.
 *    Elena components use light DOM by default (no shadow root).
 *
 * 2. COMPOSITE TYPE — no render() method. The element enhances composed
 *    children; LitroRouter manages the subtree.
 *
 * 3. ROUTER MOUNTED AFTER FIRST CONNECTION — connectedCallback() with
 *    a one-shot flag ensures the element is in the DOM before mounting.
 *
 * 4. CLIENT-ONLY — never import in server code paths.
 */

import { Elena } from '@elenajs/core';
import type { LitroRouter, Route } from '@beatzball/litro-router';

export class LitroOutlet extends Elena(HTMLElement) {
  static tagName = 'litro-outlet';

  private _routes: Route[] = [];
  private _router?: LitroRouter;
  private _initialized = false;

  get routes(): Route[] {
    return this._routes;
  }

  set routes(value: Route[]) {
    this._routes = value;
    if (this._router) {
      this._router.setRoutes(value);
    }
  }

  override connectedCallback(): void {
    if (typeof super.connectedCallback === 'function') {
      super.connectedCallback();
    }

    if (!this._initialized) {
      this._initialized = true;
      // Mount the router after the element is connected to the DOM.
      // Dynamic import keeps litro-router out of server bundles.
      void import('@beatzball/litro-router').then(({ LitroRouter }) => {
        this._router = new LitroRouter(this);
        this._router.setRoutes(this._routes);
      });
    }
  }
}

LitroOutlet.define();

/**
 * Programmatic entry point for bootstrapping the router.
 * Same contract as the Lit/FAST versions.
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
