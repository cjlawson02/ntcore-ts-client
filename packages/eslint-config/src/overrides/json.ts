import type { Linter } from '@typescript-eslint/utils/dist/ts-eslint';

export const jsonOverrides: Linter.ConfigOverride = {
  files: ['*.json'],
  plugins: ['json'],
  extends: ['plugin:json/recommended'],
  rules: {
    'json/*': ['error', { allowComments: true }],
  },
};
