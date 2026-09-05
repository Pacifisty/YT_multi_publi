import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'apps/api',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
