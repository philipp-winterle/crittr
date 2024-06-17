import _ from 'lodash';
import Rule from './Rule.class.js';
import hash from 'object-hash';

// PRIVATE VARS
const REMOVEABLE_PROPS = ['position'];

// PRIVATE FUNCTIONS
const cleanUnusedProperties = obj => {
    for (let prop in obj) {
        if (REMOVEABLE_PROPS.includes(prop)) {
            delete obj[prop];
        }

        const item = obj[prop];
        if (Array.isArray(item) || typeof item === 'object') {
            cleanUnusedProperties(item);
        }
    }
};

const handleRule = (ruleObj, map) => {
    // Ignore comments
    if (!Rule.isComment(ruleObj)) {
        cleanUnusedProperties(ruleObj); // Remove position. We don't need that any longer

        // Handle MediaQuery
        if (Rule.isMediaRule(ruleObj)) {
            const media = Ast.MEDIA_PREFIX + ruleObj.media;
            const mediaRulesArr = map.get(media);
            const mRules = ruleObj.rules;

            // There are already media rules in our set
            if (mediaRulesArr && mediaRulesArr.length > 0) {
                // Filter the rules of the proccessed media query for already existing and only return
                // rules that does not exist in the mq map
                const newRules = mRules
                    .filter(mRule => {
                        const objHash = hash.MD5(mRule);
                        return !mediaRulesArr.some(ruleObj => ruleObj.hash === objHash);
                    })
                    .map(mRule => {
                        const objHash = hash.MD5(mRule);
                        return {
                            hash: objHash,
                            rule: mRule,
                        };
                    });
                map.set(media, [...mediaRulesArr, ...newRules]);
            } else {
                // Fresh media rules can be created
                map.set(
                    media,
                    mRules.map(mRule => {
                        const objHash = hash.MD5(mRule);
                        return {
                            hash: objHash,
                            rule: mRule,
                        };
                    }),
                );
            }
        } else {
            const ruleKey = Rule.generateRuleKey(ruleObj);
            const rulesArray = map.get(ruleKey);
            const objHash = hash.MD5(ruleObj);

            if (rulesArray) {
                // If this rule object (hash) already exists in this ruleKey ignore else insert
                if (!rulesArray.some(ruleObj => ruleObj.hash === objHash)) {
                    rulesArray.push({
                        hash: objHash,
                        rule: ruleObj,
                    });
                }
            } else {
                map.set(ruleKey, [
                    {
                        hash: objHash,
                        rule: ruleObj,
                    },
                ]);
            }
        }
    }
};

/**
 * Rule Class with static functions to handle ast management
 *
 * @static
 */
class Ast {
    static generateRuleMap(ast, ruleMap = new Map()) {
        if (ast.type && ast.type === 'stylesheet' && ast.stylesheet && Array.isArray(ast.stylesheet.rules)) {
            const restRules = ast.stylesheet.rules;

            for (const ruleObj of restRules) {
                handleRule(ruleObj, ruleMap);
            }
        }

        return ruleMap;
    }

    static getAstOfRuleMap(ruleMap) {
        const ast = {
            type: 'stylesheet',
            stylesheet: {
                rules: [],
            },
        };
        const astRules = ast.stylesheet.rules;

        for (let [ruleKey, rulesObj] of ruleMap) {
            // Empty declarations break reworkcss/css. https://github.com/reworkcss/css/issues/92
            if (rulesObj[0].rule.hasOwnProperty('declarations') && !rulesObj[0].rule.declarations.length) {
                break;
            }

            if (rulesObj[0].rule.type === 'rule' && !rulesObj[0].rule.hasOwnProperty('declarations')) {
                break;
            }

            // Is this rule a media query?
            if (ruleKey.includes(Ast.MEDIA_PREFIX)) {
                const mqStr = ruleKey.replace(Ast.MEDIA_PREFIX, '');
                astRules.push({
                    type: 'media',
                    media: mqStr,
                    rules: rulesObj.map(ruleObj => {
                        return ruleObj.rule;
                    }),
                });
            } else {
                astRules.push(...rulesObj.map(ruleObj => ruleObj.rule));
            }
        }

        return ast;
    }

    static isMediaObj(ruleKey) {
        return ruleKey.includes(Ast.MEDIA_PREFIX);
    }
}

Ast.TYPES_TO_REMOVE = ['comment'];

Ast.MEDIA_PREFIX = '@media ';

export default Ast;
