"use strict";
const path    = require('path');
const fs      = require('fs-extra');
const Crittr  = require('../index');
const rootDir = path.join(__dirname, "..");

console.log("Server listening");
Crittr({
    urls:   [
        "https://github.com/"
    ],
    css:    `.header-logo-invertocat {
                margin: -1px 15px -1px -2px;
                color: #fff;
                white-space: nowrap;
            }`,
    device: {
        width:  1920,
        height: 1080
    }
}).then( ({critical, rest}) => {
    fs.writeFileSync(path.join(rootDir, "./examples/basic.css"), critical, "utf-8")
}).catch(err => {
    console.error(err);
});

