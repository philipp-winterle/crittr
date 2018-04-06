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
const package_json    = require('../package.json');

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
            browser:         null,
            userAgent:       "CriticalExtractor " + package_json.version,
            timeout:         10000,
            pageLoadTimeout: 5000,
            renderTimeout:   200
        };
        this.options = merge(this.options, options);

        this._browser          = null;
        this._cssTransformator = new CssTransformator();

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
            debug("Starting run ...");

            let selectorMap = null;
            let criticalCss = "";

            try {
                debug("Get css content ...");
                this._cssContent = await this.getCssContent();

                selectorMap = this._cssTransformator.getSelectorMap(this._cssContent);
                debug("Get css content done!");
            } catch (err) {
                debug("ERROR while extracting css content");
                reject(err);
            }

            const {selectorNodeMap, selectors} = selectorMap;

            try {
                debug("Starting browser ...");
                this._browser = await this.getBrowser();
                debug("Browser started!");
            } catch (err) {
                debug("ERROR: Browser could not be launched ... abort!");
                reject(err);
                // TODO Retry?
                process.exit(1);
            }

            try {
                debug("Starting critical css extraction ...");
                criticalCss = await this.getCriticalCssFromUrls(selectors);
                debug("Finished critical css extraction!");
            } catch (err) {
                debug("ERROR while critical css extraction");
                reject(err);
            }

            try {
                debug("Browser closing ...");
                await this._browser.close();
                debug("Browser closed!");
            } catch (err) {
                debug("ERROR: Browser could not be closed -> already closed?");
            }

            debug("Extraction ended!");
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
            if (this.options.browser !== null) {
                return this.options.browser;
            }
            return puppeteer.launch({
                ignoreHTTPSErrors: true,
                args:              [
                    '--disable-setuid-sandbox',
                    '--no-sandbox',
                    '--ignore-certificate-errors'
                ]
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
                browserPagesPromisesSet.add(this.evaluateUrl(url, selectors));
            }

            // Iterate over the evaluation promises and get the results of each
            if (browserPagesPromisesSet.size > 0) {
                // All pages are closed
                for (let pagePromise of browserPagesPromisesSet) {
                    let criticalCss = "";
                    try {
                        criticalCss = await pagePromise;
                    } catch (err) {
                        debug("ERROR getting critical css from promise");
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
            let page        = null;
            let criticalCss = null;

            // TODO: handle page open errors with retry
            // TODO: handle goto errors with retry
            // TODO: handle page evaluate errors
            // TODO: handle page close errors?

            try {
                debug("Open new Page-Tab ...");
                page = await this.getPage();
                debug("Page-Tab opened!");
            } catch (err) {
                debug("Error while opening page tab -> abort!");
                reject(err);
            }

            // Go to destination page
            try {
                debug("Navigating page to " + url);
                await page.goto(url, {
                    timeout: this.options.timeout
                });
                debug("Page navigated");
            } catch (err) {
                debug("Error while page.goto -> abort?");
                reject(err);
            }

            try {
                criticalCss = await page.evaluate(extractCriticalCss_script, {
                    selectors,
                    renderTimeout: this.options.renderTimeout
                }).then(criticalSelectors => {
                    return criticalSelectors
                });
            } catch (err) {
                debug("Error while extracting critical css -> not good!");
                reject(err);
            }

            // TODO: deal with critical css

            try {
                debug("Closing page ...");
                await page.close();
                debug("Page closed");
            } catch (err) {
                debug("Error while closing page -> already closed?");
                reject(err);
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