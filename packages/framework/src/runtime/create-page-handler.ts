/**
 * create-page-handler.ts — SSR handler factory
 *
 * Returns an H3 EventHandler that server-renders a page component and
 * streams the full HTML document to the client.
 *
 * Streaming architecture (in order):
 *   1. shell.head  — written synchronously: DOCTYPE, <head>, polyfill (if needed),
 *                    hydration scripts, <body>
 *   2. SSR output  — streamed async from the framework adapter's renderPage()
 *   3. shell.foot  — written synchronously after stream ends: app bundle
 *                    <script>, </body>, </html>
 *
 * The adapter is resolved at handler creation time and determines how
 * components are rendered on the server (DSD for Lit/FAST, plain HTML for Elena).
 */

import { PassThrough } from 'node:stream';
import { defineEventHandler, setResponseHeader, sendStream, getRequestHeader, getRequestURL } from 'h3';
import type { EventHandler } from 'h3';
import { buildShell } from './shell.js';
import type { SkipLink } from './shell.js';
import type { LitroRoute } from '../types/route.js';
import type { PageDataFetcher } from './page-data.js';
import type { FrameworkAdapter } from '../adapter/types.js';
import { iterableToReadable } from '../adapter/stream.js';

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
  /**
   * Skip links rendered at the top of the page. Defaults to
   * DEFAULT_SKIP_LINKS (a single "Skip to content" link).
   *
   * Sites with sidebars/search can extend:
   *   skipLinks: [...DEFAULT_SKIP_LINKS, { label: 'Skip to navigation', href: '#_litro_nav' }]
   */
  skipLinks?: SkipLink[];
  /**
   * Framework adapter instance. Determines how page components are
   * rendered on the server and what hydration scripts are emitted.
   *
   * When omitted, falls back to resolving from the LITRO_ADAPTER env var
   * (default: 'lit'). Prefer passing explicitly for deterministic builds.
   */
  adapter?: FrameworkAdapter;
}

/**
 * Creates an H3 EventHandler that SSR-renders the given page component.
 *
 * The handler:
 *   1. Dynamically imports the component module (registers it with the
 *      server-side customElements registry as a side effect).
 *   2. Delegates rendering to the framework adapter's renderPage().
 *   3. Pipes the SSR stream (head → HTML → foot) to the HTTP response.
 *
 * Error handling:
 *   If SSR throws (e.g., the component accesses window/document at module
 *   eval time, or render() throws mid-stream), the handler logs a warning
 *   and falls back to serving the client-only HTML shell. This ensures the
 *   page is still usable — the framework will render client-side — rather
 *   than serving a 500 error in production.
 *
 * @param options - Route descriptor and optional route metadata.
 * @returns An H3 EventHandler.
 */
export function createPageHandler(options: PageHandlerOptions): EventHandler {
  const { route, routeMeta, pageModule, skipLinks } = options;

  // Resolve adapter lazily — allows handler creation before adapter is loaded.
  let adapterPromise: Promise<FrameworkAdapter> | undefined;
  function getAdapter(): Promise<FrameworkAdapter> {
    if (options.adapter) return Promise.resolve(options.adapter);
    if (!adapterPromise) {
      adapterPromise = import('../adapter/resolve.js').then(m => m.resolveAdapter());
    }
    return adapterPromise;
  }

  return defineEventHandler(async (event) => {
    // Content negotiation: if the client wants JSON, skip SSR and return only
    // the definePageData result. This allows LitroPage.fetchData() to call the
    // same page URL — no separate data API endpoint is needed.
    const acceptHeader = getRequestHeader(event, 'accept') ?? '';
    if (acceptHeader.includes('application/json')) {
      setResponseHeader(event, 'content-type', 'application/json; charset=utf-8');
      setResponseHeader(event, 'vary', 'Accept');

      const pageDataExport = options.pageModule?.pageData as PageDataFetcher<unknown> | undefined;
      if (pageDataExport?.__litroPageData === true) {
        try {
          const data = await pageDataExport.fetcher(event);
          return data;
        } catch (err) {
          console.warn(
            '[litro] pageData.fetcher failed (JSON request) for',
            options.route.componentTag,
            err,
          );
        }
      }
      // Page has no definePageData — return empty object.
      return {};
    }

    // Always set the content-type header before any writes. This must be set
    // before sendStream() is called so the header goes out in the first chunk.
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8');
    // Inform caches that the response varies by Accept — a JSON request and an
    // HTML request for the same URL produce different responses.
    setResponseHeader(event, 'vary', 'Accept');

    // Hint the OG image route to Nitro's prerenderer so crawlLinks-discovered
    // pages also get their OG images prerendered.
    const pagePath = getRequestURL(event).pathname;
    const ogRoute = pagePath === '/'
      ? '/__og/index.png'
      : `/__og${pagePath}.png`;
    setResponseHeader(event, 'x-nitro-prerender', ogRoute);

    try {
      const adapter = await getAdapter();

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
      let dynamicHead = '';
      let dynamicTitle: string | undefined;
      let dynamicBodyScript = '';
      const pageDataExport = mod.pageData as PageDataFetcher<unknown> | undefined;
      if (pageDataExport?.__litroPageData === true) {
        try {
          const data = await pageDataExport.fetcher(event);
          // Extract seoHead / seoTitle from page data for injection into <head>.
          // Pages return these strings from definePageData() so that per-request
          // meta tags (description, OG, JSON-LD) land in the actual <head> rather
          // than being buried inside the __litro_data__ JSON blob.
          //
          // IMPORTANT: seoHead must NOT be included in the serialized JSON.
          // It typically contains a <script type="application/ld+json">...</script>
          // tag. The closing </script> inside a JSON string inside
          // <script type="application/json"> causes the browser HTML parser to
          // terminate the outer script element early, leaking the rest of the
          // JSON as visible text and breaking getServerData() on the client.
          const d = data as Record<string, unknown>;
          if (typeof d.seoHead === 'string') dynamicHead = d.seoHead;
          if (typeof d.seoTitle === 'string') dynamicTitle = d.seoTitle;
          // Per-page synchronous end-of-body script (emitted before the app
          // bundle) — the body-slot counterpart to seoHead.
          if (typeof d.bodyScript === 'string') dynamicBodyScript = d.bodyScript;
          // Strip seoHead, seoTitle and bodyScript before serializing to avoid
          // the </script> injection issue described above. The client doesn't
          // need these fields — they were only needed server-side to build the
          // HTML shell.
          const { seoHead: _h, seoTitle: _t, bodyScript: _b, ...clientData } = d;
          serverDataJson = JSON.stringify(clientData);
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

      // Reference the client entry. In dev mode we point at the .ts SOURCE at a
      // ROOT-relative path (`/app.ts`) so Vite's dev middleware serves it as
      // live, transformed source — edits to app.ts reflect without a rebuild.
      // Dev must NOT use the `/_litro/` prefix: Nitro's publicAssets handler
      // owns `/_litro/*` and would serve the stale pre-built dist/client/app.js
      // (issue #97). The dev Vite server runs with base '/', so it emits and
      // serves the entry and every transitive import at root-relative paths.
      // In production the compiled `/_litro/app.js` bundle is served by the
      // publicAssets static handler (dist/client/app.js).
      //
      // LITRO_DEV_LIVE_ENTRY gates the live entry on the app actually running
      // the new litroViteDevConfig()-based middleware: an app upgraded to this
      // framework version but still running its previously-scaffolded
      // vite-dev middleware keeps the old (stale-bundle) behavior instead of a
      // broken `/app.ts` graph — see litroViteDevConfig() in runtime/vite-dev.
      const basePath = process.env.LITRO_BASE_PATH ?? '';
      const isDev = process.env.LITRO_DEV === 'true';
      const liveEntry = isDev && process.env.LITRO_DEV_LIVE_ENTRY === '1';
      const appScriptUrl = liveEntry ? `${basePath}/app.ts` : `${basePath}/_litro/app.js`;

      // Get any framework-specific head scripts from the adapter.
      const adapterHeadScripts = adapter.getHeadScripts({ isDev, basePath });

      // Build the HTML shell for this component. The shell is split into head
      // and foot so we can stream the SSR output between the two halves.
      // serverDataJson is passed here so it is injected into the <head> as
      // <script type="application/json" id="__litro_data__">.
      const staticHead = typeof routeMeta?.head === 'string' ? routeMeta.head : '';
      const shell = buildShell(route.componentTag, '', {
        title: dynamicTitle ?? routeMeta?.title,
        head: staticHead + dynamicHead + adapterHeadScripts || undefined,
        serverDataJson,
        appScriptUrl,
        contentDevPolling: isDev && process.env.LITRO_HAS_CONTENT === 'true',
        skipLinks,
        includeDSDPolyfill: adapter.needsDSDPolyfill,
        bodyScript: dynamicBodyScript || undefined,
      });

      // Delegate rendering to the framework adapter. The adapter returns an
      // AsyncIterable<string> of HTML chunks — DSD-wrapped for Shadow DOM
      // frameworks (Lit, FAST) or plain HTML for light DOM (Elena).
      const serverData = serverDataJson ? JSON.parse(serverDataJson) : undefined;
      const ssrIterable = adapter.renderPage(route.componentTag, serverData);

      // Convert the async iterable to a Node.js Readable stream.
      const ssrReadable = iterableToReadable(ssrIterable);

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
      // the client-only shell so the page remains usable via client-side rendering.
      console.warn(
        '[litro] SSR failed for',
        route.componentTag,
        '— falling back to client-only shell.',
        err,
      );

      // Build a minimal fallback shell (no server data — data fetch may have
      // been the source of the error, or may not have run yet).
      const basePath = process.env.LITRO_BASE_PATH ?? '';
      const isDev = process.env.LITRO_DEV === 'true';
      // Same LITRO_DEV_LIVE_ENTRY gating as the happy path above.
      const liveEntry = isDev && process.env.LITRO_DEV_LIVE_ENTRY === '1';
      const appScriptUrl = liveEntry ? `${basePath}/app.ts` : `${basePath}/_litro/app.js`;
      // Carry vary header through the fallback path too — the URL can still
      // be hit with Accept: application/json on retries.
      setResponseHeader(event, 'vary', 'Accept');
      const fallbackShell = buildShell(route.componentTag, '', {
        title: routeMeta?.title,
        head: typeof routeMeta?.head === 'string' ? routeMeta.head : undefined,
        appScriptUrl,
        skipLinks,
      });

      // Client-only fallback: emit the shell with a bare component tag.
      // The framework will render the component entirely on the client side.
      const fallbackHtml =
        fallbackShell.head +
        `<${route.componentTag}></${route.componentTag}>` +
        fallbackShell.foot;

      return fallbackHtml;
    }
  });
}
