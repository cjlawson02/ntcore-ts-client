/// <reference types="vitest" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/client',
  plugins: [
    tsconfigPaths({
      root: path.join(__dirname, '../..'),
    }),
  ],
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/client',
      provider: 'v8' as const,
      include: ['src/**/*.{ts,tsx}'],
    },
  },
  benchmark: {
    include: ['src/**/*.{bench,benchmark}.{ts,mts,cts}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
  },
  resolve: {
    alias: {
      'isomorphic-ws': path.resolve(__dirname, 'src/__mocks__/isomorphic-ws.ts'),
    },
  },
}));
