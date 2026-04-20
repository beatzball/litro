// Set adapter BEFORE any imports that might read it
process.env.LITRO_ADAPTER = 'elena';

import { defineNitroConfig } from 'nitropack/config';
import type { Nitro } from 'nitropack';
import { resolve } from 'node:path';
import { ssgPreset, ssrPreset } from '@beatzball/litro/config';
import pagesPlugin from '@beatzball/litro/plugins';
import ssgPlugin from '@beatzball/litro/plugins/ssg';
import { topStoryIds, askStoryIds, showStoryIds, userIds } from '../hn-shared/fixture-ids.js';

const mode = process.env.LITRO_MODE ?? 'server';
const allStoryIds = [...new Set([...topStoryIds, ...askStoryIds, ...showStoryIds])];

export default defineNitroConfig({
  ...(mode === 'static' ? ssgPreset() : ssrPreset()),

  srcDir: 'server',

  prerender: {
    crawlLinks: false,
    failOnError: false,
    autoSubfolderIndex: true,
    routes: [
      '/', '/ask', '/show',
      ...allStoryIds.map(id => `/story/${id}`),
      ...userIds.map(id => `/user/${id}`),
    ],
  },

  publicAssets: [
    { dir: '../dist/client', baseURL: '/_litro/', maxAge: 31536000 },
    { dir: '../public', baseURL: '/', maxAge: 0 },
  ],

  // Elena does not use legacy decorators — no special esbuild config needed.

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
      // HTMLElement + customElements shim must exist before page modules
      // are imported by the page scanner (jiti evaluates them at build time).
      await import('@beatzball/litro/adapter/elena/ssr-shim');
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
