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
 *     setRoutes() directly when the router is already initialized. This avoids
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LitElement } from 'lit';

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

/**
 * Stand in for `@lit-labs/ssr-client/lit-element-hydrate-support.js`.
 *
 * The real module cannot be used here. It only assigns
 * `globalThis.litElementHydrateSupport`; the patch is applied by `lit-element`
 * reading that hook ONCE, as its own module body runs. By the time a test file
 * executes, `lit` has long since been imported, so importing the real module
 * now would set the hook too late to have any effect — which is the very bug
 * under test, not a way to set up for it.
 *
 * So patch the one thing the assertion reads, exactly the way the real module
 * patches it: prepend `defer-hydration` onto `LitElement.observedAttributes`
 * via an own-property getter that delegates to the inherited one.
 */
function installHydrateSupportPatch(): void {
  const inherited = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(LitElement),
    'observedAttributes'
  )!.get!;
  Object.defineProperty(LitElement, 'observedAttributes', {
    configurable: true,
    get(this: unknown) {
      return [...(inherited.call(this) as string[]), 'defer-hydration'];
    },
  });
}

/** Remove the stand-in, so `observedAttributes` falls back to the inherited getter. */
function removeHydrateSupportPatch(): void {
  delete (LitElement as unknown as Record<string, unknown>).observedAttributes;
}

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
  // Every test below this line is about routing, not hydration, and mounting an
  // outlet runs firstUpdated()'s hydrate-support assertion. Install the patch so
  // those tests represent a correctly built app and do not each log a warning
  // that is a false alarm here. The assertion has its own tests at the bottom.
  installHydrateSupportPatch();
});

afterEach(() => {
  removeHydrateSupportPatch();
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
  it('calls setRoutes() when routes are assigned after the router is initialized', async () => {
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

  it('does NOT call setRoutes() before the router is initialized (setter guard)', () => {
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
// SSR child-preservation behavior (FOUC prevention)
// ---------------------------------------------------------------------------

describe('LitroOutlet — preserves SSR children in firstUpdated() to prevent FOUC', () => {
  it('does NOT remove children present before the router initializes', async () => {
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

// ---------------------------------------------------------------------------
// firstUpdated() — the hydrate-support assertion
//
// `lit-element` applies Lit's hydration patch on one line of its module body:
//
//   globalThis.litElementHydrateSupport?.({ LitElement });
//
// It runs once, at module evaluation, and `?.` makes a missing hook a silent
// no-op — so a build that evaluates `lit-element` first loses hydration for the
// life of the page with nothing thrown and nothing logged. From Vite 8.1
// (Rolldown 1.1.5) onward Rolldown can produce exactly that order by leaving
// `lit-element` in a chunk the entry imports statically. The assertion turns
// that silence into one named console.error. See BUILD-009.
// ---------------------------------------------------------------------------

describe('LitroOutlet — hydrate-support assertion', () => {
  it('says nothing when the patch is installed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // beforeEach already installed the patch.
    await makeOutlet();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs one named error when the patch never installed', async () => {
    removeHydrateSupportPatch();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await makeOutlet();

    expect(errorSpy).toHaveBeenCalledOnce();
    const message = String(errorSpy.mock.calls[0]![0]);
    // The message has to carry its own diagnosis: a reader who sees it in a
    // browser console has no other clue that anything is wrong.
    expect(message).toContain('[litro]');
    expect(message).toContain('lit-element-hydrate-support.js');
    expect(message).toContain('BUILD-009');
    errorSpy.mockRestore();
  });

  it('still mounts the router when the patch never installed', async () => {
    // Deliberately a warning and not a throw: a page that re-renders instead of
    // hydrating is slower, not broken, and breaking it would turn a performance
    // fault into an outage.
    removeHydrateSupportPatch();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const el = document.createElement('litro-outlet') as InstanceType<typeof LitroOutlet>;
    el.routes = ROUTES as never;
    document.body.appendChild(el);
    await afterUpdate(el);

    expect(RouterConstructorSpy).toHaveBeenCalledWith(el);
    expect(setRoutesSpy).toHaveBeenCalledWith(ROUTES);
    errorSpy.mockRestore();
  });

  it('does not warn merely because observedAttributes is unreadable', async () => {
    // A non-standard Lit build could throw from the getter. An unreadable list
    // is not evidence of a broken install, so the assertion must stay quiet
    // rather than cry wolf.
    Object.defineProperty(LitElement, 'observedAttributes', {
      configurable: true,
      get() {
        throw new Error('exotic Lit build');
      },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await makeOutlet();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
