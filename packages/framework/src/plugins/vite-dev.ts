/**
 * Nitro build-time plugin: Vite dev middleware injection
 *
 * This is a Nitro BUILD-TIME plugin (registered in nitro.config.ts under `plugins`).
 * It runs during `nitro dev` initialization and injects Vite's dev middleware into
 * Nitro's internal devHandlers array.
 *
 * Result: a SINGLE HTTP port serves both Vite (JS modules, HMR) and Nitro
 * (API routes, HTML shell, static assets) — no cross-process proxy, no CORS.
 *
 * This plugin is a NO-OP in production (nitro.options.dev is false during build).
 *
 * Architecture:
 *   Browser → :3000 (Nitro dev server)
 *               ├── Vite devHandler (catches /@id/, /@fs/, /node_modules/.vite/, HMR WS)
 *               │     Vite calls next() for requests it doesn't own
 *               └── Nitro file router (API routes, catch-all HTML handler)
 */

import type { Nitro } from 'nitropack';

/**
 * Injects Vite's dev middleware into Nitro's main H3 app.
 *
 * IMPORTANT — registration timing:
 *   This plugin MUST be registered in nitro.config.ts `plugins` array, NOT
 *   called from `hooks['build:before']`. Here is why:
 *
 *   Nitro's DevServer constructor calls createApp() which reads
 *   nitro.options.devHandlers at construction time to build the main H3 app.
 *   createDevServer() is called AFTER createNitro() but BEFORE build:before.
 *   So any push() to devHandlers in build:before arrives too late — the H3
 *   app has already been built without the Vite handler.
 *
 *   Plugins registered in the `plugins` array run during createNitro() and
 *   can hook into `nitro:init` (which fires at the end of createNitro(),
 *   still before createDevServer()). That is the only safe window to add
 *   devHandlers.
 *
 * Usage in nitro.config.ts:
 *   export default defineNitroConfig({
 *     plugins: ['./node_modules/litro/dist/plugins/vite-dev.js'],
 *     // or, in the playground monorepo:
 *     plugins: ['../packages/framework/dist/plugins/vite-dev.js'],
 *   });
 */
export default async function viteDevPlugin(nitro: Nitro): Promise<void> {
  // Only inject the Vite middleware in dev mode.
  // In production, devHandlers is completely ignored by Nitro anyway,
  // but this guard makes the intent explicit.
  if (!nitro.options.dev) {
    return;
  }

  // Register on nitro:init, which fires at the end of createNitro() —
  // before createDevServer() constructs the main H3 app. This guarantees
  // that the Vite devHandler is present when createApp() iterates devHandlers.
  nitro.hooks.hook('nitro:init', async () => {
    // Dynamic imports so these modules are never required in production bundles.
    const { fromNodeMiddleware } = await import('h3');
    const { createServer: createViteServer } = await import('vite');

    const viteServer = await createViteServer({
      // CRITICAL: middlewareMode — Vite does NOT bind its own HTTP server.
      // Instead it exposes `viteServer.middlewares` — a connect-compatible
      // middleware stack we can attach to Nitro's server.
      server: {
        middlewareMode: true,
      },
      // appType 'custom' suppresses Vite's built-in SPA HTML serving.
      // Nitro's catch-all handler owns all HTML responses.
      appType: 'custom',
      // Root must be the project directory so Vite can resolve relative
      // imports in app.ts and pages/*.ts correctly.
      root: nitro.options.rootDir,
    });

    // fromNodeMiddleware adapts the Node.js/connect-style (req, res, next)
    // signature of viteServer.middlewares into an H3 EventHandler that Nitro
    // can invoke in its request pipeline.
    const viteHandler = fromNodeMiddleware(viteServer.middlewares);

    // Push the Vite handler as a devHandler at the root route ('/**').
    // Vite will process requests it recognises (JS/TS modules, HMR WebSocket,
    // virtual modules via /@id/...) and call next() for everything else,
    // allowing Nitro's own router to handle API routes and the HTML catch-all.
    nitro.options.devHandlers.push({
      route: '/**',
      handler: viteHandler,
    });

    // Ensure Vite closes gracefully when Nitro shuts down.
    nitro.hooks.hook('close', () => viteServer.close());
  });
}
