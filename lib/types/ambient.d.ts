// Ambient module declarations for third-party packages that do not ship TypeScript
// typings compatible with NodeNext module resolution.

declare module 'is-plain-object' {
    export function isPlainObject(value: unknown): boolean;
}

declare module 'run-queue' {
    type RunQueueFn<Args extends readonly unknown[]> = (...args: Args) => unknown;

    interface RunQueueOptions {
        maxConcurrency?: number;
    }

    class RunQueue {
        constructor(options?: RunQueueOptions);
        add<Args extends readonly unknown[]>(priority: number, fn: RunQueueFn<Args>, args: Args): void;
        run(): Promise<void>;
    }

    export default RunQueue;
}

declare module 'postcss-sort-media-queries' {
    import type { Plugin } from 'postcss';

    interface SortMediaQueriesOptions {
        sort?: 'mobile-first' | 'desktop-first' | ((a: string, b: string) => number);
        configuration?: Record<string, unknown>;
    }

    const sortMediaQueries: (options?: SortMediaQueriesOptions) => Plugin;
    export default sortMediaQueries;
}

declare module '@dynamicabot/signales' {
    interface SignaleLogger {
        log: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        success: (...args: unknown[]) => void;
        debug: (...args: unknown[]) => void;
        time: (label?: string) => void;
        timeEnd: (label?: string) => void;
    }

    const log: SignaleLogger;
    export default log;
}

declare module '../evaluation/extract_critical_with_css.js' {
    // Browser-side evaluation script. Imported as a function value and passed to
    // `page.evaluate`. Typed as `unknown` so consumers must cast deliberately.
    const script: unknown;
    export default script;
}
