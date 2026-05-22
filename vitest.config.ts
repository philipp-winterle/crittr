import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'node',
        include: ['test/tests/**/*.test.{js,ts}'],
        globalSetup: './test/setup.js',
        bail: 1,
        reporters: ['verbose'],
        testTimeout: 60_000,
        hookTimeout: 60_000,
        pool: 'forks',
        forks: { singleFork: true },
        env: {
            NODE_ENV: 'development',
        },
    },
});
