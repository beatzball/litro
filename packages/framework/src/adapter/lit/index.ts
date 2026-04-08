/**
 * adapter/lit/index.ts — Lit framework adapter
 *
 * Implements FrameworkAdapter for Lit (Google). This is the default adapter
 * and represents the extraction of Litro's original Lit-coupled code into
 * the adapter interface — no new behaviour, just a structural refactor.
 *
 * SSR: @lit-labs/ssr renders components as Declarative Shadow DOM (DSD)
 * Hydration: @lit-labs/ssr-client patches LitElement before component evaluation
 * Styles: Shadow DOM with adoptedStyleSheets
 */

import { html, unsafeStatic } from 'lit/static-html.js';
import { render } from '@lit-labs/ssr';
import type { RenderResult } from '@lit-labs/ssr';
import type { FrameworkAdapter } from '../types.js';

/**
 * Converts Lit SSR's RenderResult (a sync Iterable of strings and Promises)
 * into an AsyncIterable<string> that the adapter interface expects.
 *
 * RenderResult is `Iterable<string | Promise<RenderResult>>`. Items are
 * either string chunks (emitted synchronously) or Promises that resolve to
 * nested RenderResults (for async component rendering). This function
 * flattens both into a single async string stream.
 */
async function* renderResultToAsyncIterable(
  result: RenderResult,
): AsyncIterable<string> {
  for (const chunk of result) {
    if (typeof chunk === 'string') {
      yield chunk;
    } else {
      // chunk is Promise<RenderResult> — await and recurse
      const nested = await chunk;
      yield* renderResultToAsyncIterable(nested);
    }
  }
}

/**
 * Render a Lit component to an AsyncIterable<string> of HTML chunks.
 *
 * Uses unsafeStatic for dynamic tag names (required by Lit's template parser)
 * and optionally binds .serverData as a property during SSR so the component's
 * render() method sees real data on the server.
 */
function renderLitPage(tag: string, serverData: unknown): AsyncIterable<string> {
  const tagStatic = unsafeStatic(tag);
  const template = serverData != null
    ? html`<${tagStatic} .serverData=${serverData}></${tagStatic}>`
    : html`<${tagStatic}></${tagStatic}>`;
  return renderResultToAsyncIterable(render(template));
}

export const litAdapter: FrameworkAdapter = {
  name: 'lit',

  renderPage(tag: string, serverData: unknown): AsyncIterable<string> {
    return renderLitPage(tag, serverData);
  },

  getHeadScripts(_options: { isDev: boolean; basePath: string }): string {
    // Lit's hydration support is bundled into app.js (first import in client.ts).
    // No separate <script> tag needed in <head> — the import order inside the
    // bundle handles it. Return empty string.
    return '';
  },

  needsDSDPolyfill: true,

  // Relative to framework package src. Consumed by the build pipeline to know
  // which client entry to use. The actual client.ts file stays in runtime/ for
  // backward compat — this path is informational for future adapter-aware builds.
  clientEntryModule: '../runtime/client.js',

  vitePlugins() {
    return [];
  },

  nitroConfig() {
    return {
      externals: {
        inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'],
      },
      esbuild: {
        options: {
          tsconfigRaw: {
            compilerOptions: {
              experimentalDecorators: true,
              useDefineForClassFields: false,
            },
          },
        },
      },
    };
  },
};
