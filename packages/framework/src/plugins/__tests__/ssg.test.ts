/**
 * Unit tests for patchCustomElementsIdempotent (ssg.ts).
 *
 * Run with: pnpm --filter litro test
 *
 * The function patches globalThis.customElements.define to silently skip
 * re-registration of already-defined element names. This prevents the
 * "has already been used with this registry" error thrown by
 * @lit-labs/ssr-dom-shim when jiti pre-loads Lit page files (registering
 * their @customElement decorators) and the prerender bundle later imports
 * the same pages, triggering the decorator a second time.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { patchCustomElementsIdempotent } from '../ssg.js';

// Restore globalThis.customElements to its original state after each test
// so tests remain isolated.
describe('patchCustomElementsIdempotent', () => {
  let savedCE: unknown;

  beforeEach(() => {
    savedCE = (globalThis as Record<string, unknown>).customElements;
  });

  afterEach(() => {
    if (savedCE === undefined) {
      delete (globalThis as Record<string, unknown>).customElements;
    } else {
      (globalThis as Record<string, unknown>).customElements = savedCE;
    }
  });

  // ---------------------------------------------------------------------------
  // Guard conditions
  // ---------------------------------------------------------------------------

  it('does nothing when customElements is undefined', () => {
    delete (globalThis as Record<string, unknown>).customElements;
    expect(() => patchCustomElementsIdempotent()).not.toThrow();
  });

  it('does not patch when __litroIdempotent is already set', () => {
    let callCount = 0;
    const ce = {
      define: () => { callCount++; },
      get: () => undefined,
      __litroIdempotent: true, // already patched
    };
    (globalThis as Record<string, unknown>).customElements = ce;

    patchCustomElementsIdempotent(); // should be a no-op

    // define is still the original (not re-wrapped); calling it increments counter
    ce.define();
    expect(callCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Patching behaviour
  // ---------------------------------------------------------------------------

  it('sets __litroIdempotent to true after patching', () => {
    const ce = {
      define: () => {},
      get: () => undefined as unknown,
      __litroIdempotent: undefined as unknown,
    };
    (globalThis as Record<string, unknown>).customElements = ce;

    patchCustomElementsIdempotent();

    expect((ce as Record<string, unknown>).__litroIdempotent).toBe(true);
  });

  it('silently skips re-registration of an already-defined element', () => {
    const registry = new Map<string, unknown>();
    const ce = {
      define: (name: string, ctor: unknown) => { registry.set(name, ctor); },
      get: (name: string) => registry.get(name),
      __litroIdempotent: undefined as unknown,
    };
    (globalThis as Record<string, unknown>).customElements = ce;

    // Register before patching
    const originalCtor = class OriginalEl {};
    ce.define('my-element', originalCtor);
    expect(registry.size).toBe(1);

    patchCustomElementsIdempotent();

    // Attempt to re-register with a different constructor — must be ignored
    const replacementCtor = class ReplacementEl {};
    ce.define('my-element', replacementCtor);

    expect(registry.size).toBe(1);
    expect(registry.get('my-element')).toBe(originalCtor); // original preserved
  });

  it('still allows registration of new (not-yet-seen) element names', () => {
    const registry = new Map<string, unknown>();
    const ce = {
      define: (name: string, ctor: unknown) => { registry.set(name, ctor); },
      get: (name: string) => registry.get(name),
      __litroIdempotent: undefined as unknown,
    };
    (globalThis as Record<string, unknown>).customElements = ce;

    patchCustomElementsIdempotent();

    const ctorA = class ElA {};
    const ctorB = class ElB {};
    ce.define('el-a', ctorA);
    ce.define('el-b', ctorB);

    expect(registry.size).toBe(2);
    expect(registry.get('el-a')).toBe(ctorA);
    expect(registry.get('el-b')).toBe(ctorB);
  });

  it('calling the function twice wraps define only once', () => {
    let defineCallCount = 0;
    const ce = {
      define: (_name: string, _ctor: unknown) => { defineCallCount++; },
      get: () => undefined as unknown,
      __litroIdempotent: undefined as unknown,
    };
    (globalThis as Record<string, unknown>).customElements = ce;

    patchCustomElementsIdempotent();
    patchCustomElementsIdempotent(); // second call: __litroIdempotent already true → no-op

    // define is wrapped once; calling it on a new name should invoke the
    // original exactly one time (not twice from double-wrapping).
    ce.define('once-el', class {});
    expect(defineCallCount).toBe(1);
  });
});
