/**
 * Zentrale, öffentlich exportierte Types für crittr.
 *
 * Quelle: `_workspace/00_api_types.md` (Phase 0). Die Types spiegeln die tatsächliche
 * Runtime-Shape von `Crittr.class` und `index.js` wider — nicht die veralteten JSDoc
 * Tupel-Signaturen.
 */

import type { Browser } from 'puppeteer';

/** Funktion, die aus einer URL einen Dateinamen (ohne Endung `.png`) erzeugt. */
export type ScreenshotNameGenerator = (url: string) => string | Promise<string>;

export interface BrowserOptions {
    userAgent: string;
    isCacheEnabled: boolean;
    isJsEnabled: boolean;
    concurrentTabs: number;
}

export interface DeviceConfig {
    width: number;
    height: number;
    scaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
    isLandscape: boolean;
}

/**
 * Puppeteer-Launch-Options (Teilmenge, die crittr nach außen anbietet).
 *
 * Puppeteer 24: `'new'` is obsolete (gleich `true`). `'shell'` existiert
 * weiter, `true`/`false` bleibt der Hauptschalter.
 */
export interface PuppeteerOptions {
    browser: Browser | null;
    chromePath: string | null;
    headless: boolean | 'shell';
}

export type DeclarationMatcher = string | RegExp | ((property: string, value: string) => boolean);

export interface CrittrOptions {
    css?: string | null;
    urls: ReadonlyArray<string>;
    timeout?: number;
    pageLoadTimeout?: number;
    outputRemainingCss?: boolean;
    browser?: Partial<BrowserOptions>;
    device?: string | Partial<DeviceConfig>;
    puppeteer?: Partial<PuppeteerOptions>;
    printBrowserConsole?: boolean;
    dropKeyframes?: boolean;
    takeScreenshots?: boolean;
    screenshotPath?: string;
    screenshotNameGenerator?: ScreenshotNameGenerator | null;
    keepSelectors?: ReadonlyArray<string>;
    removeSelectors?: ReadonlyArray<string>;
    blockRequests?: ReadonlyArray<string>;
    removeDeclarations?: ReadonlyArray<DeclarationMatcher>;
}

/**
 * Intern verwendete, voll gemergte Options. Alle Felder konkret.
 *
 * `device` wird vom Constructor aus `string` zu {@link DeviceConfig} normalisiert
 * (siehe `puppeteer.devices[name].viewport`), daher ist der resolved-Typ `DeviceConfig`.
 */
export interface ResolvedCrittrOptions {
    css: string | null;
    urls: string[];
    timeout: number;
    pageLoadTimeout: number;
    outputRemainingCss: boolean;
    browser: BrowserOptions;
    device: DeviceConfig;
    puppeteer: PuppeteerOptions;
    printBrowserConsole: boolean;
    dropKeyframes: boolean;
    takeScreenshots: boolean;
    screenshotPath: string;
    screenshotNameGenerator: ScreenshotNameGenerator | null;
    keepSelectors: string[];
    removeSelectors: string[];
    blockRequests: string[];
    removeDeclarations: DeclarationMatcher[];
}

export interface CrittrResult {
    critical: string | null;
    rest: string | null;
}

// ---------------------------------------------------------------------------
// CSS AST (reworkcss/css@3 Shape). Wird in Phase 5 bei Migration auf postcss
// evtl. ersetzt. Bis dahin ist das die maßgebliche Shape.
// ---------------------------------------------------------------------------

export type CssAstNodeType =
    | 'stylesheet'
    | 'rule'
    | 'media'
    | 'supports'
    | 'charset'
    | 'font-face'
    | 'keyframes'
    | 'keyframe'
    | 'comment'
    | 'declaration';

export interface CssDeclaration {
    type: 'declaration';
    property: string;
    value: string;
}

export interface CssRule {
    type: 'rule';
    selectors?: string[];
    declarations?: CssDeclaration[];
    rules?: AnyCssRule[];
    [key: string]: unknown;
}

export interface CssMediaRule {
    type: 'media';
    media: string;
    rules: AnyCssRule[];
    [key: string]: unknown;
}

export interface CssSupportsRule {
    type: 'supports';
    supports: string;
    rules: AnyCssRule[];
    [key: string]: unknown;
}

export interface CssKeyframes {
    type: 'keyframes';
    name: string;
    vendor?: string;
    keyframes: CssKeyframe[];
    [key: string]: unknown;
}

export interface CssKeyframe {
    type: 'keyframe';
    values: string[];
    declarations: CssDeclaration[];
    [key: string]: unknown;
}

export interface CssCharset {
    type: 'charset';
    charset: string;
    [key: string]: unknown;
}

export interface CssFontFace {
    type: 'font-face';
    declarations: CssDeclaration[];
    [key: string]: unknown;
}

export interface CssComment {
    type: 'comment';
    comment: string;
    [key: string]: unknown;
}

export type AnyCssRule = CssRule | CssMediaRule | CssSupportsRule | CssKeyframes | CssKeyframe | CssCharset | CssFontFace | CssComment;

export interface CssStylesheet {
    type: 'stylesheet';
    stylesheet: {
        rules: AnyCssRule[];
        parsingErrors?: Error[];
    };
}

/** Entry in einer RuleMap — ein AST-Rule mit zugehörigem MD5-Hash. */
export interface RuleMapEntry {
    hash: string;
    rule: AnyCssRule;
}

export type RuleMap = Map<string, RuleMapEntry[]>;

/** Entry in `criticalSelectorsMap`, die aus `page.evaluate` zurückkommt. */
export interface CriticalSelectorsEntry {
    selectors: string[];
}
