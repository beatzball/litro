/**
 * Named Nitro config presets for SSG and SSR deployment modes.
 *
 * Usage in nitro.config.ts:
 *
 *   import { ssgPreset, ssrPreset } from '../packages/framework/src/config/presets.js';
 *   // or from 'litro/config' once the package is built
 *
 *   const mode = process.env.LITRO_MODE ?? 'server'; // 'static' | 'server'
 *
 *   export default defineNitroConfig({
 *     ...(mode === 'static' ? ssgPreset() : ssrPreset()),
 *     // ... rest of config
 *   });
 *
 * SSG preset notes:
 *   - `preset: 'static'` — Nitro produces a directory of HTML + JSON files
 *     that can be served from any static host (Netlify, GitHub Pages, S3, etc.)
 *   - `crawlLinks: true` — Nitro's prerender crawler follows <a href> links
 *     found in already-prerendered HTML. This catches links hardcoded in
 *     templates but does NOT discover @vaadin/router routes (client-side JS).
 *     All @vaadin/router routes must be added via generateRoutes() exports.
 *   - `failOnError: false` — a missing generateRoutes export or a failing page
 *     is a console.warn, not a build failure. Allows partial prerender in CI.
 *   - `autoSubfolderIndex: true` — /about → /about/index.html. Enables clean
 *     URLs on hosts that serve directory indexes (Netlify, GitHub Pages, etc.).
 *
 * SSR preset notes:
 *   - `preset` defaults to 'node-server' but can be overridden for edge
 *     targets: ssrPreset('cloudflare-pages'), ssrPreset('vercel-edge'), etc.
 *   - All Nitro deployment adapters are supported — no custom adapters needed.
 */

import type { NitroConfig } from 'nitropack';

/**
 * Returns Nitro config for static site generation (SSG) mode.
 *
 * Spread into defineNitroConfig() when LITRO_MODE=static:
 *   export default defineNitroConfig({ ...ssgPreset(), ...rest })
 */
export function ssgPreset(): Partial<NitroConfig> {
  return {
    preset: 'static',
    output: {
      dir: 'dist/static',
      publicDir: 'dist/static',
    },
    prerender: {
      // crawlLinks discovers <a href> links in prerendered HTML output.
      // Does NOT discover @vaadin/router client-side routes — those require
      // explicit generateRoutes() exports on each dynamic page file.
      crawlLinks: true,

      // A missing generateRoutes or a prerender fetch error logs a warning
      // but does not abort the build. Allows partial SSG in CI pipelines.
      failOnError: false,

      // /about → /about/index.html — enables clean URLs on static hosts
      // that serve directory index files (Netlify, GitHub Pages, S3 + CloudFront).
      autoSubfolderIndex: true,
    },
  };
}

/**
 * Returns Nitro config for server-side rendering (SSR) mode.
 *
 * @param preset  Nitro deployment preset. Defaults to 'node-server'.
 *                Other valid values: 'cloudflare-pages', 'vercel-edge',
 *                'netlify', 'deno-deploy', 'aws-lambda', etc.
 *                Full list: https://nitro.unjs.io/deploy
 *
 * Spread into defineNitroConfig() when LITRO_MODE=server (default):
 *   export default defineNitroConfig({ ...ssrPreset(), ...rest })
 */
export function ssrPreset(preset = 'node-server'): Partial<NitroConfig> {
  return {
    preset,
    output: {
      dir: 'dist/server',
    },
  };
}
