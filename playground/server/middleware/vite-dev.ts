/**
 * Vite dev middleware
 *
 * Intercepts ALL requests before Nitro's route handlers so that Vite can
 * serve JS/TS modules (including /app.ts and page chunks) with the correct
 * MIME type. Vite calls next() for requests it does not own (HTML pages,
 * API routes), which Nitro's router then handles normally.
 *
 * Why server middleware instead of devHandlers:
 *   Nitro's DevServer.createApp() reads nitro.options.devHandlers ONCE in
 *   the DevServer constructor, before build:before ever fires. Pushing to
 *   devHandlers from any config hook is too late. Server middleware files
 *   (server/middleware/) are bundled into the worker and registered in h3App
 *   BEFORE the router (createNitroApp() calls h3App.use(middleware) then
 *   h3App.use(router.handler)), giving Vite first access to every request.
 *
 * Bundle size:
 *   Nitro's Rollup replaces process.dev with false in production builds.
 *   DCE then eliminates the entire handler body — including the dynamic
 *   import('vite') call — so vite is NOT copied to the production output.
 */
import { defineEventHandler, fromNodeMiddleware } from 'h3';

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
    // handler to the *existing* server (port 3030) instead of opening a new
    // standalone WebSocket server that would conflict with Nitro's port.
    const httpServer = (event.node.req.socket as import('node:net').Socket & {
      server?: import('node:http').Server;
    }).server;

    viteHandlerPromise = import('vite')
      .then(({ createServer }) =>
        createServer({
          // middlewareMode: Vite does NOT bind its own HTTP server.
          server: {
            middlewareMode: true,
            hmr: httpServer ? { server: httpServer } : true,
          },
          // 'custom' appType: suppress Vite's SPA HTML fallback.
          appType: 'custom',
          // process.cwd() is the project root because Nitro is always
          // started from the playground directory.
          root: process.cwd(),
        })
      )
      .then((server) => fromNodeMiddleware(server.middlewares));
  }

  const viteHandler = await viteHandlerPromise;
  return viteHandler(event);
});
