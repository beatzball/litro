import { defineConfig } from 'vite';

export default defineConfig({
  base: '/_litro/',
  resolve: {
    // NOTE: no 'source' condition. An installed package's TypeScript is
    // never transpiled by Vite (it lives under node_modules), so resolving
    // to source would emit raw decorators and break the client bundle.
    // Always consume the package's compiled output.
    conditions: ['browser', 'module', 'import', 'default'],
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
