/**
 * Unit tests for LitroRouter and h3ToURLPattern.
 *
 * Run with: pnpm --filter litro-router test
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { LitroRouter, h3ToURLPattern } from '../index.js';

// ---------------------------------------------------------------------------
// URLPattern polyfill
//
// URLPattern is browser-native (Baseline Sep 2025); jsdom does not include it
// and Node.js does not expose it as a global. We provide a minimal but correct
// implementation that covers the three pattern shapes Litro uses:
//   /                       — exact root
//   /blog/:slug             — named parameter
//   /:all*                  — catch-all (produced by h3ToURLPattern)
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (typeof (globalThis as Record<string, unknown>).URLPattern !== 'undefined') return;

  (globalThis as Record<string, unknown>).URLPattern = class MinimalURLPattern {
    private regex: RegExp;
    private paramNames: string[] = [];

    constructor(init: { pathname?: string } = {}) {
      const pattern = init.pathname ?? '*';
      const names: string[] = [];
      const src = pattern
        // catch-all :name*  →  captures the rest of the path
        .replace(/:([^/?*]+)\*/g, (_, n) => { names.push(n); return '(.*)'; })
        // optional :param?
        .replace(/:([^/?*]+)\?/g, (_, n) => { names.push(n); return '([^/]*)'; })
        // required :param
        .replace(/:([^/?*]+)/g, (_, n) => { names.push(n); return '([^/]+)'; });
      this.paramNames = names;
      this.regex = new RegExp('^' + src + '$');
    }

    exec(input: { pathname?: string } = {}): {
      pathname: { groups: Record<string, string | undefined> };
    } | null {
      const match = this.regex.exec(input.pathname ?? '');
      if (!match) return null;
      const groups: Record<string, string | undefined> = {};
      this.paramNames.forEach((n, i) => {
        groups[n] = match[i + 1] || undefined;
      });
      return { pathname: { groups } };
    }
  };
});

// ---------------------------------------------------------------------------
// h3ToURLPattern — catch-all syntax conversion
// ---------------------------------------------------------------------------

describe('h3ToURLPattern', () => {
  it('leaves static paths unchanged', () => {
    expect(h3ToURLPattern('/')).toBe('/');
    expect(h3ToURLPattern('/about')).toBe('/about');
    expect(h3ToURLPattern('/blog/post')).toBe('/blog/post');
  });

  it('leaves named params unchanged', () => {
    expect(h3ToURLPattern('/blog/:slug')).toBe('/blog/:slug');
    expect(h3ToURLPattern('/docs/:section/:page')).toBe('/docs/:section/:page');
  });

  it('converts :param(.*)* to :param* (catch-all)', () => {
    expect(h3ToURLPattern('/:all(.*)*')).toBe('/:all*');
    expect(h3ToURLPattern('/files/:rest(.*)*')).toBe('/files/:rest*');
  });

  it('leaves optional :param? unchanged', () => {
    expect(h3ToURLPattern('/docs/:section?')).toBe('/docs/:section?');
  });

  it('does not modify plain named params that happen to precede other segments', () => {
    expect(h3ToURLPattern('/a/:b/c')).toBe('/a/:b/c');
  });
});

// ---------------------------------------------------------------------------
// No click interceptor on document
//
// The global click interceptor (_interceptClicks) was removed. LitroRouter
// no longer calls document.addEventListener('click', ...) in setRoutes().
// Plain <a> tags do full page reloads; only <litro-link> (which calls
// LitroRouter.go() directly) performs SPA navigation.
// ---------------------------------------------------------------------------

describe('LitroRouter — no document click listener', () => {
  it('setRoutes() does not register a click listener on document', () => {
    const clickListeners: EventListenerOrEventListenerObject[] = [];
    const original = document.addEventListener.bind(document);
    const spy = vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject, ...rest: Parameters<typeof document.addEventListener> extends [string, EventListenerOrEventListenerObject, ...infer R] ? R : never[]) => {
        if (type === 'click') clickListeners.push(listener);
        original(type, listener, ...(rest as [EventListenerOptions | boolean | undefined]));
      },
    );

    const outlet = document.createElement('div');
    document.body.appendChild(outlet);
    if (!customElements.get('no-click-page')) {
      customElements.define('no-click-page', class extends HTMLElement {});
    }
    const router = new LitroRouter(outlet);
    router.setRoutes([{ path: '/', component: 'no-click-page' }]);

    expect(clickListeners).toHaveLength(0);

    spy.mockRestore();
    outlet.remove();
  });

  it('clicking a plain <a> tag does NOT call LitroRouter.go()', () => {
    // setRoutes() registers only a popstate listener, not a click listener.
    // A plain <a href="/about"> click therefore triggers full navigation, not SPA.
    const goSpy = vi.spyOn(history, 'pushState');

    const outlet = document.createElement('div');
    document.body.appendChild(outlet);
    if (!customElements.get('no-intercept-page')) {
      customElements.define('no-intercept-page', class extends HTMLElement {});
    }
    const router = new LitroRouter(outlet);
    router.setRoutes([{ path: '/about', component: 'no-intercept-page' }]);

    // Simulate a click on a plain anchor in the document
    const anchor = document.createElement('a');
    anchor.href = '/about';
    document.body.appendChild(anchor);

    // Dispatch a click event — LitroRouter should NOT intercept it,
    // so pushState should NOT be called as a result of the click.
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(clickEvent);

    // pushState was NOT called by the router's click handler (there is none)
    expect(goSpy).not.toHaveBeenCalled();

    goSpy.mockRestore();
    anchor.remove();
    outlet.remove();
  });
});

// ---------------------------------------------------------------------------
// LitroRouter.go()
// ---------------------------------------------------------------------------

describe('LitroRouter.go()', () => {
  it('pushes a new history entry', () => {
    const spy = vi.spyOn(history, 'pushState');
    LitroRouter.go('/about');
    expect(spy).toHaveBeenCalledWith(null, '', '/about');
    spy.mockRestore();
  });

  it('dispatches a popstate event on window', () => {
    return new Promise<void>((resolve) => {
      window.addEventListener('popstate', () => resolve(), { once: true });
      LitroRouter.go('/dispatch-test');
    });
  });
});

// ---------------------------------------------------------------------------
// Route resolution
// ---------------------------------------------------------------------------

describe('LitroRouter — setRoutes and resolve', () => {
  let outlet: HTMLDivElement;
  let router: LitroRouter;

  beforeEach(() => {
    outlet = document.createElement('div');
    document.body.appendChild(outlet);
    router = new LitroRouter(outlet);
  });

  afterEach(() => {
    outlet.remove();
  });

  it('mounts the matching static-route component into the outlet', async () => {
    history.replaceState(null, '', '/');
    if (!customElements.get('rr-home')) {
      customElements.define('rr-home', class extends HTMLElement {});
    }
    router.setRoutes([{ path: '/', component: 'rr-home' }]);
    await new Promise(r => setTimeout(r, 0));
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('rr-home');
  });

  it('extracts named params and passes them to onBeforeEnter', async () => {
    history.replaceState(null, '', '/blog/hello-world');
    let receivedParams: Record<string, string | undefined> | undefined;
    customElements.define('rr-blog-slug', class extends HTMLElement {
      onBeforeEnter(loc: { params: Record<string, string | undefined> }) {
        receivedParams = loc.params;
      }
    });
    router.setRoutes([{ path: '/blog/:slug', component: 'rr-blog-slug' }]);
    await new Promise(r => setTimeout(r, 0));
    expect(receivedParams?.slug).toBe('hello-world');
  });

  it('matches catch-all routes (/:all(.*)*)', async () => {
    history.replaceState(null, '', '/some/deep/unknown/path');
    if (!customElements.get('rr-catch')) {
      customElements.define('rr-catch', class extends HTMLElement {});
    }
    router.setRoutes([{ path: '/:all(.*)*', component: 'rr-catch' }]);
    await new Promise(r => setTimeout(r, 0));
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('rr-catch');
  });

  it('clears existing outlet children before mounting', async () => {
    history.replaceState(null, '', '/');
    const stale = document.createElement('span');
    outlet.appendChild(stale);
    if (!customElements.get('rr-fresh')) {
      customElements.define('rr-fresh', class extends HTMLElement {});
    }
    router.setRoutes([{ path: '/', component: 'rr-fresh' }]);
    await new Promise(r => setTimeout(r, 0));
    expect(outlet.querySelector('span')).toBeNull();
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('rr-fresh');
  });

  it('runs action() before mounting the component', async () => {
    history.replaceState(null, '', '/');
    const order: string[] = [];
    let mountedAfterAction = false;
    customElements.define('rr-action-order', class extends HTMLElement {
      connectedCallback() {
        mountedAfterAction = order.includes('action');
      }
    });
    router.setRoutes([{
      path: '/',
      component: 'rr-action-order',
      action: async () => { order.push('action'); },
    }]);
    await new Promise(r => setTimeout(r, 10));
    expect(order).toContain('action');
    expect(mountedAfterAction).toBe(true);
  });

  it('does not mount anything when no route has a component', async () => {
    history.replaceState(null, '', '/');
    router.setRoutes([{ path: '/' }]); // no component key
    await new Promise(r => setTimeout(r, 0));
    expect(outlet.children.length).toBe(0);
  });

  it('re-resolves when LitroRouter.go() triggers popstate', async () => {
    if (!customElements.get('rr-nav')) {
      customElements.define('rr-nav', class extends HTMLElement {});
    }
    history.replaceState(null, '', '/');
    router.setRoutes([{ path: '/nav-target', component: 'rr-nav' }]);
    await new Promise(r => setTimeout(r, 0)); // initial resolve (no match)

    LitroRouter.go('/nav-target');
    await new Promise(r => setTimeout(r, 0));
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('rr-nav');
  });
});

