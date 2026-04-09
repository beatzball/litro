// Set adapter BEFORE any imports that might read it
process.env.LITRO_ADAPTER = 'fast';

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
    { dir: '../node_modules/@shoelace-style/shoelace/dist/assets', baseURL: '/shoelace/assets/', maxAge: 604800 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/themes', baseURL: '/shoelace/themes/', maxAge: 604800 },
  ],

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
      // FAST Element accesses `document` at module eval time. When the SSG
      // plugin uses jiti to import page modules (to call generateRoutes()),
      // the DOM shim must already be in place. Import it synchronously here.
      await import('@microsoft/fast-ssr/install-dom-shim.js');

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
