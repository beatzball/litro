import { defineConfig } from 'vite';

export default defineConfig({
  base: '/_litro/',
  resolve: {
    conditions: ['source', 'browser', 'module', 'import', 'default'],
  },
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      input: 'app.ts',
      output: { entryFileNames: '[name].js' },
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
});
