import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';
import ogPlugin from '@beatzball/litro/plugins/og';
import contentPlugin from '@beatzball/litro/content/plugin';
import { CONTENT_DIR } from '@beatzball/litro-docs-content';

const basePath = process.env.LITRO_BASE_PATH ?? '';
const ssg = ssgPreset();

export default defineNitroConfig({
  ...ssg,
  // Nitro defaults to crawling from '/' when prerender.routes is empty.
  // Explicit routes are required for non-HTML responses that crawlLinks
  // cannot discover (XML files have no anchor tags to follow).
  // '/' is included so crawlLinks has a starting point regardless of
  // whether the default behaviour holds across Nitro versions.
  prerender: {
    ...ssg.prerender,
    // '/' seeds crawlLinks to discover all HTML pages linked from the site.
    // Non-HTML routes and pages not reachable via <a> links must be listed
    // explicitly — crawlLinks cannot discover them.
    routes: [
      '/',
      '/why-web-components',
      '/compare',
      '/compare/nextjs',
      '/compare/nuxt',
      '/compare/enhance',
      '/sitemap.xml',
      '/blog/rss.xml',
      '/benchmarks',
    ],
  },

  srcDir: 'server',

  publicAssets: [
    { dir: '../dist/client', baseURL: `${basePath}/_litro/`, maxAge: 31536000 },
    { dir: '../public',      baseURL: '/',        maxAge: 0 },
    { dir: CONTENT_DIR,      baseURL: '/content/', maxAge: 86400 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/assets', baseURL: '/shoelace/assets/', maxAge: 604800 },
    { dir: '../node_modules/@shoelace-style/shoelace/dist/themes', baseURL: '/shoelace/themes/', maxAge: 604800 },
  ],

  externals: { inline: ['@lit-labs/ssr', '@lit-labs/ssr-client', '@beatzball/litro-docs-ui', 'satori', '@resvg/resvg-js'] },

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
      await ogPlugin(nitro, { siteName: 'Litro' });
    },
  },

  compatibilityDate: '2025-01-01',

  routeRules: {
    [`${basePath}/_litro/**`]: {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    '/shoelace/**': {
      headers: { 'cache-control': 'public, max-age=604800' },
    },
  },
});
