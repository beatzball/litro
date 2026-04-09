/**
 * adapter/fast/ensure-dom.ts — Synchronous minimal DOM shim for FAST Element
 *
 * @microsoft/fast-element accesses `document` at module eval time:
 *   - compiler.js:28   → document.createElement("div")
 *   - element-styles.js:89 → document.adoptedStyleSheets, CSSStyleSheet.prototype
 *
 * On the server, globalThis.document doesn't exist and these crash.
 *
 * This module MUST be the first import in LitroPage.ts (FAST) so that it
 * executes before @microsoft/fast-element in the ESM dependency graph.
 * ESM guarantees sibling imports execute in source order — but ONLY when
 * all siblings are synchronous. Top-level `await` breaks this guarantee
 * (async siblings can interleave). Therefore this shim is purely synchronous:
 * no imports, no dynamic import, no await.
 *
 * We intentionally do NOT set globalThis.window — the real
 * @microsoft/fast-ssr/install-dom-shim.js checks `globalThis.window === undefined`
 * before installing. By leaving `window` unset, the real shim (loaded by the
 * Nitro manifest preamble) can overwrite our minimal stubs with full-fidelity
 * implementations needed for actual SSR rendering.
 *
 * On the client (browser), `document` already exists so this is a no-op.
 */
if (typeof document === 'undefined') {
  // Provide all globals that @microsoft/fast-element accesses at module eval.
  // Mirrors the surface from @microsoft/fast-ssr/dom-shim.js but inlined
  // to avoid any imports (which would introduce top-level await or break
  // the synchronous execution guarantee).

  const g = globalThis as any;

  // Document stub
  g.document = {
    adoptedStyleSheets: [],
    createTreeWalker() { return {}; },
    createTextNode() { return {}; },
    createElement() { return {}; },
    createComment() { return {}; },
    adoptNode(node: unknown) { return node; },
    dispatchEvent() { return true; },
    addEventListener() {},
    removeEventListener() {},
  };

  // DOM classes needed by fast-element at module eval time
  if (typeof MutationObserver === 'undefined') {
    g.MutationObserver = class MutationObserver {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  }
  if (typeof CSSStyleSheet === 'undefined') {
    g.CSSStyleSheet = class CSSStyleSheet {
      cssRules: unknown[] = [];
      replace() {}
      insertRule() { return 0; }
    };
  }
  if (typeof CustomEvent === 'undefined') {
    g.CustomEvent = class CustomEvent extends Event {
      detail: unknown = null;
      constructor(type: string, init?: CustomEventInit) {
        super(type, init);
        if (init && 'detail' in init) this.detail = init.detail;
      }
    };
  }
  if (typeof HTMLElement === 'undefined') {
    g.HTMLElement = class HTMLElement {
      attachShadow() { return { host: this }; }
      setAttribute() {}
      removeAttribute() {}
      hasAttribute() { return false; }
      getAttribute() { return null; }
      get attributes() { return []; }
      get shadowRoot() { return null; }
      get classList() { return { add() {}, remove() {}, contains() { return false; }, toggle() {} }; }
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
    };
  }
  if (typeof Element === 'undefined') {
    g.Element = g.HTMLElement;
  }
  if (typeof Node === 'undefined') {
    g.Node = g.HTMLElement;
  }
  if (typeof ShadowRoot === 'undefined') {
    g.ShadowRoot = class ShadowRoot {};
  }
  if (typeof CustomElementRegistry === 'undefined') {
    g.CustomElementRegistry = class CustomElementRegistry {
      private __defs = new Map<string, unknown>();
      define(name: string, ctor: unknown) { this.__defs.set(name, ctor); }
      get(name: string) { return this.__defs.get(name); }
    };
  }
  if (typeof customElements === 'undefined') {
    g.customElements = new g.CustomElementRegistry();
  }
  if (typeof MediaQueryList === 'undefined') {
    g.MediaQueryList = class MediaQueryList {
      matches = false;
      addEventListener() {}
      removeEventListener() {}
    };
  }
  if (typeof matchMedia === 'undefined') {
    g.matchMedia = () => new g.MediaQueryList();
  }
}
