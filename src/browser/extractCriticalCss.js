module.exports = () => {
    // ADJUSTMENTS
    const removePseudoSelectors = false;

    // innerHeight of window to determine if in viewport
    const height        = window.innerHeight;
    //Setup our Pseudo selector killer, view height and critical nodes
    const removePseudo  = removePseudoSelectors ? /([^\s,\:\(])\:\:?(?!not)[a-zA-Z\-]{1,}(?:\(.*?\))?/g : /(.*)/;
    const criticalNodes = [];

    // Get a list of all the elements in the view.
    const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_ELEMENT,
        function (node) {
            return NodeFilter.FILTER_ACCEPT;
        },
        true
    );

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const rect = node.getBoundingClientRect();
        if (rect.top < height) {
            criticalNodes.push(node);
        }
    }

    // Grab loaded stylesheets
    const sheets = document.styleSheets;

    const outCss = Array.prototype.map.call(sheets, function (sheet) {
        const rules = sheet.rules || sheet.cssRules;
        // If there are rules
        if (rules) {
            return {
                sheet: sheet,
                rules: Array.prototype.map.call(rules, function (rule) { // Convert each CSSRule into a
                    try {
                        if (rule instanceof CSSMediaRule) {
                            let subRules = rule.rules || rule.cssRules;
                            let css      = Array.prototype.filter.call(subRules, function (rule) {
                                return criticalNodes.filter(function (e) {
                                    return e.matches(rule.selectorText.replace(removePseudo, "$1"))
                                }).length > 0;
                            }).map(function (rule) {
                                return rule.cssText
                            }).reduce(function (ruleCss, init) {
                                return init + "\n" + ruleCss;
                            }, "");
                            return css ? ("@media " + rule.media.mediaText + " { " + css + "}") : null;

                        } else if (rule instanceof CSSStyleRule) {

                            return criticalNodes.filter(function (e) {
                                return e.matches(rule.selectorText.replace(removePseudo, "$1"))
                            }).length > 0 ? rule.cssText : null;

                        } else {
                            console.warn("allowing", rule);
                            return rule.cssText;
                        }
                    } catch (e) {
                        console.error("Bad CSS rule", rule.selectorText);
                        throw e;
                    }
                }).filter(function (e) {
                    return e;
                })
            }
        } else {
            return null;
        }
    }).filter(function (cssEntry) {
        return cssEntry && cssEntry.rules.length > 0
    }).map(function (cssEntry) {
        return cssEntry.rules.join("");
    }).reduce(function (css, out) {
        return out + css
    }, "");

    return outCss.replace(/\n/g,"").replace(/content\: \"(.)\"/g,function(a,e){
        return "content: \"\\" + encodeURI(e).substr(2) + "\"";
    });
};