import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/e2e/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    watch: false,
  },
  resolve: {
    alias: {
      '@ntcore-ts/client': path.resolve(__dirname, '../../packages/client/src/index.ts'),
    },
  },
});
