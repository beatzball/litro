import { defineConfig } from 'vitest/config';
import config from './vitest.config.js';

export default defineConfig({
  ...config,
  test: { ...config.test, include: ['tests/run-code.vm.ts'], testTimeout: 120000, hookTimeout: 30000 },
});
