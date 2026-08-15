import { withNx } from '@nx/rollup/with-nx';

const options = {
  outputPath: '../../dist/packages/react',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  generateExportsField: true,
  sourceMap: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@ntcore-ts/client'],
  // SWC avoids the Babel 8 / useBuiltIns breakage with @babel/preset-react.
  compiler: 'swc' as const,
  assets: [
    {
      input: '.',
      output: '.',
      glob: 'README.md',
    },
  ],
};

export default withNx(options);
