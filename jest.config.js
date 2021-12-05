// jest.config.js
module.exports = {
    projects: [
        {
            displayName: 'Basic',
            globalSetup: './test/setup.js',
            globalTeardown: './test/teardown.js',
            roots: ['<rootDir>'],
            testMatch: ['**/test/tests/**/*.test.js?(x)'],
            testURL: 'http://localhost',
        },
    ],
};
