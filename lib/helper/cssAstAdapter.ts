/**
 * PostCSS <-> reworkcss/css@3 shape adapter.
 *
 * Why this exists:
 *   crittr's internal AST shape matches `reworkcss/css@3` (the unmaintained
 *   `css` package). The shape is also serialized across the Puppeteer
 *   `page.evaluate` boundary in `lib/evaluation/extract_critical_with_css.js`,
 *   so it is fixed by contract — PostCSS `Root`/`Node` instances don't
 *   JSON-round-trip through the DevTools protocol.
 *
 * What this does:
 *   - `parseCss(content)`  -> reworkcss-shaped CssStylesheet
 *   - `stringifyCss(ast)`  -> CSS string (via PostCSS emitter)
 *
 * PostCSS is used as the parser/serializer only. The internal traversal
 * logic in CssTransformator, Rule, Ast, and the browser script keeps
 * operating on the reworkcss JSON shape.
 */

import postcss, {
    type AtRule,
    type ChildNode,
    type Container,
    type Declaration,
    type Comment as PostcssComment,
    type Rule as PostcssRule,
    type Root,
} from 'postcss';

import type {
    AnyCssRule,
    CssCharset,
    CssComment,
    CssDeclaration,
    CssFontFace,
    CssKeyframe,
    CssKeyframes,
    CssMediaRule,
    CssRule,
    CssStylesheet,
    CssSupportsRule,
} from '../types.js';

interface ParseOptions {
    silent?: boolean;
    source?: string;
}

// ---------------------------------------------------------------------------
// Parse: PostCSS Root -> reworkcss CssStylesheet
// ---------------------------------------------------------------------------

export function parseCss(cssContent: string, opts: ParseOptions = {}): CssStylesheet {
    const parsingErrors: Error[] = [];
    let root: Root;

    try {
        root = postcss.parse(cssContent, {
            from: opts.source,
        });
    } catch (err) {
        if (opts.silent) {
            parsingErrors.push(err instanceof Error ? err : new Error(String(err)));
            return {
                type: 'stylesheet',
                stylesheet: { rules: [], parsingErrors },
            };
        }
        throw err;
    }

    const rules = convertChildren(root);

    return {
        type: 'stylesheet',
        stylesheet: {
            rules,
            ...(parsingErrors.length > 0 ? { parsingErrors } : {}),
        },
    };
}

function convertChildren(container: Container): AnyCssRule[] {
    const out: AnyCssRule[] = [];
    container.each((node: ChildNode) => {
        const converted = convertNode(node);
        if (converted) out.push(converted);
    });
    return out;
}

function convertNode(node: ChildNode): AnyCssRule | null {
    switch (node.type) {
        case 'rule':
            return convertRule(node);
        case 'atrule':
            return convertAtRule(node);
        case 'comment':
            return convertComment(node);
        default:
            return null;
    }
}

function convertRule(node: PostcssRule): CssRule {
    return {
        type: 'rule',
        selectors: splitSelectors(node.selector),
        declarations: convertDeclarations(node),
    };
}

function convertAtRule(node: AtRule): AnyCssRule | null {
    const { name, params } = node;
    // Normalize vendor-prefixed keyframes: -webkit-keyframes -> name=keyframes, vendor=-webkit-
    const keyframesMatch = /^(-[a-z]+-)?keyframes$/.exec(name);
    if (keyframesMatch) {
        const vendor = keyframesMatch[1] ?? '';
        return convertKeyframes(node, params, vendor);
    }

    switch (name) {
        case 'media':
            return {
                type: 'media',
                media: params,
                rules: convertChildren(node),
            } satisfies CssMediaRule;
        case 'supports':
            return {
                type: 'supports',
                supports: params,
                rules: convertChildren(node),
            } satisfies CssSupportsRule;
        case 'font-face':
            return {
                type: 'font-face',
                declarations: convertDeclarations(node),
            } satisfies CssFontFace;
        case 'charset':
            return {
                type: 'charset',
                charset: params,
            } satisfies CssCharset;
        default:
            // Unknown at-rule: drop. reworkcss supports some variants (document,
            // host, namespace, page) — not currently used by crittr tests, so
            // omit until needed.
            return null;
    }
}

function convertKeyframes(node: AtRule, name: string, vendor: string): CssKeyframes {
    const keyframes: CssKeyframe[] = [];
    node.each((child: ChildNode) => {
        if (child.type === 'rule') {
            keyframes.push({
                type: 'keyframe',
                values: splitSelectors(child.selector),
                declarations: convertDeclarations(child),
            });
        }
    });
    const result: CssKeyframes = {
        type: 'keyframes',
        name,
        keyframes,
    };
    if (vendor) result.vendor = vendor;
    return result;
}

function convertDeclarations(container: Container): CssDeclaration[] {
    const out: CssDeclaration[] = [];
    container.each((child: ChildNode) => {
        if (child.type === 'decl') {
            const decl = child as Declaration;
            out.push({
                type: 'declaration',
                property: decl.prop,
                value: decl.value,
            });
        }
    });
    return out;
}

function convertComment(node: PostcssComment): CssComment {
    return {
        type: 'comment',
        comment: node.text,
    };
}

function splitSelectors(raw: string): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

// ---------------------------------------------------------------------------
// Stringify: reworkcss CssStylesheet -> CSS string
// Strategy: rebuild a PostCSS Root, then call .toString().
// ---------------------------------------------------------------------------

export function stringifyCss(ast: CssStylesheet): string {
    const root = postcss.root();
    for (const rule of ast.stylesheet.rules) {
        const node = buildNode(rule);
        if (node) root.append(node);
    }
    return root.toString();
}

function buildNode(rule: AnyCssRule): ChildNode | null {
    switch (rule.type) {
        case 'rule':
            return buildRule(rule as CssRule);
        case 'media':
            return buildAtRuleContainer('media', (rule as CssMediaRule).media, (rule as CssMediaRule).rules);
        case 'supports':
            return buildAtRuleContainer('supports', (rule as CssSupportsRule).supports, (rule as CssSupportsRule).rules);
        case 'font-face': {
            const atrule = postcss.atRule({ name: 'font-face' });
            appendDeclarations(atrule, (rule as CssFontFace).declarations ?? []);
            return atrule;
        }
        case 'charset':
            return postcss.atRule({
                name: 'charset',
                params: (rule as CssCharset).charset,
            });
        case 'keyframes': {
            const kf = rule as CssKeyframes;
            const name = `${kf.vendor ?? ''}keyframes`;
            const atrule = postcss.atRule({ name, params: kf.name });
            for (const frame of kf.keyframes) {
                atrule.append(buildKeyframe(frame));
            }
            return atrule;
        }
        case 'comment':
            return postcss.comment({ text: (rule as CssComment).comment });
        default:
            return null;
    }
}

function buildRule(rule: CssRule): PostcssRule {
    const selector = (rule.selectors ?? []).join(', ');
    const node = postcss.rule({ selector });
    appendDeclarations(node, rule.declarations ?? []);
    if (rule.rules) {
        for (const child of rule.rules) {
            const built = buildNode(child);
            if (built) node.append(built);
        }
    }
    return node;
}

function buildAtRuleContainer(name: string, params: string, children: AnyCssRule[]): AtRule {
    const node = postcss.atRule({ name, params });
    for (const child of children) {
        const built = buildNode(child);
        if (built) node.append(built);
    }
    return node;
}

function buildKeyframe(frame: CssKeyframe): PostcssRule {
    const selector = frame.values.join(', ');
    const node = postcss.rule({ selector });
    appendDeclarations(node, frame.declarations ?? []);
    return node;
}

function appendDeclarations(container: Container, declarations: CssDeclaration[]): void {
    for (const decl of declarations) {
        container.append(postcss.decl({ prop: decl.property, value: decl.value }));
    }
}
