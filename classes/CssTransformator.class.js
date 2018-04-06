"use strict";

const path            = require('path');
const fs              = require('fs-extra');
const util            = require('util');
const readFilePromise = util.promisify(fs.readFile);
const _               = require('lodash');
const debug           = require('debug')("CriticalExtractor CSSTransformator");
const consola         = require('consola');
const merge           = require('deepmerge');
const csstree         = require('css-tree');

/**
 *
 */
class CssTransformator {
    constructor(options) {
        options = options || {};
        this.options = {

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
        return csstree.parse(cssContent, {
            positions: true,
            onParseError: error => {
                consola.error("CSS PARSE ERROR");
                consola.error(error);
            }
        });
    }

    /**
     *
     * @returns {{selectorNodeMap: WeakMap<Object, any>, selectors: Array[]}}
     */
    getSelectorMap(cssContent) {
        const ast = this.getAst(cssContent);

        const selectors       = new Set();
        const selectorNodeMap = new WeakMap();

        csstree.walk(ast, {
            visit: 'Rule',
            enter: (rule, item, list) => {
                // ignore rules inside @keyframes at-rule
                if (item.atrule && csstree.keyword(item.atrule.name).basename === 'keyframes') {
                    return;
                }

                // ignore a rule with a bad selector
                if (rule.prelude.type !== 'SelectorList') {
                    return;
                }

                // collect selectors and build a map
                rule.prelude.children.each(selectorNode => {
                    const selector = this.normalizeSelector(selectorNode);
                    if (typeof selector === 'string') {
                        selectors.add(selector);
                    }
                    selectorNodeMap.set(selectorNode, selector);
                });
            }
        });

        return {
            selectorNodeMap,
            selectors: Array.from(selectors)
        }
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
        return forceInclude.some( (includeSelector) => {
            if (includeSelector.type === 'RegExp') {
                const {source, flags} = includeSelector;
                const re              = new RegExp(source, flags);
                return re.test(selector);
            }
            return includeSelector.value === selector;
        })
    }

    merge(ast1, ast2) {

        csstree.walk(ast1, {
            visit: 'Rule',
            enter: (node, item, list) => {
                // ignore rules inside @keyframes at-rule
                if (this.atrule && csstree.keyword(this.atrule.name).basename === 'keyframes') {
                    return;
                }
                // ignore a rule with a bad selector
                if (node.prelude.type !== 'SelectorList') {
                    return;
                }


                node.prelude.children.each(selectorNode => {
                    const selector = this.normalizeSelector(selectorNode);
                    if (typeof selector === 'string') {
                        selectors.add(selector);
                    }
                    selectorNodeMap.set(selectorNode, selector);
                });
            }
        });
    }
}

module.exports = CssTransformator;