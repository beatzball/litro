import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
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
      dir: 'dist/client',
      baseURL: '/_litro/',
      maxAge: 31536000, // 1 year — Vite writes content-hashed filenames
    },
    {
      dir: 'public',
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

  // ─── Build-time Plugins ────────────────────────────────────────────────────
  // Plugins run during createNitro() and can register nitro:init hooks.
  // viteDevPlugin MUST be here (not in hooks['build:before']) because Nitro's
  // DevServer constructor calls createApp() which reads devHandlers before
  // build:before ever fires. nitro:init fires before createDevServer(), so
  // plugins that register a nitro:init hook can inject devHandlers in time.
  //
  // Note: Nitro resolves plugin paths relative to rootDir. Paths with '../'
  // that escape the project root may not resolve correctly in all Nitro
  // versions, so we use the local wrapper at ./plugins/vite-dev.ts instead
  // of referencing the framework package directly.
  plugins: [
    './plugins/vite-dev.ts',
  ],

  // ─── Build-time Hooks ──────────────────────────────────────────────────────
  // Nitro 2.x fires 'build:before' right before rollup starts.
  // Config hooks are registered during createNitro() so they are ready when
  // build:before fires. Plugins are called directly (awaited) — they run their
  // scan/setup immediately rather than registering nested sub-hooks which would
  // be registered too late to fire in the same build cycle.
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
