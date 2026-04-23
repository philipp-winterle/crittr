import { describe, expect, test } from 'vitest';
import Crittr from '../../lib/classes/Crittr.class.js';
import CssTransformator from '../../lib/classes/CssTransformator.class.js';

const transformator = new CssTransformator();

/**
 * Build a selectorMap that marks every selector of every rule as critical.
 * Used to ensure rules pass the selector filter so declaration filtering can be tested.
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
                    // Key matches Rule.generateRuleKey(inner, groupPrefix) — no separator
                    const key = `${prefix}${inner.selectors.join(',')}`;
                    map.set(key, { selectors: inner.selectors });
                }
            }
        }
    }
    return map;
}

describe('removeDeclarations option', () => {
    describe('string matcher', () => {
        test('removes declaration by exact property name from critical', () => {
            const css = '.foo { color: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, ['color']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('color');
            expect(criticalCss).toContain('background');
        });

        test('is case-insensitive', () => {
            const css = '.foo { COLOR: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, ['color']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('COLOR');
            expect(criticalCss).toContain('background');
        });

        test('does not affect rest css', () => {
            const css = '.foo { color: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [, rest] = transformator.filterByMap(ast, selectorMap, ['color']);
            const restCss = transformator.getCssFromAst(rest);

            expect(restCss).toContain('color');
        });
    });

    describe('RegExp matcher', () => {
        test('removes declarations matching regexp against property name', () => {
            const css = '.foo { border-radius: 4px; border-color: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [/^border-/]);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('border-radius');
            expect(criticalCss).not.toContain('border-color');
            expect(criticalCss).toContain('background');
        });
    });

    describe('function matcher', () => {
        test('removes declarations where predicate returns true', () => {
            const css = '.foo { cursor: pointer; color: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, [
                (property) => property === 'cursor',
            ]);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('cursor');
            expect(criticalCss).toContain('color');
            expect(criticalCss).toContain('background');
        });

        test('receives both property and value', () => {
            const css = '.foo { color: red; color: blue; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const seenArgs = [];
            const [critical] = transformator.filterByMap(ast, selectorMap, [
                (property, value) => {
                    seenArgs.push({ property, value });
                    return false;
                },
            ]);

            expect(seenArgs.length).toBeGreaterThan(0);
            expect(seenArgs[0]).toHaveProperty('property');
            expect(seenArgs[0]).toHaveProperty('value');
        });
    });

    describe('empty rule cleanup', () => {
        test('removes rule from critical when all declarations are stripped', () => {
            const css = '.foo { color: red; } .bar { background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, ['color']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('.foo');
            expect(criticalCss).toContain('.bar');
        });

        test('keeps rule in rest when all critical declarations are stripped', () => {
            const css = '.foo { color: red; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical, rest] = transformator.filterByMap(ast, selectorMap, ['color']);
            const criticalCss = transformator.getCssFromAst(critical);
            const restCss = transformator.getCssFromAst(rest);

            expect(criticalCss).not.toContain('.foo');
            expect(restCss).toContain('color');
        });
    });

    describe('@media wrapper', () => {
        test('filters declarations inside media query', () => {
            const css = '@media (max-width: 800px) { .foo { color: red; background: blue; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, ['color']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('color');
            expect(criticalCss).toContain('background');
        });

        test('removes empty @media rule when all inner declarations are stripped', () => {
            const css = '@media (max-width: 800px) { .foo { color: red; } }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, ['color']);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('@media');
        });
    });

    describe('no-op when empty', () => {
        test('leaves critical css unchanged when removeDeclarations is empty', () => {
            const css = '.foo { color: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, []);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).toContain('color');
            expect(criticalCss).toContain('background');
        });

        test('leaves critical css unchanged when removeDeclarations is omitted', () => {
            const css = '.foo { color: red; background: blue; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).toContain('color');
            expect(criticalCss).toContain('background');
        });
    });

    describe('multiple matchers', () => {
        test('removes declarations matching any of multiple matchers', () => {
            const css = '.foo { color: red; cursor: pointer; background: blue; border-radius: 4px; }';
            const ast = transformator.getAst(css);
            const selectorMap = buildFullSelectorMap(ast);

            const [critical] = transformator.filterByMap(ast, selectorMap, ['color', 'cursor', /^border-/]);
            const criticalCss = transformator.getCssFromAst(critical);

            expect(criticalCss).not.toContain('color');
            expect(criticalCss).not.toContain('cursor');
            expect(criticalCss).not.toContain('border-radius');
            expect(criticalCss).toContain('background');
        });
    });
});

describe('Crittr constructor option threading', () => {
    test('removeDeclarations is stored in resolved options', () => {
        const matchers = ['color', /^border-/];
        const instance = new Crittr({ urls: ['http://localhost'], removeDeclarations: matchers });
        expect(instance.options.removeDeclarations).toEqual(matchers);
    });

    test('removeDeclarations defaults to empty array when omitted', () => {
        const instance = new Crittr({ urls: ['http://localhost'] });
        expect(instance.options.removeDeclarations).toEqual([]);
    });
});
