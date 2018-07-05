const _         = require('lodash');
const log       = require('signale');
const CONSTANTS = require('../Constants');
const Rule      = require("./Rule.class");
const hash      = require('object-hash');

// PRIVATE CONSTS
const MEDIA_PREFIX = "@media ";

// PRIVATE FUNCTIONS
const handleRule = (ruleObj, map) => {
    // Ignore comments
    if (!Rule.isComment(ruleObj)) {
        delete ruleObj.position; // Remove position. We don't need that any longer

        // Handle MediaQuery
        if (Rule.isMediaRule(ruleObj)) {
            const media = MEDIA_PREFIX + ruleObj.media;
            const mediaRulesArr = map.get(media);
            const mRules        = ruleObj.rules;

            for(const mRule of mRules) {
                delete mRule.position; // Remove position. We don't need that any longer
            }

            // There are already media rules in our set
            if (mediaRulesArr && mediaRulesArr.length > 0) {
                // Filter the rules of the proccessed media query for already existing and only return
                // rules that does not exist in the mq map
                const newRules = mRules.filter(mRule => {
                    const objHash = hash.MD5(mRule);
                    return !mediaRulesArr.some(ruleObj => ruleObj.hash === objHash)
                }).map( mRule => {
                    const objHash = hash.MD5(mRule);
                    return {
                        hash: objHash,
                        rule: mRule
                    }
                });
                map.set(media, [...mediaRulesArr, ...newRules]);
            } else {
                // Fresh media rules can be created
                map.set(media, mRules.map(mRule => {
                    const objHash = hash.MD5(mRule);
                    return {
                        hash: objHash,
                        rule: mRule
                    }
                }));
            }
        } else {
            const ruleKey = Rule.generateRuleKey(ruleObj);
            const rulesArray = map.get(ruleKey);
            const objHash    = hash.MD5(ruleObj);

            if (rulesArray) {
                // If this rule object (hash) already exists in this ruleKey ignore else insert
                if (!rulesArray.some(ruleObj => ruleObj.hash === objHash)) {
                    rulesArray.push({
                        hash: objHash,
                        rule: ruleObj
                    });
                }
            } else {
                map.set(ruleKey, [
                    {
                        hash: objHash,
                        rule: ruleObj
                    }
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
        if (
            ast.type &&
            ast.type === "stylesheet" &&
            ast.stylesheet &&
            Array.isArray(ast.stylesheet.rules)
        ) {
            const restRules = ast.stylesheet.rules;

            for (const ruleObj of restRules) {
                handleRule(ruleObj, ruleMap);
            }
        }

        return ruleMap;
    }

    static getAstOfRuleMap(ruleMap) {
        const ast          = {
            "type":       "stylesheet",
            "stylesheet": {
                "rules": []
            }
        };
        const astRules     = ast.stylesheet.rules;

        for (let [ruleKey, rulesObj] of ruleMap) {
            // Is this rule a media query?
            if (ruleKey.includes(MEDIA_PREFIX)) {
                const mqStr = ruleKey.replace(MEDIA_PREFIX, "");
                astRules.push({
                    type: "media",
                    media: mqStr,
                    rules: rulesObj.map(ruleObj => {
                        // NOTE HIER ist eine normale rule drin. ka warum finde es heraus
                        // TODO: BOOOOOOOOOOOOOOOOOOOOOOOOOOOOOM only screen and (max-width:1023px) [ { hash: 'a8dd876be698c39d6f0f414a39185192',
                        /*
                        { type: 'rule',
                            selectors: [ '.c24-nav.open .c24-nav-button:after' ],
                            declarations: [ [Object] ] } ]
                         */
                        if (ruleObj === undefined || ruleObj.rule === undefined) console.log("BOOOOOOOOOOOOOOOOOOOOOOOOOOOOOM", mqStr, rulesObj)
                        return ruleObj.rule;
                    })
                })
            } else {
                astRules.push(...rulesObj.map(ruleObj => ruleObj.rule));
            }
        }

        return ast;
    }
}

Ast.TYPES_TO_REMOVE = [
    "comment"
];

module.exports = Ast;