/**
 * adapter/elena/index.ts — Elena framework adapter
 *
 * Implements FrameworkAdapter for Elena (elenajs.com).
 *
 * SSR: @elenajs/ssr renders components as plain light DOM HTML (no DSD)
 * Hydration: None — Elena uses progressive enhancement (components upgrade in place)
 * Styles: Light DOM with @scope CSS encapsulation
 *
 * Key difference from Lit/FAST: Elena's SSR output is plain HTML without
 * Declarative Shadow DOM wrappers. This means:
 *   - No DSD polyfill needed in <head>
 *   - No <template shadowrootmode="open"> in output
 *   - Global CSS reaches component internals
 *   - Smaller HTML payloads, no DSD parsing cost
 */

import type { FrameworkAdapter } from '../types.js';

/**
 * Render an Elena component to an AsyncIterable<string>.
 *
 * Elena's ssr() is synchronous and returns a plain string. We wrap it
 * in a single-yield async generator to match the adapter interface.
 *
 * serverData is injected via globalThis.__litro_ssr_page_data__ (same
 * pattern as FAST). Elena SSR calls the constructor, which reads the
 * global. This is safe because Node.js SSR is single-threaded.
 */
async function* renderElenaPage(
  tag: string,
  serverData: unknown,
): AsyncIterable<string> {
  const ssrFn = (globalThis as any).__litro_elena_ssr__;
  if (!ssrFn) {
    throw new Error(
      '[litro:elena] ssr() not found on globalThis. ' +
        'Ensure LITRO_ADAPTER=elena is set and the manifest preamble ran.',
    );
  }

  // Make serverData available to the component's constructor during SSR.
  if (serverData != null) {
    (globalThis as any).__litro_ssr_page_data__ = serverData;
  }

  try {
    const result: string = ssrFn(`<${tag}></${tag}>`);
    yield result;
  } finally {
    delete (globalThis as any).__litro_ssr_page_data__;
  }
}

export const elenaAdapter: FrameworkAdapter = {
  name: 'elena',

  renderPage(tag: string, serverData: unknown): AsyncIterable<string> {
    return renderElenaPage(tag, serverData);
  },

  getHeadScripts(_options: { isDev: boolean; basePath: string }): string {
    // Elena uses progressive enhancement — no hydration script needed.
    return '';
  },

  needsDSDPolyfill: false,

  clientEntryModule: '../adapter/elena/runtime/client.js',

  vitePlugins() {
    return [];
  },

  nitroConfig() {
    // Elena has no special bundling requirements.
    // @elenajs/core is tiny (2.9kB) and has no Node-specific issues.
    // No decorator config needed — Elena uses static props, not decorators.
    return {};
  },

  manifestPreamble() {
    // Import @elenajs/ssr and store references on globalThis so
    // renderElenaPage() can access them without re-importing.
    //
    // @elenajs/ssr provides an HTMLElement shim for Node.js, so it must
    // be imported BEFORE @elenajs/core (which extends HTMLElement).
    //
    // IMPORTANT: Uses `import * as` to prevent Rollup tree-shaking.
    // Inline code (globalThis assignments, customElements shim, env var) runs
    // AFTER all imports due to ESM hoisting — that's fine because renderPage()
    // only reads these at request time. The customElements shim here is a
    // safety net for future code that may call .define() at runtime.
    return [
      `import * as _elenaSsr from '@elenajs/ssr';`,
      `globalThis.__litro_elena_ssr__ = _elenaSsr.ssr;`,
      `globalThis.__litro_elena_register__ = _elenaSsr.register;`,
      `if (!globalThis.customElements) {`,
      `  var _ceMap = new Map();`,
      `  globalThis.customElements = {`,
      `    define: function(name, ctor) { _ceMap.set(name, ctor); },`,
      `    get: function(name) { return _ceMap.get(name); },`,
      `    whenDefined: function() { return Promise.resolve(); },`,
      `  };`,
      `}`,
      `process.env.LITRO_ADAPTER = 'elena';`,
    ].join('\n');
  },

  manifestPostamble(pageModuleVars: string[]) {
    // Register every page component class with @elenajs/ssr's internal
    // registry. This runs as top-level inline code AFTER all page modules
    // have been imported (ESM guarantees imports evaluate before inline code).
    //
    // Elena SSR's ssr() function looks up components from its own internal
    // Map — NOT from customElements. Components must be explicitly registered
    // via register(Class) before ssr() can expand their HTML tags.
    //
    // Each page module default-exports the Elena component class. We iterate
    // over all of them and register any that have a static tagName property.
    const registrations = pageModuleVars
      .map(v => `if (${v}.default && ${v}.default.tagName) _elenaSsr.register(${v}.default);`)
      .join('\n');
    return `// Auto-register Elena components with @elenajs/ssr\n${registrations}`;
  },
};
