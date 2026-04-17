import _ from 'lodash';

/**
 * Used to extract critical css with the help of a source css. This will result in larger size because every vendor
 * prefix is used.
 *
 * @param sourceAst
 * @param renderTimeout
 * @param keepSelectors
 * @returns {Promise<Map<Object>>}
 */
export default async ({ sourceAst, loadTimeout, keepSelectors, removeSelectors }) => {
    return new Promise((resolve, reject) => {
        // PRE CONFIG VARS
        const usedSelectorTypes = ['supports', 'media', 'rule'];

        const pseudoSelectors = ['after', 'before', 'first-line', 'first-letter', 'selection', 'visited'];

        const pseudoExcludes = ['root'];

        const PSEUDO_DEFAULT_REGEX = new RegExp(
            pseudoSelectors.map(s => ':?:' + s).reduce((acc, cur) => acc + '|' + cur),
            'g',
        );
        const PSEUDO_EXCLUDED_REGEX = new RegExp(
            pseudoExcludes.map(s => ':?:' + s).reduce((acc, cur) => acc + '|' + cur),
            'g',
        );
        const PSEUDO_BROWSER_REGEX = new RegExp(/:?:-[a-z-]*/g);

        // ADJUSTMENTS
        keepSelectors = keepSelectors || [];
        removeSelectors = removeSelectors || [];
        loadTimeout = loadTimeout || 2000;

        // innerHeight of window to determine if in viewport
        const height = window.innerHeight;

        // Nodes in above the fold content
        const criticalNodes = new Set();
        // Final result Map
        const criticalSelectors = new Map();

        const stopPageLoadAfterTimeout = (start, timeout) => {
            window.requestAnimationFrame(() => {
                const timePassed = Date.now() - start;
                if (timePassed >= timeout) {
                    window.stop();
                } else {
                    stopPageLoadAfterTimeout(start, timeout);
                }
            });
        };
        stopPageLoadAfterTimeout(Date.now(), loadTimeout);

        const isSelectorCritical = selector => {
            if (isSelectorForceIncluded(selector)) return true;
            if (isSelectorForceExcluded(selector)) return false;

            // clean selector from important pseudo classes to get him tracked as critical
            const cleanedSelector = getCleanedSelector(selector);

            let elements;
            try {
                elements = document.querySelectorAll(cleanedSelector);
            } catch (e) {
                // Selector not valid
                return false;
            }

            // selector has > 0 elements matching -> check for above the fold - break on success
            const elemLength = elements.length;
            for (let i = 0; i < elemLength; i++) {
                if (isElementAboveTheFold(elements[i])) {
                    return true;
                }
            }
            return false;
        };

        const isStyleSheet = rule => {
            return rule.stylesheet !== undefined;
        };

        /**
         * Clean selector of pseudo classes
         *
         * @param selector
         * @returns selector {String}
         */
        const getCleanedSelector = selector => {
            // We wont clean selectors without ":" because its faster as to replace all
            if (selector.indexOf(':' > -1)) {
                selector = selector.replace(PSEUDO_DEFAULT_REGEX, '');
            }
            // Remove browser pseudo selectors
            if (selector.indexOf(':' > -1)) {
                selector = selector.replace(PSEUDO_BROWSER_REGEX, '');
            }
            // Remove excluded pseudo selectors
            if (selector.indexOf(':' > -1)) {
                selector = selector.replace(PSEUDO_EXCLUDED_REGEX, '');
            }

            return selector;
        };

        /**
         * If selector is purely pseudo (f.e. ::-moz-placeholder) -> KEEP IT.
         * But don't keep excludedPseudos by default
         *
         * @param selector
         * @returns {boolean}
         */
        const isPurePseudo = selector => selector.startsWith(':') && selector.match(PSEUDO_EXCLUDED_REGEX) === null;

        /**
         * Creates a regex out of a wildcard selector. Returns the normal regex for a non wildcard selector
         *
         * @param {string} selector
         * @returns {RegExp} {RegExp}
         */
        const getRegexOfSelector = selector => {
            selector = '^' + selector.replace(/([.*><+~])/g, '\\$1').replace(/%/g, '.*') + '$';
            return new RegExp(selector, 'gm');
        };

        const isSelectorForceIncluded = selector => {
            return (
                keepSelectors.includes(selector) ||
                keepSelectors.some(tmpSel => {
                    const selectorWcRegex = getRegexOfSelector(tmpSel); // transform wildcards into regex
                    return selectorWcRegex.test(selector);
                })
            );
        };

        const isSelectorForceExcluded = selector => {
            return (
                removeSelectors.includes(selector) ||
                removeSelectors.some(tmpSel => {
                    const selectorWcRegex = getRegexOfSelector(tmpSel); // transform wildcards into regex
                    return selectorWcRegex.test(selector);
                })
            );
        };

        const isElementAboveTheFold = element => {
            if (criticalNodes.has(element)) return true;

            const isAboveTheFold = element.getBoundingClientRect().top < height;

            if (isAboveTheFold) {
                criticalNodes.add(element);
                return true;
            }

            return false;
        };

        const isGroupRule = rule => {
            return rule.type !== 'rule' && rule.rules !== undefined;
        };

        const getRuleType = rule => {
            return rule.type;
        };

        const getGroupRuleId = rule => {
            const type = getRuleType(rule) || '';
            const typeString = rule[type] || '';

            return `${type}${typeString}`;
        };

        /**
         * Working criticalSelectors Map
         * @param ast
         */
        const fillCriticalSelectorsMap = (rule, groupIdPrefix = '') => {
            if (isGroupRule(rule)) {
                if (groupIdPrefix) {
                    groupIdPrefix = `${groupIdPrefix}-##-`;
                }
                // Get rule prefix for grouped rule
                const rulePrefix = `${groupIdPrefix}${getGroupRuleId(rule)}`;
                // Grouped rules always having rules
                const rules = rule.rules;

                // Iterate rules
                for (let rule of rules) {
                    // Get ruletype
                    const ruleType = getRuleType(rule);

                    // Is rule part of useful rule types
                    if (usedSelectorTypes.includes(ruleType)) {
                        // Call recursive
                        fillCriticalSelectorsMap(rule, rulePrefix);
                    } else {
                        console.debug('DEBUG: UNPROCESSED RULE TYPE: ' + rule.type);
                    }
                }
            } else {
                // Handle a single rule

                // Get ruletype
                const ruleType = getRuleType(rule);

                // Is rule part of useful rule types
                if (usedSelectorTypes.includes(ruleType)) {
                    // Normal rules have selectors
                    const selectors = rule.selectors || [];

                    // Key for identify
                    const ruleKey = groupIdPrefix + selectors.join();

                    for (let selector of selectors) {
                        // Check if selector is pure pseudo or a critical match
                        // NOTE: Check if we are in trouble with doubled selectors with different content

                        if (isPurePseudo(selector) || isSelectorCritical(selector)) {
                            if (criticalSelectors.has(ruleKey)) {
                                const critSel = criticalSelectors.get(ruleKey);
                                if (!critSel.selectors.includes(selector)) {
                                    critSel.selectors.push(selector);
                                }
                            } else {
                                criticalSelectors.set(ruleKey, {
                                    selectors: [selector],
                                    type: rule.type,
                                    rule: rule, // Needed? maybe for doubled rules
                                });
                            }
                        }
                    }
                } else {
                    console.debug('DEBUG: UNPROCESSED RULE TYPE: ' + rule.type);
                }
            }
        };

        console.log('STARTING EXTRACTION');

        // Root knot handling
        if (isStyleSheet(sourceAst)) {
            _astRoot = sourceAst.stylesheet;
            fillCriticalSelectorsMap(_astRoot);
        } else {
            console.warn('Missing ast stylesheet!!!', ast.type, ast.stylesheet);
        }

        return resolve([...criticalSelectors]);
    }).catch(error => {
        console.log('Extraction Error');
        console.error(error.name);
        console.error(error.message);
    });
};
