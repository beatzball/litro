import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';

const ssg = ssgPreset();

export default defineNitroConfig({
  ...ssg,

  srcDir: 'server',

  prerender: {
    ...ssg.prerender,
    /**
     * Every measured route, named.
     *
     * `/` HAS TO STAY IN THIS LIST. Naming any route here replaces Nitro's
     * default seed of `/`, and every other page is then found only by
     * following links out of whatever is seeded.
     *
     * `/blog/hello` is named so that this app does not depend on a crawler,
     * the same way the other two do not: Nuxt names it in `nuxt.config.ts`
     * and Next names it from `generateStaticParams`. All three build the same
     * two pages from an explicit list, so the comparison does not turn on how
     * well each one's link discovery works.
     *
     * The crawler does in fact reach `/blog/hello` from `/` on its own.
     * Building with `routes: ['/']` alone still writes `blog/hello/index.html`
     * ("Prerendering 1 initial routes with crawler", then `/blog/hello`),
     * even though the link is inside `<template shadowrootmode="open">`:
     * Nitro parses the page with ultrahtml and walks every node carrying an
     * `href`, template content included. An earlier version of this comment
     * claimed the opposite. It was wrong.
     *
     * A previous version of this file put this list under a `static:` key,
     * which Nitro does not read. Both routes were then left unprerendered.
     */
    routes: ['/', '/blog/hello'],
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
