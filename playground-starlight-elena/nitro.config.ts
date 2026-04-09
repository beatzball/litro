// Set adapter BEFORE any imports that might read it
process.env.LITRO_ADAPTER = 'elena';

import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';
import contentPlugin from '@beatzball/litro/content/plugin';

export default defineNitroConfig({
  ...ssgPreset(),

  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
    { dir: '../content',     baseURL: '/content/', maxAge: 86400 },
  ],

  // Elena does not use legacy decorators — no special esbuild config needed.
  // No externals.inline — Elena has no bundling edge cases.

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
      // Elena page modules extend Elena(HTMLElement). When the SSG plugin
      // uses jiti to import page modules (to call generateRoutes()), the
      // HTMLElement shim must already be in place. @elenajs/ssr provides it.
      const elenaSsr = await import('@elenajs/ssr');
      (globalThis as any).__litro_elena_ssr__ = elenaSsr.ssr;
      (globalThis as any).__litro_elena_register__ = elenaSsr.register;

      await contentPlugin(nitro);
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
