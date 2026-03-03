/**
 * Unit tests for LitroRouter and vaadinToURLPattern.
 *
 * Run with: pnpm --filter litro-router test
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { LitroRouter, vaadinToURLPattern } from '../index.js';

// ---------------------------------------------------------------------------
// URLPattern polyfill
//
// URLPattern is browser-native (Baseline Sep 2025); jsdom does not include it
// and Node.js does not expose it as a global. We provide a minimal but correct
// implementation that covers the three pattern shapes Litro uses:
//   /                       — exact root
//   /blog/:slug             — named parameter
//   /:all*                  — catch-all (produced by vaadinToURLPattern)
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
// vaadinToURLPattern — catch-all syntax conversion
// ---------------------------------------------------------------------------

describe('vaadinToURLPattern', () => {
  it('leaves static paths unchanged', () => {
    expect(vaadinToURLPattern('/')).toBe('/');
    expect(vaadinToURLPattern('/about')).toBe('/about');
    expect(vaadinToURLPattern('/blog/post')).toBe('/blog/post');
  });

  it('leaves named params unchanged', () => {
    expect(vaadinToURLPattern('/blog/:slug')).toBe('/blog/:slug');
    expect(vaadinToURLPattern('/docs/:section/:page')).toBe('/docs/:section/:page');
  });

  it('converts :param(.*)* to :param* (catch-all)', () => {
    expect(vaadinToURLPattern('/:all(.*)*')).toBe('/:all*');
    expect(vaadinToURLPattern('/files/:rest(.*)*')).toBe('/files/:rest*');
  });

  it('leaves optional :param? unchanged', () => {
    expect(vaadinToURLPattern('/docs/:section?')).toBe('/docs/:section?');
  });

  it('does not modify plain named params that happen to precede other segments', () => {
    expect(vaadinToURLPattern('/a/:b/c')).toBe('/a/:b/c');
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

// ---------------------------------------------------------------------------
// Click interception
// ---------------------------------------------------------------------------

describe('LitroRouter — click interception', () => {
  let outlet: HTMLDivElement;

  beforeEach(() => {
    outlet = document.createElement('div');
    document.body.appendChild(outlet);
    const router = new LitroRouter(outlet);
    // Empty routes — we only care about whether go() is called, not routing.
    router.setRoutes([]);
  });

  afterEach(() => {
    outlet.remove();
  });

  function click(a: HTMLAnchorElement, overrides?: MouseEventInit): void {
    a.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, button: 0,
      ...overrides,
    }));
  }

  it('intercepts left-clicks on same-origin anchors', () => {
    const spy = vi.spyOn(LitroRouter, 'go');
    const a = document.createElement('a');
    a.href = `${location.origin}/page`;
    document.body.appendChild(a);
    click(a);
    expect(spy).toHaveBeenCalledWith('/page');
    a.remove();
    spy.mockRestore();
  });

  it('does not intercept external-origin links', () => {
    const spy = vi.spyOn(LitroRouter, 'go');
    const a = document.createElement('a');
    a.href = 'https://external.example.com/page';
    document.body.appendChild(a);
    click(a);
    expect(spy).not.toHaveBeenCalled();
    a.remove();
    spy.mockRestore();
  });

  it('does not intercept links with a target attribute', () => {
    const spy = vi.spyOn(LitroRouter, 'go');
    const a = document.createElement('a');
    a.href = `${location.origin}/page`;
    a.target = '_blank';
    document.body.appendChild(a);
    click(a);
    expect(spy).not.toHaveBeenCalled();
    a.remove();
    spy.mockRestore();
  });

  it('does not intercept ctrl+click', () => {
    const spy = vi.spyOn(LitroRouter, 'go');
    const a = document.createElement('a');
    a.href = `${location.origin}/page`;
    document.body.appendChild(a);
    click(a, { ctrlKey: true });
    expect(spy).not.toHaveBeenCalled();
    a.remove();
    spy.mockRestore();
  });

  it('does not intercept meta+click', () => {
    const spy = vi.spyOn(LitroRouter, 'go');
    const a = document.createElement('a');
    a.href = `${location.origin}/page`;
    document.body.appendChild(a);
    click(a, { metaKey: true });
    expect(spy).not.toHaveBeenCalled();
    a.remove();
    spy.mockRestore();
  });

  it('does not intercept right-clicks (button !== 0)', () => {
    const spy = vi.spyOn(LitroRouter, 'go');
    const a = document.createElement('a');
    a.href = `${location.origin}/page`;
    document.body.appendChild(a);
    click(a, { button: 2 });
    expect(spy).not.toHaveBeenCalled();
    a.remove();
    spy.mockRestore();
  });
});
