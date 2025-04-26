import type { Linter } from '@typescript-eslint/utils/dist/ts-eslint';

export const vitestOverrides: Linter.ConfigOverride = {
  files: '*.spec.ts',
  plugins: ['vitest'],
  rules: {
    '@typescript-eslint/dot-notation': 'off',
  },
};
