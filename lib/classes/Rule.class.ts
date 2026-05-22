import isEqualWith from 'lodash/isEqualWith.js';
import CONSTANTS from '../Constants.js';
import type {
    AnyCssRule,
    CssCharset,
    CssComment,
    CssFontFace,
    CssKeyframe,
    CssKeyframes,
    CssMediaRule,
    CssRule,
    CssSupportsRule,
} from '../types.js';

/**
 * Rule Class with static functions to handle rule comparision and more.
 *
 * All methods are static. The class is never instantiated.
 */
class Rule {
    /**
     * Checks if rule is a native duplicate. Checks all properties but excluded.
     */
    static isRuleDuplicate(rule1: unknown, rule2: unknown, excludedProperties: ReadonlyArray<string> = []): boolean {
        return isEqualWith(rule1, rule2, (_value1: unknown, _value2: unknown, propKey) => {
            if (typeof propKey === 'string' && excludedProperties.includes(propKey)) {
                return true;
            }
            return undefined;
        });
    }

    /**
     * Compares 2 ast rules by type.
     */
    static isSameRuleType(rule1: { type: string }, rule2: { type: string }): boolean {
        return rule1.type === rule2.type;
    }

    static isMediaRule(rule: AnyCssRule): rule is CssMediaRule {
        return rule.type === 'media';
    }

    static isSupportsRule(rule: AnyCssRule): rule is CssSupportsRule {
        return rule.type === 'supports';
    }

    static isRule(rule: AnyCssRule): rule is CssRule {
        return rule.type === 'rule';
    }

    static isStyleRule(rule: AnyCssRule): rule is CssRule {
        return rule.type === 'rule';
    }

    static isKeyframe(rule: AnyCssRule): rule is CssKeyframe {
        return rule.type === 'keyframe';
    }

    static isKeyframes(rule: AnyCssRule): rule is CssKeyframes {
        return rule.type === 'keyframes';
    }

    static isCharset(rule: AnyCssRule): rule is CssCharset {
        return rule.type === 'charset';
    }

    static isComment(rule: AnyCssRule): rule is CssComment {
        return rule.type === 'comment';
    }

    static isFontFace(rule: AnyCssRule): rule is CssFontFace {
        return rule.type === 'font-face';
    }

    static isGroupRule(rule: AnyCssRule): boolean {
        return (rule as Record<string, unknown>)[rule.type] !== undefined;
    }

    static isStylesheet(rule: { type: string }): boolean {
        return rule.type === 'stylesheet';
    }

    static isImportantRule(rule: AnyCssRule): boolean {
        return Rule.isMediaRule(rule) || Rule.isRule(rule);
    }

    /**
     * Returns true if selector_1 is matching selector_2 as a media rule selector.
     * Also checks valid differences between media selectors that mean the same.
     * "all and " is not needed for the same result. Therefore we need to check the
     * rules more gracefully.
     */
    static isMatchingMediaRuleSelector(selector_1: string, selector_2: string): boolean {
        return (
            selector_1 === selector_2 ||
            selector_1 === selector_2.replace('all and ', '') ||
            selector_2 === selector_1.replace('all and ', '') ||
            selector_1.replace('all and ', '') === selector_2.replace('all and ', '')
        );
    }

    static generateRuleKey(rule: AnyCssRule, groupPrefix = '', withKeySeparator = false): string | false {
        const keySeparator = withKeySeparator ? CONSTANTS.RULE_SEPARATOR : '';
        let ruleStr = 'default';

        if (Rule.isRule(rule) && rule.selectors) {
            ruleStr = rule.selectors.join();
        } else if (Rule.isCharset(rule)) {
            ruleStr = rule.charset;
        } else if (Rule.isKeyframes(rule)) {
            ruleStr = rule.name;
        } else if (Rule.isKeyframe(rule)) {
            ruleStr = rule.values.join();
        } else if (Rule.isMediaRule(rule)) {
            ruleStr = `${rule.type} ${rule.media}`;
        } else if (Rule.isSupportsRule(rule)) {
            ruleStr = `${rule.type} ${rule.supports}`;
        } else if (Rule.isFontFace(rule)) {
            ruleStr = rule.type;
        } else if (Rule.isComment(rule)) {
            return false;
        } else if (Rule.isGroupRule(rule)) {
            const groupValue = (rule as Record<string, unknown>)[rule.type];
            ruleStr = `${rule.type} ${String(groupValue)}`;
        } else {
            return ruleStr;
        }

        return groupPrefix + keySeparator + ruleStr;
    }
}

export default Rule;
