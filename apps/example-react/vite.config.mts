import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/example-react',
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: '../../dist/apps/example-react',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
});
