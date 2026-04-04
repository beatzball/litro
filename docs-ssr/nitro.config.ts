import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import pagesPlugin from '@beatzball/litro/plugins';
import contentPlugin from '@beatzball/litro/content/plugin';
import ogPlugin, { ogPrerenderHook } from '@beatzball/litro/plugins/og';
import { ssrPreset } from '@beatzball/litro/config';
import { CONTENT_DIR } from '@beatzball/litro-docs-content';

export default defineNitroConfig({
  ...ssrPreset(),
  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client',                                      baseURL: '/_litro/',           maxAge: 31536000 },
    // Reuse docs/ public directory — no duplicate static assets.
    // Paths resolve relative to srcDir ('server'), so '../..' goes up to the repo root.
    { dir: '../../docs/public',                                   baseURL: '/',                  maxAge: 0 },
    { dir: CONTENT_DIR,                                           baseURL: '/content/',          maxAge: 86400 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/assets', baseURL: '/shoelace/assets/', maxAge: 604800 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/themes', baseURL: '/shoelace/themes/', maxAge: 604800 },
  ],

  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client', '@beatzball/litro-docs-ui', 'satori'] },

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
    'prerender:routes': ogPrerenderHook(),
    'build:before': async (nitro: Nitro) => {
      await contentPlugin(nitro);
      await pagesPlugin(nitro);
      await ogPlugin(nitro);
    },
  },

  compatibilityDate: '2025-01-01',

  routeRules: {
    '/_litro/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    '/shoelace/**': {
      headers: { 'cache-control': 'public, max-age=604800' },
    },
  },
});
