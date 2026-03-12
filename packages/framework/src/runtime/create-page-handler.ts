/**
 * create-page-handler.ts — SSR handler factory
 *
 * Returns an H3 EventHandler that server-renders a Lit page component and
 * streams the full HTML document to the client using @lit-labs/ssr.
 *
 * Streaming architecture (in order):
 *   1. shell.head  — written synchronously: DOCTYPE, <head>, DSD polyfill,
 *                    hydration script, <body>
 *   2. SSR output  — streamed async from @lit-labs/ssr via RenderResultReadable
 *                    (Lit component HTML with Declarative Shadow DOM)
 *   3. shell.foot  — written synchronously after stream ends: app bundle
 *                    <script>, </body>, </html>
 *
 * Node.js / Edge note:
 *   RenderResultReadable (from @lit-labs/ssr/lib/render-result-readable.js)
 *   extends Node.js stream.Readable. It is NOT available in Cloudflare Workers
 *   or other edge runtimes that lack Node.js stream APIs. For Cloudflare Workers
 *   support, the SSR output must be converted to a Web ReadableStream manually
 *   (iterate the AsyncIterable<string> returned by renderToStream() and enqueue
 *   into a new ReadableStream controller). This is left as a TODO for the edge
 *   adapter work; the Node.js implementation is correct for all non-edge targets.
 */

import { PassThrough } from 'node:stream';
import { html, unsafeStatic } from 'lit/static-html.js';
import { defineEventHandler, setResponseHeader, sendStream } from 'h3';
import type { EventHandler } from 'h3';
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';
import { renderToStream } from './ssr.js';
import { buildShell } from './shell.js';
import type { LitroRoute } from '../types/route.js';
import type { PageDataFetcher } from './page-data.js';

export interface PageHandlerOptions {
  route: LitroRoute;
  routeMeta?: { title?: string; [key: string]: unknown };
  /**
   * Pre-imported page module from the #litro/page-manifest registry.
   * When provided, the handler uses this directly instead of doing a
   * dynamic import of the .ts source file (which fails in Node.js ESM
   * because .ts extensions are not supported at runtime).
   *
   * The module is statically bundled into the server output by Rollup
   * when the pages plugin generates the #litro/page-manifest virtual module.
   */
  pageModule?: Record<string, unknown>;
}

/**
 * Creates an H3 EventHandler that SSR-renders the given Lit page component.
 *
 * The handler:
 *   1. Dynamically imports the component module (registers it with the
 *      server-side customElements registry as a side effect).
 *   2. Instantiates the component via a Lit html`` template.
 *   3. Pipes the SSR stream (head → DSD HTML → foot) to the HTTP response.
 *
 * Error handling:
 *   If SSR throws (e.g., the component accesses window/document at module
 *   eval time, or render() throws mid-stream), the handler logs a warning
 *   and falls back to serving the client-only HTML shell. This ensures the
 *   page is still usable — Lit will render client-side — rather than serving
 *   a 500 error in production.
 *
 * @param options - Route descriptor and optional route metadata.
 * @returns An H3 EventHandler.
 */
export function createPageHandler(options: PageHandlerOptions): EventHandler {
  const { route, routeMeta, pageModule } = options;

  return defineEventHandler(async (event) => {
    // Always set the content-type header before any writes. This must be set
    // before sendStream() is called so the header goes out in the first chunk.
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');

    try {
      // Resolve the page module. The preferred path is the pre-bundled module
      // from the #litro/page-manifest registry (pageModule option), which was
      // statically imported and compiled by Rollup at build time.
      //
      // The fallback dynamic import is kept for dev mode where Vite serves
      // modules via its dev server — in that context the filePath resolves
      // correctly through Vite's resolver. It is NOT used in production because
      // Node.js ESM cannot import .ts files natively.
      const mod: Record<string, unknown> = pageModule ?? await import(route.filePath);

      // --- Data fetching (I-5) ---
      // If the page module exports `pageData` with the Litro sentinel flag,
      // call the fetcher now, before rendering, and serialize the result into
      // the HTML shell. The client reads this via getServerData() on first load.
      let serverDataJson: string | undefined;
      const pageDataExport = mod.pageData as PageDataFetcher<unknown> | undefined;
      if (pageDataExport?.__litroPageData === true) {
        try {
          const data = await pageDataExport.fetcher(event);
          serverDataJson = JSON.stringify(data);
        } catch (dataErr) {
          // Data fetch failure is non-fatal: log a warning and render without
          // data. The client will call fetchData() as a fallback on navigation.
          console.warn(
            '[litro] pageData.fetcher failed for',
            route.componentTag,
            dataErr,
          );
        }
      }

      // Always reference the compiled bundle. In dev mode Vite's middleware
      // intercepts /_litro/app.js and serves app.ts on the fly (Vite resolves
      // .js → .ts automatically). If Vite is not intercepting, the static file
      // handler serves the pre-built dist/client/app.js as a fallback.
      const basePath = process.env.LITRO_BASE_PATH ?? '';
      const appScriptUrl = `${basePath}/_litro/app.js`;

      // Build the HTML shell for this component. The shell is split into head
      // and foot so we can stream the SSR output between the two halves.
      // serverDataJson is passed here so it is injected into the <head> as
      // <script type="application/json" id="__litro_data__">.
      const shell = buildShell(route.componentTag, '', {
        title: routeMeta?.title,
        head: typeof routeMeta?.head === 'string' ? routeMeta.head : undefined,
        serverDataJson,
        appScriptUrl,
      });

      // Construct the Lit template for this component. Dynamic tag names in
      // Lit templates must use unsafeStatic (from lit/static-html.js) — plain
      // expression interpolation of tag names is an invalid Lit expression
      // location and causes SSR to throw "Unexpected final partIndex".
      //
      // When serverDataJson is available, pass the parsed data as a .serverData
      // property binding so this.serverData is populated *during* SSR. This means
      // render() sees the real data and the streamed DSD HTML already shows the
      // correct content (not "No data yet"). After JS loads, the router creates
      // a new component instance, calls onBeforeEnter() → getServerData() (reads
      // the JSON script tag still in the DOM) → sets serverData on the new
      // instance, producing the same content seamlessly.
      const tagStatic = unsafeStatic(route.componentTag);
      const template = serverDataJson
        ? html`<${tagStatic} .serverData=${JSON.parse(serverDataJson)}></${tagStatic}>`
        : html`<${tagStatic}></${tagStatic}>`;

      // Get the AsyncIterable<string> from the SSR engine.
      const ssrIterable = renderToStream(template);

      // Wrap in RenderResultReadable to get a Node.js Readable stream.
      // RenderResultReadable extends stream.Readable, pulling from the async
      // generator on demand and respecting backpressure.
      //
      // NOTE: RenderResultReadable is Node.js-only. For Cloudflare Workers /
      // edge runtimes, convert ssrIterable to a Web ReadableStream instead
      // (see module-level doc comment for the conversion pattern).
      const ssrReadable = new RenderResultReadable(ssrIterable);

      // Use a PassThrough stream to combine head + SSR output + foot into a
      // single Readable that Nitro's sendStream() can consume.
      const combined = new PassThrough();

      // Write shell head synchronously. The browser starts parsing immediately.
      combined.write(shell.head);

      // Pipe the SSR Readable into combined without auto-closing so we can
      // append the foot after the SSR stream ends.
      ssrReadable.pipe(combined, { end: false });

      ssrReadable.on('end', () => {
        // Write the shell foot after the SSR output finishes, then close combined.
        combined.write(shell.foot);
        combined.end();
      });

      ssrReadable.on('error', (err: Error) => {
        // If the SSR stream errors mid-flight, log it and end the combined
        // stream. The browser will receive a truncated response, which is
        // preferable to a hanging connection.
        console.warn('[litro] SSR stream error for', route.componentTag, err);
        combined.end();
      });

      // Hand the combined stream to Nitro. sendStream() pipes it to the
      // underlying Node.js ServerResponse, respecting backpressure.
      return sendStream(event, combined);
    } catch (err) {
      // SSR setup failure (e.g., dynamic import threw, or component accesses
      // window/document at module eval time). Log a warning and fall back to
      // the client-only shell so the page remains usable via client-side Lit.
      console.warn(
        '[litro] SSR failed for',
        route.componentTag,
        '— falling back to client-only shell.',
        err,
      );

      // Build a minimal fallback shell (no server data — data fetch may have
      // been the source of the error, or may not have run yet).
      const basePath = process.env.LITRO_BASE_PATH ?? '';
      const appScriptUrl = `${basePath}/_litro/app.js`;
      const fallbackShell = buildShell(route.componentTag, '', {
        title: routeMeta?.title,
        head: typeof routeMeta?.head === 'string' ? routeMeta.head : undefined,
        appScriptUrl,
      });

      // Client-only fallback: emit the shell with a bare component tag.
      // Lit will render the component entirely on the client side.
      const fallbackHtml =
        fallbackShell.head +
        `<${route.componentTag}></${route.componentTag}>` +
        fallbackShell.foot;

      return fallbackHtml;
    }
  });
}
