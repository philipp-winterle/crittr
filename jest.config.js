// jest.config.js
export default {
    projects: [
        {
            displayName: 'Basic',
            globalSetup: './test/setup.js',
            globalTeardown: './test/teardown.js',
            roots: ['<rootDir>'],
            testMatch: ['**/test/tests/**/*.test.js?(x)'],
            testEnvironmentOptions: {
                url: 'http://localhost',
            },
        },
    ],
    transform: {},
};
