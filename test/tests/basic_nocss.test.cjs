const fs = require('fs-extra');
const path = require('path');
const css = require('css');

const rootDir = path.join(__dirname, '..', '..');
const helpers = require('./../helpers.cjs');
const Rule = require(path.join(rootDir, 'lib/classes/Rule.class.js'));

describe('Basic NoCSS Test', () => {
    describe('Check Results', () => {
        const resultCSS = fs.readFileSync(path.join(rootDir, 'test', 'test_result_noCss.css'), 'utf8');

        const remainingCSS = fs.readFileSync(path.join(rootDir, 'test', 'test_result_noCss_remaining.css'), 'utf8');

        const resultAstRules = css.parse(resultCSS).stylesheet.rules;
        const remainingAstRules = css.parse(remainingCSS).stylesheet.rules;

        const criticalSelectorRules = helpers.getAstRules(resultAstRules);

        // Selectors to search for
        const mustHaveSelectors = {
            standard: [
                '.standard-selector',
                '#id-selector',
                'div',
                '.child-selector > *',
                '.sibling-selector + .sibling',
                '.sibling-general-selector ~ .sibling',
                '.property-selector[data-test="test"]',
                '.group-selector .deep1 .deep2',
                '.multi-selector,.multi-selector-1,.multi-selector-2',
                '.forceInclude',
                'h1',
                '.vendor_prefix',
                '.pseudo-selector::after',
                '.pseudo-selector::before',
                '.pre .wildcard_test_1 .post',
            ],
            media1024: [
                '.standard-selector',
                '#id-selector',
                'div',
                '.forceInclude',
                '.pseudo-selector::after',
                '.pseudo-selector::before',
            ],
            media800: ['.standard-selector', '#id-selector', '.forceInclude'],
        };

        const mustMissSelectors = {
            standard: [
                '.forceExclude',
                '.no-atf-css-default',
                ':root .not-existing-selector',
                'h2,h3,h4,h5,h6',
                '.pre .wildcard_test_2 .post',
                '.wildcard_test_3.space',
            ],
            media1024: ['.forceExclude', '.no-atf-css-default-1024'],
            media800: ['.forceExclude', '.no-atf-css-default-800'],
        };

        test('Standard selectors should be included', () => {
            const missingSelectors = [];
            for (const selector of mustHaveSelectors.standard) {
                if (!criticalSelectorRules.has(selector)) {
                    missingSelectors.push(selector);
                }
            }
            expect(missingSelectors).toHaveLength(0);
        });

        test('Standard selectors should NOT be included', () => {
            const falseIncludedSelectors = [];
            for (const selector of mustMissSelectors.standard) {
                if (criticalSelectorRules.has(selector)) {
                    falseIncludedSelectors.push(selector);
                }
            }
            expect(falseIncludedSelectors).toHaveLength(0);
        });

        test("There shouldn't be any duplicate media query delcarations", () => {
            const duplicateMediaQuery = [];
            const mqCounter = [];
            for (const rule of resultAstRules) {
                if (rule.type === 'media') {
                    if (mqCounter.includes(rule.media)) {
                        duplicateMediaQuery.push(rule.media);
                    } else {
                        mqCounter.push(rule.media);
                    }
                }
            }
            expect(duplicateMediaQuery).toHaveLength(0);
        });

        test('MediaQuery 1024 selectors should be included', () => {
            const missingSelectors = [];
            const selectorPrefix = 'media (min-width: 1024px)===';
            for (const selector of mustHaveSelectors.media1024) {
                if (!criticalSelectorRules.has(selectorPrefix + selector)) {
                    missingSelectors.push(selectorPrefix + selector);
                }
            }
            expect(missingSelectors).toHaveLength(0);
        });

        test('MediaQuery 1024 selectors should NOT be included', () => {
            const falseIncludedSelectors = [];
            const selectorPrefix = 'media (min-width: 1024px)===';
            for (const selector of mustMissSelectors.media1024) {
                if (criticalSelectorRules.has(selectorPrefix + selector)) {
                    falseIncludedSelectors.push(selectorPrefix + selector);
                }
            }
            expect(falseIncludedSelectors).toHaveLength(0);
        });

        test('MediaQuery 800 selectors should be included', () => {
            const missingSelectors = [];
            const selectorPrefix = 'media (min-width: 800px)===';
            for (const selector of mustHaveSelectors.media800) {
                if (!criticalSelectorRules.has(selectorPrefix + selector)) {
                    missingSelectors.push(selectorPrefix + selector);
                }
            }
            expect(missingSelectors).toHaveLength(0);
        });

        test('MediaQuery 800 selectors should NOT be included', () => {
            const falseIncludedSelectors = [];
            const selectorPrefix = 'media (min-width: 800px)===';
            for (const selector of mustMissSelectors.media800) {
                if (criticalSelectorRules.has(selectorPrefix + selector)) {
                    falseIncludedSelectors.push(selectorPrefix + selector);
                }
            }
            expect(falseIncludedSelectors).toHaveLength(0);
        });

        test('There should not be duplicates of rules', () => {
            const getDeepDuplicates = (rules, excludedProps, media) => {
                let duplicatedRules = [];
                media = media || '';

                for (const rule of rules) {
                    if (Rule.isMediaRule(rule)) {
                        duplicatedRules = duplicatedRules.concat(getDeepDuplicates(rule.rules, excludedProps, rule.media));
                    } else {
                        let duplicateCount = 0;
                        for (const innerRule of rules) {
                            if (Rule.isRuleDuplicate(rule, innerRule, excludedProps)) {
                                duplicateCount++;
                            }
                        }
                        if (duplicateCount > 1) {
                            // Put the rule into the duplicate Array but reduce the count by one because one is still needed :)
                            const index = rule.type + (media ? ' ' + media + ' ' : '') + (rule.selectors ? rule.selectors.join(' ') : '');
                            if (!duplicatedRules.includes(index)) {
                                duplicatedRules.push(index);
                            }
                        }
                    }
                }

                return duplicatedRules;
            };

            const excludedProps = ['position'];
            const duplicateRules = getDeepDuplicates(resultAstRules, excludedProps);
            expect(duplicateRules).toHaveLength(0);
        });

        test('There should not exist any empty selectors', () => {
            const emptyRules = [];
            for (const rule of resultAstRules) {
                if (Rule.isMediaRule(rule)) {
                    if (rule.rules && rule.rules.length === 0) {
                        emptyRules.push(rule.media);
                    }
                } else {
                    if (rule.declarations && rule.declarations.length === 0) {
                        emptyRules.push(rule.selectors.join(' '));
                    }
                }
            }

            expect(emptyRules).toHaveLength(0);
        });

        test('There should not exist any non critical partial selectors in critical css', () => {
            let exists = resultAstRules.some(rule => {
                return rule.selectors && rule.selectors.includes('.not-exists .remaining-css');
            });

            expect(exists).not.toBeTruthy();
        });

        test('There should not exist any non critical partial mq rule selectors in remaining css', () => {
            let exists = resultAstRules.some(rule => {
                if (rule.type === 'media') {
                    return rule.rules.some(rule => rule.selectors && rule.selectors.includes('.not-exists-mq-1024 .remaining-css'));
                }
            });

            expect(exists).not.toBeTruthy();
        });

        test('There should exist any non critical partial selectors in remaining css', () => {
            let exists = remainingAstRules.some(rule => rule.selectors && rule.selectors.includes('.not-exists .remaining-css'));
            expect(exists).toBeTruthy();
        });

        test('There should exist any non critical partial mq rule selectors in remaining css', () => {
            let exists = remainingAstRules.some(rule => {
                if (rule.type === 'media') {
                    return rule.rules.some(rule => rule.selectors && rule.selectors.includes('.not-exists-mq-1024 .remaining-css'));
                }
            });

            expect(exists).toBeTruthy();
        });

        test('Font-Face should be in critical css', () => {
            const exists = criticalSelectorRules.has('font-face');
            expect(exists).toBeTruthy();
        });
    });
});
