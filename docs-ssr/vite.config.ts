import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import litroContentPlugin from '@beatzball/litro/vite';
import { litroSourceAlias } from '../scripts/litro-source-alias.mjs';

// Browser stub for @beatzball/litro-docs-ui/src/packages.ts — that module
// reads CHANGELOG.md / package.json with node:fs and runs the Markdown
// toolchain, both server-only, so it must never reach the client bundle
// (CONTENT-008). In the browser, the rendered data arrives via serverData.
//
// The stub holds NO copy of the package list. It re-exports the slugs from
// package-list.ts, which is dependency-free and safe in a browser bundle, so
// a new package cannot be added to one list and forgotten in the other.
export const PACKAGES_STUB_ID = '\0litro:packages-stub';

export const PACKAGES_STUB_SOURCE = [
  "export { PACKAGES, ALL_PACKAGE_SLUGS } from '@beatzball/litro-docs-ui/src/package-list.js';",
  'export async function getPackageInfo(_slug) { return null; }',
  'export async function renderMarkdown(_md) { return ""; }',
].join('\n');

export function packagesStubPlugin(): Plugin {
  return {
    name: 'litro:packages-stub',
    enforce: 'pre',
    resolveId(id, importer) {
      if (importer && (id.endsWith('/src/packages.js') || id.endsWith('/src/packages.ts'))) {
        return PACKAGES_STUB_ID;
      }
    },
    load(id) {
      if (id !== PACKAGES_STUB_ID) return;
      return PACKAGES_STUB_SOURCE;
    },
  };
}

export default defineConfig({
  plugins: [litroContentPlugin(), packagesStubPlugin()],
  base: process.env.LITRO_BASE_PATH ? `${process.env.LITRO_BASE_PATH}/_litro/` : '/_litro/',
  resolve: {
    // Workspace-only: read the Litro packages from src/ (see scripts/litro-source-alias.mjs).
    alias: litroSourceAlias(),
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'app.ts',
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
