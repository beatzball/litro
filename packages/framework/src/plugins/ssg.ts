/**
 * Nitro build-time plugin: SSG dynamic-route resolver
 *
 * This plugin runs during `nitro:build:before` (after the pages plugin) and
 * handles dynamic page routes for static site generation.
 *
 * The pages plugin (I-2) already adds all non-dynamic, non-catch-all routes to
 * `nitro.options.prerender.routes`. This plugin handles the dynamic route case
 * by calling the `generateRoutes()` named export from each dynamic page file,
 * collecting the returned concrete paths, and appending them to the prerender
 * list.
 *
 * Contract:
 *   - A dynamic page file (e.g. `pages/blog/[slug].ts`) MAY export:
 *       export async function generateRoutes(): Promise<string[]> {
 *         return ['/blog/hello-world', '/blog/getting-started'];
 *       }
 *   - If `generateRoutes` is absent, the plugin emits a console.warn and skips
 *     the route (no build error — failOnError: false policy).
 *   - If importing the file throws, the error is caught and logged as a warning.
 *
 * Why not rely on crawlLinks?
 *   `crawlLinks: true` discovers links in the HTML output of prerendered pages.
 *   It DOES NOT discover routes configured in @vaadin/router — those are
 *   client-side JS and are never visible to the prerender crawler. All dynamic
 *   page routes must be explicitly listed via generateRoutes().
 *   (See R-4 findings §6.3 and R-3 findings §client-router-ssg.)
 */

import type { Nitro } from 'nitropack';
import { fileToRoute } from './path-to-route.js';
import fastGlob from 'fast-glob';
import { resolve } from 'pathe';

// ---------------------------------------------------------------------------
// Main plugin export
// ---------------------------------------------------------------------------

/**
 * The Litro SSG plugin.
 *
 * Registered as a Nitro build-time plugin via `plugins` in nitro.config.ts
 * AFTER pagesPlugin (order matters — pages plugin seeds the prerender list
 * first, then this plugin appends dynamic routes to it).
 *
 *   import pagesPlugin from 'litro/plugins';
 *   import ssgPlugin from 'litro/plugins/ssg';
 *   // or locally during development:
 *   import ssgPlugin from '../packages/framework/src/plugins/ssg.js';
 *
 *   export default defineNitroConfig({
 *     plugins: [pagesPlugin, ssgPlugin],
 *   });
 */
/**
 * Called directly from nitro.config.ts hooks['build:before'] after pagesPlugin.
 * Runs the SSG dynamic-route resolution immediately.
 *
 * Note on Nitro 2.x hook names: see pages.ts for details.
 */
export default async function ssgPlugin(nitro: Nitro): Promise<void> {
  const rootDir = nitro.options.rootDir;
  const pagesDir = resolve(rootDir, 'pages');

  // Scan for all page files — same glob pattern as the pages plugin
  let files: string[];
  try {
    files = await fastGlob('**/*.{ts,tsx}', {
      cwd: pagesDir,
      absolute: true,
      followSymbolicLinks: true,
      onlyFiles: true,
      ignore: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/-*.ts',
        '**/-*.tsx',
      ],
    });
  } catch {
    // pages/ directory doesn't exist — nothing to do
    return;
  }

  for (const file of files) {
    const route = fileToRoute(file, pagesDir);

    // Static routes are already handled by the pages plugin — skip them here.
    // Catch-all routes are intentionally excluded from SSG prerendering.
    if (!route.isDynamic || route.isCatchAll) continue;

    // Attempt to call generateRoutes() from the page module
    try {
      // Dynamic import uses the absolute file path.
      // In Node.js ESM, file:// URLs are required for Windows compatibility,
      // but on POSIX systems absolute paths work directly with import().
      const mod = await import(file);

      if (typeof mod.generateRoutes === 'function') {
        const paths: string[] = await mod.generateRoutes();

        if (!Array.isArray(paths) || paths.length === 0) {
          nitro.logger.warn(
            `[litro:ssg] generateRoutes() in ${file} returned an empty array. ` +
            `No paths will be prerendered for this route.`
          );
          continue;
        }

        // Ensure prerender object and routes array exist
        if (!nitro.options.prerender) {
          (nitro.options as Record<string, unknown>).prerender = {};
        }
        nitro.options.prerender.routes ??= [];

        // Deduplicate before appending — other plugins may have added some
        const existing = new Set(nitro.options.prerender.routes);
        for (const p of paths) {
          if (!existing.has(p)) {
            nitro.options.prerender.routes.push(p);
            existing.add(p);
          }
        }

        nitro.logger.info(
          `[litro:ssg] ${route.path} → ${paths.length} prerender path${paths.length === 1 ? '' : 's'}: ${paths.join(', ')}`
        );
      } else {
        // Dynamic page without generateRoutes — warn but continue
        console.warn(
          `[litro:ssg] Dynamic page ${file} has no generateRoutes export. ` +
          `It will not be prerendered in SSG mode. ` +
          `Add: export async function generateRoutes(): Promise<string[]> { return ['/blog/my-post']; }`
        );
      }
    } catch (e) {
      // Import failed (e.g. the page imports browser-only APIs at module eval time)
      console.warn(
        `[litro:ssg] Failed to load generateRoutes from ${file}:`,
        e
      );
    }
  }
}
