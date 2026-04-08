import { defineConfig } from 'vite';

export default defineConfig({
  base: '/_litro/',
  resolve: {
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
