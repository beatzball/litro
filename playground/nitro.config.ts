import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset, ssrPreset } from '../packages/framework/dist/config/presets.js';
import pagesPlugin from '../packages/framework/dist/plugins/pages.js';
import ssgPlugin from '../packages/framework/dist/plugins/ssg.js';

// LITRO_MODE controls the deployment target:
//   'static' — SSG: prerender all routes to static HTML (serve from CDN/GitHub Pages/Netlify)
//   'server' — SSR: run as a Node.js server (default)
//
// Set at build time:
//   LITRO_MODE=static nitro build
//   LITRO_MODE=server  nitro build   (or just: nitro build)
const mode = process.env.LITRO_MODE ?? 'server'; // 'static' | 'server'

export default defineNitroConfig({
  // ─── Deployment Preset ─────────────────────────────────────────────────────
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),

  // ─── Source Directory ──────────────────────────────────────────────────────
  // Nitro auto-discovers: server/routes/, server/api/, server/middleware/,
  // and server/plugins/ (runtime plugins, auto-loaded at startup).
  srcDir: 'server',

  // ─── Public Assets ─────────────────────────────────────────────────────────
  // IMPORTANT: publicAssets, NOT publicDir — publicDir is ignored by edge adapters.
  publicAssets: [
    {
      // Nitro resolves publicAssets.dir relative to srcDir (not rootDir).
      // Since srcDir='server', use '../dist/client' to reach <rootDir>/dist/client.
      dir: '../dist/client',
      baseURL: '/_litro/',
      maxAge: 31536000, // 1 year — Vite writes content-hashed filenames
    },
    {
      // Similarly, '../public' resolves to <rootDir>/public.
      dir: '../public',
      baseURL: '/',
      maxAge: 0,
    },
  ],

  // ─── Externals Inlining ────────────────────────────────────────────────────
  // Must be bundled for edge runtimes (Cloudflare Workers, Vercel Edge).
  externals: {
    inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'],
  },

  // ─── esbuild / TypeScript ─────────────────────────────────────────────────
  // Lit page components use TypeScript's legacy experimental decorators
  // (@customElement, @state, @property) and useDefineForClassFields: false.
  // These must be forwarded to Nitro's esbuild transformer so that page files
  // bundled via the #litro/page-manifest virtual module compile correctly.
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

  // ─── Vite Dev Middleware ───────────────────────────────────────────────────
  // server/middleware/vite-dev.ts contains a dynamic import('vite') that must
  // NOT enter Rollup's module graph in production — even though process.dev DCE
  // eliminates it from the compiled code, Nitro's @vercel/nft tracer adds vite
  // to trackedExternals BEFORE DCE (during Rollup's resolution phase), causing
  // vite + esbuild + rollup + postcss to be copied to the output (~4.5 MB).
  //
  // Fix: prevent auto-discovery + register explicitly with env: 'dev'.
  //   - `ignore` stops globby from finding the file in server/middleware/.
  //   - `handlers` re-registers it with env: 'dev' so Nitro's getHandlers()
  //     excludes it in production builds — the file never enters Rollup's
  //     module graph, so import('vite') is never resolved, and vite is not
  //     copied to the output.
  //   - In dev (env: 'dev' matches), it is included and intercepts every
  //     request before Nitro's router, giving Vite first access.
  ignore: ['**/middleware/vite-dev.ts'],
  handlers: [
    {
      middleware: true,
      handler: resolve('./server/middleware/vite-dev.ts'),
      env: 'dev',
    },
  ],

  // ─── Build-time Hooks ──────────────────────────────────────────────────────
  // Nitro 2.x fires 'build:before' right before rollup starts.
  // Config hooks are registered during createNitro() so they are ready when
  // build:before fires. Plugins are called directly (awaited) — they run their
  // scan/setup immediately rather than registering nested sub-hooks which would
  // be registered too late to fire in the same build cycle.
  //
  // Vite dev middleware is NOT injected here. Nitro's DevServer.createApp()
  // reads devHandlers before build:before fires, so pushing to devHandlers
  // there is too late. Instead, server/middleware/vite-dev.ts is registered
  // as a Nitro server middleware (auto-discovered) — middleware files are added
  // to h3App before the router in createNitroApp(), giving Vite first access.
  hooks: {
    'build:before': async (nitro: Nitro) => {
      // Run page scanner — scans pages/, writes manifest stub, sets virtual module
      await pagesPlugin(nitro);
      // Run SSG resolver — resolves dynamic routes for prerendering
      await ssgPlugin(nitro);
    },
  },

  compatibilityDate: '2026-02-28',

  // ─── Route Rules ───────────────────────────────────────────────────────────
  routeRules: {
    '/_litro/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  },
});
