/**
 * Vite dev middleware
 *
 * Spins up an in-process Vite dev server (middlewareMode) and hands it every
 * request so Vite can serve the live client entry and JS/TS module graph with
 * the correct MIME type. Vite calls next() for requests it does not own (HTML
 * pages, API routes), which Nitro's router then handles normally.
 *
 * The Vite config comes from litroViteDevConfig() in @beatzball/litro, which
 * forces `base: '/'` in dev so module URLs stay clear of Nitro's `/_litro/`
 * static mount (that mount would otherwise serve a stale pre-built bundle —
 * issue #97). See that helper's docblock for the full rationale.
 *
 * Why server middleware instead of devHandlers:
 *   Nitro's DevServer.createApp() reads nitro.options.devHandlers ONCE in
 *   the DevServer constructor, before build:before ever fires. Pushing to
 *   devHandlers from any config hook is too late. Server middleware files
 *   (server/middleware/) are bundled into the worker and registered in h3App
 *   BEFORE the router, giving Vite first access to every request.
 *
 * Bundle size:
 *   Nitro's Rollup replaces process.dev with false in production builds.
 *   DCE then eliminates the entire handler body — including the dynamic
 *   import('vite') call — so vite is NOT copied to the production output.
 */
import { defineEventHandler, fromNodeMiddleware } from 'h3';
import { litroViteDevConfig, warmupLitroViteServer } from '@beatzball/litro/runtime/vite-dev.js';

// Singleton: initialise once on the first dev request, then reuse.
// A Promise is cached so concurrent first requests queue on the same
// initialisation rather than racing to create multiple Vite servers.
let viteHandlerPromise: Promise<ReturnType<typeof fromNodeMiddleware>> | null = null;

export default defineEventHandler(async (event) => {
  // process.dev is a Rollup-defined constant: true in dev, false in prod.
  // In production, Rollup constant-folds this to `if (true) return;` and
  // DCE removes everything below — including import('vite') — so vite is
  // never included in the production bundle.
  // At runtime in dev, NITRO_DEV_WORKER_ID is a belt-and-suspenders guard.
  if (!process.dev || !process.env.NITRO_DEV_WORKER_ID) return;

  if (!viteHandlerPromise) {
    // Extract Nitro's underlying HTTP server from the first request's socket.
    // Passing it as hmr.server tells Vite to attach its WebSocket upgrade
    // handler to the *existing* server instead of opening a new standalone
    // WebSocket server that would conflict with Nitro's port.
    const httpServer = (event.node.req.socket as import('node:net').Socket & {
      server?: import('node:http').Server;
    }).server;

    viteHandlerPromise = import('vite')
      .then(({ createServer }) =>
        // process.cwd() is the project root because Nitro is always started
        // from the app directory.
        createServer(litroViteDevConfig({ root: process.cwd(), hmrServer: httpServer })),
      )
      .then(async (server) => {
        // Pre-warm the client entry so Vite finishes optimizing its dependency
        // graph before the first page is served. Without this, dep discovery
        // happens mid-load and triggers a full-page reload that can duplicate
        // the SSR'd DOM during hydration.
        await warmupLitroViteServer(server);
        return fromNodeMiddleware(server.middlewares);
      });
  }

  const viteHandler = await viteHandlerPromise;
  return viteHandler(event);
});
