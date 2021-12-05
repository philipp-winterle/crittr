const Critter = require("../index");
const fs = require("fs-extra");
const path = require("path");
const merge = require("deepmerge");

const rootDir = path.join(__dirname, "..");
const staticServer = require("../lib/helper/localFileServer")(rootDir);

const testData = {
    urls: [
        "./test/data/test.html?1",
        "./test/data/test.html?2",
        "./test/data/test.html?3",
        "./test/data/test.html?4",
    ],
    css: rootDir + "/test/data/test.css",
};

const testDataNoCSS = {
    urls: [
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4",
    ],
};

const defaultOptions = {
    device: {
        width: 1920,
        height: 1080,
    },
    keepSelectors: [
        ".forceInclude",
        "%.wildcard_test_1 %",
        ".wildcard_test_2 %",
        ".wildcard_test_3 %",
    ],
    removeSelectors: [".forceExclude"],
};

const standardOptions = merge(defaultOptions, {
    urls: testData.urls,
    css: testData.css,
});

const noCssOptions = merge(defaultOptions, {
    urls: testDataNoCSS.urls,
    css: null,
});

module.exports = () => {
    return new Promise(async (resolve, reject) => {
        const server = staticServer
            .listen(8000, async () => {
                try {
                    const { critical: defaultCss, rest: defaultRest } =
                        await Critter(standardOptions);

                    fs.writeFileSync(
                        path.join(rootDir, "./test/test_result.css"),
                        defaultCss,
                        "utf-8"
                    );

                    fs.writeFileSync(
                        path.join(rootDir, "./test/test_result_remaining.css"),
                        defaultRest,
                        "utf-8"
                    );

                    // Second Run for URL
                    let { critical: noCssCritical, rest: noCssRest } =
                        await Critter(noCssOptions);

                    fs.writeFileSync(
                        path.join(rootDir, "./test/test_result_noCss.css"),
                        noCssCritical,
                        "utf-8"
                    );

                    fs.writeFileSync(
                        path.join(
                            rootDir,
                            "./test/test_result_noCss_remaining.css"
                        ),
                        noCssRest,
                        "utf-8"
                    );

                    resolve();
                } catch (err) {
                    reject(err);
                }

                server.close();
            })
            .on("error", (err) => {
                reject(err);
            });
    });
};
