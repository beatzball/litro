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
 * 3. onBeforeEnter(location) is called on the newly created element BEFORE
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
  /**
   * Monotonically increasing counter. Incremented at the start of every
   * `_resolve()` call. Each invocation captures its own token and checks it
   * after every `await`; if the counter has moved on, a newer navigation
   * superseded this one and we bail out without touching the DOM.
   */
  private _resolveToken = 0;
  /** Last pathname rendered by `_resolve()`. Used to skip re-renders on hash-only navigations. */
  private _lastPathname = '';

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

    // Fragment navigations (clicking <a href="#section">) fire popstate per the
    // HTML spec. Guard against re-rendering the same page when only the hash changes.
    window.addEventListener('popstate', () => {
      if (location.pathname === this._lastPathname) return;
      void this._resolve();
    });
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

  private async _resolve(): Promise<void> {
    const token = ++this._resolveToken;
    const pathname = location.pathname;
    this._lastPathname = pathname;

    for (const route of this.routes) {
      const match = route.pattern.exec({ pathname });
      if (!match) continue;

      const params = match.pathname.groups as Record<string, string | undefined>;

      // Run the action first (typically: dynamically import the page module so
      // customElements.define() runs before createElement is called).
      await route.action();

      // A newer navigation superseded this one — bail out without touching DOM.
      if (token !== this._resolveToken) return;

      const loc: LitroLocation = {
        pathname,
        params,
        search: location.search,
        hash: location.hash,
      };

      // Create the element, call lifecycle hook, then mount.
      const el = document.createElement(route.component) as HTMLElement & {
        onBeforeEnter?: (loc: LitroLocation) => Promise<void> | void;
        updateComplete?: Promise<boolean>;
      };

      if (typeof el.onBeforeEnter === 'function') {
        await el.onBeforeEnter(loc);
      }

      // Check again after the onBeforeEnter async hook.
      if (token !== this._resolveToken) return;

      // Pre-render the new element before it's visible.
      //
      // Lit renders asynchronously (microtasks). If we clear the outlet and
      // append the new element in one step, the browser can paint the element
      // in several intermediate states (empty shell → page renders → nested
      // components like starlight-sidebar render), producing a layout shift.
      //
      // Fix: append the new element hidden *alongside* the existing content
      // so the old content stays visible while the new element renders. Once
      // the page component's first update completes and a rAF confirms that
      // nested Lit components have also flushed their microtask renders, swap
      // atomically: remove old children, reveal new element.
      el.setAttribute('hidden', '');
      this.outlet.appendChild(el);

      const settle = (el as HTMLElement & { updateComplete?: Promise<boolean> }).updateComplete
        ?? Promise.resolve(true);
      await settle;

      // One animation frame — microtasks (including nested Lit component
      // renders triggered by the page's first render) all complete before
      // the next rAF callback fires, ensuring a fully-rendered swap.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

      // Bail if a newer navigation superseded this one while we were waiting.
      if (token !== this._resolveToken) {
        el.remove();
        return;
      }

      // Atomic swap: remove previous content, reveal the pre-rendered element.
      let child = this.outlet.firstChild;
      while (child && child !== el) {
        const next = child.nextSibling;
        this.outlet.removeChild(child);
        child = next;
      }
      el.removeAttribute('hidden');

      // Scroll to hash after the component finishes rendering. Heading elements
      // injected via unsafeHTML live inside shadow roots, so native fragment
      // scrolling can't reach them — we traverse the shadow tree manually.
      const hash = location.hash;
      if (hash) {
        this._scrollToHash(hash);
      }
      return;
    }
  }

  /**
   * Scrolls to the element matching `hash` (e.g. '#welcome') by walking
   * the shadow DOM tree. Required because heading `id` attributes rendered
   * via Lit templates end up inside shadow roots that native fragment
   * navigation and `document.getElementById()` cannot reach.
   */
  private _scrollToHash(hash: string): void {
    const id = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!id) return;
    const target = this._findDeep(document, id);
    if (target) target.scrollIntoView();
  }

  private _findDeep(root: Document | ShadowRoot | Element, id: string): Element | null {
    const sel = `#${CSS.escape(id)}`;
    const direct = root.querySelector(sel);
    if (direct) return direct;
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const found = this._findDeep(el.shadowRoot, id);
        if (found) return found;
      }
    }
    return null;
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
