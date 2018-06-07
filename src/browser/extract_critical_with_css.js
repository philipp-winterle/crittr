module.exports = ({sourceAst, renderTimeout, keepSelectors}) => {
    const usedSelectorTypes = [
        "media",
        "rule"
    ];

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

        let elements;
        try {
            elements = document.querySelectorAll(selector)
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

        if (isSelectorCritical(selector)) {
            if (!criticalSelectors.has(key)) {
                criticalSelectors.set(key, {
                    selector: selector,
                    media:    media
                });
            }
        }
    };

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
                console.log("UNPROCESSED RULE TYPE: " + rule.type);
            }
        }
    };

    gatherCriticalSelectors(sourceAst);

    return [...criticalSelectors];
};