/**
 * Nitro build-time plugin: OG image prerender route registration
 *
 * Returns a `prerender:routes` hook function that maps page routes to
 * `/__og/<route>.png` entries. In Nitro's CLI build pipeline, `prerender()`
 * runs BEFORE `build()`, so the hook must be registered at config level
 * (in `nitro.config.ts` hooks) — NOT inside `build:before`.
 *
 * Usage in nitro.config.ts:
 *
 *   import { ogPrerenderHook } from '@beatzball/litro/plugins/og';
 *
 *   export default defineNitroConfig({
 *     hooks: {
 *       'prerender:routes': ogPrerenderHook(),
 *       'build:before': async (nitro) => { ... },
 *     },
 *   });
 *
 * The legacy `ogPlugin(nitro)` export is kept for backwards compat in
 * `build:before` — it's a no-op but stores config on `nitro.options`.
 */

import type { Nitro } from 'nitropack';

export interface OgPluginConfig {
  /** Site name displayed on OG cards. Default: 'Litro' */
  siteName?: string;
  /** Accent color for the card gradient. Default: '#ea580c' */
  accentColor?: string;
  /** SVG markup string for the logo in the top-left corner */
  logoSvg?: string;
}

/** File extensions that should not get OG image routes */
const SKIP_EXTENSIONS = ['.xml', '.json', '.txt', '.rss'];

/**
 * Returns a `prerender:routes` hook function that adds `/__og/*.png`
 * entries for every page route in the prerender set.
 */
export function ogPrerenderHook(): (routes: Set<string>) => void {
  return (routes: Set<string>) => {
    if (routes.size === 0) return;

    let count = 0;
    const currentRoutes = [...routes];

    for (const route of currentRoutes) {
      if (SKIP_EXTENSIONS.some(ext => route.endsWith(ext))) continue;

      const ogRoute = route === '/'
        ? '/__og/index.png'
        : `/__og${route}.png`;

      if (!routes.has(ogRoute)) {
        routes.add(ogRoute);
        count++;
      }
    }

    if (count > 0) {
      console.log(`[litro:og] Registered ${count} OG image prerender routes`);
    }
  };
}

/**
 * Legacy build:before plugin — stores config on nitro.options.
 * OG prerender route registration is now handled by `ogPrerenderHook()`
 * registered at the config level.
 */
export default async function ogPlugin(nitro: Nitro, config?: OgPluginConfig): Promise<void> {
  (nitro.options as Record<string, unknown>).__litroOgConfig = {
    siteName: config?.siteName ?? 'Litro',
    accentColor: config?.accentColor ?? '#ea580c',
    logoSvg: config?.logoSvg,
  };
}
