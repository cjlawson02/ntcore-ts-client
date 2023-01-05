/* eslint-disable */
export default {
    displayName: 'ntcore-ts',
    coverageReporters: ['html'],
    testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/', '/build/'],
    testEnvironment: 'jsdom',
    globals: {},
    transform: {
        '^.+\\.[tj]sx?$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
            },
        ],
    },
    moduleDirectories: ['node_modules', '<rootDir>'],
    moduleFileExtensions: ['ts', 'js'],
    coverageDirectory: './coverage/libs/ntcore-ts',
};
