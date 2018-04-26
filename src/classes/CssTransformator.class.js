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
            indent: "  ",
            compress: false,
            sourcemap: true,
            inputSourcemaps: true
        })
    }

    normalizeSelector(selectorNode, forceInclude) {
        const selector = csstree.generate(selectorNode);
        // some selectors can't be matched on page.
        // In these cases we test a slightly modified selector instead
        let modifiedSelector = selector.trim();

//        if (this.matchesForceInclude(modifiedSelector, forceInclude)) {
//            return true;
//        }

        if (modifiedSelector.indexOf(':') > -1) {
            // handle special case selectors, the ones that contain a semicolon (:)
            // many of these selectors can't be matched to anything on page via JS,
            // but that still might affect the above the fold styling

            // ::selection we just remove
            if (/:?:(-moz-)?selection/.test(modifiedSelector)) {
                return false
            }

            // for the pseudo selectors that depend on an element, test for presence
            // of the element (in the critical viewport) instead
            // (:hover, :focus, :active would be treated same
            // IF we wanted to keep them for critical path css, but we don’t)
            modifiedSelector = modifiedSelector.replace(this._PSUEDO_SELECTOR_REGEXP, '');

            // if selector is purely pseudo (f.e. ::-moz-placeholder), just keep as is.
            // we can't match it to anything on page, but it can impact above the fold styles
            if (modifiedSelector.replace(/:[:]?([a-zA-Z0-9\-_])*/g, '').trim().length === 0) {
                return true;
            }

            // handle browser specific pseudo selectors bound to elements,
            // Example, button::-moz-focus-inner, input[type=number]::-webkit-inner-spin-button
            // remove browser specific pseudo and test for element
            modifiedSelector = modifiedSelector.replace(/:?:-[a-z-]*/g, '');
        }

        return modifiedSelector;
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
     * @param sourceAst
     * @param targetAst
     * @returns {Promise<any>}
     */
    filter(sourceAst, targetAst) {
        return new Promise((resolve, reject) => {
            debug("filter - Filtering ast from source");
            if (targetAst.stylesheet) {
                let targetRules      = targetAst.stylesheet.rules;
                sourceAst.stylesheet = sourceAst.stylesheet || {rules: []};
                let sourceRules      = sourceAst.stylesheet.rules;

                targetAst.stylesheet.rules = _.filter(targetRules, (targetRule, index, collection) => {
                    // Target rule is media query?
                    if (targetRule.type === "media") {
                        // Get an array of all matching source media rules
                        let matchingSourceMediaArr = [];

                        for (let sourceRule of sourceRules) {
                            // Only respect matching media queries
                            if (sourceRule.type === "media") {
                                // Target rule may be slightly different because the CSSMediaRule does not count
                                // "all" as an important property because it is default. So it just removes it.
                                if (
                                    targetRule.media === sourceRule.media ||
                                    targetRule.media === sourceRule.media.replace("all and ", "")
                                ) {
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
                            // Are the sourceRule selectors the same as the targetRule selectors -> keep
                            const hasIdenticalSelectors = _.isEqual(sourceRule.selectors, targetRule.selectors);
                            if (hasIdenticalSelectors === true) {
                                return true;
                            }
                        }
                    }

                    return false;
                });

                debug("filter - Successfully filtered AST!");
                resolve(targetAst);
            } else {
                debug("filter - ERROR no stylesheet property");
                reject(new Error("Target AST has no root node stylesheet. Stylesheet is properly wrong!"));
            }
        });
    }

    /**
     * Merge mergeAst into targetAst.
     * Keep targetAst properties if duplicate
     * TODO: Media Queries
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

                        // Handle media queries
                        if (mergeRule.type === "media") {
                            // TODO MEDIA QUERY
                            consola.warn("HANDLE MEDIA QUERY")

                        } else { // Normal CSSRule
                            // Does mergeRule exists in targetRules?
                            // If not -> assimilate
                            if (targetRules.length > 0) {
                                for (let targetRule of targetRules) {
                                    // Same selectors?? -> Check declaration if same
                                    if (_.isEqual(mergeRule.selectors, targetRule.selectors)) {
                                        let mergeDeclarations  = mergeRule.declarations;
                                        let targetDeclarations = targetRule.declarations;

                                        // Check diff by length
                                        if (mergeDeclarations.length !== targetDeclarations.length) {
                                            // Declarations differ -> Take the rule
                                            targetRules.push(mergeRule); // TODO: positioning
                                            break;
                                        } else {
                                            // Same length! Check single declarations
                                            let mergeDeclCount     = mergeDeclarations.length;
                                            let mergeDeclTargetHit = 0;

                                            // Iterate over both declarations and check diff in detail
                                            // we only count the amount of hits of the same declaration and comparing the result count
                                            // with the previous count of declarations to be merged. If they are equal
                                            // we got the same rule
                                            for (let mergeDeclaration of mergeDeclarations) {
                                                for (let targetDeclaration of targetDeclarations) {
                                                    // Is declaration the same?
                                                    if (targetDeclaration.property === mergeDeclaration.property && targetDeclaration.value !== mergeDeclaration.value) {
                                                        mergeDeclTargetHit++;
                                                        break;
                                                    }
                                                }
                                            }

                                            // Different declarations in both arrays? > create new rule
                                            if (mergeDeclCount !== mergeDeclTargetHit) {
                                                // TODO: take care of positioning. The rule may need to overwrite something and could be inserted to early / late
                                                targetRules.push(mergeRule);
                                                break;
                                            }
                                        }
                                    } else {
                                        // TODO: merge into target but care about position
                                        // Maybe with mergeRules.indexOf(mergeRule) and keep the same index for inserting in targetRules
                                        // Problem could be that the inserted Rule overwrites something important which would normally
                                        // not happen.
                                        targetRules.push(mergeRule);
                                        break;
                                    }
                                }

                            } else {
                                // Empty targetRules -> create
                                targetRules.push(mergeRule);
                            }

                        }

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
}

module.exports = CssTransformator;