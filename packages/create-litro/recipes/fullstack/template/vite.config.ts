import { defineConfig } from 'vite';

export default defineConfig({
  // base must match publicAssets.baseURL in nitro.config.ts ('/_litro/').
  // Vite embeds the base into the compiled preload URL resolver so that
  // modulepreload hints resolve to /_litro/assets/... instead of /assets/...
  // Without this, preload requests hit the catch-all page handler and return
  // HTML, causing a MIME type error for module scripts.
  base: '/_litro/',
  resolve: {
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
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
