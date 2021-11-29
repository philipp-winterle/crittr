const fs = require("fs-extra");
const path = require("path");
const css = require("css");

const rootDir = path.join(__dirname, "..", "..");
const Rule = require(path.join(rootDir, "lib/classes/Rule.class"));

describe("Vendor Prefix Test", () => {
    describe("Check Vendor Prefix Exists", () => {
        const resultCSS = fs.readFileSync(
            path.join(rootDir, "test", "test_result.css"),
            "utf8"
        );

        const resultAstRules = css.parse(resultCSS).stylesheet.rules;

        test("Vendor prefixes still exists", () => {
            const vendorPrefixRule = resultAstRules.find(
                (rule) =>
                    rule.type === "rule" &&
                    rule.selectors.includes(".vendor_prefix")
            );
            const vendorPrefixExists =
                vendorPrefixRule.declarations.some((declaration) =>
                    declaration.property.startsWith("-webkit-")
                ) === true &&
                vendorPrefixRule.declarations.some((declaration) =>
                    declaration.property.startsWith("-moz-")
                ) === true;

            expect(vendorPrefixExists).toBeTruthy();
        });
    });
});
