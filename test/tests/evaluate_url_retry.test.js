import { describe, expect, test } from 'vitest';
import Crittr from '../../lib/classes/Crittr.class.js';

class RetryableCrittr extends Crittr {
    constructor(page) {
        super({
            urls: ['http://localhost:8000/test/data/test.html'],
            css: 'body { color: red; }',
        });
        this.page = page;
    }

    async getPage() {
        return this.page;
    }

    async gracefulClosePage(page) {
        if (page) {
            await page.close();
        }
    }
}

const createFakePage = errors => {
    const attempts = {
        goto: 0,
        close: 0,
    };

    return {
        attempts,
        setCacheEnabled: async () => {},
        setJavaScriptEnabled: async () => {},
        setRequestInterception: async () => {},
        on: () => {},
        emulate: async () => {},
        goto: async () => {
            const error = errors[attempts.goto] ?? null;
            attempts.goto++;
            if (error) {
                throw error;
            }
        },
        screenshot: async () => {},
        evaluate: async () => [],
        close: async () => {
            attempts.close++;
        },
    };
};

describe('Crittr URL evaluation retries', () => {
    test('retries transient browser failures before succeeding', async () => {
        const page = createFakePage([new Error('Navigation timeout of 30000 ms exceeded'), null]);
        const crittr = new RetryableCrittr(page);
        const ast = crittr._cssTransformator.getAst('body { color: red; }');

        await expect(crittr.evaluateUrl('http://localhost:8000/test/data/test.html', ast)).resolves.toBeTruthy();
        expect(page.attempts.goto).toBe(2);
    });

    test('does not retry non-transient failures', async () => {
        const page = createFakePage([new Error('Could not parse source CSS to AST')]);
        const crittr = new RetryableCrittr(page);
        const ast = crittr._cssTransformator.getAst('body { color: red; }');

        await expect(crittr.evaluateUrl('http://localhost:8000/test/data/test.html', ast)).rejects.toThrow(
            'Could not parse source CSS to AST',
        );
        expect(page.attempts.goto).toBe(1);
    });
});
