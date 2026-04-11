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
// URLPattern types and fallback
//
// URLPattern (https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) is
// Baseline Newly Available (Sep 2025) but missing in Safari < 18.2 / iOS < 18.2.
// When the native API is absent we install a minimal fallback that covers the
// three pattern shapes Litro generates:
//   /                  — static paths
//   /blog/:slug        — named parameters
//   /docs/:section?    — optional parameters
//   /:all*             — catch-all (produced by h3ToURLPattern)
//
// The fallback is intentionally NOT a full spec-compliant polyfill — it only
// handles pathname matching with the subset of syntax above.
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

/**
 * Minimal URLPattern fallback for browsers that lack the native API
 * (Safari < 18.2, iOS < 18.2). Installed on globalThis only when the native
 * constructor is absent — zero overhead on modern browsers.
 */
if (typeof (globalThis as Record<string, unknown>).URLPattern === 'undefined') {
  class LitroURLPattern {
    private _re: RegExp;
    private _names: string[] = [];

    constructor(init: URLPatternInit = {}) {
      const pattern = init.pathname ?? '*';
      const names: string[] = [];
      const src = pattern
        // catch-all :name*  →  captures the rest of the path
        .replace(/:([^/?*]+)\*/g, (_, n: string) => { names.push(n); return '(.*)'; })
        // optional :param?
        .replace(/:([^/?*]+)\?/g, (_, n: string) => { names.push(n); return '([^/]*)'; })
        // required :param
        .replace(/:([^/?*]+)/g, (_, n: string) => { names.push(n); return '([^/]+)'; });
      this._names = names;
      this._re = new RegExp('^' + src + '$');
    }

    exec(input: URLPatternInit = {}): URLPatternResult | null {
      const match = this._re.exec(input.pathname ?? '');
      if (!match) return null;
      const groups: Record<string, string | undefined> = {};
      this._names.forEach((n, i) => {
        groups[n] = match[i + 1] || undefined;
      });
      return { pathname: { groups } };
    }
  }

  (globalThis as Record<string, unknown>).URLPattern = LitroURLPattern;
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
  /** Last pathname+search rendered by `_resolve()`. Used to skip re-renders on hash-only navigations. */
  private _lastPathAndSearch = '';
  /** Screen-reader live region for announcing page changes after SPA navigation. */
  private _announceEl: HTMLElement | null = null;

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

    // Make the outlet programmatically focusable for post-navigation focus management.
    if (!this.outlet.hasAttribute('tabindex')) {
      this.outlet.setAttribute('tabindex', '-1');
      this.outlet.style.outline = 'none';
    }

    // Create a persistent live region for screen reader route announcements.
    if (!this._announceEl) {
      this._announceEl = document.createElement('div');
      this._announceEl.id = '_litro_announce';
      this._announceEl.setAttribute('role', 'status');
      this._announceEl.setAttribute('aria-live', 'polite');
      this._announceEl.setAttribute('aria-atomic', 'true');
      this._announceEl.className = 'sr-only';
      this._announceEl.style.cssText =
        'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
      document.body.appendChild(this._announceEl);
    }

    // Fragment navigations (clicking <a href="#section">) fire popstate per the
    // HTML spec. Guard against re-rendering the same page when only the hash changes.
    // Compare pathname+search so query string changes (e.g. /search?q=a → /search?q=b)
    // still trigger a re-render.
    window.addEventListener('popstate', () => {
      if (location.pathname + location.search === this._lastPathAndSearch) return;
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
    this._lastPathAndSearch = pathname + location.search;

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

      // Focus the outlet so keyboard users start at the top of the new page.
      this.outlet.focus({ preventScroll: true });

      // Announce the new page to screen readers via the persistent live region.
      if (this._announceEl) {
        this._announceEl.textContent = '';
        // Use a microtask so the empty→filled transition triggers the live region.
        Promise.resolve().then(() => {
          if (this._announceEl) {
            // Try to find an h1 inside the new page element (may be in shadow DOM).
            const heading = el.querySelector('h1')
              ?? el.shadowRoot?.querySelector('h1');
            this._announceEl.textContent = heading?.textContent?.trim() || document.title;
          }
        });
      }

      // Scroll to top of the new page, then override with hash target if present.
      // Heading elements injected via unsafeHTML live inside shadow roots, so
      // native fragment scrolling can't reach them — we traverse the shadow tree.
      const hash = location.hash;
      if (hash) {
        this._scrollToHash(hash);
      } else {
        window.scrollTo(0, 0);
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
