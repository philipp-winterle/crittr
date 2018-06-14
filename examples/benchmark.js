/**
 *  You need to install penthouse first to run this benchmark
 *  npm i penthouse --no-save
 *
 *  node ./examples/benchmark.js
 */

"use strict";
const path              = require('path');
const fs                = require('fs-extra');
const penthouse         = require('penthouse');
const chalk             = require('chalk');
const CriticalExtractor = require('../index');
const rootDir           = path.join(__dirname, "..");
const staticServer      = require("../src/helper/localFileServer")(rootDir);

staticServer.listen(8000, async () => {
    console.log("Server listening");

    const urls = [
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4",
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4",
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4",
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4",
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4"
    ];

    const cssString = fs.readFileSync(path.join(rootDir, "/test/data/test.css"), "utf8");

    try {
        console.log("Start Critter Benchmark");
        console.time("CriticalExtractor");
        const extractedCss = await CriticalExtractor({
            urls:            urls,
            css:             rootDir + "/test/data/test.css",
            device:          {
                width:  1920,
                height: 1080
            },
            keepSelectors:   [
                ".forceInclude"
            ],
            removeSelectors: [
                ".forceExclude"
            ],
            browser:         {
                concurrentTabs: Infinity
            }

        });
        console.timeEnd("CriticalExtractor")
    } catch (err) {
        console.error(err);
    }

    console.log("Start Penthouse Benchmark");
    console.time("Penthouse");
    for (const url of urls) {
        try {

            const extracedCss = await penthouse({
                url:             url,
                css:             rootDir + "/test/data/test.css",
                width:           1920,
                height:          1080,
                forceInclude:    [
                    ".forceInclude"
                ],
                blockJsRequests: false

            });

        } catch (err) {
            console.error(err);
        }
    }
    console.timeEnd("Penthouse");

    staticServer.close();
    process.exit(0);
}).on("error", (err) => {
    console.error(err)
});

