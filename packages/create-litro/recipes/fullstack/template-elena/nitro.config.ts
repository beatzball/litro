import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssrPreset, ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';

// LITRO_MODE controls the deployment target at build time:
//   LITRO_MODE=server  litro build     (default — Node.js server)
//   LITRO_MODE=static  litro generate  (SSG — static HTML for CDN)
const mode = process.env.LITRO_MODE ?? 'server';

// Tell the adapter resolver to use Elena.
process.env.LITRO_ADAPTER = 'elena';

export default defineNitroConfig({
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),

  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
  ],

  // Elena does not use legacy decorators — no special esbuild config needed.

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
      // HTMLElement + customElements shim must exist before page modules
      // are imported by the page scanner (jiti evaluates them at build time).
      await import('@beatzball/litro/adapter/elena/ssr-shim');
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
