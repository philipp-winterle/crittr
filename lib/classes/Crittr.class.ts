import path from 'node:path';
import { pathToFileURL } from 'node:url';
import util from 'node:util';
import log from '@dynamicabot/signales';
import chalk from 'chalk';
import CleanCSS from 'clean-css';
import doDebug from 'debug';
import deepmerge from 'deepmerge';
import fs from 'fs-extra';
import { isPlainObject } from 'is-plain-object';
import postcss from 'postcss';
import sortMediaQueries from 'postcss-sort-media-queries';
import type { Browser, LaunchOptions, Page } from 'puppeteer';
import { KnownDevices } from 'puppeteer';
// puppeteer-extra re-exports puppeteer but its TS types don't expose `.launch`, `.use`,
// or `.devices`. Cast to a structural type that matches runtime behavior.
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import Queue from 'run-queue';

interface PuppeteerExtraLike {
    use: (plugin: unknown) => PuppeteerExtraLike;
    launch: (options?: LaunchOptions) => Promise<Browser>;
}

const puppeteer = puppeteerExtra as unknown as PuppeteerExtraLike;

import DEFAULTS from '../Constants.js';
// The evaluation script is raw JS sent into the Puppeteer context. Keep .js import.
import extractCriticalCss_script from '../evaluation/extract_critical_with_css.js';
import type {
    CriticalSelectorsEntry,
    CrittrOptions,
    CrittrResult,
    CssStylesheet,
    DeviceConfig,
    ResolvedCrittrOptions,
    RuleMap,
} from '../types.js';
import Ast from './Ast.class.js';
import CssTransformator from './CssTransformator.class.js';

const debug = doDebug('crittr:Crittr.class');
const readFilePromise = util.promisify(fs.readFile);
const devices: Record<string, { viewport: DeviceConfig } | undefined> = KnownDevices as unknown as Record<
    string,
    { viewport: DeviceConfig } | undefined
>;
puppeteer.use(StealthPlugin());

interface OptionsError {
    message: string;
}

/**
 * CRITTR Class — extracts critical CSS from one or more URLs.
 */
class Crittr {
    options: ResolvedCrittrOptions;
    private _browser: Browser | null;
    private _cssTransformator: CssTransformator;
    private _cssContent = '';

    constructor(options: CrittrOptions) {
        const defaults: ResolvedCrittrOptions = {
            css: null,
            urls: [],
            timeout: DEFAULTS.TIMEOUT,
            pageLoadTimeout: DEFAULTS.PAGE_LOAD_TIMEOUT,
            outputRemainingCss: DEFAULTS.OUTPUT_REMAINING_CSS,
            browser: {
                userAgent: DEFAULTS.BROWSER_USER_AGENT,
                isCacheEnabled: DEFAULTS.BROWSER_CACHE_ENABLED,
                isJsEnabled: DEFAULTS.BROWSER_JS_ENABLED,
                concurrentTabs: DEFAULTS.BROWSER_CONCURRENT_TABS,
            },
            device: {
                width: DEFAULTS.DEVICE_WIDTH,
                height: DEFAULTS.DEVICE_HEIGHT,
                scaleFactor: DEFAULTS.DEVICE_SCALE_FACTOR,
                isMobile: DEFAULTS.DEVICE_IS_MOBILE,
                hasTouch: DEFAULTS.DEVICE_HAS_TOUCH,
                isLandscape: DEFAULTS.DEVICE_IS_LANDSCAPE,
            },
            puppeteer: {
                browser: null,
                chromePath: null,
                headless: DEFAULTS.PUPPETEER_HEADLESS,
            },
            printBrowserConsole: DEFAULTS.PRINT_BROWSER_CONSOLE,
            dropKeyframes: DEFAULTS.DROP_KEYFRAMES,
            takeScreenshots: DEFAULTS.PAGE_SCREENSHOT,
            screenshotPath: path.join('.'),
            screenshotNameGenerator: DEFAULTS.SCREENSHOT_NAME_GENERATOR,
            keepSelectors: [],
            removeSelectors: [],
            removeDeclarations: [],
            excludeMediaQueries: ['print'],
            blockRequests: [
                'maps.gstatic.com',
                'maps.googleapis.com',
                'googletagmanager.com',
                'google-analytics.com',
                'google.',
                'googleadservices.com',
                'generaltracking.de',
                'bing.com',
                'doubleclick.net',
            ],
        };

        // deepmerge preserves DeviceConfig object shape, but the user may pass a string
        // for `device`, which deepmerge will clobber over the default object. Handle the
        // string case explicitly after merge.
        const merged = deepmerge(defaults, options as Partial<ResolvedCrittrOptions>, {
            isMergeableObject: isPlainObject as (value: object) => boolean,
        }) as unknown as ResolvedCrittrOptions & { device: DeviceConfig | string };

        // Normalize device string → DeviceConfig via puppeteer.devices lookup
        if (typeof merged.device === 'string') {
            const deviceKey = merged.device;
            const device = devices[deviceKey];
            if (device) {
                merged.device = {
                    width: device.viewport.width,
                    height: device.viewport.height,
                    scaleFactor: device.viewport.scaleFactor,
                    isMobile: device.viewport.isMobile,
                    hasTouch: device.viewport.hasTouch,
                    isLandscape: device.viewport.isLandscape,
                };
            } else {
                log.error(
                    "Option 'device' is set as string but has an unknown value. Use devices of puppeteer (https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js) or an object!",
                );
                // Fall back to defaults so the resolved type remains DeviceConfig
                merged.device = defaults.device;
            }
        }

        this.options = merged as ResolvedCrittrOptions;
        this._browser = null;
        this._cssTransformator = new CssTransformator();

        // Validate some of the options like url and css
        const optionsErrors = this.validateOptions();
        if (optionsErrors.length > 0) {
            for (const { message } of optionsErrors) {
                log.error(message);
            }
            throw new Error('crittr stopped working. See errors above.');
        }
    }

    /**
     * Validates parts of the class options to check if they fit the requirements.
     */
    validateOptions(): OptionsError[] {
        const errors: OptionsError[] = [];

        if (!Array.isArray(this.options.urls)) {
            errors.push({ message: 'Urls not an Array' });
        }

        if (Array.isArray(this.options.urls) && this.options.urls.length === 0) {
            errors.push({ message: 'NO URLs to check. Insert at least one url in the urls option!' });
        }

        if (typeof this.options.css !== 'string' && this.options.css !== null) {
            errors.push({
                message: `css not valid. Expected string got ${typeof this.options.css}`,
            });
        }

        if (typeof this.options.screenshotPath !== 'string') {
            errors.push({ message: 'screenshotPath needs to be a string' });
        }

        return errors;
    }

    /**
     * Main execution point of the Crittr class.
     */
    async run(): Promise<CrittrResult> {
        debug('run - Starting run ...');

        let criticalCss = '';
        let restCss = '';

        try {
            debug('run - Starting browser ...');
            this._browser = await this.getBrowser();
            debug('run - Browser started!');
        } catch (err) {
            debug('run - ERROR: Browser could not be launched ... abort!');
            throw err;
        }

        try {
            debug('run - Get css content ...');
            this._cssContent = await this.getCssContent();
            debug('run - Get css content done!');
        } catch (err) {
            debug('run - ERROR while extracting css content');
            throw err;
        }

        let errors: unknown[] = [];
        try {
            debug('run - Starting critical css extraction ...');
            [criticalCss, restCss, errors] = await this.getCriticalCssFromUrls();
            if (errors.length > 0) {
                log.warn('Some of the urls had errors. Please review them below!');
                this.printErrors(errors);
            }
            debug('run - Finished critical css extraction!');
        } catch (err) {
            debug('run - ERROR while critical css extraction');
            throw err;
        }

        try {
            debug('run - Browser closing ...');
            if (!this.options.puppeteer.browser && this._browser) {
                await this._browser.close();
            }
            debug('run - Browser closed!');
        } catch {
            debug('run - ERROR: Browser could not be closed -> already closed?');
        }

        debug('run - Extraction ended!');
        return { critical: criticalCss, rest: restCss };
    }

    /**
     * Returns the browser object of the underlying headless browser.
     */
    async getBrowser(): Promise<Browser> {
        try {
            if (this.options.puppeteer.browser !== null) {
                return this.options.puppeteer.browser;
            }

            // Puppeteer 24 removed `ignoreHTTPSErrors` in favour of
            // `acceptInsecureCerts`, and the `'new'` headless string is gone
            // (`headless: true` is the new-mode default). `PUPPETEER_HEADLESS`
            // may still carry legacy `'new'` at runtime — normalised below.
            const launchOptions = {
                acceptInsecureCerts: true,
                args: ['--disable-setuid-sandbox', '--no-sandbox', '--ignore-certificate-errors', '--disable-dev-shm-usage'],
                dumpio: false,
                headless: this.options.puppeteer.headless,
                executablePath: this.options.puppeteer.chromePath ?? undefined,
                devtools: false,
            } as unknown as LaunchOptions;

            const browser = await puppeteer.launch(launchOptions);
            return browser;
        } catch (e) {
            throw e instanceof Error ? e : new Error(String(e));
        }
    }

    /**
     * Tries to gracefully close a page object to ensure uninterrupted progress.
     */
    async gracefulClosePage(page: Page | null, errors: unknown): Promise<void> {
        this.printErrors(errors);

        if (!page) return;

        try {
            debug('gracefulClosePage - Closing page after error gracefully ...');
            await page.close();
            debug('gracefulClosePage - Page closed gracefully!');
        } catch {
            debug('gracefulClosePage - Error while closing page -> already closed?');
        }
    }

    /**
     * Outputs the errors in a readable way to stdout/stderr.
     */
    printErrors(errors: unknown): void {
        if (!errors) return;

        log.warn(chalk.red('Errors occured during processing. Please have a look and report them if necessary'));
        if (Array.isArray(errors)) {
            for (const error of errors) {
                log.error(error);
            }
        } else {
            log.error(errors);
        }
    }

    /**
     * Returns a page of the underlying browser engine.
     */
    getPage(): Promise<Page> {
        if (!this._browser) {
            return Promise.reject(new Error('Browser is not initialized'));
        }
        return this._browser.newPage() as unknown as Promise<Page>;
    }

    /**
     * Tries to get the contents of the given css file or in case of css string returns the string.
     */
    async getCssContent(): Promise<string> {
        if (typeof this.options.css === 'string') {
            if (this.options.css.endsWith('.css')) {
                const cssString = await readFilePromise(this.options.css, 'utf8');
                if (!cssString || cssString.length === 0) {
                    throw new Error('No CSS content in file exists -> exit!');
                }
                return cssString;
            }
            return this.options.css;
        }

        if (!this.options.css) {
            return this.getCssFromUrl(this.options.urls[0]);
        }

        return '';
    }

    async getCssFromUrl(url: string): Promise<string> {
        const page = await this.getPage();
        debug(`getCssFromUrl - Try to get collect CSS from ${url}`);
        await page.coverage.startCSSCoverage();
        const navigationUrl = this.isLocalFile(url) ? pathToFileURL(url).href : url;
        await page.goto(navigationUrl, {
            waitUntil: 'load',
            timeout: this.options.timeout,
        });
        const cssString = await page.evaluate(() => {
            return [...document.styleSheets]
                .map(styleSheet => {
                    try {
                        return [...styleSheet.cssRules].map(rule => rule.cssText).join('');
                    } catch {
                        console.log('Access to stylesheet %s is denied. Ignoring...', styleSheet.href);
                        return '';
                    }
                })
                .filter(Boolean)
                .join('\n');
        });

        await page.close();
        return cssString;
    }

    /**
     * Starts an url evaluation with all operations to extract the critical css.
     */
    async getCriticalCssFromUrls(): Promise<[string, string, unknown[]]> {
        const errors: unknown[] = [];
        const urls = this.options.urls;
        const criticalAstSets = new Set<CssStylesheet>();
        const restAstSets = new Set<CssStylesheet>();
        const sourceCssAst = this._cssTransformator.getAst(this._cssContent);
        if (!sourceCssAst) {
            throw new Error('Could not parse source CSS to AST');
        }

        const queue = new Queue({
            maxConcurrency: this.options.browser.concurrentTabs,
        });

        const queueEvaluateFn = async (
            url: string,
            ast: CssStylesheet,
            criticalSets: Set<CssStylesheet>,
            restSets: Set<CssStylesheet>,
        ): Promise<void> => {
            try {
                debug(`getCriticalCssFromUrls - Try to get critical ast from ${url}`);
                const [criticalAst, restAst] = await this.evaluateUrl(url, ast);
                if (criticalAst) criticalSets.add(criticalAst);
                if (restAst) restSets.add(restAst);
                debug('getCriticalCssFromUrls - Successfully extracted critical ast!');
            } catch (err) {
                debug('getCriticalCssFromUrls - ERROR getting critical ast from promise');
                log.error(`Could not get critical ast for url ${url}`);
                log.error(err);
                errors.push(err);
            }
        };

        for (const url of urls) {
            queue.add(1, queueEvaluateFn, [url, sourceCssAst, criticalAstSets, restAstSets]);
        }

        await queue.run();

        if (criticalAstSets.size === 0) {
            throw errors;
        }

        // Create the Rule Maps for further iteration
        debug(`getCriticalCssFromUrls - Merging multiple atf ast objects. Size: ${criticalAstSets.size}`);
        let atfRuleMap: RuleMap = new Map();
        for (const astObj of criticalAstSets) {
            try {
                atfRuleMap = Ast.generateRuleMap(astObj, atfRuleMap);
            } catch (err) {
                debug('getCriticalCssFromUrls - ERROR merging multiple atf ast objects');
                throw err;
            }
        }
        debug('getCriticalCssFromUrls - Merging multiple atf ast objects - finished');

        // Only do the more time consuming steps if needed
        let restRuleMap: RuleMap = new Map();
        if (this.options.outputRemainingCss) {
            debug(`getCriticalCssFromUrls - Merging multiple rest ast objects. Size: ${restAstSets.size}`);
            for (const astObj of restAstSets) {
                try {
                    restRuleMap = Ast.generateRuleMap(astObj, restRuleMap);
                } catch (err) {
                    debug('getCriticalCssFromUrls - ERROR merging multiple rest ast objects');
                    throw err;
                }
            }
            debug('getCriticalCssFromUrls - Merging multiple rest ast objects - finished');

            // Filter rules out of restRuleMap which already exists in atfRuleMap
            debug('getCriticalCssFromUrls - Filter duplicates of restMap');
            for (const [atfRuleKey, atfRuleObj] of atfRuleMap) {
                if (restRuleMap.has(atfRuleKey)) {
                    let restRuleArr = restRuleMap.get(atfRuleKey) ?? [];
                    restRuleArr = restRuleArr.filter(ruleObj => !atfRuleObj.some(atfRule => ruleObj.hash === atfRule.hash));
                    if (restRuleArr.length > 0) {
                        restRuleMap.set(atfRuleKey, restRuleArr);
                    } else {
                        restRuleMap.delete(atfRuleKey);
                    }
                }
            }
            debug('getCriticalCssFromUrls - Filter duplicates of restMap - finished');
        }

        // CleanCSS Config
        const ccss = new CleanCSS({
            compatibility: '*',
            properties: {
                backgroundClipMerging: false,
                backgroundOriginMerging: false,
                backgroundSizeMerging: false,
                colors: false,
                ieBangHack: false,
                ieFilters: false,
                iePrefixHack: false,
                ieSuffixHack: false,
                merging: true,
                shorterLengthUnits: false,
                spaceAfterClosingBrace: true,
                urlQuotes: true,
                zeroUnits: false,
            },
            selectors: {
                adjacentSpace: false,
                ie7Hack: true,
                mergeLimit: 1000,
                multiplePseudoMerging: false,
            },
            level: {
                1: {
                    all: false,
                    cleanupCharsets: true,
                    removeWhitespace: false,
                },
                2: {
                    mergeAdjacentRules: true,
                    mergeIntoShorthands: false,
                    mergeMedia: true,
                    mergeNonAdjacentRules: true,
                    mergeSemantically: false,
                    overrideProperties: true,
                    removeEmpty: true,
                    reduceNonAdjacentRules: true,
                    removeDuplicateFontRules: true,
                    removeDuplicateMediaBlocks: true,
                    removeDuplicateRules: true,
                    removeUnusedAtRules: false,
                    restructureRules: false,
                },
            },
        } as unknown as CleanCSS.OptionsOutput);

        // Create the AST Objects out of the RuleMaps to be able to convert them back to CSS
        debug('getCriticalCssFromUrls - Creating AST Object of atf ruleMap');
        const finalAtfAst = Ast.getAstOfRuleMap(atfRuleMap);
        let finalCss = this._cssTransformator.getCssFromAst(finalAtfAst);
        const atfMinifyResult = ccss.minify(finalCss) as unknown as { styles: string };
        finalCss = atfMinifyResult.styles;
        finalCss = (await postcss([sortMediaQueries({ sort: 'mobile-first' })]).process(finalCss, { from: undefined })).css;

        // Handle restCSS
        let finalRestCss = '';
        if (this.options.outputRemainingCss) {
            debug('getCriticalCssFromUrls - Filter duplicates of restMap');
            for (const [atfRuleKey, atfRuleObj] of atfRuleMap) {
                if (restRuleMap.has(atfRuleKey)) {
                    let restRuleArr = restRuleMap.get(atfRuleKey) ?? [];
                    restRuleArr = restRuleArr.filter(ruleObj => !atfRuleObj.some(atfRule => ruleObj.hash === atfRule.hash));
                    if (restRuleArr.length > 0) {
                        restRuleMap.set(atfRuleKey, restRuleArr);
                    } else {
                        restRuleMap.delete(atfRuleKey);
                    }
                }
            }
            debug('getCriticalCssFromUrls - Filter duplicates of restMap - finished');

            const finalRestAst = Ast.getAstOfRuleMap(restRuleMap);
            finalRestCss = this._cssTransformator.getCssFromAst(finalRestAst);
            const restMinifyResult = ccss.minify(finalRestCss) as unknown as { styles: string };
            finalRestCss = restMinifyResult.styles;
            finalRestCss = (await postcss([sortMediaQueries({ sort: 'mobile-first' })]).process(finalRestCss, { from: undefined })).css;
        }

        return [finalCss, finalRestCss, errors];
    }

    isRetriableUrlEvaluationError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        if (error.name === 'TimeoutError') {
            return true;
        }

        return /timeout|target closed|session closed|execution context was destroyed|page crashed|navigation|net::err/i.test(error.message);
    }

    /**
     * Evaluates an url and retries transient browser failures that are more common in CI.
     */
    async evaluateUrl(url: string, sourceAst: CssStylesheet): Promise<[CssStylesheet | null, CssStylesheet | null]> {
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.evaluateUrlOnce(url, sourceAst);
            } catch (error) {
                const shouldRetry = attempt < maxAttempts && this.isRetriableUrlEvaluationError(error);
                if (!shouldRetry) {
                    throw error;
                }

                log.warn(`Transient browser error while processing ${url}. Retry ${attempt} of ${maxAttempts - 1}.`);
                await new Promise(resolve => setTimeout(resolve, attempt * 250));
            }
        }

        throw new Error(`Failed to evaluate ${url}`);
    }

    /**
     * Performs a single evaluation pass for a URL.
     */
    async evaluateUrlOnce(url: string, sourceAst: CssStylesheet): Promise<[CssStylesheet | null, CssStylesheet | null]> {
        let retryCounter = 3;
        let hasError: unknown | false = false;
        let page: Page | null = null;
        let criticalSelectorsMap = new Map<string, CriticalSelectorsEntry>();
        let criticalAstObj: CssStylesheet | null = null;
        let restAstObj: CssStylesheet | null = null;

        const getPage = async (): Promise<Page> => {
            try {
                return await this.getPage();
            } catch (err) {
                if (retryCounter-- > 0) {
                    log.warn(`Could not get page from browser. Retry ${retryCounter} times.`);
                    return getPage();
                }
                log.warn('Tried to get page but failed. Abort now ...');
                throw err;
            }
        };

        try {
            debug('evaluateUrl - Open new Page-Tab ...');
            page = await getPage();
            if (this.options.printBrowserConsole === true) {
                page.on('console', msg => {
                    const args = msg.args();
                    for (let i = 0; i < args.length; ++i) {
                        log.log(`${args[i]}`);
                    }
                });
                page.on('pageerror', err => {
                    log.log(`Page error: ${String(err)}`);
                });
                page.on('error', err => {
                    log.log(`Error: ${String(err)}`);
                });
            }
            debug('evaluateUrl - Page-Tab opened!');
        } catch (err) {
            debug('evaluateUrl - Error while opening page tab -> abort!');
            hasError = err;
        }

        // Set Page properties
        if (hasError === false && page) {
            try {
                const browserOptions = this.options.browser;
                const deviceOptions = this.options.device;
                debug('evaluateUrl - Set page properties ...');
                await page.setCacheEnabled(browserOptions.isCacheEnabled);
                await page.setJavaScriptEnabled(browserOptions.isJsEnabled);
                await page.setRequestInterception(true);

                const blockRequests = this.options.blockRequests;

                page.on('request', interceptedRequest => {
                    const requestUrl = interceptedRequest.url();
                    if (blockRequests) {
                        for (const blockedUrl of blockRequests) {
                            if (requestUrl.includes(blockedUrl)) {
                                interceptedRequest.abort();
                                return;
                            }
                        }
                    }
                    interceptedRequest.continue();
                });

                page.on('error', err => {
                    hasError = err;
                });

                await page.emulate({
                    viewport: {
                        width: deviceOptions.width,
                        height: deviceOptions.height,
                        deviceScaleFactor: deviceOptions.scaleFactor,
                        isMobile: deviceOptions.isMobile,
                        hasTouch: deviceOptions.hasTouch,
                        isLandscape: deviceOptions.isLandscape,
                    },
                    userAgent: browserOptions.userAgent,
                });

                debug('evaluateUrl - Page properties set!');
            } catch (err) {
                debug('evaluateUrl - Error while setting page properties -> abort!');
                hasError = err;
            }
        }

        // Go to destination page
        if (hasError === false && page) {
            try {
                debug(`evaluateUrl - Navigating page to ${url}`);

                if (this.isLocalFile(url)) {
                    let cleanedUrl = url;
                    if (cleanedUrl.includes('?')) {
                        cleanedUrl = cleanedUrl.substring(0, cleanedUrl.indexOf('?'));
                    }
                    if (cleanedUrl.includes('#')) {
                        cleanedUrl = cleanedUrl.substring(0, cleanedUrl.indexOf('#'));
                    }

                    if (path.isAbsolute(cleanedUrl)) {
                        // Absolute paths must be navigated as file:// URLs so that
                        // Chrome resolves relative resources (CSS, images) correctly.
                        await page.goto(pathToFileURL(cleanedUrl).href, {
                            timeout: this.options.timeout,
                            waitUntil: 'load',
                        });
                    } else {
                        const htmlContent = await fs.readFile(path.join(DEFAULTS.PROJECT_DIR, cleanedUrl), 'utf8');
                        await page.setContent(htmlContent);
                    }
                } else {
                    // `networkidle2` is flaky in CI; `load` matches getCssFromUrl.
                    await page.goto(url, {
                        timeout: this.options.timeout,
                        waitUntil: 'load',
                    });
                }

                debug('evaluateUrl - Page navigated');
            } catch (err) {
                debug(`evaluateUrl - Error while page.goto -> ${url}`);
                hasError = err;
            }
        }

        if (hasError === false && page) {
            try {
                debug('evaluateUrl - Extracting critical selectors');
                await new Promise(r => setTimeout(r, 250));
                if (this.options.takeScreenshots === true) {
                    let screenName = `${url.replace(/[^\w\s]/gi, '_')}.png`;
                    if (typeof this.options.screenshotNameGenerator === 'function') {
                        const screenGeneratedName = await this.options.screenshotNameGenerator(url);
                        screenName = `${screenGeneratedName}.png`;
                    }

                    await fs.mkdirp(this.options.screenshotPath);
                    await page.screenshot({
                        path: path.join(this.options.screenshotPath, screenName) as `${string}.png`,
                        type: 'png',
                    });
                }

                const evalFn = extractCriticalCss_script as Parameters<typeof page.evaluate>[0];
                const evalResult = (await page.evaluate(evalFn, {
                    sourceAst,
                    loadTimeout: this.options.pageLoadTimeout,
                    keepSelectors: this.options.keepSelectors,
                    removeSelectors: this.options.removeSelectors,
                    dropKeyframes: this.options.dropKeyframes,
                } as unknown as never)) as unknown as Array<[string, CriticalSelectorsEntry]>;

                criticalSelectorsMap = new Map(evalResult);
                debug(`evaluateUrl - Extracting critical selectors - successful! Length: ${criticalSelectorsMap.size}`);
            } catch (err) {
                debug('evaluateUrl - Error while extracting critical selectors -> not good!');
                hasError = err;
            }

            debug('evaluateUrl - cleaning up AST with criticalSelectorMap');
            const [criticalAst, restAst] = this._cssTransformator.filterByMap(
                sourceAst,
                criticalSelectorsMap,
                this.options.removeDeclarations,
                this.options.excludeMediaQueries,
            );
            criticalAstObj = criticalAst;
            restAstObj = restAst;
            debug('evaluateUrl - cleaning up AST with criticalSelectorMap - END');
        }

        if (hasError === false && page) {
            try {
                debug('evaluateUrl - Closing page ...');
                await page.close();
                debug('evaluateUrl - Page closed');
            } catch (err) {
                hasError = err;
                debug('evaluateUrl - Error while closing page -> already closed?');
            }
        }

        if (hasError !== false) {
            try {
                await this.gracefulClosePage(page, hasError);
            } catch {
                // swallow — original behavior was to ignore secondary close errors
            }
            throw hasError;
        }

        return [criticalAstObj, restAstObj];
    }

    isLocalFile(url: string): boolean {
        // Windows absolute paths (e.g. "d:\\path\\file.html") are accepted by the
        // URL constructor with "d:" as the scheme — so we must guard with isAbsolute first.
        if (path.isAbsolute(url)) {
            debug('{url} is an absolute local path');
            return true;
        }
        try {
            new URL(url);
            debug('{url} is a real url');
            return false;
        } catch {
            debug('{url} is a local file');
            return true;
        }
    }
}

export { Crittr, Crittr as default };
