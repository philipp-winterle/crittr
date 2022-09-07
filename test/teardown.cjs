const fs = require('fs-extra');
const path = require('path');
const rootDir = path.join(__dirname, '..');

module.exports = async function () {
    // Cleans up artifacts (`.css` files and `screenshots` folder from `test`)
    const files = await fs.readdir(__dirname);
    await Promise.all(
        files
            .filter(fileOrFolder => fileOrFolder.endsWith('.css') || fileOrFolder === 'screenshots')
            .map(fileOrFolder => fs.remove(path.join('./test/', fileOrFolder))),
    );
};
