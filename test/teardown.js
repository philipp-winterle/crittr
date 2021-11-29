const fs = require("fs-extra");
const path = require("path");
const rootDir = path.join(__dirname, "..");

module.exports = async function () {
    fs.unlink(path.join(rootDir, "./test/test_result.css"), (err) => {
        if (err) throw err;
    });

    fs.unlink(path.join(rootDir, "./test/test_result_remaining.css"), (err) => {
        if (err) throw err;
    });

    fs.unlink(path.join(rootDir, "./test/test_result_noCss.css"), (err) => {
        if (err) throw err;
    });

    fs.unlink(
        path.join(rootDir, "./test/test_result_noCss_remaining.css"),
        (err) => {
            if (err) throw err;
        }
    );
};
