import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'app.ts',
      output: {
        // Stable (non-hashed) entry filename so the HTML shell can always
        // reference /_litro/app.js without knowing the content hash.
        entryFileNames: '[name].js',
      },
    },
  },
});
