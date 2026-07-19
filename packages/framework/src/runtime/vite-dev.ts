/**
 * vite-dev.ts — dev-server Vite config for Litro's single-port setup
 *
 * Builds the Vite `InlineConfig` used by each app's `server/middleware/vite-dev.ts`
 * when it spins up an in-process Vite dev server in `middlewareMode`. Centralising
 * it here fixes the stale-client-bundle footgun described in issue #97.
 *
 * The problem
 * ───────────
 * A Litro app's `vite.config.ts` sets `base: '/_litro/'` so the PRODUCTION client
 * bundle (served from `dist/client/` via Nitro's `publicAssets` mount at
 * `/_litro/`) resolves its preload/import URLs. Vite reads that same config in
 * dev, so it EMITS every module URL prefixed with `/_litro/`.
 *
 * But in dev Nitro's `publicAssets` handler owns `/_litro/*` and is consulted
 * BEFORE the Vite dev middleware — it never yields. So a `/_litro/app.js` request
 * (and every `/_litro/@fs/…`, `/_litro/@vite/client`, `/_litro/node_modules/…`
 * import) is served the pre-built, and now STALE, `dist/client/app.js`. Source
 * edits to `app.ts` / `pages/*.ts` silently stop reflecting in the browser until
 * `dist/` is deleted — exactly the bug reported in issue #97.
 *
 * The fix
 * ───────
 * Override `base` to `'/'` for the DEV Vite server only. Vite then emits and
 * serves the entry and all transitive imports at ROOT-relative paths (`/app.ts`,
 * `/@fs/…`, `/@vite/client`, …), which the Vite dev middleware DOES receive
 * (Nitro's `/_litro/` static handler never sees them). The HTML shell references
 * `/app.ts` in dev (see create-page-handler), so the live source entry — not the
 * stale bundle — is what the browser loads. Production is unaffected: the shell
 * still references `/_litro/app.js` and `vite build` still uses `base: '/_litro/'`
 * from `vite.config.ts`.
 *
 * This module has NO `vite` import (only a type-only import, which is erased), so
 * it is safe to import from a Nitro server middleware without pulling Vite into
 * the production bundle. Callers still perform the `import('vite')` + `createServer`
 * themselves so Vite stays out of the production trace.
 */

import type { Server } from 'node:http';
import type { InlineConfig, ViteDevServer } from 'vite';

/** Litro's client entry filename (relative to the app root). */
export const LITRO_CLIENT_ENTRY = 'app.ts';

export interface LitroViteDevOptions {
  /** Vite project root — the app directory (typically `process.cwd()`). */
  root: string;
  /**
   * The HTTP server Nitro is already listening on. Passed as Vite's `hmr.server`
   * so Vite attaches its HMR WebSocket to the existing port instead of opening a
   * second, conflicting server. When omitted, Vite uses its default HMR setup.
   */
  hmrServer?: Server;
  /**
   * Client entry to pre-scan for dependency optimization. Defaults to
   * {@link LITRO_CLIENT_ENTRY} (`app.ts`). See `optimizeDeps.entries` below.
   */
  entry?: string;
}

/**
 * Builds the Vite `InlineConfig` for Litro's single-port dev server.
 *
 * @see the module docblock for why `base` is forced to `'/'` in dev (issue #97).
 */
export function litroViteDevConfig(options: LitroViteDevOptions): InlineConfig {
  return {
    // DEV base override — see module docblock. `vite.config.ts` keeps
    // `base: '/_litro/'` for the production build; this only affects the dev
    // middleware server so its module URLs stay clear of Nitro's `/_litro/` mount.
    base: '/',
    // middlewareMode: Vite does NOT bind its own HTTP server — it exposes a
    // connect middleware stack that the Nitro server middleware mounts.
    server: {
      middlewareMode: true,
      // Attach Vite's HMR WebSocket to Nitro's existing HTTP server (single port).
      hmr: options.hmrServer ? { server: options.hmrServer } : true,
      // Never watch Nitro/Litro server-state dirs. Nitro regenerates
      // `.nitro/types/tsconfig.json` on every dev:reload (and whenever a second
      // Nitro process shares the app dir, e.g. a test spawning its own server),
      // and Vite treats any tracked-tsconfig change as "clear cache + force
      // full-reload" — yanking the page out from under the browser mid-session.
      // `.litro/` holds runtime state (agent session logs) that is likewise
      // never client source. Neither dir can contain modules Vite serves.
      watch: {
        ignored: ['**/.nitro/**', '**/.litro/**'],
      },
      // Transform the client entry and every page module at server startup.
      // Page modules are lazily (dynamically) imported by the router at
      // navigation time; without warmup that first import is a cold, on-demand
      // transform. In dev the router briefly keeps the SSR'd element mounted
      // alongside the incoming one while `route.action()` (the dynamic import)
      // resolves — a slow cold transform widens that window. Warming the page
      // graph up front keeps those imports fast so the swap is near-instant.
      warmup: {
        clientFiles: [options.entry ?? LITRO_CLIENT_ENTRY, 'pages/**/*.{ts,tsx,js,jsx,mjs}'],
      },
    },
    // 'custom' appType suppresses Vite's built-in SPA HTML fallback — Nitro owns
    // all HTML responses.
    appType: 'custom',
    root: options.root,
    optimizeDeps: {
      // In middlewareMode + appType 'custom', Vite has no HTML entry to crawl,
      // so it defers dependency optimization until the first module request —
      // discovering new deps then triggers a full-page reload mid-hydration
      // (which can duplicate SSR'd DOM). Scan the client entry AND every page
      // component up front so the whole client dependency graph is pre-bundled
      // at server startup. Page modules are lazily (dynamically) imported by the
      // router, so without the `pages/**` glob their deps would be discovered on
      // first navigation and force a reload. Pre-scanning keeps page loads stable.
      entries: [options.entry ?? LITRO_CLIENT_ENTRY, 'pages/**/*.{ts,tsx,js,jsx,mjs}'],
    },
  };
}

/**
 * Pre-warms the client entry so Vite finishes optimizing its dependency graph
 * before the first page is served.
 *
 * `optimizeDeps.entries` alone only schedules a scan; the actual dep-bundling
 * still races the first request. `warmupRequest` runs the entry through the
 * full transform pipeline — which awaits the dep optimizer — so by the time this
 * resolves the optimized deps are ready and no mid-load full-reload (that can
 * duplicate SSR'd DOM during hydration) is emitted to the first client.
 *
 * Best-effort: warmup failures never block the dev server from serving.
 *
 * @param server - The Vite dev server created from {@link litroViteDevConfig}.
 * @param entry  - Root-relative entry URL to warm (default `/app.ts`).
 */
export async function warmupLitroViteServer(
  server: ViteDevServer,
  entry: string = `/${LITRO_CLIENT_ENTRY}`,
): Promise<void> {
  try {
    await server.warmupRequest(entry);
  } catch {
    // Ignore — warmup is a startup optimization, not a correctness requirement.
  }
}
