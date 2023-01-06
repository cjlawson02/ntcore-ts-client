import type { Linter } from '@typescript-eslint/utils/dist/ts-eslint';

export const jestOverrides: Linter.ConfigOverride = {
    files: '*.spec.ts',
    env: {
        'jest/globals': true,
    },
    plugins: ['jest'],
    rules: {
        '@typescript-eslint/dot-notation': 'off',
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
    },
};
