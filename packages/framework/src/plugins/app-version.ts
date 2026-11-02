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
import fastGlob from 'fast-glob';
import { resolve, join } from 'pathe';

/** The `publicAssets` entry shape this module reads. */
export interface PublicAssetDir {
  dir: string;
  baseURL?: string;
}

/** Length of the hash in the `?v=` query. 12 hex characters is 48 bits. */
const VERSION_LENGTH = 12;

/** A quoted relative specifier that names the entry: `"../app.js"`, `'./app.js'`. */
const ENTRY_IMPORT = /["'`](?:\.\.?\/)+app\.js["'`]/;

/**
 * Finds the directory served at `/_litro/`. Falls back to
 * `<rootDir>/dist/client`, the location every recipe uses.
 */
export function resolveClientDir(rootDir: string, publicAssets: PublicAssetDir[] = []): string {
  const entry = publicAssets.find(a => (a.baseURL ?? '').replace(/^\/+|\/+$/g, '') === '_litro');
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
export async function computeAppVersion(clientDir: string): Promise<AppVersionResult> {
  let entry: Buffer;
  try {
    entry = await readFile(join(clientDir, 'app.js'));
  } catch {
    return { version: undefined, reason: 'missing' };
  }

  const others = await fastGlob('**/*.js', { cwd: clientDir, ignore: ['app.js'] });
  const importers: string[] = [];
  for (const file of others.sort()) {
    const code = await readFile(join(clientDir, file), 'utf-8');
    if (ENTRY_IMPORT.test(code)) importers.push(file);
  }
  if (importers.length > 0) return { version: undefined, reason: 'imported', importers };

  const version = createHash('sha256').update(entry).digest('hex').slice(0, VERSION_LENGTH);
  return { version };
}
