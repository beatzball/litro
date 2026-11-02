/**
 * app-version.ts — the content hash of the built client entry.
 *
 * `litro build` runs `vite build` before `nitro build`, so when the pages
 * plugin runs (`build:before`) `dist/client/app.js` is already the file this
 * build will serve. Its hash goes into the generated page manifest, and the
 * page shell then loads `/_litro/app.js?v=<hash>` (see runtime/app-entry.ts).
 *
 * The entry's own bytes are enough: it imports its chunks by their hashed
 * names, and a chunk's hash changes when anything it imports changes.
 *
 * The hash is withheld (bare `/_litro/app.js`) when any other emitted file
 * imports the entry by name. That happens when the client build does not use
 * `litroEntryPlugin()` (see vite/entry.ts): shared code then sits inside
 * `app.js`, and a versioned entry URL would load that code a second time,
 * under the bare URL the chunks ask for.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import fastGlob from 'fast-glob';
import { resolve, join } from 'pathe';

/** The `publicAssets` entry shape this module reads. */
export interface PublicAssetDir {
  dir: string;
  baseURL?: string;
}

/** Length of the hash in the `?v=` query. 12 hex characters is 48 bits. */
const VERSION_LENGTH = 12;

/** Every JavaScript module format the client build can emit. */
const SCRIPT_GLOB = '**/*.{js,mjs,cjs}';

/**
 * An import of the entry by a relative specifier: `from"../app.js"`,
 * `import"./app.js"`, `import("../app.js")`, `export*from"../app.js"`.
 * Anchored to import syntax, so a code sample in a string does not count.
 */
const ENTRY_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*["'`](?:\.\.?\/)+app\.js["'`]/;

/** A `publicAssets` baseURL, without leading or trailing slashes. */
const trimSlashes = (url: string): string => url.replace(/^\/+|\/+$/g, '');

/**
 * Finds the directory served at `/_litro/`, including under a base path:
 * Nitro normalizes `${LITRO_BASE_PATH}/_litro/` to `/litro/_litro`, so a
 * mount ending in `/_litro` counts. A mount at exactly `<basePath>/_litro`
 * wins over any other. Falls back to `<rootDir>/dist/client`, the location
 * every recipe uses, only when no mount matches.
 */
export function resolveClientDir(
  rootDir: string,
  publicAssets: PublicAssetDir[] = [],
  basePath = '',
): string {
  const exact = trimSlashes(`${basePath}/_litro`);
  const mounts = publicAssets.filter(a => {
    const url = trimSlashes(a.baseURL ?? '');
    return url === '_litro' || url.endsWith('/_litro');
  });
  const entry =
    mounts.find(a => trimSlashes(a.baseURL ?? '') === exact) ?? mounts[0];
  return entry ? resolve(rootDir, entry.dir) : resolve(rootDir, 'dist', 'client');
}

export type AppVersionResult =
  | { version: string }
  | { version: undefined; reason: 'missing' }
  | { version: undefined; reason: 'imported'; importers: string[] };

/**
 * Hashes `<clientDir>/app.js`. Returns no version when the file does not
 * exist, or when another emitted file imports it by name.
 */
export interface ComputeAppVersionOptions {
  /**
   * Vite's `publicDir`. Files it copies into the client directory are not
   * chunks, so a file that also exists there at the same path is skipped.
   */
  publicDir?: string;
}

export async function computeAppVersion(
  clientDir: string,
  options: ComputeAppVersionOptions = {},
): Promise<AppVersionResult> {
  let entry: Buffer;
  try {
    entry = await readFile(join(clientDir, 'app.js'));
  } catch {
    return { version: undefined, reason: 'missing' };
  }

  const others = await fastGlob(SCRIPT_GLOB, { cwd: clientDir, ignore: ['app.js'] });
  const importers: string[] = [];
  for (const file of others.sort()) {
    if (options.publicDir && existsSync(join(options.publicDir, file))) continue;
    const code = await readFile(join(clientDir, file), 'utf-8');
    if (ENTRY_IMPORT.test(code)) importers.push(file);
  }
  if (importers.length > 0) return { version: undefined, reason: 'imported', importers };

  const version = createHash('sha256').update(entry).digest('hex').slice(0, VERSION_LENGTH);
  return { version };
}
