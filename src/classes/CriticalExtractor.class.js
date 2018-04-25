"use strict";

const path            = require('path');
const url             = require('url');
const fs              = require('fs-extra');
const util            = require('util');
const readFilePromise = util.promisify(fs.readFile);
const _               = require('lodash');
const debug           = require('debug')("CriticalExtractor Class");
const consola         = require('consola');
const merge           = require('deepmerge');
const puppeteer       = require('puppeteer');
const devices         = require('puppeteer/DeviceDescriptors');
const DEFAULTS        = require('../Constants');

const CssTransformator          = require('./CssTransformator.class');
const extractCriticalCss_script = require('../browser/extractCriticalCss');

class CriticalExtractor {

    /**
     *
     * @param options
     * @returns {Promise<any>}
     */
    constructor(options) {
        this.options = {
            css:             null,
            urls:            [],
            timeout:         DEFAULTS.TIMEOUT,
            pageLoadTimeout: DEFAULTS.PAGE_LOAD_TIMEOUT,
            renderTimeout:   DEFAULTS.PAGE_RENDER_TIMEOUT,
            browser:         {
                userAgent:      DEFAULTS.USER_AGENT,
                isCacheEnabled: DEFAULTS.BROWSER_CACHE_ENABLED,
                isJsEnabled:    DEFAULTS.BROWSER_JS_ENABLED
            },
            device:          {
                width:       DEFAULTS.DEVICE_WIDTH,
                height:      DEFAULTS.DEVICE_HEIGHT,
                scaleFactor: DEFAULTS.DEVICE_SCALE_FACTOR,
                isMobile:    DEFAULTS.DEVICE_IS_MOBILE,
                hasTouch:    DEFAULTS.DEVICE_HAS_TOUCH,
                isLandscape: DEFAULTS.DEVICE_IS_LANDSCAPE
            },
            puppeteer:       {
                browser: null
            }

        };
        this.options = merge(this.options, options);

        this._browser          = null;
        this._cssTransformator = new CssTransformator();

        // Check device
        if (typeof this.options.device === "string") {
            if (devices[this.options.device]) {
                this.options.device = devices[this.options.device].viewport;
            } else {
                consola.error("Option 'device' is set as string but has an unknown value. Use devices of puppeteer (https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js) or an object!");
            }
        }

        // Validate some of the options like url and css
        const optionsErrors = this.validateOptions();

        if (optionsErrors.length > 0) {
            optionsErrors.forEach(({message}) => {
                consola.error(message);
            });
            // Exit process when options are invalid
            process.exit(1);
        }
    }

    run() {
        return new Promise(async (resolve, reject) => {
            debug("run - Starting run ...");

            let selectorMap = null;
            let criticalCss = "";

            try {
                debug("run - Get css content ...");
                this._cssContent = await this.getCssContent();

                selectorMap = this._cssTransformator.getSelectorMap(this._cssContent);
                debug("run - Get css content done!");
            } catch (err) {
                debug("run - ERROR while extracting css content");
                reject(err);
            }

            const {selectorNodeMap, selectors} = selectorMap;

            try {
                debug("run - Starting browser ...");
                this._browser = await this.getBrowser();
                debug("run - Browser started!");
            } catch (err) {
                debug("run - ERROR: Browser could not be launched ... abort!");
                reject(err);
                // TODO Retry?
                process.exit(1);
            }

            try {
                debug("run - Starting critical css extraction ...");
                criticalCss = await this.getCriticalCssFromUrls(selectors);
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

    /**
     *
     * @returns {Promise}
     */
    getBrowser() {
        try {
            // TODO: Check instance of browser to be puppeteer
            if (this.options.puppeteer.browser !== null) {
                return this.options.puppeteer.browser;
            }
            return puppeteer.launch({
                ignoreHTTPSErrors: true,
                args:              [
                    '--disable-setuid-sandbox',
                    '--no-sandbox',
                    '--ignore-certificate-errors'
                ],
                dumpio:            true
            }).then(browser => {
                return browser;
            });
        } catch (err) {
            consola.error(err);
            return false;
        }
    }

    /**
     *
     * @param page
     * @param error
     * @returns {Promise<any>}
     */
    gracefulClosePage(page, error) {
        return new Promise(async (resolve, reject) => {
            // TODO: handle error arrays
            consola.error(error);
            try {
                debug("gracefulClosePage - Closing page after error gracefully ...");
                await page.close();
                debug("gracefulClosePage - Page closed gracefully!");
            } catch (err) {
                debug("gracefulClosePage - Error while closing page -> already closed?");
                consola.error(err);
            }
            resolve();
        });
    }

    /**
     *
     * @param browser
     * @returns {Promise}
     */
    getPage() {
        try {
            return this._browser.newPage();
        } catch (err) {
            consola.error(err);
            return false;
        }
    }

    getCssContent() {
        return new Promise(async (resolve, reject) => {
            if (typeof this.options.css === "string") {
                let cssString = "";
                if (this.options.css.endsWith(".css")) {
                    try {
                        cssString = await readFilePromise(this.options.css, "utf8");
                        if (cssString.length === 0) {
                            consola.error("No CSS content exists -> exit!");
                            process.exit(1);
                        }
                    } catch (err) {
                        consola.error(err);
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

    getCriticalCssFromUrls(selectors) {
        return new Promise(async (resolve, reject) => {

            const urls                    = this.options.urls;
            const browserPagesPromisesSet = new Set();
            const criticalCssSets         = new Set();

            // Iterate over the array of urls and create a promise for every url
            for (let url of urls) {
                browserPagesPromisesSet.add({
                    promise: this.evaluateUrl(url, selectors),
                    url:     url
                });
            }

            // Iterate over the evaluation promises and get the results of each
            if (browserPagesPromisesSet.size > 0) {
                // All pages are closed
                for (let pagePromiseObj of browserPagesPromisesSet) {
                    let criticalCss = "";
                    try {
                        debug("getCriticalCssFromUrls - Try to get critical css from " + pagePromiseObj.url);
                        criticalCss = await pagePromiseObj.promise;
                        debug("getCriticalCssFromUrls - Successfully extracted critical css!");
                    } catch (err) {
                        debug("getCriticalCssFromUrls - ERROR getting critical css from promise");
                        consola.error("Could not get critical css for url " + pagePromiseObj.url);
                        consola.error(err);
                    }
                    criticalCssSets.add(this._cssTransformator.getAst(criticalCss));
                }
            }

            // Go through the critical set and create one out of many
            let finalMap = {};

            for (let cssMap of criticalCssSets) {
                finalMap = this.mergeSelectorMaps(finalMap, cssMap);
            }

            // TODO: After all pages are iterated sum up the css with AST
            resolve(finalMap);
        }); // End of Promise
    }

    evaluateUrl(url, selectors) {
        return new Promise(async (resolve, reject) => {
            let hasError    = false;
            let page        = null;
            let criticalCss = null;

            // TODO: handle page open errors with retry
            // TODO: handle goto errors with retry
            // TODO: handle page evaluate errors
            // TODO: handle page close errors?

            try {
                debug("evaluateUrl - Open new Page-Tab ...");
                page = await this.getPage();
                debug("evaluateUrl - Page-Tab opened!");
            } catch (err) {
                debug("evaluateUrl - Error while opening page tab -> abort!");
                hasError = err;
            }

            // Set Page properties
            try {
                let browserOptions = this.options.browser;
                let deviceOptions  = this.options.device;
                debug("evaluateUrl - Set page properties ...");
                await page.setCacheEnabled(browserOptions.isCacheEnabled); // Disables cache
                await page.setJavaScriptEnabled(browserOptions.isJsEnabled);
//                await page.setExtraHTTPHeaders("");
                await page.setRequestInterception(true);

                // Remove tracking from pages (at least the well known ones
                page.on('request', interceptedRequest => {
                    if (
                        !interceptedRequest.url().includes("maps.gstatic.com"),
                            !interceptedRequest.url().includes("maps.googleapis.com"),
                            !interceptedRequest.url().includes("googletagmanager.com"),
                            !interceptedRequest.url().includes("generaltracking"),
                            !interceptedRequest.url().includes("doubleclick.net")
                    ) {
                        interceptedRequest.continue();
                    } else {
                        interceptedRequest.abort();
                    }
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

            // Go to destination page
            if (hasError === false) {
                try {
                    debug("evaluateUrl - Navigating page to " + url);
                    await page.goto(url, {
                        timeout: this.options.timeout
                    });
                    debug("evaluateUrl - Page navigated");
                } catch (err) {
                    debug("evaluateUrl - Error while page.goto -> abort?");
                    hasError = err;

                }
            }

            if (hasError === false) {
                try {
                    debug("evaluateUrl - Extracting critical CSS");
                    criticalCss = await page.evaluate(extractCriticalCss_script, {
                        selectors,
                        renderTimeout: this.options.renderTimeout
                    }).then(criticalSelectors => {
                        return criticalSelectors || "";
                    });
                    debug("evaluateUrl - Extracting critical CSS - successful! Length: " + criticalCss.length);
                } catch (err) {
                    debug("evaluateUrl - Error while extracting critical css -> not good!");
                    hasError = err;
                }
            }

            // TODO: deal with critical css
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

            resolve(criticalCss);
        });
    }

    /**
     *
     * @param ast1
     * @param ast2
     * @returns {*}
     */
    mergeSelectorMaps(ast1, ast2) {
        return this._cssTransformator.merge(ast1, ast2);
    }
}

module.exports = CriticalExtractor;