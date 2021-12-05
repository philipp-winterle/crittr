'use strict';
global.crittr_project_path = __dirname;

const log = require('signale');
const path = require('path');
const NODE_ENV = process.env.NODE_ENV || 'production';

let IS_NPM_PACKAGE = false;
try {
    IS_NPM_PACKAGE = !!require.resolve('crittr');
} catch (e) {}

const pathToCrittr = NODE_ENV === 'development' && !IS_NPM_PACKAGE ? 'lib' : 'lib'; // Only keep for later browser support?
const Crittr = require(path.join(__dirname, pathToCrittr, 'classes', 'Crittr.class.js'));

/**
 *
 * @param options
 * @returns {Promise<[<string>, <string>]>}
 */
module.exports = options => {
    return new Promise(async (resolve, reject) => {
        log.time('Crittr Run');

        let crittr;
        let resultObj = { critical: null, rest: null };

        try {
            crittr = new Crittr(options);
        } catch (err) {
            reject(err);
        }

        try {
            resultObj = await crittr.run();
        } catch (err) {
            reject(err);
        }
        resolve(resultObj);
        log.timeEnd('Crittr Run');
    });
};
