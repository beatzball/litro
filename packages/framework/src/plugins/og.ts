/**
 * Nitro build-time plugin: OG image prerender route registration
 *
 * This plugin runs during `build:before` AFTER both the pages plugin and
 * the SSG plugin. It reads the already-populated `prerender.routes` array
 * and pushes a corresponding `/__og/<route>.png` entry for each page route,
 * so Nitro's prerenderer will hit the OG image handler during SSG builds.
 *
 * Plugin order in nitro.config.ts hooks['build:before']:
 *   1. pagesPlugin  — scans pages/, seeds static routes
 *   2. ssgPlugin    — resolves dynamic routes via generateRoutes()
 *   3. ogPlugin     — maps page routes to /__og/*.png prerender routes
 *
 * This plugin does NOT generate images — it only registers prerender routes.
 * The actual image generation happens in a separate server route handler.
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
 * The Litro OG image prerender route plugin.
 *
 * Called directly from nitro.config.ts hooks['build:before'] after both
 * pagesPlugin and ssgPlugin have populated prerender.routes.
 */
export default async function ogPlugin(nitro: Nitro, config?: OgPluginConfig): Promise<void> {
  nitro.options.prerender.routes ??= [];

  const routes = nitro.options.prerender.routes;

  // Nothing to do in SSR-only mode (no prerender routes)
  if (routes.length === 0) return;

  // Store config on nitro options for potential use by the OG image handler
  (nitro.options as Record<string, unknown>).__litroOgConfig = {
    siteName: config?.siteName ?? 'Litro',
    accentColor: config?.accentColor ?? '#ea580c',
    logoSvg: config?.logoSvg,
  };

  const existing = new Set(routes);
  let count = 0;

  // Snapshot the current routes — we are appending to the same array
  const currentRoutes = [...routes];

  for (const route of currentRoutes) {
    // Skip non-page routes (feeds, sitemaps, data files, etc.)
    if (SKIP_EXTENSIONS.some(ext => route.endsWith(ext))) continue;

    // Map / → /__og/index.png, /about → /__og/about.png
    const ogRoute = route === '/'
      ? '/__og/index.png'
      : `/__og${route}.png`;

    if (!existing.has(ogRoute)) {
      routes.push(ogRoute);
      existing.add(ogRoute);
      count++;
    }
  }

  if (count > 0 && nitro.logger) {
    nitro.logger.info(`[litro:og] Registered ${count} OG image prerender routes`);
  }
}
