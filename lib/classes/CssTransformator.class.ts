import log from '@dynamicabot/signales';
import doDebug from 'debug';
import deepmerge from 'deepmerge';
import { parseCss, stringifyCss } from '../helper/cssAstAdapter.js';
import type { AnyCssRule, CriticalSelectorsEntry, CssRule, CssStylesheet } from '../types.js';
import Rule from './Rule.class.js';

const debug = doDebug('crittr:css-transformator');

interface CssTransformatorOptions {
    silent: boolean;
    source: string | null;
}

interface ProcessRuleCollectionArgs {
    rules: AnyCssRule[];
    selectorMap?: Map<string, CriticalSelectorsEntry>;
    criticalSelectorsMap: Map<string, string[]>;
    isCritical?: boolean;
    groupPrefix?: string;
}

type RuleWithRules = AnyCssRule & { rules?: AnyCssRule[] };

class CssTransformator {
    readonly options: CssTransformatorOptions;
    readonly CRITICAL_TYPES_TO_KEEP: ReadonlyArray<string> = ['media', 'rule', 'charset', 'font-face', 'supports'];
    readonly GROUP_SEPERATOR = '-##-';

    constructor(options: Partial<CssTransformatorOptions> = {}) {
        const defaults: CssTransformatorOptions = {
            silent: true,
            source: null,
        };
        this.options = deepmerge(defaults, options as Partial<CssTransformatorOptions>);
    }

    getAst(cssContent: string): CssStylesheet | null {
        let astObj: CssStylesheet | null = null;
        try {
            debug('getAst - Try parsing css to ast ...');
            astObj = parseCss(cssContent, {
                silent: this.options.silent,
                source: this.options.source ?? undefined,
            });
            debug('getAst - Css successfully parsed to ast ...');
        } catch (err) {
            log.error(err);
        }
        return astObj;
    }

    getCssFromAst(ast: CssStylesheet): string {
        return stringifyCss(ast);
    }

    getCriticalRuleSelectors(rule: CssRule, selectorMap: Map<string, CriticalSelectorsEntry>, groupPrefix = ''): string[] {
        const ruleKey = Rule.generateRuleKey(rule, groupPrefix);
        if (ruleKey === false) {
            return [];
        }

        if (selectorMap.has(ruleKey)) {
            const critObj = selectorMap.get(ruleKey);
            if (!critObj) return [];
            return (rule.selectors ?? []).filter(selector => critObj.selectors.includes(selector));
        }

        return [];
    }

    isGroupType(rule: AnyCssRule): boolean {
        // AST RULES have a interface GroupingRule
        // developer.mozilla.org/en-US/docs/Web/API/CSSGroupingRule
        return rule.type !== 'rule' && (rule as RuleWithRules).rules !== undefined;
    }

    getRuleType(rule: AnyCssRule): string {
        return rule.type || '';
    }

    getGroupRuleId(rule: AnyCssRule): string {
        const type = this.getRuleType(rule);
        const typeString = (rule as Record<string, unknown>)[type];
        return `${type}${typeString ?? ''}`;
    }

    processRuleCollection({
        rules,
        selectorMap,
        criticalSelectorsMap,
        isCritical = false,
        groupPrefix = '',
    }: ProcessRuleCollectionArgs): AnyCssRule[] {
        const processedRules: AnyCssRule[] = [];

        for (const originalRule of rules) {
            let rule: AnyCssRule | null = originalRule;

            if (this.isGroupType(rule)) {
                const prefix = this.getGroupRuleId(rule);
                const groupRule = rule as RuleWithRules;

                groupRule.rules = this.processRuleCollection({
                    rules: groupRule.rules ?? [],
                    selectorMap,
                    criticalSelectorsMap,
                    isCritical,
                    groupPrefix: prefix,
                });

                if ((groupRule.rules?.length ?? 0) === 0) {
                    rule = null;
                }
            } else {
                if (isCritical) {
                    rule = this.processCriticalRule(
                        rule as CssRule,
                        selectorMap ?? new Map<string, CriticalSelectorsEntry>(),
                        criticalSelectorsMap,
                        groupPrefix,
                    );
                } else {
                    rule = this.processNonCriticalRule(rule, criticalSelectorsMap, groupPrefix);
                }
            }

            if (rule !== null) {
                processedRules.push(rule);
            }
        }

        return processedRules;
    }

    processCriticalRule(
        rule: CssRule,
        selectorMap: Map<string, CriticalSelectorsEntry>,
        criticalSelectorsMap: Map<string, string[]>,
        groupPrefix: string,
    ): CssRule | null {
        const ruleKey = Rule.generateRuleKey(rule, groupPrefix);
        rule.selectors = this.getCriticalRuleSelectors(rule, selectorMap, groupPrefix);
        if (ruleKey !== false) {
            criticalSelectorsMap.set(ruleKey, rule.selectors);
        }

        if (rule.type === 'rule' && rule.selectors.length === 0) {
            return null;
        }

        return rule;
    }

    processNonCriticalRule(rule: AnyCssRule, criticalSelectorsMap: Map<string, string[]>, groupPrefix: string): AnyCssRule | null {
        const ruleKey = Rule.generateRuleKey(rule, groupPrefix);
        if (ruleKey === false) {
            return rule;
        }

        if (criticalSelectorsMap.has(ruleKey)) {
            const criticalSelectorsOfRule = criticalSelectorsMap.get(ruleKey) ?? [];
            const ruleWithSelectors = rule as { selectors?: string[] };
            const selectors = ruleWithSelectors.selectors ?? [];
            const newSelectors: string[] = [];
            for (const selector of selectors) {
                if (!criticalSelectorsOfRule.includes(selector)) {
                    newSelectors.push(selector);
                }
            }
            ruleWithSelectors.selectors = newSelectors;
        }

        if (rule.type === 'rule' && ((rule as CssRule).selectors?.length ?? 0) === 0) {
            return null;
        }

        return rule;
    }

    /**
     * Filters the AST Object with the `selectorMap` containing critical selectors.
     * Returns a tuple `[criticalAst, restAst]`. Does NOT mutate the input AST.
     */
    filterByMap(ast: CssStylesheet, selectorMap: Map<string, CriticalSelectorsEntry>): [CssStylesheet, CssStylesheet] {
        const _ast = JSON.parse(JSON.stringify(ast)) as CssStylesheet;
        const _astRest = JSON.parse(JSON.stringify(ast)) as CssStylesheet;
        const _astRoot = _ast.stylesheet;
        const _astRestRoot = _astRest.stylesheet;
        const criticalSelectorsMap = new Map<string, string[]>();

        // Filter rule types we don't want in critical
        let newRules = _astRoot.rules.filter(rule => this.CRITICAL_TYPES_TO_KEEP.includes(rule.type));

        // HANDLE CRITICAL CSS
        newRules = this.processRuleCollection({
            rules: newRules,
            selectorMap,
            criticalSelectorsMap,
            isCritical: true,
        });

        // HANDLE REST CSS
        const astRestRules = _astRestRoot.rules;
        const restRules = this.processRuleCollection({
            rules: astRestRules,
            criticalSelectorsMap,
            isCritical: false,
        });

        _astRoot.rules = newRules;
        _astRestRoot.rules = restRules;

        return [_ast, _astRest];
    }
}

export default CssTransformator;
