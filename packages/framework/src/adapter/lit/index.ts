/**
 * adapter/lit/index.ts — Lit framework adapter
 *
 * Implements FrameworkAdapter for Lit (Google). This is the default adapter
 * and represents the extraction of Litro's original Lit-coupled code into
 * the adapter interface — no new behavior, just a structural refactor.
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

  manifestPreamble() {
    // Register the framework's own custom elements on the server.
    //
    // WHY THIS IS NEEDED. `<litro-link>` builds its `<a href>` in render().
    // If the element is not in the server's custom element registry,
    // @lit-labs/ssr prints a bare `<litro-link href="/docs">` with no shadow
    // root — so with JavaScript off there is no anchor and the link is
    // unclickable text. Nothing reports it; the build exits 0.
    //
    // WHY THE PAGES COULD NOT CARRY IT. Importing the element from a page is
    // not enough in general: the runtime barrel re-exports it as a NAME, and
    // Rollup drops a re-export nothing uses (BUILD-007). A site that got it
    // right did so with one bare side-effect import in one page file, and
    // because the whole server is a single bundle that one import happened to
    // register the element for every other page too. Delete that line and all
    // of them regress at once. Registering here makes it the framework's job.
    //
    // WHY IT IS SAFE ON THE SERVER. LitroLink imports only `lit`, which ships
    // a `node` export condition. `@beatzball/litro-router` — the part that
    // touches `window` — is loaded by a dynamic import inside the click
    // handler, which only ever runs in a browser. The module's older header
    // said it must never be imported server-side; that stopped being true
    // when the router import was made lazy.
    //
    // The namespace binding and globalThis assignment are BUILD-002: Rollup
    // deletes a bare side-effect import it cannot prove is used.
    return [
      `import * as _litroLink from '@beatzball/litro/runtime/LitroLink.js';`,
      `globalThis.__litro_link__ = _litroLink;`,
    ].join('\n');
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
