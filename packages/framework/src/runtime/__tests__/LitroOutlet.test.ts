/**
 * Unit tests for LitroOutlet (<litro-outlet>) in LitroOutlet.ts.
 *
 * The critical invariant under test: the router always receives the real route
 * table via setRoutes(), regardless of whether routes are assigned before or
 * after Lit's first update microtask fires.
 *
 * Background on the timing bug this tests against:
 *   - When <litro-outlet> is upgraded (customElements.define()), Lit schedules
 *     the first update as a microtask — not synchronously.
 *   - If `outlet.routes` is set inside a DOMContentLoaded callback, it fires
 *     AFTER that microtask, so firstUpdated() runs with routes=[] and the
 *     router is never given the real routes.
 *   - The fix: LitroOutlet.routes uses a property setter that calls
 *     setRoutes() directly when the router is already initialised. This avoids
 *     triggering Lit's update/render cycle (which would crash because
 *     firstUpdated() does not drive any Lit render in LitroOutlet's light-DOM mode).
 *
 * Testing approach:
 *   - Mock `@beatzball/litro-router` so LitroRouter is a class whose
 *     setRoutes() is a spy, and its constructor records the outlet element.
 *   - Register LitroOutlet with customElements.define().
 *   - Append to jsdom document so Lit's lifecycle hooks fire.
 *   - Use `await afterUpdate(el)` to wait for firstUpdated()'s async body
 *     (the dynamic import + router setup) before asserting. Lit's
 *     `updateComplete` resolves when the synchronous render cycle ends but
 *     does NOT await the async firstUpdated() body; a zero-delay setTimeout
 *     flushes those remaining microtasks.
 *
 * @vitest-environment jsdom
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @beatzball/litro-router before importing LitroOutlet.
//
// LitroOutlet.firstUpdated() does:
//   const { LitroRouter } = await import('@beatzball/litro-router');
//   this.router = new LitroRouter(this);
//   this.router.setRoutes(this.routes);
//
// We replace LitroRouter with a class whose constructor and setRoutes() are
// vi.fn() spies so we can assert on call counts and arguments.
// ---------------------------------------------------------------------------

const setRoutesSpy = vi.fn();
const RouterConstructorSpy = vi.fn();

vi.mock('@beatzball/litro-router', () => ({
  LitroRouter: class MockLitroRouter {
    constructor(outlet: Element) {
      RouterConstructorSpy(outlet);
    }
    setRoutes = setRoutesSpy;
  },
}));

// Import LitroOutlet AFTER vi.mock() so the mock is in place.
const { LitroOutlet } = await import('../LitroOutlet.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal route fixture matching the Route type shape expected by the router. */
const ROUTES = [
  { path: '/', component: 'page-home', action: async () => {} },
  { path: '/blog', component: 'page-blog', action: async () => {} },
];

/**
 * Wait for Lit's update cycle AND the async body of firstUpdated() to finish.
 *
 * Lit calls firstUpdated() but does not await it (async lifecycle methods are
 * fire-and-forget in Lit). updateComplete therefore resolves before the
 * `await import('@beatzball/litro-router')` inside firstUpdated() settles.
 * A zero-delay setTimeout flushes those remaining microtasks.
 */
async function afterUpdate(el: InstanceType<typeof LitroOutlet>): Promise<void> {
  await el.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Creates a LitroOutlet element, appends it to document.body so Lit's
 * lifecycle fires, then waits for firstUpdated()'s async body to complete.
 */
async function makeOutlet(): Promise<InstanceType<typeof LitroOutlet>> {
  const el = document.createElement('litro-outlet') as InstanceType<typeof LitroOutlet>;
  document.body.appendChild(el);
  await afterUpdate(el);
  return el;
}

// ---------------------------------------------------------------------------
// Cleanup between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  setRoutesSpy.mockClear();
  RouterConstructorSpy.mockClear();
  document.querySelectorAll('litro-outlet').forEach(el => el.remove());
});

// ---------------------------------------------------------------------------
// firstUpdated() — routes set before the first update microtask fires
// ---------------------------------------------------------------------------

describe('LitroOutlet — routes set synchronously before first update', () => {
  it('passes routes to setRoutes() during firstUpdated()', async () => {
    const el = document.createElement('litro-outlet') as InstanceType<typeof LitroOutlet>;
    // Set routes synchronously — before appending to DOM triggers firstUpdated().
    el.routes = ROUTES as never;
    document.body.appendChild(el);
    await afterUpdate(el);

    expect(setRoutesSpy).toHaveBeenCalledOnce();
    expect(setRoutesSpy).toHaveBeenCalledWith(ROUTES);
  });

  it('constructs LitroRouter with the outlet element as its argument', async () => {
    const el = document.createElement('litro-outlet') as InstanceType<typeof LitroOutlet>;
    el.routes = ROUTES as never;
    document.body.appendChild(el);
    await afterUpdate(el);

    expect(RouterConstructorSpy).toHaveBeenCalledOnce();
    expect(RouterConstructorSpy).toHaveBeenCalledWith(el);
  });
});

// ---------------------------------------------------------------------------
// Property setter — routes set after firstUpdated() fires (timing-race fix)
//
// The setter calls setRoutes() directly on the router instance without going
// through Lit's update/render cycle (which would crash because firstUpdated()
// removes Lit's internal ChildPart marker nodes).
// ---------------------------------------------------------------------------

describe('LitroOutlet — routes set after first update (timing-race fix)', () => {
  it('calls setRoutes() when routes are assigned after the router is initialised', async () => {
    // Append without routes — simulates the DOMContentLoaded timing race where
    // firstUpdated() fires before the routes are assigned.
    const el = await makeOutlet();
    setRoutesSpy.mockClear(); // discard the call from firstUpdated()

    // Now set routes — as if a DOMContentLoaded callback fires late.
    // The property setter calls setRoutes() synchronously (no update cycle).
    el.routes = ROUTES as never;

    expect(setRoutesSpy).toHaveBeenCalledOnce();
    expect(setRoutesSpy).toHaveBeenCalledWith(ROUTES);
  });

  it('does NOT call setRoutes() before the router is initialised (setter guard)', () => {
    // Element created but NOT appended → firstUpdated() never fires → router = undefined.
    const el = document.createElement('litro-outlet') as InstanceType<typeof LitroOutlet>;
    el.routes = ROUTES as never; // setter runs but router is undefined

    // setRoutes() must NOT be called — the router doesn't exist yet.
    expect(setRoutesSpy).not.toHaveBeenCalled();
    // The routes value is still stored and will be forwarded by firstUpdated().
    expect(el.routes).toBe(ROUTES);
  });

  it('calls setRoutes() each time routes is replaced after init', async () => {
    const el = await makeOutlet();
    setRoutesSpy.mockClear();

    const firstRoutes = [{ path: '/', component: 'page-home', action: async () => {} }];
    const secondRoutes = [...firstRoutes, { path: '/about', component: 'page-about', action: async () => {} }];

    el.routes = firstRoutes as never;
    el.routes = secondRoutes as never;

    expect(setRoutesSpy).toHaveBeenCalledTimes(2);
    expect(setRoutesSpy).toHaveBeenNthCalledWith(1, firstRoutes);
    expect(setRoutesSpy).toHaveBeenNthCalledWith(2, secondRoutes);
  });
});

// ---------------------------------------------------------------------------
// SSR child-preservation behaviour (FOUC prevention)
// ---------------------------------------------------------------------------

describe('LitroOutlet — preserves SSR children in firstUpdated() to prevent FOUC', () => {
  it('does NOT remove children present before the router initialises', async () => {
    const el = document.createElement('litro-outlet') as InstanceType<typeof LitroOutlet>;
    // Simulate SSR-streamed content inside the outlet.
    const ssrNode = document.createElement('div');
    ssrNode.textContent = 'SSR content';
    el.appendChild(ssrNode);

    document.body.appendChild(el);
    await afterUpdate(el);

    // SSR children must NOT be cleared here — the router's _resolve() clears
    // them atomically (clear + appendChild in the same sync block) after the
    // async onBeforeEnter() resolves. Clearing eagerly in firstUpdated() would
    // blank the page for the duration of that async work (FOUC).
    expect(el.childElementCount).toBe(1);
    expect(el.firstElementChild).toBe(ssrNode);
  });
});
