/**
 * Used to extract critical css with the help of a source css. This will result in larger size because every vendor
 * prefix is used.
 *
 * @param sourceAst
 * @param renderTimeout
 * @param keepSelectors
 * @returns {Promise<Map<Object>>}
 */
module.exports = ({sourceAst, loadTimeout, keepSelectors}) => {
    return new Promise((resolve, reject) => {
        // PRE CONFIG VARS
        const usedSelectorTypes = [
            "media",
            "rule"
        ];

        const pseudoSelectors = [
            "after",
            "before",
            "first-line",
            "first-letter",
            "selection",
            "visited"
        ];

        const pseudoExcludes = [
            "root"
        ];

        const PSEUDO_DEFAULT_REGEX  = new RegExp(pseudoSelectors.map(s => ":?:" + s).reduce((acc, cur) => acc + "|" + cur), "g");
        const PSEUDO_EXCLUDED_REGEX = new RegExp(pseudoExcludes.map(s => ":?:" + s).reduce((acc, cur) => acc + "|" + cur), "g");
        const PSEUDO_BROWSER_REGEX  = new RegExp(/:?:-[a-z-]*/g);

        // ADJUSTMENTS
        keepSelectors = keepSelectors || [];
        loadTimeout   = loadTimeout || 2000;

        // innerHeight of window to determine if in viewport
        const height = window.innerHeight;

        // Nodes in above the fold content
        const criticalNodes     = new Set();
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
            })
        };
        stopPageLoadAfterTimeout(Date.now(), loadTimeout);

        const isSelectorCritical = (selector) => {
            if (isSelectorForced(selector)) return true;

            // clean selector from important pseudo classes to get him tracked as critical
            const cleanedSelector = getCleanedSelector(selector);

            let elements;
            try {
                elements = document.querySelectorAll(cleanedSelector)
            } catch (e) {
                // Selector not valid
                return false
            }

            // selector has > 0 elements matching -> check for above the fold - break on success
            const elemLength = elements.length;
            for (let i = 0; i < elemLength; i++) {
                if (isElementAboveTheFold(elements[i])) {
                    return true
                }
            }
            return false
        };

        /**
         * Clean selector of pseudo classes
         *
         * @param selector
         * @returns selector {String}
         */
        const getCleanedSelector = selector => {
            // We wont clean selectors without ":" because its faster as to replace all
            if (selector.indexOf(":" > -1)) {
                selector = selector.replace(PSEUDO_DEFAULT_REGEX, "");
            }
            // Remove browser pseudo selectors
            if (selector.indexOf(":" > -1)) {
                selector = selector.replace(PSEUDO_BROWSER_REGEX, "");
            }
            // Remove excluded pseudo selectors
            if (selector.indexOf(":" > -1)) {
                selector = selector.replace(PSEUDO_EXCLUDED_REGEX, "");
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
        const isPurePseudo = selector => selector.startsWith(":") && selector.match(PSEUDO_EXCLUDED_REGEX) === null;

        const isSelectorForced = selector => {
            return keepSelectors.includes(selector);
        };

        const isElementAboveTheFold = (element) => {
            if (criticalNodes.has(element)) return true;

            const isAboveTheFold = element.getBoundingClientRect().top < height;

            if (isAboveTheFold) {
                criticalNodes.add(element);
                return true;
            }

            return false;
        };

        /**
         * Mutating criticalSelectors Map
         * @param ast
         */
        const gatherCriticalSelectors = (ast) => {
            let _astRoot = {};
            let media    = null;

            // Root knot or media query
            if (ast.stylesheet) {
                _astRoot = ast.stylesheet;
            } else if (ast.rules && ast.type === "media") {
                _astRoot = ast;
                media    = ast.media;
            } else {
                console.warn("Missing ast rules!!!", ast.type, ast.stylesheet);
            }

            const rules = _astRoot.rules;

            for (let rule of rules) {
                // Part of useful rule types
                if (usedSelectorTypes.includes(rule.type)) {
                    // If rule type is media -> rerun as rule
                    if (rule.type === "media") {
                        // Recursive process of media rule
                        gatherCriticalSelectors(rule);
                    } else { // IS ALWAYS RULE

                        const selectors = rule.selectors || [];
                        media     = media || "";

                        // Key for identify
                        const ruleKey = media + selectors.join();

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
                                        media:     media, // Needed?
                                        rule:      rule // Needed? maybe for doubled rules
                                    });
                                }
                            }
                        }
                    }
                } else {
                    console.debug("DEBUG: UNPROCESSED RULE TYPE: " + rule.type);
                }
            }
        };

        gatherCriticalSelectors(sourceAst);

        return resolve([...criticalSelectors]);

    }).catch(error => {
        console.error(error);
    })
};