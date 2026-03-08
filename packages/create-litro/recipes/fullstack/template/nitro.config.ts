import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssrPreset, ssgPreset } from 'litro/config';
import pagesPlugin from 'litro/plugins';
import ssgPlugin from 'litro/plugins/ssg';

// LITRO_MODE controls the deployment target at build time:
//   LITRO_MODE=server  litro build     (default — Node.js server)
//   LITRO_MODE=static  litro generate  (SSG — static HTML for CDN)
const mode = process.env.LITRO_MODE ?? 'server';

export default defineNitroConfig({
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),

  // Nitro auto-discovers server/routes/, server/api/, server/middleware/
  srcDir: 'server',

  // publicAssets.dir is resolved relative to srcDir ('server/').
  // Use '../dist/client' (not 'dist/client') to reach <rootDir>/dist/client.
  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
  ],

  // Must be bundled for edge runtimes (Cloudflare Workers, Vercel Edge).
  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'] },

  // Lit uses legacy experimental decorators.
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

  // Exclude vite-dev.ts from auto-discovery so import('vite') never enters
  // the production module graph. Re-register with env:'dev' so it only runs
  // during development.
  ignore: ['**/middleware/vite-dev.ts'],
  handlers: [
    {
      middleware: true,
      handler: resolve('./server/middleware/vite-dev.ts'),
      env: 'dev',
    },
  ],

  hooks: {
    'build:before': async (nitro: Nitro) => {
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
    },
  },

  compatibilityDate: '2025-01-01',

  routeRules: {
    '/_litro/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  },
});
