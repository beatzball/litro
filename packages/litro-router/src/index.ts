/**
 * LitroRouter — Litro's built-in client-side router.
 *
 * Replaces @vaadin/router (deprecated). Built on the native URLPattern API
 * (Baseline Newly Available Sep 2025; polyfill available for older browsers).
 *
 * Client-only — never import this module server-side. It accesses
 * `window`, `history`, `document`, and `location` at runtime.
 *
 * Design decisions:
 *
 * 1. URLPattern for matching — web-platform primitive, zero bundle overhead
 *    in modern browsers. The only format conversion needed is the catch-all
 *    modifier: Litro paths use `:param(.*)*` (h3/path-to-regexp convention),
 *    which URLPattern spells as `:param*`.
 *
 * 2. Same external API shape as @vaadin/router — setRoutes(), static go(),
 *    and onBeforeEnter() on page elements — so LitroOutlet and LitroPage
 *    need only minimal changes.
 *
 * 3. Click interception via event.composedPath() so links inside Shadow DOM
 *    are correctly detected across shadow boundaries.
 *
 * 4. onBeforeEnter(location) is called on the newly created element BEFORE
 *    it is appended to the outlet, matching the vaadin-router lifecycle that
 *    LitroPage depends on for server-data hydration.
 */

// ---------------------------------------------------------------------------
// URLPattern ambient types
// URLPattern (https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) is
// Baseline Newly Available (Sep 2025) but not yet in TypeScript's DOM lib.
// Declare the minimal subset we use so tsc compiles without lib changes.
// ---------------------------------------------------------------------------

interface URLPatternInit {
  pathname?: string;
}

interface URLPatternComponentResult {
  groups: Record<string, string | undefined>;
}

interface URLPatternResult {
  pathname: URLPatternComponentResult;
}

declare class URLPattern {
  constructor(init?: URLPatternInit);
  exec(input?: URLPatternInit): URLPatternResult | null;
}

// ---------------------------------------------------------------------------

/** Route definition consumed by LitroOutlet and the generated routes file. */
export interface Route {
  /** Path pattern in h3/Litro format (e.g. '/', '/blog/:slug', '/:all(.*)*'). */
  path: string;
  /** Custom element tag name to render for this route. */
  component?: string;
  /** Optional async callback run before the component is mounted (e.g. dynamic import). */
  action?: () => Promise<void> | void;
}

/**
 * Route location object passed to page element lifecycle hooks.
 * Replaces @vaadin/router's RouterLocation.
 */
export interface LitroLocation {
  /** Current pathname (e.g. '/blog/hello-world'). */
  pathname: string;
  /** Named URL parameters extracted by URLPattern (e.g. { slug: 'hello-world' }). */
  params: Record<string, string | undefined>;
  /** Query string including '?' (e.g. '?page=2'), or '' if none. */
  search: string;
  /** Hash fragment including '#' (e.g. '#section'), or '' if none. */
  hash: string;
}

interface InternalRoute {
  pattern: URLPattern;
  component: string;
  action: () => Promise<void> | void;
}

export class LitroRouter {
  private routes: InternalRoute[] = [];
  private outlet: HTMLElement;

  constructor(outlet: HTMLElement) {
    this.outlet = outlet;
  }

  setRoutes(routes: Route[]): void {
    this.routes = routes
      .filter((r): r is Route & { component: string } => !!r.component)
      .map(r => ({
        pattern: new URLPattern({ pathname: h3ToURLPattern(r.path) }),
        component: r.component,
        action: r.action ?? (() => {}),
      }));

    window.addEventListener('popstate', () => void this._resolve());
    document.addEventListener('click', this._interceptClicks.bind(this));
    void this._resolve();
  }

  /**
   * Programmatic navigation. Pushes a new history entry and triggers routing.
   * Equivalent to @vaadin/router's Router.go().
   */
  static go(path: string): void {
    history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  /**
   * Intercepts clicks on <a> elements (including those inside Shadow DOM)
   * and converts them to client-side navigations.
   */
  private _interceptClicks(e: MouseEvent): void {
    // Already handled (e.g. by LitroLink) — don't push a second history entry.
    if (e.defaultPrevented) return;
    // Modifier keys signal browser-native behavior (new tab, etc.) — pass through.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Only intercept left-clicks.
    if (e.button !== 0) return;

    const target = e.composedPath().find(
      el => el instanceof HTMLAnchorElement
    ) as HTMLAnchorElement | undefined;

    if (!target || !target.href || target.target) return;

    const url = new URL(target.href);
    // Only intercept same-origin navigations.
    if (url.origin !== location.origin) return;

    e.preventDefault();
    LitroRouter.go(url.pathname + url.search + url.hash);
  }

  private async _resolve(): Promise<void> {
    const pathname = location.pathname;

    for (const route of this.routes) {
      const match = route.pattern.exec({ pathname });
      if (!match) continue;

      const params = match.pathname.groups as Record<string, string | undefined>;

      // Run the action first (typically: dynamically import the page module so
      // customElements.define() runs before createElement is called).
      await route.action();

      const loc: LitroLocation = {
        pathname,
        params,
        search: location.search,
        hash: location.hash,
      };

      // Create the element, call lifecycle hook, then mount.
      const el = document.createElement(route.component) as HTMLElement & {
        onBeforeEnter?: (loc: LitroLocation) => Promise<void> | void;
      };

      if (typeof el.onBeforeEnter === 'function') {
        await el.onBeforeEnter(loc);
      }

      // Swap outlet content.
      while (this.outlet.lastChild) {
        this.outlet.removeChild(this.outlet.lastChild);
      }
      this.outlet.appendChild(el);
      return;
    }
  }
}

/**
 * Converts Litro's h3/path-to-regexp catch-all syntax to URLPattern syntax.
 * Only the catch-all modifier differs: `:param(.*)*` → `:param*`
 * All other patterns (`:param`, `:param?`) are URLPattern-compatible as-is.
 */
export function h3ToURLPattern(path: string): string {
  return path.replace(/:([^/]+)\(\.\*\)\*/g, ':$1*');
}
