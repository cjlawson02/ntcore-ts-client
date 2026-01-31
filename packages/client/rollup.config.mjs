import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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

/**
 * Nx Rollup config: handles descriptor.json for ESM and CJS for browser and Node.
 */
export default function (config) {
  config.plugins = [protobufDescriptorJson(), ...(config.plugins ?? [])];
  return config;
}
