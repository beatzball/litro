import { defineConfig } from 'vitest/config';
import { litroSourceAlias } from '../../scripts/litro-source-alias.mjs';

export default defineConfig({
  resolve: {
    // Workspace-only: read the Litro packages from src/ (see scripts/litro-source-alias.mjs).
    alias: litroSourceAlias(),
    // NO `source` CONDITION. It is not needed — `litroSourceAlias()` above is
    // what reads the workspace packages from src/, and the published packages
    // stopped advertising `source` when BUILD-004 was written. Leaving it in the
    // list applied it to DEPENDENCIES too: `eventsource-parser`, which the MCP
    // SDK's Streamable HTTP client pulls in, publishes a `source` condition
    // pointing at raw TypeScript inside node_modules, and Node refuses that with
    // "Stripping types is currently unsupported for files under node_modules".
    conditions: ['module', 'import', 'default'],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    environment: 'node',
  },
});
