"use strict";

const path            = require('path');
const fs              = require('fs-extra');
const util            = require('util');
const readFilePromise = util.promisify(fs.readFile);
const _               = require('lodash');
const debug           = require('debug')("CriticalExtractor CSSTransformator");
const consola         = require('consola');
const merge           = require('deepmerge');
const css             = require('css');

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
            consola.error(err);
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

    matchesForceInclude(selector, forceInclude) {
        return forceInclude.some((includeSelector) => {
            if (includeSelector.type === 'RegExp') {
                const {source, flags} = includeSelector;
                const re              = new RegExp(source, flags);
                return re.test(selector);
            }
            return includeSelector.value === selector;
        })
    }

    /**
     * Filters targetAst to not contain any other values then in sourceAst
     * TODO: ignore keyframes rules
     *
     * @param sourceAst {Object}
     * @param targetAst {Object}
     *
     * @returns {Promise<any>}
     */
    filter(sourceAst, targetAst) {
        return new Promise((resolve, reject) => {
            debug("filter - Filtering ast from source");
            if (targetAst.stylesheet) {
                let targetRules      = targetAst.stylesheet.rules;
                sourceAst.stylesheet = sourceAst.stylesheet || {rules: []};
                let sourceRules      = sourceAst.stylesheet.rules;

                targetAst.stylesheet.rules = this.filterRules(sourceRules, targetRules);

                debug("filter - Successfully filtered AST!");
                resolve(targetAst);
            } else {
                debug("filter - ERROR no stylesheet property");
                reject(new Error("Target AST has no root node stylesheet. Stylesheet is properly wrong!"));
            }
        });
    }

    filterRules(sourceRules, targetRules) {
        return _.filter(targetRules, (targetRule, index, collection) => {
            if (targetRule.type === "comment") return false;
            if (targetRule.type === "font-face") return true;

            // Target rule is media query?
            if (targetRule.type === "media") {
                // Get an array of all matching source media rules
                let matchingSourceMediaArr = [];

                for (let sourceRule of sourceRules) {
                    if (sourceRule.type === "comment") continue;
                    // Only respect matching media queries
                    if (sourceRule.type === "media") {
                        if (this.isMatchingMediaRuleSelector(targetRule.media, sourceRule.media)) {
                            matchingSourceMediaArr = matchingSourceMediaArr.concat(sourceRule.rules);
                        }
                    }
                }

                targetRule.rules = _.filter(targetRule.rules, (targetMediaRule, index, collection) => {
                    for (let sourceMediaRule of matchingSourceMediaArr) {
                        const hasIdenticalSelectors = _.isEqual(sourceMediaRule.selectors, targetMediaRule.selectors);
                        if (hasIdenticalSelectors === true) {
                            return true;
                        }
                    }
                    return false;
                });

                return targetRule.rules.length > 0;
            } else {
                for (let sourceRule of sourceRules) {
                    if (sourceRule.type === "comment") continue;
                    // Are the sourceRule selectors the same as the targetRule selectors -> keep
                    // TODO: hier kommt schon weniger CSS an. Siehe README BUGS
                    const hasIdenticalSelectors = this.isSameRuleType(sourceRule, targetRule) && _.isEqual(sourceRule.selectors, targetRule.selectors);
                    if (hasIdenticalSelectors === true) {
                        return true;
                    }
                }
            }

            return false;
        });
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
            consola.warn("removeSelectors have to be an array to be processed");
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

                if (this.isMediaRule(rule)) {
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
     * @param ast {Object}
     * @param selectorMap {Map}
     * @returns {Object<AST>}
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

        // Iterate over all ast rules
        for (let rule of _astRoot.rules) {
            // If rule is media going recursive with their rules
            if (rule.type === "media") {
                _astRoot.rules[_astRoot.rules.indexOf(rule)] = this.filterByMap(rule, selectorMap);
            } else if (rule.type === "rule") {
                // If rule is rule -> check if selectors are in critical map
                // If not - put them into the array to remove them later on
                if (!hasCriticalSelectors(rule.selectors, media, selectorMap)) {
                    removeableRules.push(rule);
                }
            } else {
                debug("Unknow rule type => " + rule.type);
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
     * @param targetAst
     * @param mergeAst
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
     * @param rule {Object}
     * @param targetRules {Array}
     */
    mergeRule(rule, targetRules) {
        // Handle media queries
        if (this.isMediaRule(rule)) {
            this.mergeMediaRule(rule, targetRules);
        } else {
            // Normal CSS-Rule or other
            if (targetRules.length > 0) {
                let isDuplicate = false;
                for (let targetRule of targetRules) {
                    // Does rule exists in targetRules?
                    // If not -> assimilate
                    if (this.isSameRuleType(targetRule, rule) && this.isRuleDuplicate(targetRule, rule)) {
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
            if (this.isMediaRule(targetRule) && this.isMatchingMediaRuleSelector(selector, targetRule.media)) {
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

    /**
     * Returns true if rule1 is a duplicate of rule2.
     *
     * @param rule1 {Object}
     * @param rule2 {Object}
     * @returns {boolean}
     */
    isRuleDuplicate(rule1, rule2) {
        // Same selectors?? -> Check declaration if same
        if (_.isEqual(rule1.selectors, rule2.selectors)) {
            let r1Declarations = rule1.declarations;
            let r2Declarations = rule2.declarations;

            // Check diff by length
            if (r1Declarations.length !== r2Declarations.length) {
                return false;
            } else {
                // Same length! Check single declarations
                let r1DeclCount   = r1Declarations.length;
                let r2DeclMatches = 0;

                // Iterate over both declarations and check diff in detail
                // we only count the amount of hits of the same declaration and comparing the result count
                // with the previous count of declarations to be merged. If they are equal
                // we got the same rule
                for (let r1Decl of r1Declarations) {
                    for (let r2Decl of r2Declarations) {
                        // Is declaration the same?
                        if (r2Decl.property === r1Decl.property && r2Decl.value === r1Decl.value) {
                            r2DeclMatches++;
                            break;
                        }
                    }
                }

                // Different declarations in both arrays? > create new rule
                if (r1DeclCount === r2DeclMatches) {
                    return true;
                }
            }
        }

        return false;
    }

    isSameRuleType(rule1, rule2) {
        return rule1.type === rule2.type;
    }

    /**
     * Returns true if rule is of type "media"
     *
     * @param rule
     * @returns {boolean}
     */
    isMediaRule(rule) {
        return rule.type === "media";
    }

    /**
     * Returns true if selector_1 is matching selector_2 as a media rule selector.
     * Also checks valid differences between media selectors that mean the same.
     * "all and " is not needed for the same result. Therefor we need to check the rules more gracefully
     *
     * @param selector_1
     * @param selector_2
     * @returns {boolean}
     */
    isMatchingMediaRuleSelector(selector_1, selector_2) {
        return selector_1 === selector_2 ||
            selector_1 === selector_2.replace("all and ", "") ||
            selector_2 === selector_1.replace("all and ", "") ||
            selector_1.replace("all and ", "") === selector_2.replace("all and ", "")
    }
}

module.exports = CssTransformator;