"use strict";

const path            = require('path');
const url             = require('url');
const fs              = require('fs-extra');
const util            = require('util');
const readFilePromise = util.promisify(fs.readFile);
const _               = require('lodash');
const debug           = require('debug')("CriticalExtractor Class");
const log             = require('signale');
const chalk           = require('chalk');
const merge           = require('deepmerge');
const puppeteer       = require('puppeteer');
const devices         = require('puppeteer/DeviceDescriptors');
const DEFAULTS        = require('../Constants');

const CssTransformator          = require('./CssTransformator.class');
const extractCriticalCss_script = require('../browser/extract_critical_with_css');

class CriticalExtractor {

    /**
     *
     * @param options
     * @returns {Promise<any>}
     */
    constructor(options) {
        this.options = {
            css:                 null,
            urls:                [],
            timeout:             DEFAULTS.TIMEOUT,
            pageLoadTimeout:     DEFAULTS.PAGE_LOAD_TIMEOUT,
            renderTimeout:       DEFAULTS.PAGE_RENDER_TIMEOUT,
            browser:             {
                userAgent:      DEFAULTS.USER_AGENT,
                isCacheEnabled: DEFAULTS.BROWSER_CACHE_ENABLED,
                isJsEnabled:    DEFAULTS.BROWSER_JS_ENABLED
            },
            device:              {
                width:       DEFAULTS.DEVICE_WIDTH,
                height:      DEFAULTS.DEVICE_HEIGHT,
                scaleFactor: DEFAULTS.DEVICE_SCALE_FACTOR,
                isMobile:    DEFAULTS.DEVICE_IS_MOBILE,
                hasTouch:    DEFAULTS.DEVICE_HAS_TOUCH,
                isLandscape: DEFAULTS.DEVICE_IS_LANDSCAPE
            },
            puppeteer:           {
                browser:    null,
                chromePath: null
            },
            printBrowserConsole: false,
            dropKeyframes:       true,
            keepSelectors:       [],
            removeSelectors:     [],
            blockRequests:       [
                "maps.gstatic.com",
                "maps.googleapis.com",
                "googletagmanager.com",
                "google-analytics.com",
                "google.",
                "googleadservices.com",
                "generaltracking.de",
                "bing.com",
                "doubleclick.net"
            ]

        };
        this.options = merge(this.options, options);

        this._browser          = null;
        this._cssTransformator = new CssTransformator();

        // Check device
        if (typeof this.options.device === "string") {
            if (devices[this.options.device]) {
                this.options.device = devices[this.options.device].viewport;
            } else {
                log.error("Option 'device' is set as string but has an unknown value. Use devices of puppeteer (https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js) or an object!");
            }
        }

        // Validate some of the options like url and css
        const optionsErrors = this.validateOptions();

        if (optionsErrors.length > 0) {
            optionsErrors.forEach(({message}) => {
                log.error(message);
            });
            // Exit process when options are invalid
            process.exit(1);
        }
    }

    /**
     *
     * @returns {Array}
     */
    validateOptions() {
        const errors = [];
        // Check url
        if (!Array.isArray(this.options.urls)) {
            errors.push({
                message: "Url not valid"
            });
        }

        if (typeof this.options.css !== "string") {
            errors.push({
                message: "css not valid. Expected string got " + typeof this.options.css
            });
        }
        return errors;
    }

    run() {
        return new Promise(async (resolve, reject) => {
            debug("run - Starting run ...");

            let criticalCss = "";
            let errors      = [];

            try {
                debug("run - Get css content ...");
                this._cssContent = await this.getCssContent();
                debug("run - Get css content done!");
            } catch (err) {
                debug("run - ERROR while extracting css content");
                reject(err);
            }

            try {
                debug("run - Starting browser ...");
                this._browser = await this.getBrowser();
                debug("run - Browser started!");
            } catch (err) {
                debug("run - ERROR: Browser could not be launched ... abort!");
                reject(err);
            }

            try {
                debug("run - Starting critical css extraction ...");
                [criticalCss, errors] = await this.getCriticalCssFromUrls();
                if (errors.length > 0) {
                    log.warn("Some of the urls had errors. Please review them below!");
                    this.printErrors(errors);
                }
                debug("run - Finished critical css extraction!");
            } catch (err) {
                debug("run - ERROR while critical css extraction");
                reject(err);
            }

            try {
                debug("run - Browser closing ...");
                await this._browser.close();
                debug("run - Browser closed!");
            } catch (err) {
                debug("run - ERROR: Browser could not be closed -> already closed?");
            }

            debug("run - Extraction ended!");
            resolve(criticalCss);
        });
    }

    /**
     *
     * @returns {Promise}
     */
    getBrowser() {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.options.puppeteer.browser !== null) {
                    resolve(this.options.puppeteer.browser);
                }
                const browser = await puppeteer.launch({
                    ignoreHTTPSErrors: true,
                    args:              [
//                        '--disable-setuid-sandbox',
                        '--no-sandbox',
                        '--ignore-certificate-errors'
//                        '--no-gpu'
                    ],
                    dumpio:            false,
                    headless:          true,
                    executablePath:    this.options.puppeteer.chromePath
                }).then(browser => {
                    return browser;
                });

                resolve(browser);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     *
     * @param page
     * @param errors {Array<Error>}
     * @returns {Promise<any>}
     */
    gracefulClosePage(page, errors) {
        return new Promise(async (resolve, reject) => {

            this.printErrors(errors);

            try {
                debug("gracefulClosePage - Closing page after error gracefully ...");
                await page.close();
                debug("gracefulClosePage - Page closed gracefully!");
            } catch (err) {
                debug("gracefulClosePage - Error while closing page -> already closed?");
            }
            resolve();
        });
    }

    printErrors(errors) {
        if (errors) {
            log.warn(chalk.red("Errors occured during processing. Please have a look and report them if necessary"));
            if (Array.isArray(errors)) {
                for (let error of errors) {
                    log.error(error);
                }
            } else {
                log.error(errors);
            }
        }
    }

    /**
     *
     *
     * @returns {Promise<Page>}
     */
    getPage() {
        return this._browser.newPage();
    }

    getCssContent() {
        return new Promise(async (resolve, reject) => {
            if (typeof this.options.css === "string") {
                let cssString = "";
                if (this.options.css.endsWith(".css")) {
                    try {
                        cssString = await readFilePromise(this.options.css, "utf8");
                        if (cssString.length === 0) {
                            reject(new Error("No CSS content in file exists -> exit!"));
                        }
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    cssString = this.options.css;
                }

                resolve(cssString);
            } else {
                resolve(false);
            }
        });
    }

    getCriticalCssFromUrls() {
        return new Promise(async (resolve, reject) => {
            let errors                    = [];
            const urls                    = this.options.urls;
            const browserPagesPromisesSet = new Set();
            const criticalAstSets         = new Set();
            const sourceCssAst            = this._cssTransformator.getAst(this._cssContent);

            // Iterate over the array of urls and create a promise for every url
            for (let url of urls) {
                browserPagesPromisesSet.add({
                    promise: this.evaluateUrl(url, sourceCssAst),
                    url:     url
                });
            }

            // Iterate over the evaluation promises and get the results of each
            if (browserPagesPromisesSet.size > 0) {
                // All pages are evaluted?
                for (let pagePromiseObj of browserPagesPromisesSet) {
                    let criticalAst = null;
                    try {
                        debug("getCriticalCssFromUrls - Try to get critical ast from " + pagePromiseObj.url);
                        criticalAst = await pagePromiseObj.promise;
                        debug("getCriticalCssFromUrls - Successfully extracted critical ast!");
                        criticalAstSets.add(criticalAst);
                    } catch (err) {
                        debug("getCriticalCssFromUrls - ERROR getting critical ast from promise");
                        log.error("Could not get critical ast for url " + pagePromiseObj.url);
                        log.error(err);
                        errors.push(err);
                    }
                }
            }

            if (criticalAstSets.size === 0) {
                reject(errors);
            }

            // Go through the critical set and create one out of many
            let finalAst = {
                "type":       "stylesheet",
                "stylesheet": {
                    "rules": []
                }
            };

            for (let astMap of criticalAstSets) {
                try {
                    // Filter selectors which have to be force removed
                    astMap   = this._cssTransformator.filterSelector(astMap, this.options.removeSelectors);
                    // Merge all extracted ASTs into a final one
                    finalAst = await this._cssTransformator.merge(finalAst, astMap);
                } catch (err) {
                    reject(err);
                }
            }

            // TODO: Filter AST by keepSelectors
            // remember to use wildcards. Greedy seems to be the perfect fit
            // Just *selector* matches all selector that have at least selector in their string
            // *sel* needs only sel and so on

            const finalCss = this._cssTransformator.getCssFromAst(finalAst);
            resolve([finalCss.code, errors]);
        }); // End of Promise
    }

    /**
     * Evaluates an url and returns the critical AST Object
     *
     * @param url
     * @param sourceAst
     * @returns {Promise<Object>}
     */
    evaluateUrl(url, sourceAst) {
        return new Promise(async (resolve, reject) => {
            let retryCounter         = 3;
            let hasError             = false;
            let page                 = null;
            let criticalSelectorsMap = new Map();
            let criticalAst          = null;

            // TODO: handle goto errors with retry

            const getPage = async () => {
                return new Promise((resolve, reject) => {
                    try {
                        this.getPage()
                            .then(page => {
                                resolve(page);
                            })
                            .catch(err => {
                                if (retryCounter-- > 0) {
                                    log.warn("Could not get page from browser. Retry " + retryCounter + " times.");
                                    resolve(getPage());
                                } else {
                                    log.warn("Tried to get page but failed. Abort now ...");
                                    reject(err);
                                }
                            });
                    } catch (err) {
                        reject(err);
                    }
                })
            };

            try {
                debug("evaluateUrl - Open new Page-Tab ...");
                page = await getPage();
                if (this.options.printBrowserConsole === true) {
                    page.on('console', msg => {
                        const args = msg.args();
                        for (let i = 0; i < args.length; ++i)
                            log.log(`${args[i]}`);
                    });
                }
                debug("evaluateUrl - Page-Tab opened!");
            } catch (err) {
                debug("evaluateUrl - Error while opening page tab -> abort!");
                hasError = err;
            }

            // Set Page properties
            if (hasError === false) {
                try {
                    let browserOptions = this.options.browser;
                    let deviceOptions  = this.options.device;
                    debug("evaluateUrl - Set page properties ...");
                    await page.setCacheEnabled(browserOptions.isCacheEnabled); // Disables cache
                    await page.setJavaScriptEnabled(browserOptions.isJsEnabled);
//                await page.setExtraHTTPHeaders("");
                    await page.setRequestInterception(true);

                    const blockRequests = this.options.blockRequests;
                    // Remove tracking from pages (at least the well known ones
                    page.on('request', interceptedRequest => {
                        const url = interceptedRequest.url();
                        if (blockRequests) {
                            for (const blockedUrl of blockRequests) {
                                if (url.includes(blockedUrl)) {
                                    interceptedRequest.abort();
                                    return;
                                }
                            }
                        }
                        interceptedRequest.continue();
                    });

                    await page.emulate({
                        viewport:  {
                            width:             deviceOptions.width,
                            height:            deviceOptions.height,
                            deviceScaleFactor: deviceOptions.scaleFactor,
                            isMobile:          deviceOptions.isMobile,
                            hasTouch:          deviceOptions.hasTouch,
                            isLandscape:       deviceOptions.isLandscape
                        },
                        userAgent: browserOptions.userAgent
                    });

                    debug("evaluateUrl - Page properties set!");
                } catch (err) {
                    debug("evaluateUrl - Error while setting page properties -> abort!");
                    hasError = err;
                }
            }

            // Go to destination page
            if (hasError === false) {
                try {
                    debug("evaluateUrl - Navigating page to " + url);
                    await page.goto(url, {
                        timeout:   this.options.timeout,
                        waitUntil: 'networkidle2'
                    });
                    debug("evaluateUrl - Page navigated");
                } catch (err) {
                    debug("evaluateUrl - Error while page.goto -> abort?");
                    hasError = err;

                }
            }

            if (hasError === false) {
                try {
                    debug("evaluateUrl - Extracting critical selectors");
                    await page.waitFor(250); // Needed because puppeteer sometimes isnt able to handle quick tab openings
                    criticalSelectorsMap = new Map(await page.evaluate(extractCriticalCss_script, {
                        sourceAst:     sourceAst,
                        renderTimeout: this.options.renderTimeout,
                        keepSelectors: this.options.keepSelectors,
                        dropKeyframes: this.options.dropKeyframes
                    }));
                    debug("evaluateUrl - Extracting critical selectors - successful! Length: " + criticalSelectorsMap.size);
                } catch (err) {
                    debug("evaluateUrl - Error while extracting critical selectors -> not good!");
                    hasError = err;
                }

                debug("evaluateUrl - cleaning up AST with criticalSelectorMap");
                criticalAst = this._cssTransformator.filterByMap(sourceAst, criticalSelectorsMap);
                debug("evaluateUrl - cleaning up AST with criticalSelectorMap - END");
            }

            if (hasError === false) {
                try {
                    debug("evaluateUrl - Closing page ...");
                    await page.close();
                    debug("evaluateUrl - Page closed");
                } catch (err) {
                    hasError = err;
                    debug("evaluateUrl - Error while closing page -> already closed?");
                }
            }

            // Error handling
            if (hasError !== false) {
                try {
                    await this.gracefulClosePage(page, hasError);
                } catch (err) {
                }
                reject(hasError);
            }

            resolve(criticalAst);
        });
    }

}

module.exports = CriticalExtractor;