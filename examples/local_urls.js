"use strict";
const path         = require('path');
const fs           = require('fs-extra');
const Crittr       = require('../index');
const rootDir      = path.join(__dirname, "..");
const staticServer = require("../lib/helper/localFileServer")(rootDir);

const testCase = {
    urls: [
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4"
    ],
    css:  rootDir + "/test/data/test.css"
};

staticServer.listen(8000, async () => {
    console.log("Server listening");
    try {
        const extractedCss = await Crittr({
            urls:            testCase.urls,
            css:             testCase.css,
            timeout:         30000,
            device:          {
                width:  1920,
                height: 1080
            },
            browser:         {
                concurrentTabs: Infinity
            },
            keepSelectors:   [
                ".forceInclude"
            ],
            removeSelectors: [
                ".forceExclude"
            ]
        });
        fs.writeFileSync(path.join(rootDir, "./examples/local_urls.css"), extractedCss, "utf-8");
    } catch (err) {
        console.error(err);
    }
    staticServer.close();
    process.exit(0);
}).on("error", (err) => {
    console.error(err)
});

