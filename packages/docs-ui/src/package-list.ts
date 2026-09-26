/**
 * The published Litro packages, as plain data.
 *
 * This module is deliberately dependency-free: no `node:fs`, no Markdown
 * toolchain, nothing that cannot run in a browser bundle. `packages.ts` reads
 * README and CHANGELOG files off disk and therefore has to be replaced by a
 * browser stub (CONTENT-008); this file does not, so both the server module
 * and that stub can derive the package list from one place instead of each
 * keeping a copy. See issue "Docs browser stub hard-codes a package list".
 */

export interface PackageEntry {
  /** URL slug under /docs/packages/. */
  slug: string;
  /** Directory under packages/ in this repository. */
  dir: string;
  /** npm package name. */
  name: string;
}

export const PACKAGES: readonly PackageEntry[] = [
  { slug: 'litro',        dir: 'framework',    name: '@beatzball/litro' },
  { slug: 'litro-router', dir: 'litro-router', name: '@beatzball/litro-router' },
  { slug: 'create-litro', dir: 'create-litro', name: '@beatzball/create-litro' },
  { slug: 'litro-agent',  dir: 'litro-agent',  name: '@beatzball/litro-agent' },
];

export const ALL_PACKAGE_SLUGS: readonly string[] = PACKAGES.map(p => p.slug);
