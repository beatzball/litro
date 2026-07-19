---
title: Upgrading
description: How to upgrade an existing Litro app, and the release-by-release notes for anything that needs a decision — including opting in to the live dev entry (issue 97) introduced alongside @beatzball/litro 0.12.1.
date: 2026-07-19
---

# Upgrading

Litro releases are coordinated: `@beatzball/litro`, `@beatzball/litro-router`, and `@beatzball/create-litro` version together through changesets, and a release never silently changes the behavior of an existing app. Anything that would is gated behind an opt-in, and this page documents each one.

To upgrade, bump the packages and reinstall:

```bash
pnpm update @beatzball/litro @beatzball/litro-router
```

`@beatzball/create-litro` only matters when scaffolding new apps — `npm create @beatzball/litro@latest` always uses the latest.

Full change lists live in each package's CHANGELOG on npm or in the repository.

## litro 0.12.1 / litro-router 0.2.0

### Live dev entry — the stale-bundle fix (opt-in)

Previously, `litro dev` served the client from a pre-built `dist/client/app.js`. That bundle was built once (on first start) and never rebuilt, so edits to `app.ts` or shared components could stop reflecting in the browser until you deleted `dist/client/` and restarted — the classic symptom being stale pages or "hydration value mismatch" errors after changing shared code.

As of `@beatzball/litro` 0.12.1, dev can serve the **live source entry** through Vite instead: the shell references `/app.ts`, every module in the client graph is transformed on demand, and edits reflect on reload with no rebuild step. Production and SSG builds are completely unchanged.

**Upgrading alone changes nothing.** The live entry only activates when your app's Vite dev middleware is built from the framework's `litroViteDevConfig()` helper. Apps scaffolded before 0.12.1 run an older middleware and keep their previous dev behavior after upgrading.

To opt in, replace your `server/middleware/vite-dev.ts` with the current version:

```ts
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
```

That file swap is the whole migration. Notes:

- Keep `base: '/_litro/'` in your `vite.config.ts` — it still configures the **production** build. The helper only overrides `base` for the dev middleware server.
- The helper also stops Vite from watching `.nitro/` and `.litro/` (Nitro regenerating its types no longer forces a full browser reload) and pre-optimizes the dependency graph of `app.ts` and every page module at startup.
- Apps scaffolded with `@beatzball/create-litro` 0.7.1 or later include this middleware already.
- If your shared modules read `process.env` at module top level, guard them (`globalThis.process?.env`) — the production build tree-shakes server-only code out of the client bundle, but the live dev graph executes the whole module in the browser.

### `data-litro-settled` — knowing when the page is interactive

`@beatzball/litro-router` 0.2.0 marks the outlet element with a `data-litro-settled` attribute once the initial SSR-to-client swap completes. Before that moment, the visible content is the server-rendered shell, whose event handlers are not wired yet.

This is additive — nothing existing changes — but it closes a real gap if you run browser tests or defer interactions until the page is live:

```ts
// Playwright: wait for the page to be interactive before clicking
await page.waitForSelector('litro-outlet[data-litro-settled]');
```

Element-count or visibility checks cannot distinguish the pre-hydration shell from the live page; the attribute can.

## litro 0.12.0

Adds the `@beatzball/litro/stream` subpath — the NDJSON stream wire protocol (`createStreamEncoder`, `createStreamDecoder`, `serializeValue`, `deserializeValue`) shared by Server Actions streaming and the agent layer. Purely additive; no action needed.

`@beatzball/litro-agent` 0.1.0 released alongside it: the filesystem-first agent layer where `agents/<name>/` directories become durable streaming session endpoints and tools return server-rendered components. Entirely opt-in — see [Agents](/docs/agents) for setup.

## litro 0.11.0

Introduced Server Actions (typed RPC, no-JS forms, streaming). Opt-in, with a few one-time wiring edits for existing apps — see [Upgrading from 0.10.x or earlier](/docs/server-actions#upgrading-from-010x-or-earlier) on the Server Actions page.
