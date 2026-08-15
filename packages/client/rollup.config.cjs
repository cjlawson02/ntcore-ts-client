/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('node:fs');
const { withNx } = require('@nx/rollup/with-nx');

const VIRTUAL_DESCRIPTOR_ID = '\0protobuf-descriptor-json';

/**
 * Load protobuf descriptor.json via fs so Rollup bundles it (avoids parse issues
 * with @rollup/plugin-json on this large file from node_modules).
 */
function protobufDescriptorJson() {
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
  format: ['esm', 'cjs'],
  generateExportsField: true,
  sourceMap: true,
};

module.exports = withNx(options, {
  plugins: [protobufDescriptorJson()],
});
