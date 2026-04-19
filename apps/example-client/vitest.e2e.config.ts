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
    // E2E specs talk to the same live NT server (example-robot) and some
    // tests toggle the connection (changeURI). Run spec files sequentially
    // to avoid cross-file interference.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@ntcore-ts/client': path.resolve(__dirname, '../../packages/client/src/index.ts'),
    },
  },
});
