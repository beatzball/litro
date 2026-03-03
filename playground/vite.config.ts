import { defineConfig } from 'vite';

export default defineConfig({
  // base must match publicAssets.baseURL in nitro.config.ts ('/_litro/').
  // Vite embeds the base into the compiled preload URL resolver:
  //   const Ft = function(i) { return "/_litro/" + i }
  // Without this, Ft uses "/" and module preload hints resolve to
  // /assets/... (404 HTML) while the actual dynamic imports succeed via
  // relative resolution from /_litro/app.js. The MIME mismatch error
  // comes from the browser receiving HTML for the preload request.
  base: '/_litro/',
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
