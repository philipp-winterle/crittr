"use strict";

const log           = require('signale');
const CriticalExtractor = require('./src/classes/CriticalExtractor.class');

module.exports = (options) => {
    return new Promise(async (resolve, reject) => {
        log.time("Crittr Run");
        const ce         = new CriticalExtractor(options);
        let extractedCss = "";
        try {
            extractedCss = await ce.run();
        } catch (err) {
            reject(err);
        }

        log.timeEnd("Crittr Run");
        resolve(extractedCss);
    });
};