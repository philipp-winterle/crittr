// jest.config.js
module.exports = {
    globalSetup: './test/setup.js',
    verbose: true,
    roots: [
        "./test"
    ],
    testMatch: ["**/test/**/*.test.js?(x)"]
};