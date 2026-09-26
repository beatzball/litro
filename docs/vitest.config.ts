import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { litroSourceAlias } from '../scripts/litro-source-alias.mjs';

export default defineConfig({
  resolve: {
    // Workspace-only: read the Litro packages from src/ (see scripts/litro-source-alias.mjs).
    alias: [
      ...litroSourceAlias(),
      // The real #litro/page-manifest is generated inside a Nitro build and is
      // absent when the unit tests run. The double scans docs/pages/ instead.
      {
        find: /^#litro\/page-manifest$/,
        replacement: fileURLToPath(new URL('./src/__tests__/fixtures/page-manifest.ts', import.meta.url)),
      },
    ],
    conditions: ['source', 'module', 'import', 'default'],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    environment: 'node',
  },
});
