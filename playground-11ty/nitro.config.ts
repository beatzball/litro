import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssrPreset, ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';
import contentPlugin from '@beatzball/litro/content/plugin';

const mode = process.env.LITRO_MODE ?? 'server';

export default defineNitroConfig({
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),

  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/' },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
    // Serve co-located content images at their natural paths
    { dir: '../content',     baseURL: '/content/', maxAge: 86400 },
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
      await contentPlugin(nitro);
      await pagesPlugin(nitro);
      await ssgPlugin(nitro);
    },
  },

  compatibilityDate: '2025-01-01',

  routeRules: {
    // Only the hashed chunks are immutable. app.js keeps one name in every
    // build, so a browser must ask again each time; the page loads it as
    // app.js?v=<content hash>, which changes with each deploy.
    '/_litro/assets/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    '/_litro/app.js': {
      headers: { 'cache-control': 'no-cache' },
    },
  },
});
