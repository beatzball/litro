import { defineConfig } from 'vite';

export default defineConfig({
  base: '/_litro/',
  resolve: {
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
  // Elena does not use legacy decorators — no special esbuild config needed.
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
