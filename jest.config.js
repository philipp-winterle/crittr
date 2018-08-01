// jest.config.js
module.exports = {
    globalSetup: './test/setup.js',
    globalTeardown: './test/teardown.js',
    verbose: true,
    roots: [
        "./test"
    ],
    testMatch: ["**/test/**/*.test.js?(x)"],
    testURL: 'http://localhost'
};