// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withNx } = require('@nx/rollup/with-nx');

const options = {
  outputPath: '../../dist/packages/react',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  format: ['esm', 'cjs'],
  generateExportsField: true,
  sourceMap: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@ntcore-ts/client'],
  // SWC avoids the Babel 8 / useBuiltIns breakage with @babel/preset-react.
  compiler: 'swc',
  assets: [
    {
      input: '.',
      output: '.',
      glob: 'README.md',
    },
  ],
};

module.exports = withNx(options);
