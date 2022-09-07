// jest.config.js
module.exports = {
    projects: [
        {
            displayName: 'Basic',
            globalSetup: './test/setup.cjs',
            globalTeardown: './test/teardown.cjs',
            roots: ['<rootDir>'],
            testMatch: ['**/test/tests/**/*.test.cjs?(x)'],
            testEnvironmentOptions: {
                url: 'http://localhost',
            },
        },
    ],
};
