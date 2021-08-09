const Critter = require("./../index");
const fs = require("fs-extra");
const path = require("path");

const rootDir = path.join(__dirname, "..");

const testData = {
    urls: [
        "http://localhost/test/data/test.html?1",
        "http://localhost/test/data/test.html?2",
        "http://localhost/test/data/test.html?3",
        "http://localhost/test/data/test.html?4"
    ]
};

module.exports = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const { critical, rest } = await Critter({
                urls: testData.urls,
                device: {
                    width: 1920,
                    height: 1080,
                },
                keepSelectors: [
                    ".forceInclude",
                    "%.wildcard_test_1 %",
                    ".wildcard_test_2 %",
                    ".wildcard_test_3 %",
                ],
                removeSelectors: [".forceExclude"],
            });
            fs.writeFileSync(
                path.join(rootDir, "./test/test_result.css"),
                critical,
                "utf-8"
            );
            fs.writeFileSync(
                path.join(rootDir, "./test/test_result_remaining.css"),
                rest,
                "utf-8"
            );
        } catch (err) {
            reject(err);
        }

        resolve();
    });
};
