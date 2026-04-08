/**
 * adapter/fast/index.ts — FAST Element framework adapter
 *
 * Implements FrameworkAdapter for Microsoft FAST Element 2.x.
 *
 * SSR: @microsoft/fast-ssr renders components as Declarative Shadow DOM (DSD)
 * Hydration: @microsoft/fast-element/install-element-hydration patches FASTElement
 *            to respect the defer-hydration attribute
 * Styles: Shadow DOM with adoptedStyleSheets (same as Lit)
 */

import type { FrameworkAdapter } from '../types.js';

/**
 * Render a FAST component to an AsyncIterable<string> of HTML chunks.
 *
 * The templateRenderer is initialised by the manifestPreamble (ssr-init.ts)
 * at module eval time — before any page components are defined. We import it
 * here to reuse the same singleton for every render call.
 *
 * serverData injection:
 *   Lit's adapter uses `.serverData=${value}` (a Lit property binding) to set
 *   data on the element during SSR. FAST SSR's string-based rendering has no
 *   equivalent property binding mechanism. Instead, we set serverData on
 *   globalThis.__litro_ssr_page_data__ before rendering. The FAST LitroPage
 *   base class reads this in connectedCallback during SSR. This is safe
 *   because Node.js SSR is single-threaded and sequential.
 */
async function* renderFastPage(
  tag: string,
  serverData: unknown,
): AsyncIterable<string> {
  // The templateRenderer was initialised by the manifest preamble (which runs
  // at module eval time, before any page component is defined) and stored on
  // globalThis. Retrieve it here.
  const templateRenderer = (globalThis as any).__litro_fast_template_renderer__;
  if (!templateRenderer) {
    throw new Error(
      '[litro:fast] templateRenderer not found. ' +
      'Ensure LITRO_ADAPTER=fast is set and the manifest preamble ran.',
    );
  }

  // Make serverData available to the component's connectedCallback during SSR.
  // Cleared after rendering to prevent leaks between requests.
  if (serverData != null) {
    (globalThis as any).__litro_ssr_page_data__ = serverData;
  }

  try {
    // FAST SSR accepts plain HTML strings. It finds registered custom elements
    // by tag name, instantiates them, and renders their templates as DSD.
    const result = templateRenderer.render(`<${tag}></${tag}>`);

    for await (const chunk of result) {
      if (typeof chunk === 'string') {
        yield chunk;
      }
    }
  } finally {
    // Clean up the global to prevent data leaking between requests.
    delete (globalThis as any).__litro_ssr_page_data__;
  }
}

export const fastAdapter: FrameworkAdapter = {
  name: 'fast',

  renderPage(tag: string, serverData: unknown): AsyncIterable<string> {
    return renderFastPage(tag, serverData);
  },

  getHeadScripts(_options: { isDev: boolean; basePath: string }): string {
    return '';
  },

  needsDSDPolyfill: true,

  clientEntryModule: '../adapter/fast/runtime/client.js',

  vitePlugins() {
    return [];
  },

  nitroConfig() {
    return {
      // FAST packages are intentionally NOT inlined. Keeping them external
      // ensures a single copy of @microsoft/fast-element across the entire
      // module graph (both page modules and the @beatzball/litro workspace
      // package). The manifest preamble's imports appear first in the bundle,
      // so Node evaluates the DOM shim → fastSSR() → fast-element in the
      // correct order. ensure-dom.ts provides a synchronous fallback shim
      // for the external @beatzball/litro dependency chain.
    };
  },

  manifestPreamble() {
    // These imports MUST appear before any page module import in the manifest.
    // 1. DOM shim: provides globalThis.document etc. for @microsoft/fast-element
    //    which accesses document at module eval time.
    // 2. fastSSR(): patches FAST Element internals for SSR (SSRElementController,
    //    SSR template compiler). Must run before any component is defined.
    //
    // The templateRenderer is stored on globalThis so renderFastPage() can
    // retrieve it without re-initialising.
    //
    // IMPORTANT: The DOM shim import uses `import * as` (not bare `import`)
    // because Rollup tree-shakes bare side-effect-only imports of external
    // packages that lack "sideEffects" in package.json. A namespace binding
    // prevents this — `_domShim` is unused but Rollup can't prove it.
    return [
      `import * as _domShim from '@microsoft/fast-ssr/install-dom-shim.js';`,
      `globalThis.__litro_dom_shim__ = _domShim;`,
      `import _fastSSR from '@microsoft/fast-ssr';`,
      `var _ssrResult = _fastSSR({ renderMode: 'async' });`,
      `globalThis.__litro_fast_template_renderer__ = _ssrResult.templateRenderer;`,
      // Ensure the adapter env var is available at runtime — nitro.config.ts
      // sets it at build time, but it's lost in the production bundle.
      `process.env.LITRO_ADAPTER = 'fast';`,
    ].join('\n');
  },
};
