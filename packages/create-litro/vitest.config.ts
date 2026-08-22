import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/recipes/**/template/**',
      // tsc emits the specs to dist/ too; without this every test runs twice,
      // and the compiled copy can be stale relative to the source.
      '**/dist/**',
    ],
  },
});
