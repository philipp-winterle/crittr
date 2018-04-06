"use strict";

const consola           = require('consola');
const CriticalExtractor = require('./classes/CriticalExtractor.class');

module.exports = (options) => {
    return new Promise(async (resolve, reject) => {
        const ce         = new CriticalExtractor(options);
        let extractedCss = "";
        try {
            extractedCss = await ce.run();
        } catch (err) {
            reject(err);
        }

        resolve(extractedCss);
    });
};