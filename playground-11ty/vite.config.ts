import { defineConfig } from 'vite';
import litroContentPlugin from '@beatzball/litro/vite';

export default defineConfig({
  plugins: [litroContentPlugin()],
  base: '/_litro/',
  resolve: {
    conditions: ['source', 'browser', 'module', 'import', 'default'],
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
