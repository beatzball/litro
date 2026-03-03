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
import { createJiti } from 'jiti';
import { fileToRoute } from './path-to-route.js';
import fastGlob from 'fast-glob';
import { resolve } from 'pathe';

// ---------------------------------------------------------------------------
// Main plugin export
// ---------------------------------------------------------------------------

/**
 * Patches globalThis.customElements.define to be idempotent (skip if already
 * registered). Applied once after jiti loads @lit-labs/ssr-dom-shim as a side
 * effect of importing a Lit page. Prevents "already been used with this
 * registry" errors when the prerender bundle re-registers the same elements.
 */
function patchCustomElementsIdempotent(): void {
  type CE = Record<string, unknown> & {
    define: (name: string, ctor: unknown, options?: unknown) => void;
    get: (name: string) => unknown;
  };
  const ce = (globalThis as Record<string, unknown>).customElements as CE | undefined;
  if (!ce || ce.__litroIdempotent) return;
  const orig = ce.define.bind(ce);
  ce.define = function (name, ctor, options) {
    if (ce.get(name)) return;
    orig(name, ctor, options);
  };
  ce.__litroIdempotent = true;
}

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
  // generateRoutes() is only useful for SSG prerendering — skip entirely during
  // dev mode. `nitro dev` never prerenders; resolving routes is a no-op there.
  if (nitro.options.dev) return;

  const rootDir = nitro.options.rootDir;
  const pagesDir = resolve(rootDir, 'pages');

  // jiti loads TypeScript files at runtime without a separate compile step.
  // Node.js ESM cannot import .ts files natively (ERR_UNKNOWN_FILE_EXTENSION);
  // jiti's transform pipeline handles the TypeScript → JS conversion in memory.
  const jiti = createJiti(import.meta.url, { interopDefault: true });

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
      // jiti.import() compiles TypeScript on the fly before loading.
      // Native import() would throw ERR_UNKNOWN_FILE_EXTENSION for .ts files.
      const mod = await jiti.import(file) as Record<string, unknown>;

      // jiti uses a separate module loader from Node's native ESM cache, so
      // importing a Lit page loads @lit-labs/ssr-dom-shim and calls
      // customElements.define() as a side effect — registering elements in the
      // global registry. The prerender bundle later imports the same pages via
      // static imports in the page manifest, hitting the same global registry and
      // throwing "has already been used with this registry".
      //
      // Fix: after the jiti import (which is when the shim first becomes available),
      // patch customElements.define to be idempotent. Subsequent registrations of
      // already-defined elements become no-ops instead of throwing.
      patchCustomElementsIdempotent();

      const generateRoutes = mod.generateRoutes as (() => Promise<string[]>) | undefined;
      if (typeof generateRoutes === 'function') {
        const paths: string[] = await generateRoutes();

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
