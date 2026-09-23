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
     * The seed the crawler starts from.
     *
     * `/` HAS TO STAY IN THIS LIST. Naming any route here replaces Nitro's
     * default seed of `/`, and every other page is found only by following
     * links out of the home page.
     *
     * `/blog/hello` is named because the crawler cannot reach it. The home
     * page does link to it, but that link is rendered inside a declarative
     * shadow root, and Nitro's link crawler does not look inside one. The
     * other two benchmark apps put the same link in light DOM, so their
     * crawlers find it. Naming the route here is what makes the three apps
     * prerender the same two pages.
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
