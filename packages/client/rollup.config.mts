import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { withNx } from '@nx/rollup/with-nx';
import type { Plugin } from 'rollup';

const require = createRequire(import.meta.url);

const VIRTUAL_DESCRIPTOR_ID = '\0protobuf-descriptor-json';

/**
 * Load protobuf descriptor.json via fs so Rollup bundles it (avoids parse issues
 * with @rollup/plugin-json on this large file from node_modules).
 */
function protobufDescriptorJson(): Plugin {
  return {
    name: 'protobuf-descriptor-json',
    resolveId(id) {
      if (id === 'protobufjs/google/protobuf/descriptor.json') return VIRTUAL_DESCRIPTOR_ID;
      return null;
    },
    load(id) {
      if (id !== VIRTUAL_DESCRIPTOR_ID) return null;
      try {
        const path = require.resolve('protobufjs/google/protobuf/descriptor.json');
        const data = JSON.parse(readFileSync(path, 'utf8'));
        return `export default ${JSON.stringify(data)};`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.error(`Failed to load protobuf descriptor.json: ${msg}`);
      }
    },
  };
}

const options = {
  outputPath: '../../dist/packages/client',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  generateExportsField: true,
  sourceMap: true,
};

export default withNx(options, {
  plugins: [protobufDescriptorJson()],
});
