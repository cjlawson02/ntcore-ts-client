import { jsonOverrides } from './overrides/json';
import { tsOverrides } from './overrides/ts';
import { vitestOverrides } from './overrides/vitest';

import type { Linter } from '@typescript-eslint/utils/dist/ts-eslint';

const config: Linter.Config = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/', 'build/', 'docs/'],
  env: {
    browser: true,
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': '.ts',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  overrides: [tsOverrides, vitestOverrides, jsonOverrides],
};

module.exports = config;
