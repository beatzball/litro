/**
 * Unit tests for LitroLink (<litro-link>) in LitroLink.ts.
 *
 * LitroLink wraps a standard <a> element and intercepts clicks for client-side
 * navigation via LitroRouter.go(). The click handler is registered on the HOST
 * element via addEventListener in connectedCallback(), NOT as a Lit @click
 * binding on the shadow <a>. This ensures it fires even when Lit's update cycle
 * is blocked by defer-hydration on SSR'd elements.
 *
 * Testing approach:
 *   - Mock `@beatzball/litro-router` so LitroRouter.go() is a spy function.
 *   - Register LitroLink with customElements.define() so jsdom can instantiate it.
 *   - Append to document.body so connectedCallback() fires and registers the listener.
 *   - Dispatch real MouseEvents on the element — this exercises the actual
 *     addEventListener path rather than calling the private handler directly.
 *
 * @vitest-environment jsdom
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock litro-router before importing LitroLink.
//
// LitroLink._clickHandler() does:
//   void import('@beatzball/litro-router').then(({ LitroRouter }) => LitroRouter.go(this.href));
//
// We intercept this dynamic import so LitroRouter.go() becomes a vi.fn() spy.
// ---------------------------------------------------------------------------

const goSpy = vi.fn();

vi.mock('@beatzball/litro-router', () => ({
  LitroRouter: {
    go: goSpy,
  },
}));

// Import LitroLink AFTER vi.mock() so the mock is in place when its module
// initializes. The @customElement decorator runs at import time.
const { LitroLink } = await import('../LitroLink.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a MouseEvent with optional modifier keys.
 * cancelable: true allows e.preventDefault() to be observed via event.defaultPrevented.
 */
function makeClick(opts: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
} = {}): MouseEvent {
  return new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
  });
}

/**
 * Flush the microtask queue so that `void import(...).then(...)` chains resolve.
 * We need this because _clickHandler fires the dynamic import asynchronously.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Creates a LitroLink instance, sets href/target/rel, appends it to the
 * document so connectedCallback() fires and registers the host click listener,
 * then returns the element.
 */
function makeLitroLink(
  href: string,
  target = '',
  rel = '',
): InstanceType<typeof LitroLink> {
  const el = document.createElement('litro-link') as InstanceType<typeof LitroLink>;
  el.href = href;
  el.target = target;
  el.rel = rel;
  // Append to body so connectedCallback() runs and addEventListener is called.
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Cleanup between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  goSpy.mockClear();
  document.querySelectorAll('litro-link').forEach(el => el.remove());
});

// ---------------------------------------------------------------------------
// LitroLink — SPA navigation (_clickHandler intercept path)
// ---------------------------------------------------------------------------

describe('LitroLink — SPA navigation via LitroRouter.go()', () => {
  it('calls LitroRouter.go(href) for a same-origin path', async () => {
    const link = makeLitroLink('/about');

    link.dispatchEvent(makeClick());
    await flushMicrotasks();

    expect(goSpy).toHaveBeenCalledWith('/about');
  });

  it('calls e.preventDefault() to block the native navigation', () => {
    const link = makeLitroLink('/contact');

    const event = makeClick();
    link.dispatchEvent(event);

    // preventDefault must be called synchronously (before the async import resolves)
    expect(event.defaultPrevented).toBe(true);
  });

  it('passes the correct href to LitroRouter.go() for nested paths', async () => {
    const link = makeLitroLink('/blog/hello-world');

    link.dispatchEvent(makeClick());
    await flushMicrotasks();

    expect(goSpy).toHaveBeenCalledWith('/blog/hello-world');
  });

  it('registers the listener in connectedCallback so it fires without Lit hydration', () => {
    // Element appended to DOM — connectedCallback() fired.
    // Dispatching a click should reach _clickHandler even though the Lit
    // render cycle has not run (simulates defer-hydration scenario).
    const link = makeLitroLink('/about');

    const event = makeClick();
    link.dispatchEvent(event);

    // preventDefault is the synchronous signal that the handler ran.
    expect(event.defaultPrevented).toBe(true);
  });

  it('removes the listener after disconnectedCallback', () => {
    const link = makeLitroLink('/about');

    // Remove from DOM — disconnectedCallback() should remove the listener.
    link.remove();

    const event = makeClick();
    link.dispatchEvent(event);
    // Handler was removed; default should not be prevented.
    expect(event.defaultPrevented).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LitroLink — pass-through conditions (must NOT call LitroRouter.go())
// ---------------------------------------------------------------------------

describe('LitroLink — conditions where click is NOT intercepted', () => {
  it('does NOT intercept when target is set (_blank)', async () => {
    const link = makeLitroLink('/about', '_blank');

    const event = makeClick();
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT intercept when metaKey is held (new tab intent)', async () => {
    const link = makeLitroLink('/about');

    const event = makeClick({ metaKey: true });
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT intercept when ctrlKey is held', async () => {
    const link = makeLitroLink('/about');

    const event = makeClick({ ctrlKey: true });
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT intercept when shiftKey is held (new window intent)', async () => {
    const link = makeLitroLink('/about');

    const event = makeClick({ shiftKey: true });
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT intercept when altKey is held', async () => {
    const link = makeLitroLink('/about');

    const event = makeClick({ altKey: true });
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT intercept external URLs (http://)', async () => {
    const link = makeLitroLink('http://example.com/page');

    const event = makeClick();
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT intercept external URLs (https://)', async () => {
    const link = makeLitroLink('https://example.com');

    const event = makeClick();
    link.dispatchEvent(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });
});
