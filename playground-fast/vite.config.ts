import { defineConfig } from 'vite';
import { litroSourceAlias } from '../scripts/litro-source-alias.mjs';

export default defineConfig({
  base: '/_litro/',
  resolve: {
    // Workspace-only: read the Litro packages from src/ (see scripts/litro-source-alias.mjs).
    alias: litroSourceAlias(),
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
  // FAST Element 2.x uses legacy TypeScript decorators (@attr, @observable).
  // Vite's esbuild defaults to TC39 Stage 3 decorators which silently drop
  // legacy decorators on plain fields.
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
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
