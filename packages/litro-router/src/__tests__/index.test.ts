/**
 * Unit tests for LitroRouter and h3ToURLPattern.
 *
 * Run with: pnpm --filter litro-router test
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// URLPattern type — mirrors the declare in index.ts so tests can use it.
// ---------------------------------------------------------------------------
interface URLPatternInit { pathname?: string }
interface URLPatternResult { pathname: { groups: Record<string, string | undefined> } }
declare class URLPattern {
  constructor(init?: URLPatternInit);
  exec(input?: URLPatternInit): URLPatternResult | null;
}

// ---------------------------------------------------------------------------
// jsdom environment stubs — must run before the router module loads
// ---------------------------------------------------------------------------

// jsdom doesn't implement scrollTo or CSS.escape — provide no-op stubs.
if (typeof window.scrollTo !== 'function' || (window.scrollTo as unknown) === undefined) {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}
if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
  (globalThis as Record<string, unknown>).CSS = {
    escape: (s: string) => s.replace(/([^\w-])/g, '\\$1'),
  };
}

// Ensure the native URLPattern is NOT available so the router's built-in
// fallback activates. This simulates Safari < 18.2 / iOS < 18.2.
delete (globalThis as Record<string, unknown>).URLPattern;

// Import AFTER deleting globalThis.URLPattern so the fallback installs.
const { LitroRouter, h3ToURLPattern } = await import('../index.js');

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
  let router: InstanceType<typeof LitroRouter>;

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

  it('removes stale outlet children after the new element renders (FOUC prevention)', async () => {
    // The new element is appended hidden alongside stale content while it
    // renders, then stale content is removed and the new element is revealed.
    // This prevents layout shifts caused by clearing before the new element
    // is ready. The swap happens after a requestAnimationFrame; jsdom fires
    // rAF via a ~16ms timeout, so we wait 50ms to be safe.
    history.replaceState(null, '', '/');
    const stale = document.createElement('span');
    outlet.appendChild(stale);
    if (!customElements.get('rr-fresh')) {
      customElements.define('rr-fresh', class extends HTMLElement {});
    }
    router.setRoutes([{ path: '/', component: 'rr-fresh' }]);
    await new Promise(r => setTimeout(r, 50));
    expect(outlet.querySelector('span')).toBeNull();
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('rr-fresh');
  });

  it('marks the outlet data-litro-settled only after the atomic swap completes', async () => {
    // Until the swap, the visible content on an initial load is the SSR'd
    // shell whose event handlers are not wired — the attribute is the
    // router's observable "current page element is live" signal, polled by
    // consumers (including e2e tests) before interacting with the page.
    history.replaceState(null, '', '/');
    const ssrShell = document.createElement('span');
    outlet.appendChild(ssrShell);
    if (!customElements.get('rr-settle')) {
      customElements.define('rr-settle', class extends HTMLElement {});
    }
    expect(outlet.hasAttribute('data-litro-settled')).toBe(false);
    router.setRoutes([{ path: '/', component: 'rr-settle' }]);
    // Synchronously after setRoutes the swap is still pending (updateComplete
    // + rAF have not run) — the marker must not be set yet.
    expect(outlet.hasAttribute('data-litro-settled')).toBe(false);
    await new Promise(r => setTimeout(r, 50));
    expect(outlet.hasAttribute('data-litro-settled')).toBe(true);
    // And it is set by the same pass that removed the stale SSR content.
    expect(outlet.querySelector('span')).toBeNull();
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

  it('scrolls to top after mounting a new page', async () => {
    history.replaceState(null, '', '/');
    if (!customElements.get('rr-scroll-top')) {
      customElements.define('rr-scroll-top', class extends HTMLElement {});
    }
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    router.setRoutes([{ path: '/', component: 'rr-scroll-top' }]);
    await new Promise(r => setTimeout(r, 50));
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    scrollSpy.mockRestore();
  });

  it('does not scroll to top when URL has a hash fragment', async () => {
    // Navigate to a path with a hash fragment
    history.replaceState(null, '', '/#section');
    if (!customElements.get('rr-scroll-hash')) {
      customElements.define('rr-scroll-hash', class extends HTMLElement {});
    }
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    router.setRoutes([{ path: '/', component: 'rr-scroll-hash' }]);
    await new Promise(r => setTimeout(r, 50));
    // scrollTo(0, 0) should NOT be called — _scrollToHash runs instead
    expect(scrollSpy).not.toHaveBeenCalledWith(0, 0);
    scrollSpy.mockRestore();
  });

  it('re-resolves when LitroRouter.go() triggers popstate', async () => {
    if (!customElements.get('rr-nav')) {
      customElements.define('rr-nav', class extends HTMLElement {});
    }
    history.replaceState(null, '', '/');
    router.setRoutes([{ path: '/nav-target', component: 'rr-nav' }]);
    await new Promise(r => setTimeout(r, 0)); // initial resolve (no match)

    LitroRouter.go('/nav-target');
    await new Promise(r => setTimeout(r, 50));
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('rr-nav');
  });
});

// ---------------------------------------------------------------------------
// URLPattern fallback (LitroURLPattern)
//
// The router installs a minimal URLPattern fallback on globalThis when the
// native API is missing (Safari < 18.2 / iOS < 18.2). These tests verify
// the fallback is active and handles all Litro route patterns correctly.
// ---------------------------------------------------------------------------

describe('URLPattern fallback (LitroURLPattern)', () => {
  it('installs on globalThis when native URLPattern is absent', () => {
    const g = globalThis as Record<string, unknown>;
    expect(typeof g.URLPattern).toBe('function');
    // The fallback class is named LitroURLPattern internally
    expect((g.URLPattern as { name: string }).name).toBe('LitroURLPattern');
  });

  it('matches static paths exactly', () => {
    const p = new URLPattern({ pathname: '/' });
    expect(p.exec({ pathname: '/' })).not.toBeNull();
    expect(p.exec({ pathname: '/other' })).toBeNull();
  });

  it('matches multi-segment static paths', () => {
    const p = new URLPattern({ pathname: '/blog/post' });
    expect(p.exec({ pathname: '/blog/post' })).not.toBeNull();
    expect(p.exec({ pathname: '/blog' })).toBeNull();
  });

  it('extracts named parameters', () => {
    const p = new URLPattern({ pathname: '/blog/:slug' });
    const result = p.exec({ pathname: '/blog/hello-world' });
    expect(result).not.toBeNull();
    expect(result!.pathname.groups.slug).toBe('hello-world');
  });

  it('named params do not match across slashes', () => {
    const p = new URLPattern({ pathname: '/blog/:slug' });
    expect(p.exec({ pathname: '/blog/a/b' })).toBeNull();
  });

  it('extracts multiple named parameters', () => {
    const p = new URLPattern({ pathname: '/docs/:section/:page' });
    const result = p.exec({ pathname: '/docs/guide/intro' });
    expect(result).not.toBeNull();
    expect(result!.pathname.groups.section).toBe('guide');
    expect(result!.pathname.groups.page).toBe('intro');
  });

  it('handles optional parameters', () => {
    const p = new URLPattern({ pathname: '/docs/:section?' });
    expect(p.exec({ pathname: '/docs/' })).not.toBeNull();
    expect(p.exec({ pathname: '/docs/guide' })).not.toBeNull();
  });

  it('handles catch-all patterns', () => {
    const p = new URLPattern({ pathname: '/:all*' });
    const result = p.exec({ pathname: '/some/deep/path' });
    expect(result).not.toBeNull();
    expect(result!.pathname.groups.all).toBe('some/deep/path');
  });

  it('handles prefixed catch-all patterns', () => {
    const p = new URLPattern({ pathname: '/files/:rest*' });
    const result = p.exec({ pathname: '/files/docs/readme.md' });
    expect(result).not.toBeNull();
    expect(result!.pathname.groups.rest).toBe('docs/readme.md');
  });

  it('catch-all matches root path', () => {
    const p = new URLPattern({ pathname: '/:all*' });
    const result = p.exec({ pathname: '/' });
    expect(result).not.toBeNull();
  });
});

