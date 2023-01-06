import type { Linter } from '@typescript-eslint/utils/dist/ts-eslint';

export const tsOverrides: Linter.ConfigOverride = {
    files: ['*.ts', '*.tsx'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.base.json',
        createDefaultProgram: true,
    },
    plugins: ['@typescript-eslint', 'import', 'tsdoc', 'jsdoc'],
    extends: ['plugin:import/recommended', 'plugin:import/typescript', 'plugin:jsdoc/recommended'],
    rules: {
        'tsdoc/syntax': 'warn',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/require-param-type': 'off',
        '@typescript-eslint/consistent-type-definitions': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/dot-notation': 'error',
        '@typescript-eslint/explicit-member-accessibility': [
            'error',
            {
                accessibility: 'no-public',
            },
        ],
        '@typescript-eslint/no-inferrable-types': [
            'error',
            {
                ignoreParameters: false,
            },
        ],
        'arrow-parens': ['error', 'always'],
        'import/order': [
            'error',
            {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
                'newlines-between': 'always',
                alphabetize: {
                    order: 'asc',
                    caseInsensitive: true,
                },
                warnOnUnassignedImports: true,
            },
        ],
        'linebreak-style': ['error', 'unix'],
        'new-parens': 'error',
        'no-extra-semi': 'error',
        'no-irregular-whitespace': 'error',
        'no-console': [
            'error',
            {
                allow: ['warn', 'error'],
            },
        ],
        'no-debugger': 'error',
        'no-unused-vars': [
            'error',
            {
                ignoreRestSiblings: true,
                argsIgnorePattern: '^_',
            },
        ],
        'space-before-blocks': 'error',
        'space-in-parens': ['error', 'never'],
        'spaced-comment': ['error', 'always'],
    },
};
