const Critter = require('../index');
const fs = require('fs-extra');
const path = require('path');
const merge = require('deepmerge');
const crypto = require('crypto');

const rootDir = path.join(__dirname, '..');
const staticServer = require('../lib/helper/localFileServer')(rootDir);

const testData = {
    urls: ['./test/data/test.html?1', './test/data/test.html?2', './test/data/test.html?3', './test/data/test.html?4'],
    css: rootDir + '/test/data/test.css',
};

const testDataNoCSS = {
    urls: [
        'http://localhost:8000/test/data/test.html?1',
        'http://localhost:8000/test/data/test.html?2',
        'http://localhost:8000/test/data/test.html?3',
        'http://localhost:8000/test/data/test.html?4',
    ],
};

const defaultOptions = {
    device: {
        width: 1920,
        height: 1080,
    },
    keepSelectors: ['.forceInclude', '%.wildcard_test_1 %', '.wildcard_test_2 %', '.wildcard_test_3 %'],
    removeSelectors: ['.forceExclude'],
};

const standardOptions = merge(defaultOptions, {
    urls: testData.urls,
    css: testData.css,
});

const noCssOptions = merge(defaultOptions, {
    urls: testDataNoCSS.urls,
    css: null,
});

const screenshotOptions = merge(defaultOptions, {
    urls: [
        'http://localhost:8000/test/data/test.html?1',
        'http://localhost:8000/test/data/test.html?2',
        'http://localhost:8000/test/data/test.html?3',
        'http://localhost:8000/test/data/test.html?4',
    ],
    css: testData.css,
    takeScreenshots: true,
    screenshotPath: path.join(__dirname, 'screenshots', 'normal'),
});

const screenNameGenerator = async (url) => {
    const sha1HashGen = crypto.createHash('sha1');
    sha1HashGen.update(url);
    return sha1HashGen.digest('hex');
}
const screenshotWithFunctionOptions = merge(defaultOptions, {
    urls: [
        'http://localhost:8000/test/data/test.html?1',
        'http://localhost:8000/test/data/test.html?2',
        'http://localhost:8000/test/data/test.html?3',
        'http://localhost:8000/test/data/test.html?4',
    ],
    css: testData.css,
    takeScreenshots: true,
    screenshotPath: path.join(__dirname, 'screenshots', 'withFunction'),
    screenshotNameGenerator: screenNameGenerator,
});

module.exports = () => {
    return new Promise(async (resolve, reject) => {
        const server = staticServer
            .listen(8000, async () => {
                try {
                    const { critical: defaultCss, rest: defaultRest } = await Critter(standardOptions);

                    fs.writeFileSync(path.join(rootDir, './test/test_result.css'), defaultCss, 'utf-8');

                    fs.writeFileSync(path.join(rootDir, './test/test_result_remaining.css'), defaultRest, 'utf-8');

                    // Second Run for URL
                    let { critical: noCssCritical, rest: noCssRest } = await Critter(noCssOptions);

                    fs.writeFileSync(path.join(rootDir, './test/test_result_noCss.css'), noCssCritical, 'utf-8');

                    fs.writeFileSync(path.join(rootDir, './test/test_result_noCss_remaining.css'), noCssRest, 'utf-8');

                    // Third Run for URL
                    let { critical: screenshotCssCritical, rest: screenshotCssRest } = await Critter(screenshotOptions);

                    fs.writeFileSync(path.join(rootDir, './test/test_result_screenshotCss.css'), screenshotCssCritical, 'utf-8');

                    fs.writeFileSync(path.join(rootDir, './test/test_result_screenshotCss_remaining.css'), screenshotCssRest, 'utf-8');

                    // Fourth Run for URL
                    let { critical: screenshotWithFunctionCssCritical, rest: screenshotWithFunctionCssRest } = await Critter(screenshotWithFunctionOptions);

                    fs.writeFileSync(path.join(rootDir, './test/test_result_screenshotWithFunctionCss.css'), screenshotWithFunctionCssCritical, 'utf-8');

                    fs.writeFileSync(path.join(rootDir, './test/test_result_screenshotWithFunctionCss_remaining.css'), screenshotWithFunctionCssRest, 'utf-8');

                    resolve();
                } catch (err) {
                    reject(err);
                }

                server.close();
            })
            .on('error', err => {
                reject(err);
            });
    });
};
