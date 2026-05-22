import hash from 'object-hash';
import type { AnyCssRule, CssMediaRule, CssStylesheet, RuleMap, RuleMapEntry } from '../types.js';
import Rule from './Rule.class.js';

// PRIVATE VARS
const REMOVEABLE_PROPS = ['position'] as const;

// PRIVATE FUNCTIONS
const cleanUnusedProperties = (obj: unknown): void => {
    if (obj === null || typeof obj !== 'object') {
        return;
    }

    const record = obj as Record<string, unknown>;
    for (const prop of Object.keys(record)) {
        if ((REMOVEABLE_PROPS as ReadonlyArray<string>).includes(prop)) {
            delete record[prop];
            continue;
        }

        const item = record[prop];
        if (Array.isArray(item) || (item !== null && typeof item === 'object')) {
            cleanUnusedProperties(item);
        }
    }
};

const toEntry = (rule: AnyCssRule): RuleMapEntry => ({
    hash: hash.MD5(rule as object),
    rule,
});

const handleRule = (ruleObj: AnyCssRule, map: RuleMap): void => {
    // Ignore comments
    if (Rule.isComment(ruleObj)) {
        return;
    }

    cleanUnusedProperties(ruleObj); // Remove position. We don't need that any longer

    // Handle MediaQuery
    if (Rule.isMediaRule(ruleObj)) {
        const mediaRule = ruleObj as CssMediaRule;
        const media = Ast.MEDIA_PREFIX + mediaRule.media;
        const mediaRulesArr = map.get(media);
        const mRules = mediaRule.rules;

        if (mediaRulesArr && mediaRulesArr.length > 0) {
            // Filter rules of the processed media query for already existing and only
            // append rules that do not exist in the mq map yet.
            const newRules: RuleMapEntry[] = mRules
                .filter(mRule => {
                    const objHash = hash.MD5(mRule as object);
                    return !mediaRulesArr.some(entry => entry.hash === objHash);
                })
                .map(toEntry);
            map.set(media, [...mediaRulesArr, ...newRules]);
        } else {
            map.set(media, mRules.map(toEntry));
        }

        return;
    }

    const ruleKey = Rule.generateRuleKey(ruleObj);
    if (ruleKey === false) {
        return;
    }

    const rulesArray = map.get(ruleKey);
    const objHash = hash.MD5(ruleObj as object);

    if (rulesArray) {
        // If this rule object (hash) already exists in this ruleKey ignore, else insert
        if (!rulesArray.some(entry => entry.hash === objHash)) {
            rulesArray.push({ hash: objHash, rule: ruleObj });
        }
    } else {
        map.set(ruleKey, [{ hash: objHash, rule: ruleObj }]);
    }
};

/**
 * Ast class with static functions to handle AST management.
 *
 * All methods are static. The class is never instantiated.
 */
class Ast {
    static TYPES_TO_REMOVE: ReadonlyArray<string> = ['comment'];
    static MEDIA_PREFIX = '@media ';

    static generateRuleMap(ast: CssStylesheet, ruleMap: RuleMap = new Map()): RuleMap {
        if (ast.type === 'stylesheet' && ast.stylesheet && Array.isArray(ast.stylesheet.rules)) {
            const restRules = ast.stylesheet.rules;
            for (const ruleObj of restRules) {
                handleRule(ruleObj, ruleMap);
            }
        }

        return ruleMap;
    }

    static getAstOfRuleMap(ruleMap: RuleMap): CssStylesheet {
        const ast: CssStylesheet = {
            type: 'stylesheet',
            stylesheet: {
                rules: [],
            },
        };
        const astRules = ast.stylesheet.rules;

        for (const [ruleKey, rulesObj] of ruleMap) {
            const firstRule = rulesObj[0]?.rule as Record<string, unknown> | undefined;
            if (!firstRule) {
                continue;
            }

            // Empty declarations break reworkcss/css.
            // https://github.com/reworkcss/css/issues/92
            if (Object.hasOwn(firstRule, 'declarations') && Array.isArray(firstRule.declarations) && firstRule.declarations.length === 0) {
                break;
            }

            if (firstRule.type === 'rule' && !Object.hasOwn(firstRule, 'declarations')) {
                break;
            }

            // Is this rule a media query?
            if (ruleKey.includes(Ast.MEDIA_PREFIX)) {
                const mqStr = ruleKey.replace(Ast.MEDIA_PREFIX, '');
                astRules.push({
                    type: 'media',
                    media: mqStr,
                    rules: rulesObj.map(entry => entry.rule),
                } as CssMediaRule);
            } else {
                astRules.push(...rulesObj.map(entry => entry.rule));
            }
        }

        return ast;
    }

    static isMediaObj(ruleKey: string): boolean {
        return ruleKey.includes(Ast.MEDIA_PREFIX);
    }
}

export default Ast;
