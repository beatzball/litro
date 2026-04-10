/**
 * adapter/elena/ssr-shim.ts — Node.js globals for Elena SSR
 *
 * Provides HTMLElement and customElements shims so Elena component
 * classes can be imported and call .define() in Node.js.
 *
 * This module MUST be imported (via the manifest preamble) BEFORE any
 * Elena component modules. ESM evaluates imports in declaration order,
 * so placing this import first ensures the globals exist.
 *
 * The customElements.define() shim captures every component class into
 * a Map on globalThis.__litro_elena_ce_map__. The adapter's
 * renderElenaPage() reads this map to look up component classes for
 * direct rendering — no @elenajs/ssr needed.
 */

if (typeof globalThis.HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = class HTMLElement {};
}

if (!(globalThis as any).customElements) {
  const _ceMap = new Map<string, Function>();
  (globalThis as any).customElements = {
    _ceMap,
    define(name: string, ctor: Function) { _ceMap.set(name, ctor); },
    get(name: string) { return _ceMap.get(name); },
    whenDefined() { return Promise.resolve(); },
  };
  (globalThis as any).__litro_elena_ce_map__ = _ceMap;
} else if (!(globalThis as any).__litro_elena_ce_map__) {
  // customElements exists but ceMap doesn't — happens in Nitro's dev server
  // when the worker thread inherits customElements from a prior evaluation
  // but loses the ceMap reference. Wrap define() to intercept registrations.
  const _ceMap = new Map<string, Function>();
  const origDefine = (globalThis as any).customElements.define?.bind(
    (globalThis as any).customElements,
  );
  (globalThis as any).customElements.define = (name: string, ctor: Function) => {
    _ceMap.set(name, ctor);
    origDefine?.(name, ctor);
  };
  (globalThis as any).customElements._ceMap = _ceMap;
  (globalThis as any).__litro_elena_ce_map__ = _ceMap;
}
