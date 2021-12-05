/**
 * Used to get the current live critical css without any impact of css
 *
 * @param options
 * @returns {*}
 */
module.exports = options => {
    // ADJUSTMENTS
    const removePseudoSelectors = !!options.removePseudoSelectors;
    const keepSelectors = options.keepSelectors || [];
    const renderTimeout = options.renderTimeout || 300;
    const dropKeyframes = !!options.dropKeyframes;

    // innerHeight of window to determine if in viewport
    const height = window.innerHeight;
    //Setup our Pseudo selector killer, view height and critical nodes
    const removePseudo = removePseudoSelectors ? /([^\s,\:\(])\:\:?(?!not)[a-zA-Z\-]{1,}(?:\(.*?\))?/g : /(.*)/;
    const criticalNodes = [];

    // Get a list of all the elements in the view.
    const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: function (node) {
                return NodeFilter.FILTER_ACCEPT;
            },
        },
        true,
    );

    while (walker.nextNode()) {
        const node = walker.currentNode;

        const keep = keepSelectors.find(selector => {
            // TODO: wildcard
            // node.matches('[class*="te"]')
            // node.matches('[id*="te"]')
            // node.matches('[*="te"]')
            return node.matches(selector);
        });

        if (keep) {
            criticalNodes.push(node);
        } else {
            const rect = node.getBoundingClientRect();
            if (rect.top < height) {
                criticalNodes.push(node);
            }
        }
    }

    // Grab loaded stylesheets
    const sheets = document.styleSheets;

    const filterNodes = (nodes, rule, replace) => {
        return (
            nodes.filter(function (e) {
                return e.matches(rule.selectorText.replace(replace, '$1'));
            }).length > 0
        );
    };

    const outCss = Array.prototype.map
        .call(sheets, function (sheet) {
            const rules = sheet.rules || sheet.cssRules;
            // If there are rules
            if (rules) {
                return {
                    sheet: sheet,
                    rules: Array.prototype.map
                        .call(rules, function (rule) {
                            // Convert each CSSRule into a string
                            try {
                                if (rule instanceof CSSMediaRule) {
                                    let subRules = rule.rules || rule.cssRules;
                                    let css = Array.prototype.filter
                                        .call(subRules, function (rule) {
                                            return filterNodes(criticalNodes, rule, removePseudo);
                                        })
                                        .map(function (rule) {
                                            return rule.cssText;
                                        })
                                        .reduce(function (ruleCss, init) {
                                            return init + '\n' + ruleCss;
                                        }, '');
                                    return css ? '@media ' + rule.media.mediaText + ' { ' + css + '}' : null;
                                } else if (rule instanceof CSSStyleRule) {
                                    if (
                                        rule.selectorText.indexOf(
                                            '.c24-travel-main-cnt .c24-travel-extended-fieldset, .c24-travel-main-cnt .c24-travel-searchform-wrapper',
                                        ) !== -1
                                    ) {
                                        console.log(rule.cssText);
                                    }

                                    return filterNodes(criticalNodes, rule, removePseudo) ? rule.cssText : null;
                                } else if (dropKeyframes && (rule instanceof CSSKeyframeRule || rule instanceof CSSKeyframesRule)) {
                                    return '';
                                } else {
                                    return rule.cssText;
                                }
                            } catch (e) {
                                console.error('Bad CSS rule', rule.selectorText);
                                throw e;
                            }
                        })
                        .filter(function (e) {
                            return e;
                        }),
                };
            } else {
                return null;
            }
        })
        .filter(function (cssEntry) {
            return cssEntry && cssEntry.rules.length > 0;
        })
        .map(function (cssEntry) {
            return cssEntry.rules.join('');
        })
        .reduce(function (css, out) {
            return out + css;
        }, '');

    return outCss.replace(/\n/g, '').replace(/content\: \"(.)\"/g, function (a, e) {
        return 'content: "\\' + encodeURI(e).substr(2) + '"';
    });
};
