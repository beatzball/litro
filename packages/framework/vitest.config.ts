import { defineConfig } from 'vitest/config';
import { litroSourceAlias } from '../../scripts/litro-source-alias.mjs';

export default defineConfig({
  resolve: {
    // Workspace-only: read the Litro packages from src/ (see scripts/litro-source-alias.mjs).
    alias: litroSourceAlias(),
    // Resolve the 'source' export condition in workspace packages so Vitest
    // uses TypeScript source files directly (e.g. litro-router/src/index.ts)
    // without requiring a prior build step. Mirrors playground/vite.config.ts.
    conditions: ['source', 'module', 'import', 'default'],
  },
  test: {
    // Run tests from the src directory only
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // Use the default Node.js pool — no DOM needed for path utilities
    environment: 'node',
  },
});
