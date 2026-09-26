/**
 * Scan an app's pages/ directory the way the Litro page scanner does.
 *
 * The real routes reach a server route through the #litro/page-manifest
 * virtual module, which only exists inside a Nitro build. Tests rebuild the
 * same list from the same files with the same `fileToRoute` the scanner uses,
 * so a page added to pages/ shows up here with no fixture to update.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileToRoute } from '../../../../packages/framework/src/plugins/path-to-route.js';
import type { LitroRoute } from '../../../../packages/framework/src/types/route.js';

/** Absolute path of an app's pages/ directory, e.g. appPagesDir('docs'). */
export function appPagesDir(app: string): string {
  return fileURLToPath(new URL(`../../../../${app}/pages`, import.meta.url));
}

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    // Same exclusions as the scanner's glob: declarations, tests, disabled pages.
    if (entry.name.startsWith('-')) return [];
    if (/\.(d|test|spec)\.tsx?$/.test(entry.name)) return [];
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Every route an app's pages/ directory produces, sorted by path. */
export function scanRoutes(app: string): LitroRoute[] {
  const pagesDir = appPagesDir(app);
  return pageFiles(pagesDir)
    .sort()
    .map((file) => fileToRoute(file, pagesDir));
}
