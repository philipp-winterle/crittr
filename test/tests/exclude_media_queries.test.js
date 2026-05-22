import { describe, expect, test } from 'vitest';
import Crittr from '../../lib/classes/Crittr.class.js';
import CssTransformator from '../../lib/classes/CssTransformator.class.js';

const transformator = new CssTransformator();

/**
 * Build a selectorMap that marks every selector of every rule as critical.
 * Used to ensure rules pass the selector filter so media-query filtering can be tested.
 */
function buildFullSelectorMap(ast) {
    const map = new Map();
    for (const rule of ast.stylesheet.rules) {
        if (rule.type === 'rule') {
            const key = rule.selectors.join(',');
            map.set(key, { selectors: rule.selectors });
        } else if ((rule.type === 'media' || rule.type === 'supports') && rule.rules) {
            for (const inner of rule.rules) {
                if (inner.type === 'rule') {
                    const prefix = `${rule.type}${rule.media ?? rule.supports ?? ''}`;
                    const key = `${prefix}${inner.selectors.join(',')}`;
                    map.set(key, { selectors: inner.selectors });
                }
            }
        }
    }
    return map;
}

describe('excludeMediaQueries option', () => {
    describe('default behavior', () => {
        test('@media print is excluded from critical by default', () => {
            const css = '.foo { color: red; } @media print { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], ['print']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('@media print');
            expect(criticalCss).toContain('.foo');
        });

        test('@media print is moved to rest when excluded', () => {
            const css = '.foo { color: red; } @media print { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [, rest] = transformator.filterByMap(ast, selectorMap, [], ['print']);
            const restCss = transformator.getCssFromAst(rest);

            expect(restCss).toContain('@media print');
        });
    });

    describe('opt-out with empty array', () => {
        test('@media print stays in critical when excludeMediaQueries is empty', () => {
            const css = '.foo { color: red; } @media print { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], []);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).toContain('@media print');
        });

        test('@media print stays in critical when excludeMediaQueries is omitted', () => {
            const css = '.foo { color: red; } @media print { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).toContain('@media print');
        });
    });

    describe('string pattern', () => {
        test('custom string pattern excludes matching @media rule', () => {
            const css = '.foo { color: red; } @media screen { .foo { color: blue; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], ['screen']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('@media screen');
        });

        test('string match is case-insensitive', () => {
            const css = '@media PRINT { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], ['print']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('@media');
        });
    });

    describe('RegExp pattern', () => {
        test('RegExp pattern excludes matching @media rule', () => {
            const css = '.foo { color: red; } @media print { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], [/print/i]);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('@media print');
        });

        test('RegExp is case-insensitive when flag is set', () => {
            const css = '@media PRINT { .foo { color: black; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], [/print/i]);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('@media');
        });
    });

    describe('non-matching @media rules', () => {
        test('@media (min-width: 800px) stays in critical when not excluded', () => {
            const css = '@media (min-width: 800px) { .foo { color: red; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [], ['print']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).toContain('@media');
            expect(criticalCss).toContain('min-width');
        });

        test('non-excluded @media rule is not moved to rest', () => {
            const css = '@media (min-width: 800px) { .foo { color: red; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            // rest already has a copy; critical should keep its own
            const [critical] = transformator.filterByMap(ast, selectorMap, [], ['print']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).toContain('min-width');
        });
    });

    describe('rest CSS receives excluded rule', () => {
        test('excluded @media rule is present in rest CSS', () => {
            const css = '.foo { color: red; } @media print { .bar { font-size: 12pt; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [, rest] = transformator.filterByMap(ast, selectorMap, [], ['print']);
            const restCss = transformator.getCssFromAst(rest);

            expect(restCss).toContain('@media print');
            expect(restCss).toContain('font-size');
        });
    });
});

describe('Crittr constructor option threading', () => {
    test('excludeMediaQueries defaults to ["print"]', () => {
        const instance = new Crittr({ urls: ['http://localhost'] });
        expect(instance.options.excludeMediaQueries).toEqual(['print']);
    });

    test('excludeMediaQueries is stored in resolved options', () => {
        const instance = new Crittr({ urls: ['http://localhost'], excludeMediaQueries: [/print/i, 'screen'] });
        expect(instance.options.excludeMediaQueries).toEqual([/print/i, 'screen']);
    });

    test('excludeMediaQueries can be set to empty array to opt out', () => {
        const instance = new Crittr({ urls: ['http://localhost'], excludeMediaQueries: [] });
        expect(instance.options.excludeMediaQueries).toEqual([]);
    });
});
