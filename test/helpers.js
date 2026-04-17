import Rule from '../lib/classes/Rule.class.js';

const isGroupRule = rule => {
    return rule.type !== 'rule' && rule.rules !== undefined;
};

const addCriticalRule = (rule, criticalSelectorRules, rulePrefix = '') => {
    if (isGroupRule(rule)) {
        const ruleKey = Rule.generateRuleKey(rule);
        rulePrefix = `${rulePrefix}${ruleKey}===`;

        // CSSGroupingRule has cssRules as main property. .rules is deprecated
        const rules = rule.rules || [];

        for (const rule of rules) {
            addCriticalRule(rule, criticalSelectorRules, rulePrefix);
        }
    } else if (Rule.isStyleRule(rule)) {
        const pairedSelector = `${rulePrefix}${rule.selectors.join(',')}`;

        if (criticalSelectorRules.has(pairedSelector)) {
            let count = criticalSelectorRules.get(pairedSelector);
            criticalSelectorRules.set(pairedSelector, ++count);
        } else {
            criticalSelectorRules.set(pairedSelector, 1);
        }
    } else {
        if (criticalSelectorRules.has(rule.type)) {
            let count = criticalSelectorRules.get(rule.type);
            criticalSelectorRules.set(rule.type, ++count);
        } else {
            criticalSelectorRules.set(rule.type, 1);
        }
    }
};

/**
 *
 * @param {CSSRuleList} astRules
 * @returns Map
 */
const getAstRules = astRules => {
    const criticalSelectorRules = new Map();
    // Gather all Selectors of result CSS
    for (const rule of astRules) {
        addCriticalRule(rule, criticalSelectorRules);
    }

    return criticalSelectorRules;
};

export default {
    getAstRules: getAstRules,
};
