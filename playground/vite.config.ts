import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Resolve 'source' condition in workspace packages so Vite uses
    // TypeScript source files directly (no pre-compilation needed in dev)
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'app.ts',
    },
  },
});
