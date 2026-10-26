import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // The bridge must resolve correctly where there is no DOM at all, which is
    // what a server render looks like. Tests that need browser globals install
    // their own stubs.
    environment: 'node',
  },
});
