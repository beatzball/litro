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
      output: {
        // Use a stable, non-hashed entry filename so the HTML shell can
        // reference /_litro/app.js without knowing the content hash.
        // Dynamic import chunks keep their hashes for long-term caching.
        entryFileNames: '[name].js',
      },
    },
  },
});
