import { defineConfig } from 'vite';
import litroContentPlugin from '@beatzball/litro/vite';
import { litroSourceAlias } from '../scripts/litro-source-alias.mjs';

export default defineConfig({
  plugins: [litroContentPlugin()],
  base: '/_litro/',
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
