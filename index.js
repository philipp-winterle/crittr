"use strict";

const log           = require('signale');
const Crittr = require('./src/classes/Crittr.class');

module.exports = (options) => {
    return new Promise(async (resolve, reject) => {
        log.time("Crittr Run");
        const crttr         = new Crittr(options);
        let extractedCss = "";
        try {
            extractedCss = await crttr.run();
        } catch (err) {
            reject(err);
        }
        resolve(extractedCss);
        log.timeEnd("Crittr Run");
    });
};