import { defineConfig } from 'vite';
import litroContentPlugin from '@beatzball/litro/vite';

export default defineConfig({
  plugins: [litroContentPlugin()],
  base: process.env.LITRO_BASE_PATH ? `${process.env.LITRO_BASE_PATH}/_litro/` : '/_litro/',
  resolve: {
    // NOTE: no 'source' condition. An installed package's TypeScript is
    // never transpiled by Vite (it lives under node_modules), so resolving
    // to source would emit raw decorators and break the client bundle.
    // Always consume the package's compiled output.
    conditions: ['browser', 'module', 'import', 'default'],
  },
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
