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

        this.CRITICAL_TYPES_TO_KEEP = [
            "media",
            "rule",
            "charset",
            "font-face",
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
        return css.stringify(ast, {
            indent:          "  ",
            compress:        false,
            sourcemap:       true,
            inputSourcemaps: true
        }).code;
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

        // Filter rule types we don't want in critical
        let newRules = _astRoot.rules.filter(rule => {
            return this.CRITICAL_TYPES_TO_KEEP.includes(rule.type);
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
                        if (ruleKey !== false && criticalSelectorsMap.has(ruleKey)) {
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
            return !(removeableRules.includes(rule));
        });

        _astRoot.rules     = newRules;
        _astRestRoot.rules = restRules;

        // Return the new AST Object
        return [_ast, _astRest];
    }
}

module.exports = CssTransformator;