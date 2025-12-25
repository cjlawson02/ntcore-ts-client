import type { Linter } from '@typescript-eslint/utils/dist/ts-eslint';

export const jsonOverrides: Linter.ConfigOverride = {
  files: ['*.json'],
  plugins: ['json'],
  rules: {
    'json/*': ['error', { allowComments: true }],
  },
};
