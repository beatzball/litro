import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests from the src directory only
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // Use the default Node.js pool — no DOM needed for path utilities
    environment: 'node',
  },
});
