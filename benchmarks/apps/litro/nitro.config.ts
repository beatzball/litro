import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';

export default defineNitroConfig({
  ...ssgPreset(),

  srcDir: 'server',

  static: {
    prerender: {
      routes: ['/', '/blog/hello'],
    },
  },

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public', baseURL: '/', maxAge: 0 },
  ],

  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client'] },

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
