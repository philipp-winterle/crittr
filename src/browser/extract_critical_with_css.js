/**
 * Used to extract critical css with the help of a source css. This will result in larger size because every vendor
 * prefix is used.
 *
 * @param sourceAst
 * @param renderTimeout
 * @param keepSelectors
 * @returns {*[]}
 */
module.exports = ({sourceAst, renderTimeout, keepSelectors}) => {

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

    const PSEUDO_DEFAULT_REGEX = new RegExp(pseudoSelectors.map( s => ":?:" + s).reduce( (acc, cur) => acc + "|" + cur), "g");
    const PSEUDO_BROWSER_REGEX = new RegExp(/:?:-[a-z-]*/g);

    // ADJUSTMENTS
    keepSelectors = keepSelectors || [];
    renderTimeout = renderTimeout || 300;

    // innerHeight of window to determine if in viewport
    const height = window.innerHeight;

    // Nodes in above the fold content
    const criticalNodes     = new Set();
    // Final result Map
    const criticalSelectors = new Map();

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
        if (selector.indexOf(":" > -1)) {
            selector = selector.replace(PSEUDO_BROWSER_REGEX, "");
        }

        return selector;
    };

    /**
     * If selector is purely pseudo (f.e. ::-moz-placeholder) -> KEEP IT.
     *
     * @param selector
     * @returns {boolean}
     */
    const isPurePseudo = selector => selector.startsWith(":");

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

    const processSelector = (selector, media) => {
        media     = media || "";
        const key = media + selector;

        if (isPurePseudo(selector) || isSelectorCritical(selector)) {
            if (!criticalSelectors.has(key)) {
                criticalSelectors.set(key, {
                    selector: selector,
                    media:    media
                });
            }
        }
    };

    /**
     * Mutating criticalSelectors Map
     * @param ast
     */
    const gatherCriticalSelectors = (ast) => {
        let rules = [];
        let media = null;
        // Root knot or media query
        if (ast.stylesheet) {
            rules = ast.stylesheet.rules || [];
        } else if (ast.rules && ast.type === "media") {
            rules = ast.rules || [];
            media = ast.media;
        } else {
            console.warn("Missing ast rules!!!", ast.type, ast.stylesheet);
        }

        for (let rule of rules) {
            // Part of useful rule types
            if (usedSelectorTypes.includes(rule.type)) {
                // If rule type is media -> rerun as rule
                if (rule.type === "media") {
                    // Recursive process of media rule
                    gatherCriticalSelectors(rule);
                } else { // IS ALWAYS RULE
                    const selectors = rule.selectors || [];
                    for (let selector of selectors) {
                        processSelector(selector, media);
                    }
                }
            } else {
                console.debug("DEBUG: UNPROCESSED RULE TYPE: " + rule.type);
            }
        }
    };

    gatherCriticalSelectors(sourceAst);

    return [...criticalSelectors];
};