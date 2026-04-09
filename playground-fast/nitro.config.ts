import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssrPreset } from '../packages/framework/dist/config/presets.js';
import pagesPlugin from '../packages/framework/dist/plugins/pages.js';

// Tell the adapter resolver to use FAST instead of Lit.
process.env.LITRO_ADAPTER = 'fast';

export default defineNitroConfig({
  ...ssrPreset(),

  srcDir: 'server',

  publicAssets: [
    {
      dir: '../dist/client',
      baseURL: '/_litro/',
      maxAge: 31536000,
    },
    {
      dir: '../public',
      baseURL: '/',
      maxAge: 0,
    },
  ],

  // FAST Element uses decorators (@attr, @observable) that need esbuild config.
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
      await pagesPlugin(nitro);
    },
  },

  compatibilityDate: '2026-02-28',

  routeRules: {
    '/_litro/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  },
});
