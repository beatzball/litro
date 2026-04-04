/**
 * og-handler.ts — OG image generation handler factory
 *
 * Returns an H3 EventHandler that generates Open Graph images (1200x630 PNG)
 * for any page route. The handler:
 *
 *   1. Parses the URL to extract the target page path
 *      (/__og/blog/my-post.png → /blog/my-post)
 *   2. Looks up page metadata via the page manifest and pageData fetcher
 *   3. Renders a branded card using Satori (HTML/CSS → SVG)
 *   4. Converts SVG to PNG via @resvg/resvg-js
 *
 * Supports query-param overrides (?title=...&description=...&type=...) for
 * generating OG images for non-page routes or custom content.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineEventHandler, setResponseHeader, getRequestURL, getQuery } from 'h3';
import type { EventHandler } from 'h3';
import type { LitroRoute } from '../types/route.js';
import type { PageDataFetcher } from './page-data.js';
import { defaultOgTemplate } from './og-template.js';
import type { OgTemplateInput, OgTemplate } from './og-template.js';

export interface OgHandlerConfig {
  /** Site name displayed on OG cards. Default: 'Litro' */
  siteName?: string;
  /** Accent color for the card gradient. Default: '#ea580c' */
  accentColor?: string;
  /** SVG markup string for the logo in the top-left corner */
  logoSvg?: string;
  /** Base64 data URI for a logo image (e.g. `data:image/png;base64,...`) */
  logoDataUri?: string;
  /** Custom template function. Uses defaultOgTemplate when omitted. */
  template?: OgTemplate;
  /** Path to a custom .woff font file. Uses bundled Mona Sans Bold when omitted. */
  font?: string;
  /**
   * Page routes from the #litro/page-manifest virtual module.
   * Passed by the site-level route file so the framework package
   * does not need to import the virtual module directly.
   */
  routes?: LitroRoute[];
  /**
   * Page module registry from #litro/page-manifest.
   * Maps filePath → module object containing pageData, routeMeta, etc.
   */
  pageModules?: Record<string, Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Lazy singleton for the loaded font buffer. */
let _fontData: ArrayBuffer | undefined;

function loadFont(customPath?: string): ArrayBuffer {
  if (_fontData) return _fontData;

  const fontPath = customPath
    ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/MonaSans-Bold.woff');

  _fontData = readFileSync(fontPath).buffer as ArrayBuffer;
  return _fontData;
}

/**
 * Matches a pathname against the page routes from the manifest.
 * Same regex logic as the catch-all handler in server/routes/[...].ts.
 */
function matchRoute(
  pathname: string,
  routes: LitroRoute[],
): { route: LitroRoute; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (!route.isDynamic && !route.isCatchAll) {
      if (pathname === route.path) return { route, params: {} };
      continue;
    }

    const regexStr =
      '^' +
      route.path
        .replace(/:([^/]+)\(\.\*\)\*/g, '(?<$1>.+)')
        .replace(/:([^/?]+)\?/g, '(?<$1>[^/]*)?')
        .replace(/:([^/]+)/g, '(?<$1>[^/]+)') +
      '$';

    try {
      const match = pathname.match(new RegExp(regexStr));
      if (match) return { route, params: (match.groups ?? {}) as Record<string, string> };
    } catch {
      // malformed pattern — skip
    }
  }
  return undefined;
}

/**
 * Extracts the target page path from an OG image URL.
 * /__og/blog/my-post.png → /blog/my-post
 * /__og/index.png → /
 */
function parseOgPath(pathname: string): string {
  // Strip /__og prefix and .png suffix
  let pagePath = pathname.replace(/^\/__og/, '').replace(/\.png$/, '');

  // /__og/index.png → /
  if (pagePath === '/index') return '/';

  return pagePath || '/';
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Creates an H3 EventHandler that generates OG images for page routes.
 *
 * Usage in a site's server/routes/__og/[...path].png.ts:
 *
 *   import { createOgHandler } from '@beatzball/litro/runtime/og-handler.js';
 *   import { routes, pageModules } from '#litro/page-manifest';
 *   export default createOgHandler({ siteName: 'Litro', routes, pageModules });
 */
export function createOgHandler(config?: OgHandlerConfig): EventHandler {
  const siteName = config?.siteName ?? 'Litro';
  const accentColor = config?.accentColor ?? '#ea580c';
  const logoSvg = config?.logoSvg;
  const logoDataUri = config?.logoDataUri;
  const template = config?.template ?? defaultOgTemplate;

  return defineEventHandler(async (event) => {
    const url = getRequestURL(event);
    const pagePath = parseOgPath(url.pathname);

    // Check for query-param overrides (for non-page or custom OG images)
    const query = getQuery(event);
    let title = typeof query.title === 'string' ? query.title : '';
    let description = typeof query.description === 'string' ? query.description : undefined;
    let type = typeof query.type === 'string' ? query.type : undefined;

    // If no query overrides, look up page metadata from the manifest
    if (!title && config?.routes && config?.pageModules) {
      const result = matchRoute(pagePath, config.routes);

      if (result) {
        const { route, params } = result;
        const mod = config.pageModules[route.filePath];

        // Try pageData.fetcher() first for dynamic metadata
        const pageDataExport = mod?.pageData as PageDataFetcher<unknown> | undefined;
        if (pageDataExport?.__litroPageData === true) {
          // Patch event params to match the target page
          event.context.params = { ...event.context.params, ...params };
          try {
            const data = await pageDataExport.fetcher(event) as Record<string, unknown>;
            title = (typeof data.seoTitle === 'string' ? data.seoTitle : '') ||
                    (typeof data.title === 'string' ? data.title : '');
            if (typeof data.description === 'string') description = data.description;
            if (typeof data.type === 'string') type = data.type;
          } catch {
            // Data fetch failed — fall through to routeMeta
          }
        }

        // Fall back to routeMeta
        if (!title) {
          const routeMeta = mod?.routeMeta as { title?: string } | undefined;
          title = routeMeta?.title ?? '';
        }
      }
    }

    // Final fallback: use site name as title
    if (!title) title = siteName;

    // Build the template input
    const input: OgTemplateInput = {
      title,
      description,
      type,
      siteName,
      logoSvg,
      logoDataUri,
      accentColor,
    };

    // Render to PNG
    try {
      const satori = (await import('satori')).default;
      const { Resvg } = await import('@resvg/resvg-js');

      const fontData = loadFont(config?.font);

      // Satori expects a ReactNode but our template returns a plain object tree.
      // The cast is safe — Satori's internal renderer accepts any JSX-like object.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svg = await satori(template(input) as any, {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Mona Sans',
            data: fontData,
            weight: 700,
            style: 'normal' as const,
          },
        ],
      });

      const resvg = new Resvg(svg, {
        fitTo: { mode: 'width' as const, value: 1200 },
      });
      const png = resvg.render().asPng();

      setResponseHeader(event, 'content-type', 'image/png');
      setResponseHeader(event, 'cache-control', 'public, max-age=86400, s-maxage=604800');
      return png;
    } catch (err) {
      console.warn('[litro:og] Image generation failed:', err);
      // Return a 1x1 transparent PNG as absolute fallback
      setResponseHeader(event, 'content-type', 'image/png');
      setResponseHeader(event, 'cache-control', 'no-cache');
      return Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
    }
  });
}

export { parseOgPath, matchRoute };
