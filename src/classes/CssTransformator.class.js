"use strict";
const _     = require('lodash');
const debug = require('debug')("Crittr CSSTransformator");
const log   = require('signale');
const merge = require('deepmerge');
const css   = require('css');

const Rule = require("./Rule.class");

/**
 *
 */
class CssTransformator {
    constructor(options) {
        options      = options || {};
        this.options = {
            silent: true,
            source: null
        };

        this.options = merge(this.options, options);

        const pseudoSelectorsToKeep = [
            ':before',
            ':after',
            ':visited',
            ':first-letter',
            ':first-line'
        ];

        this._TYPES_TO_REMOVE = [
            "comment"
        ];
        this._TYPES_TO_KEEP   = [
            "charset",
            "font-face"
        ];

        // detect these selectors regardless of whether one or two semicolons are used
        const pseudoSelectorsToKeepRegex = pseudoSelectorsToKeep.map(s => {
            return ':?' + s;
        }).join('|');
        // separate in regular expression
        // we will replace all instances of these pseudo selectors; hence global flag
        this._PSUEDO_SELECTOR_REGEXP = new RegExp(pseudoSelectorsToKeepRegex, 'g');
    }

    getAst(cssContent) {
        let astObj = null;
        try {
            debug("getAst - Try parsing css to ast ...");
            astObj = css.parse(cssContent, {
                silent: this.options.silent,
                source: this.options.source
            });
            debug("getAst - Css successfully parsed to ast ...");
        } catch (err) {
            log.error(err);
        }
        return astObj;
    }

    getCssFromAst(ast) {
        debug("getCssFromAst - Create css string out of AST");
        return css.stringify(ast, {
            indent:          "  ",
            compress:        false,
            sourcemap:       true,
            inputSourcemaps: true
        })
    }

    /**
     * Remove all selectors that match one of the removeSelectors.
     * Mutates the original Object
     *
     * @param ast {Object}
     * @param removeSelectors {Array<String>}
     * @returns {Object}
     */
    filterSelector(ast, removeSelectors) {
        if (!Array.isArray(removeSelectors)) {
            log.warn("removeSelectors have to be an array to be processed");
            return false;
        }

        let rules = ast;

        // Get Rules of ast object and keep reference
        if (ast.stylesheet) {
            rules = ast.stylesheet.rules;
        } else if (ast.rules) {
            rules = ast.rules;
        }

        const compareFn = (a, b) => {
            return b - a;
        };

        const removeableRules = [];

        for (const ruleIndex in rules) {
            if (rules.hasOwnProperty(ruleIndex)) {
                const rule = rules[ruleIndex];

                if (Rule.isMediaRule(rule)) {
                    // Recursive check of CSSMediaRule
                    this.filterSelector(rule, removeSelectors);
                } else {
                    //  CSSRule
                    const selectors           = rule.selectors;
                    const removeableSelectors = [];

                    for (let selectorIndex in selectors) {
                        if (selectors.hasOwnProperty(selectorIndex)) {
                            const selector = selectors[selectorIndex];

                            // TODO: deal with wildcards
                            if (removeSelectors.includes(selector)) {
                                // More than one selector in there. Only remove the match and keep the other one.
                                // If only one selector exists remove the whole rule
                                if (selectors.length > 1) {
                                    removeableSelectors.push(selectorIndex);
                                } else {
                                    removeableRules.push(ruleIndex);
                                }
                            }
                        }
                    }

                    // Sort the removeableSelectors DESC to remove them properly from the selectors end to start
                    removeableSelectors.sort(compareFn);
                    // Now remove them
                    for (let selectorIndex of removeableSelectors) {
                        selectors.splice(selectorIndex, 1);
                    }
                }
            }
        }

        // Sort the removeableRules DESC to remove them properly from the rules end to start
        removeableRules.sort(compareFn);
        // Now remove them
        for (let ruleIndex of removeableRules) {
            rules.splice(ruleIndex, 1);
        }

        return ast;
    }

    /**
     * Filters the AST Object with the selectorMap <Map> containing selectors.
     * Returns a new AST Object without those selectors. Does NOT mutate the AST.
     *
     * @param   {Object} ast
     * @param   {Map}    selectorMap
     * @returns {Object} AST
     */
    filterByMap(ast, selectorMap) {
        let _ast            = JSON.parse(JSON.stringify(ast));
        let _astRoot        = null;
        let media           = "";
        let removeableRules = [];
        // Root knot or media query
        if (_ast.type === "stylesheet") {
            _astRoot = _ast.stylesheet;
        } else if (_ast.rules && _ast.type === "media") {
            _astRoot = _ast;
            media    = _ast.media || "";
        } else {
            debug("Missing ast rules!!!");
        }

        // checks if critical selec
        const hasCriticalSelectors = (selectors, media, selectorMap) => {
            return selectors.some(selector => {
                // TODO: filter subselectors
                // Selector is in criticalSelectorsMap
                return selectorMap.has(media + selector);
            });
        };

        // Iterate over all ast rules and only keep type "rule" and "media"
        for (let rule of _astRoot.rules) {

            // If rule is media going recursive with their rules
            if (rule.type === "media") {
                const ruleIndex           = _astRoot.rules.indexOf(rule);
                const originalRule        = _astRoot.rules[ruleIndex];
                const newRule             = this.filterByMap(rule, selectorMap);
                _astRoot.rules[ruleIndex] = newRule;
                // If media query rule is empty now -> remove
                if (newRule && newRule.rules && newRule.rules.length === 0) {
                    removeableRules.push(newRule);
                }
            } else if (rule.type === "rule") {
                // If rule is rule -> check if selectors are in critical map
                // If not - put them into the array to remove them later on
                if (!hasCriticalSelectors(rule.selectors, media, selectorMap)) {
                    removeableRules.push(rule);
                }
            } else {
                if (!this._TYPES_TO_KEEP.includes(rule.type)) {
                    //debug("Dropping unusable rule type => " + rule.type);
                    removeableRules.push(rule);
                }
            }
        }

        // REMOVE rules from AST Rules
        _astRoot.rules = _astRoot.rules.filter(rule => {
            return !removeableRules.includes(rule);
        });

        // Return the new AST Object
        return _ast;
    }

    /**
     * Merge mergeAst into targetAst.
     * Keep targetAst properties if duplicate
     *
     * @param   {Object}          targetAst
     * @param   {Object}          mergeAst
     * @returns {Promise<Object>} AST
     */
    merge(targetAst, mergeAst) {
        return new Promise((resolve, reject) => {
            debug("merge - Try to merge into targetAst...");
            if (
                targetAst.type &&
                targetAst.type === "stylesheet" &&
                targetAst.stylesheet &&
                Array.isArray(targetAst.stylesheet.rules)
            ) {
                try {
                    // Iterate over merging AST
                    let mergeRules  = mergeAst.stylesheet.rules;
                    let targetRules = targetAst.stylesheet.rules;

                    for (let mergeRule of mergeRules) {
                        this.mergeRule(mergeRule, targetRules);
                    }
                    // Give back targetAst even though it was mutated
                    debug("merge - Successfully merged into targetAst!");
                    resolve(targetAst)
                } catch (err) {
                    // Catch errors if occur
                    debug("merge - general error occured.");
                    reject(err);
                }
            } else {
                debug("merge - ERROR because of missing properties!");
                reject(new Error("AST Merge failed due to missing properties"));
            }
        });
    }

    /**
     * Merges the rule object into the Array targetRules which should be an array of Rule objects
     *
     * NOTE: Muates the targetRules Array
     *
     * @param {Object} rule
     * @param {Array}  targetRules
     */
    mergeRule(rule, targetRules) {
        // Handle media queries
        if (Rule.isMediaRule(rule)) {
            this.mergeMediaRule(rule, targetRules);
        } else {
            // Normal CSS-Rule or other
            if (targetRules.length > 0) {
                let isDuplicate = false;
                for (let targetRule of targetRules) {
                    // Does rule exists in targetRules?
                    // If not -> assimilate
                    if (Rule.isSameRuleType(targetRule, rule) && Rule.isRuleDuplicate(targetRule, rule, ["position"])) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    // TODO: take care of positioning. The rule may need to overwrite something and could be inserted to early / late
                    targetRules.push(rule);
                }
            } else {
                // Empty targetRules -> create
                targetRules.push(rule);
            }
        }
    }

    /**
     * Merges a whole media rule with another. While rule is the main rule and targetArr is merges into that rule
     *
     * @param rule
     * @param targetArr
     */
    mergeMediaRule(rule, targetArr) {
        const selector      = rule.media;
        const mediaRulesArr = rule.rules;
        let targetRulesArr  = [];
        let hasNoMediaRule  = true;

        for (let targetRule of targetArr) {
            if (Rule.isMediaRule(targetRule) && Rule.isMatchingMediaRuleSelector(selector, targetRule.media)) {
                targetRulesArr = targetRule.rules;
                hasNoMediaRule = false;
                break;
            }
        }

        if (hasNoMediaRule) {
            targetArr.push(rule);
        } else {
            for (let mediaRule of mediaRulesArr) {
                this.mergeRule(mediaRule, targetRulesArr)
            }
        }
    }

}

module.exports = CssTransformator;