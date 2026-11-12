import { defineConfig } from 'vitest/config';
import { litroSourceAlias } from '../scripts/litro-source-alias.mjs';

export default defineConfig({
  resolve: { alias: litroSourceAlias(), conditions: ['module', 'import', 'default'] },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
