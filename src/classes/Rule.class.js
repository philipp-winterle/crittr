const _               = require('lodash');

/**
 * Rule Class with static functions to handle rule comparision and more
 *
 * @Static
 */
class Rule {

    /**
     * Checks if rule is a native duplicate. Checks all properties but excluded
     *
     * @param rule1
     * @param rule2
     * @param excludedProperties
     */
    static isRuleDuplicate(rule1, rule2, excludedProperties) {
        excludedProperties = excludedProperties || [];

        const hasSameProperties = _.isEqualWith(rule1, rule2, (value1, value2, propKey) => {
            if(excludedProperties.includes(propKey)) return true;
        });

        return hasSameProperties;
    }


    /**
     * Returns true if rule1 is a duplicate of rule2.
     * Only for Rule Type "media"
     *
     * @param rule1 {Object}
     * @param rule2 {Object}
     * @returns {boolean}
     */
    static isRuleTypeDuplicate(rule1, rule2) {
        // Same selectors?? -> Check declaration if same
        if (rule1.selectors && rule2.selectors && _.isEqual(rule1.selectors, rule2.selectors)) {
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

    static isSameRuleType(rule1, rule2) {
        return rule1.type === rule2.type;
    }

    /**
     * Returns true if rule is of type "media"
     *
     * @param rule
     * @returns {boolean}
     */
    static isMediaRule(rule) {
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
    static isMatchingMediaRuleSelector(selector_1, selector_2) {
        return selector_1 === selector_2 ||
            selector_1 === selector_2.replace("all and ", "") ||
            selector_2 === selector_1.replace("all and ", "") ||
            selector_1.replace("all and ", "") === selector_2.replace("all and ", "")
    }

}

module.exports = Rule;