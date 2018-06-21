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
        let _ast                   = JSON.parse(JSON.stringify(ast));
        let _astRest               = JSON.parse(JSON.stringify(ast));
        const _astRoot             = _ast.stylesheet;
        const _astRestRoot         = _astRest.stylesheet;
        let removeableRules        = [];
        const criticalSelectorsMap = new Map();

        const getCriticalRuleSelectors = (rule, media, selectorMap) => {
            media         = media || "";
            const ruleKey = Rule.generateRuleKey(rule, media);

            if (selectorMap.has(ruleKey)) {
                const critObj = selectorMap.get(ruleKey);
                return rule.selectors.filter(selector => critObj.selectors.includes(selector));
            }

            return [];
        };

        // Filter rule types we don't want
        let newRules = _astRoot.rules.filter(rule => {
            return !this._TYPES_TO_REMOVE.includes(rule.type);
        });

        // HANDLE CRITICAL CSS
        // Clear out the non critical selectors
        newRules = newRules.map((rule, index, rules) => {
            // Media Rule
            if (rule.type === "media") {
                if (rule.rules) {
                    rule.rules = rule.rules.map(internalRule => {
                        const internalRuleKey  = Rule.generateRuleKey(internalRule, rule.media);
                        // Get the critical selectors of this media internal rule
                        internalRule.selectors = getCriticalRuleSelectors(internalRule, rule.media, selectorMap);
                        // Create Map entry for exclude of remaining ast
                        criticalSelectorsMap.set(internalRuleKey, internalRule.selectors);
                        return internalRule;
                    }).filter(internalRule => internalRule.selectors !== undefined && internalRule.selectors.length > 0);

                    // If media query is empty remove
                    if (rule.rules.length === 0) {
                        removeableRules.push(rule);
                    }
                }
            } else if (rule.type === "rule") { // Standard Rule
                const ruleKey  = Rule.generateRuleKey(rule);
                // Get the critical selectors of this rule
                rule.selectors = getCriticalRuleSelectors(rule, "", selectorMap);
                // Create Map entry for exclude of remaining ast
                criticalSelectorsMap.set(ruleKey, rule.selectors);
                // If there are no critical selectors mark this rule as removeable
                if (rule.selectors.length === 0) {
                    removeableRules.push(rule);
                }
            }

            return rule;
        });

        // Process removeables
        newRules = newRules.filter(rule => {
            return !removeableRules.includes(rule);
        });

        // HANDLE REST CSS
        removeableRules = [];
        // Clear out the non critical selectors
        let restRules   = _astRestRoot.rules.map(rule => {
            const media = rule.type === "media" ? rule.media : "";

            if (rule.type === "media") {
                if (rule.rules) {
                    rule.rules = rule.rules.map(internalRule => {
                        const ruleKey = Rule.generateRuleKey(internalRule, media);
                        if (criticalSelectorsMap.has(ruleKey)) {
                            const criticalSelectorsOfRule = criticalSelectorsMap.get(ruleKey);
                            internalRule.selectors        = internalRule.selectors.filter(selector => !criticalSelectorsOfRule.includes(selector));
                        }
                        return internalRule;
                    }).filter(internalRule => internalRule.selectors !== undefined && internalRule.selectors.length > 0);

                    // If media query is empty remove
                    if (rule.rules.length === 0) {
                        removeableRules.push(rule);
                    }
                }
            } else if (rule.type === "rule") {
                const ruleKey = Rule.generateRuleKey(rule, media);
                if (criticalSelectorsMap.has(ruleKey)) {
                    const criticalSelectorsOfRule = criticalSelectorsMap.get(ruleKey);
                    rule.selectors                = rule.selectors.filter(selector => !criticalSelectorsOfRule.includes(selector));
                }

                if (rule.selectors.length === 0) {
                    removeableRules.push(rule);
                }
            }

            return rule;
        });

        // Process removeables
        restRules = restRules.filter(rule => {
            return !(removeableRules.includes(rule) || this._TYPES_TO_KEEP.includes(rule.type));
        });

        _astRoot.rules     = newRules;
        _astRestRoot.rules = restRules;

        // Return the new AST Object
        return [_ast, _astRest];
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