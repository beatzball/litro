import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';
import contentPlugin from '@beatzball/litro/content/plugin';

const ssg = ssgPreset();

export default defineNitroConfig({
  ...ssg,

  prerender: {
    ...ssg.prerender,
    /**
     * The seed the crawler starts from.
     *
     * `/` HAS TO BE IN THIS LIST. Naming any route here replaces Nitro's
     * default seed of `/`, and the rest of this site is found only by
     * following links out of the home page — leave `/` out and the build
     * prerenders one page and quietly drops the other twenty.
     *
     * `/hero-video` is linked from nowhere: it is a harness page for the
     * `<litro-hero-video>` e2e spec, kept off the landing page so that page
     * stays the recipe's own. The crawler cannot reach it, so it is named
     * here and the spec passes against a production build too.
     */
    routes: ['/', '/hero-video'],
  },

  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
    { dir: '../content',     baseURL: '/content/', maxAge: 86400 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/assets', baseURL: '/shoelace/assets/', maxAge: 604800 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/themes', baseURL: '/shoelace/themes/', maxAge: 604800 },
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
    '/_litro/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  },
});
