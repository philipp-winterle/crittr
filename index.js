"use strict";

const log          = require("signale");
const path         = require("path");
const NODE_ENV     = process.env.NODE_ENV || "production";
const pathToCrittr = NODE_ENV === "development" ? "src" : "lib";
const Crittr       = require('./' + path.join('.', pathToCrittr, 'classes/Crittr.class'));

/**
 *
 * @param options
 * @returns {Promise<[<string>, <string>]>}
 */
module.exports = (options) => {
    return new Promise(async (resolve, reject) => {
        log.time("Crittr Run");
        const crttr      = new Crittr(options);
        let extractedCss = "";
        let restCss      = "";
        try {
            ([extractedCss, restCss] = await crttr.run());
        } catch (err) {
            reject(err);
        }
        resolve([extractedCss, restCss]);
        log.timeEnd("Crittr Run");
    });
};