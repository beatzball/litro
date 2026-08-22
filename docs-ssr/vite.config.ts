import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import litroContentPlugin from '@beatzball/litro/vite';
import { litroSourceAlias } from '../scripts/litro-source-alias.mjs';

// Browser stub for docs/src/packages.ts — reads CHANGELOG.md / package.json
// at SSG build time (server-side only). In the browser, data arrives via serverData.
function packagesStubPlugin(): Plugin {
  return {
    name: 'litro:packages-stub',
    enforce: 'pre',
    resolveId(id, importer) {
      if (importer && (id.endsWith('/src/packages.js') || id.endsWith('/src/packages.ts'))) {
        return '\0litro:packages-stub';
      }
    },
    load(id) {
      if (id !== '\0litro:packages-stub') return;
      return [
        "export const ALL_PACKAGE_SLUGS = ['litro', 'litro-router', 'create-litro'];",
        'export async function getPackageInfo(_slug) { return null; }',
        'export async function renderMarkdown(_md) { return ""; }',
      ].join('\n');
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
