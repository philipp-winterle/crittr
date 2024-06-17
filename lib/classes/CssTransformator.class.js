import doDebug from 'debug';
import log from '@dynamicabot/signales';
import merge from 'deepmerge';
import css from 'css';
import Rule from './Rule.class.js';

const debug = doDebug('crittr:css-transformator');

/**
 *
 */
class CssTransformator {
    constructor(options) {
        options = options || {};
        this.options = {
            silent: true,
            source: null,
        };

        this.options = merge(this.options, options);

        const pseudoSelectorsToKeep = [':before', ':after', ':visited', ':first-letter', ':first-line'];

        this.CRITICAL_TYPES_TO_KEEP = ['media', 'rule', 'charset', 'font-face', 'supports'];

        this.GROUP_SEPERATOR = '-##-';
    }

    getAst(cssContent) {
        let astObj = null;
        try {
            debug('getAst - Try parsing css to ast ...');
            astObj = css.parse(cssContent, {
                silent: this.options.silent,
                source: this.options.source,
            });
            debug('getAst - Css successfully parsed to ast ...');
        } catch (err) {
            log.error(err);
        }
        return astObj;
    }

    getCssFromAst(ast) {
        return css.stringify(ast, {
            indent: '  ',
            compress: false,
            sourcemap: true,
            inputSourcemaps: true,
        }).code;
    }

    getCriticalRuleSelectors(rule, selectorMap, groupPrefix = '') {
        const ruleKey = Rule.generateRuleKey(rule, groupPrefix);

        if (selectorMap.has(ruleKey)) {
            const critObj = selectorMap.get(ruleKey);
            return rule.selectors.filter(selector => critObj.selectors.includes(selector));
        }

        return [];
    }

    isGroupType(rule) {
        // AST RULES have a interface GroupingRule
        // developer.mozilla.org/en-US/docs/Web/API/CSSGroupingRule
        https: return rule.type !== 'rule' && rule.rules !== undefined;
    }

    getRuleType(rule) {
        return rule.type || '';
    }

    getGroupRuleId(rule) {
        const type = this.getRuleType(rule);
        const typeString = rule[type] || '';

        return `${type}${typeString}`;
    }

    processRuleCollection({ rules, selectorMap, criticalSelectorsMap, isCritical = false, groupPrefix = '' }) {
        const processedRules = [];

        for (let rule of rules) {
            if (this.isGroupType(rule)) {
                // Grouped rule handling
                const prefix = this.getGroupRuleId(rule);

                rule.rules = this.processRuleCollection({
                    rules: rule.rules,
                    selectorMap,
                    criticalSelectorsMap,
                    isCritical,
                    groupPrefix: prefix,
                });

                // If media query is empty remove
                if (rule.rules.length === 0) {
                    rule = null;
                }
            } else {
                // Single rule -> can be processed
                if (isCritical) {
                    rule = this.processCriticalRule(rule, selectorMap, criticalSelectorsMap, groupPrefix);
                } else {
                    rule = this.processNonCriticalRule(rule, criticalSelectorsMap, groupPrefix);
                }
            }

            // Fill new Array if no empty rule
            if (rule !== null) {
                processedRules.push(rule);
            }
        }

        // Remove empty rules

        return processedRules;
    }

    processCriticalRule(rule, selectorMap, criticalSelectorsMap, groupPrefix) {
        // Get rule key
        const ruleKey = Rule.generateRuleKey(rule, groupPrefix);
        // Get the critical selectors of this media internal rule
        rule.selectors = this.getCriticalRuleSelectors(rule, selectorMap, groupPrefix);
        // Create Map entry for exclude of remaining ast
        criticalSelectorsMap.set(ruleKey, rule.selectors);

        // If there are no critical selectors mark this rule as removed and set it to null
        if (rule.type === 'rule' && rule.selectors.length === 0) {
            return null;
        }

        return rule;
    }

    processNonCriticalRule(rule, criticalSelectorsMap, groupPrefix) {
        // Get rule key
        const ruleKey = Rule.generateRuleKey(rule, groupPrefix);

        if (criticalSelectorsMap.has(ruleKey)) {
            const criticalSelectorsOfRule = criticalSelectorsMap.get(ruleKey);
            const selectors = rule.selectors || [];
            const newSelectors = [];
            for (const selector of selectors) {
                if (!criticalSelectorsOfRule.includes(selector)) {
                    newSelectors.push(selector);
                }
            }

            rule.selectors = newSelectors;
        }

        if (rule.type === 'rule' && rule.selectors.length === 0) {
            rule = null;
        }

        return rule;
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
        let _ast = JSON.parse(JSON.stringify(ast));
        let _astRest = JSON.parse(JSON.stringify(ast));
        const _astRoot = _ast.stylesheet;
        const _astRestRoot = _astRest.stylesheet;
        const criticalSelectorsMap = new Map();

        // Filter rule types we don't want in critical
        let newRules = _astRoot.rules.filter(rule => {
            return this.CRITICAL_TYPES_TO_KEEP.includes(rule.type);
        });

        // HANDLE CRITICAL CSS
        newRules = this.processRuleCollection({
            rules: newRules,
            selectorMap: selectorMap,
            criticalSelectorsMap: criticalSelectorsMap,
            isCritical: true,
        });

        // HANDLE REST CSS
        const astRestRules = _astRestRoot.rules;
        let restRules = this.processRuleCollection({
            rules: astRestRules,
            criticalSelectorsMap: criticalSelectorsMap,
            isCritical: false,
        });

        _astRoot.rules = newRules;
        _astRestRoot.rules = restRules;

        // Return the new AST Object
        return [_ast, _astRest];
    }
}

export default CssTransformator;
