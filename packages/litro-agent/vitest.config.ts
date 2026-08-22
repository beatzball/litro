import { defineConfig } from 'vitest/config';
import { litroSourceAlias } from '../../scripts/litro-source-alias.mjs';

export default defineConfig({
  resolve: {
    // Workspace-only: read the Litro packages from src/ (see scripts/litro-source-alias.mjs).
    alias: litroSourceAlias(),
    conditions: ['source', 'module', 'import', 'default'],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    environment: 'node',
  },
});
