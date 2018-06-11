const Critter = require('./../index');
const fs      = require('fs-extra');
const path    = require('path');
const css     = require('css');

const rootDir      = path.join(__dirname, "..");
const staticServer = require(path.join(rootDir, "src/helper/localFileServer"))(rootDir);
const Rule         = require(path.join(rootDir, "src/classes/Rule.class"));

const testData = {
    urls: [
        "http://localhost:8000/test/data/test.html?1",
        "http://localhost:8000/test/data/test.html?2",
        "http://localhost:8000/test/data/test.html?3",
        "http://localhost:8000/test/data/test.html?4"
    ],
    css:  rootDir + "/test/data/test.css"
};

describe('Basis Test', () => {
//    test('Run Critter with local test data', done => {
//        staticServer.listen(8000, async () => {
//            try {
//                const extractedCss = await Critter({
//                    urls:            testData.urls,
//                    css:             testData.css,
//                    device:          {
//                        width:  1920,
//                        height: 1080
//                    },
//                    keepSelectors:   [
//                        ".forceInclude"
//                    ],
//                    removeSelectors: [
//                        ".forceExclude"
//                    ]
//                });
//                fs.writeFileSync("./test/test_result.css", extractedCss, "utf-8");
//            } catch (err) {
//                done.fail(err)
//            }
//            staticServer.close();
//            done();
//        }).on("error", (err) => {
//            done.fail(err);
//        });
//    });

    describe('Check Results', () => {
        const resultCSS      = fs.readFileSync(path.join(rootDir, "test", "test_result.css"), "utf8");
        const resultAstRules = (css.parse(resultCSS)).stylesheet.rules;

        const criticalSelectorRules = new Map();

        // Gather all Selectors of result CSS
        for (const rule of resultAstRules) {

            if (rule.type === "rule") {
                const selectors = rule.selectors.join(",");
                if (criticalSelectorRules.has(selectors)) {
                    let count = criticalSelectorRules.get(selectors);
                    criticalSelectorRules.set(selectors, ++count);
                } else {
                    criticalSelectorRules.set(selectors, 1);
                }

            } else if (rule.type === "media") {
                const rules         = rule.rules;
                const mediaSelector = rule.media;
                // TODO: MACHE HIER MAL MIT mediaxxxx-selector
                for (const rule of rules) {
                    if (rule.type === "rule") {
                        const pairedSelector = mediaSelector + "===" + rule.selectors.join(",");
                        if (criticalSelectorRules.has(pairedSelector)) {
                            let count = criticalSelectorRules.get(pairedSelector);
                            criticalSelectorRules.set(pairedSelector, ++count);
                        } else {
                            criticalSelectorRules.set(pairedSelector, 1);
                        }
                    } else {
                        console.warn("Unkown rule type -> not recognized: ", rule.type);
                    }
                }
            }
        }

        // Selectors to search for
        const mustHaveSelectors = {
            standard:  [
                ".standard-selector",
                "#id-selector",
                "div",
                ".child-selector > *",
                ".sibling-selector + .sibling",
                ".sibling-general-selector ~ .sibling",
                ".property-selector[data-test=\"test\"]",
                ".group-selector .deep1 .deep2",
                ".multi-selector,.multi-selector-1,.multi-selector-2",
                ".forceInclude",
                "h1,h2,h3,h4,h5,h6",
                ".vendor_prefix",
                ".pseudo-selector:after",
                ".pseudo-selector::before"
            ],
            media1024: [
                ".standard-selector",
                "#id-selector",
                "div",
                ".forceInclude",
                ".pseudo-selector:after",
                ".pseudo-selector::before"
            ],
            media800:  [
                ".standard-selector",
                "#id-selector",
                ".forceInclude"
            ]
        };

        const mustMissSelectors = {
            standard:  [
                ".forceExclude",
                ".no-atf-css-default"
            ],
            media1024: [
                ".forceExclude",
                ".no-atf-css-default-1024"
            ],
            media800:  [
                ".forceExclude",
                ".no-atf-css-default-800"
            ]
        };

        test("Standard selectors should be included", () => {
            const missingSelectors = [];
            for (const selector of mustHaveSelectors.standard) {
                if (!criticalSelectorRules.has(selector)) {
                    missingSelectors.push(selector);
                }
            }
            expect(missingSelectors).toHaveLength(0);
        });

        test("Standard selectors should NOT be included", () => {
            const falseIncludedSelectors = [];
            for (const selector of mustMissSelectors.standard) {
                if (criticalSelectorRules.has(selector)) {
                    falseIncludedSelectors.push(selector);
                }
            }
            expect(falseIncludedSelectors).toHaveLength(0);
        });

        test("There shouldn't be any duplicate media query delcarations", () => {
            const duplicateMediaQuery = [];
            const mqCounter           = [];
            for (const rule of resultAstRules) {
                if (rule.type === "media") {
                    if (mqCounter.includes(rule.media)) {
                        duplicateMediaQuery.push(rule.media);
                    } else {
                        mqCounter.push(rule.media);
                    }
                }
            }
            expect(duplicateMediaQuery).toHaveLength(0);
        });

        test("MediaQuery 1024 selectors should be included", () => {
            const missingSelectors = [];
            const selectorPrefix   = "all and (min-width: 1024px)===";
            for (const selector of mustHaveSelectors.media1024) {
                if (!criticalSelectorRules.has(selectorPrefix + selector)) {
                    missingSelectors.push(selectorPrefix + selector);
                }
            }
            expect(missingSelectors).toHaveLength(0);
        });

        test("MediaQuery 1024 selectors should NOT be included", () => {
            const falseIncludedSelectors = [];
            const selectorPrefix         = "all and (min-width: 1024px)===";
            for (const selector of mustMissSelectors.media1024) {
                if (criticalSelectorRules.has(selectorPrefix + selector)) {
                    falseIncludedSelectors.push(selectorPrefix + selector);
                }
            }
            expect(falseIncludedSelectors).toHaveLength(0);
        });

        test("MediaQuery 800 selectors should be included", () => {
            const missingSelectors = [];
            const selectorPrefix   = "all and (min-width: 800px)===";
            for (const selector of mustHaveSelectors.media800) {
                if (!criticalSelectorRules.has(selectorPrefix + selector)) {
                    missingSelectors.push(selectorPrefix + selector);
                }
            }
            expect(missingSelectors).toHaveLength(0);
        });

        test("MediaQuery 800 selectors should NOT be included", () => {
            const falseIncludedSelectors = [];
            const selectorPrefix         = "all and (min-width: 800px)===";
            for (const selector of mustMissSelectors.media800) {
                if (criticalSelectorRules.has(selectorPrefix + selector)) {
                    falseIncludedSelectors.push(selectorPrefix + selector);
                }
            }
            expect(falseIncludedSelectors).toHaveLength(0);
        });

        test("Vendor prefixes still exists", () => {
            const vendorPrefixRule   = resultAstRules.find(rule => rule.type === "rule" && rule.selectors.includes(".vendor_prefix"));
            const vendorPrefixExists = vendorPrefixRule.declarations.some(declaration => declaration.property.startsWith("-webkit-")) === true
                && vendorPrefixRule.declarations.some(declaration => declaration.property.startsWith("-moz-")) === true;

            expect(vendorPrefixExists).toBeTruthy();
        });

        test("There should not be duplicates of rules", () => {
            const getDeepDuplicates = (rules, excludedProps, media) => {
                let duplicatedRules = [];
                media = media || "";

                for (const rule of rules) {
                    if (rule.type === "media") {
                        duplicatedRules = duplicatedRules.concat(getDeepDuplicates(rule.rules, excludedProps, rule.media));
                    } else {
                        let duplicateCount = 0;
                        for (const innerRule of rules) {
                            if (Rule.isRuleDuplicate(rule, innerRule, excludedProps)) {
                                duplicateCount++;
                            }
                        }
                        if (duplicateCount > 1) {
                            // Put the rule into the duplicate Array but reduce the count by one because one is still needed :)
                            const index = rule.type + (media ? " " + media + " " : "") + (rule.selectors ? rule.selectors.join(" ") : "");
                            if (!duplicatedRules.includes(index)) {
                                duplicatedRules.push(index);
                            }
                        }
                    }

                }

                return duplicatedRules;
            };

            const excludedProps  = ["position"];
            const duplicateRules = getDeepDuplicates(resultAstRules, excludedProps);
            expect(duplicateRules).toHaveLength(0);
        });

    });
});