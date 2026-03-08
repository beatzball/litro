/**
 * Unit tests for LitroLink (<litro-link>) in LitroLink.ts.
 *
 * LitroLink wraps a standard <a> element and intercepts clicks for client-side
 * navigation via LitroRouter.go(). The click handler (handleClick) is the
 * critical logic under test.
 *
 * Testing approach:
 *   - Mock `litro-router` so LitroRouter.go() is a spy function.
 *   - Register LitroLink with customElements.define() so jsdom can instantiate it.
 *   - Call the private handleClick() method directly via type cast — this avoids
 *     the complexity of simulating full Lit rendering and shadow DOM events.
 *
 * @vitest-environment jsdom
 *
 * Run with: pnpm --filter litro test
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock litro-router before importing LitroLink.
//
// LitroLink.handleClick() does:
//   void import('litro-router').then(({ LitroRouter }) => LitroRouter.go(this.href));
//
// We intercept this dynamic import so LitroRouter.go() becomes a vi.fn() spy.
// ---------------------------------------------------------------------------

const goSpy = vi.fn();

vi.mock('litro-router', () => ({
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
 * We need this because handleClick fires the dynamic import asynchronously.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Creates a LitroLink instance with the given href/target/rel properties,
 * registered under a unique tag name.
 */
let linkCounter = 0;
function makeLitroLink(
  href: string,
  target = '',
  rel = '',
): InstanceType<typeof LitroLink> {
  // LitroLink is registered by @customElement('litro-link') at import time.
  // We can retrieve and reuse it here. The element is already defined.
  const el = document.createElement('litro-link') as InstanceType<typeof LitroLink>;
  el.href = href;
  el.target = target;
  el.rel = rel;
  return el;
}

// ---------------------------------------------------------------------------
// LitroLink — SPA navigation (handleClick intercept path)
// ---------------------------------------------------------------------------

describe('LitroLink — SPA navigation via LitroRouter.go()', () => {
  it('calls LitroRouter.go(href) for a same-origin path', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/about');

    const event = makeClick();
    // Access private method via cast — avoids needing a full Lit render cycle.
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).toHaveBeenCalledWith('/about');
  });

  it('calls e.preventDefault() to block the native navigation', () => {
    goSpy.mockClear();
    const link = makeLitroLink('/contact');

    const event = makeClick();
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);

    // preventDefault must be called synchronously (before the async import resolves)
    expect(event.defaultPrevented).toBe(true);
  });

  it('passes the correct href to LitroRouter.go() for nested paths', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/blog/hello-world');

    const event = makeClick();
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).toHaveBeenCalledWith('/blog/hello-world');
  });
});

// ---------------------------------------------------------------------------
// LitroLink — pass-through conditions (must NOT call LitroRouter.go())
// ---------------------------------------------------------------------------

describe('LitroLink — conditions where click is NOT intercepted', () => {
  it('does NOT intercept when target is set (_blank)', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/about', '_blank');

    const event = makeClick();
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT intercept when metaKey is held (new tab intent)', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/about');

    const event = makeClick({ metaKey: true });
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT intercept when ctrlKey is held', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/about');

    const event = makeClick({ ctrlKey: true });
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT intercept when shiftKey is held (new window intent)', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/about');

    const event = makeClick({ shiftKey: true });
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT intercept when altKey is held', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('/about');

    const event = makeClick({ altKey: true });
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });

  it('does NOT intercept external URLs (http://)', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('http://example.com/page');

    const event = makeClick();
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does NOT intercept external URLs (https://)', async () => {
    goSpy.mockClear();
    const link = makeLitroLink('https://example.com');

    const event = makeClick();
    (link as unknown as { handleClick(e: MouseEvent): void }).handleClick(event);
    await flushMicrotasks();

    expect(goSpy).not.toHaveBeenCalled();
  });
});
