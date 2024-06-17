import fs from 'fs-extra';
import path from 'path';
import css from 'css';
import url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const testResultDir = path.join(rootDir, 'test', 'results');

describe('Vendor Prefix Test', () => {
    describe('Check Vendor Prefix Exists', () => {
        const resultCSS = fs.readFileSync(path.join(testResultDir, 'test_result.css'), 'utf8');

        const resultAstRules = css.parse(resultCSS).stylesheet.rules;

        test('Vendor prefixes still exists', () => {
            const vendorPrefixRule = resultAstRules.find(rule => rule.type === 'rule' && rule.selectors.includes('.vendor_prefix'));
            const vendorPrefixExists =
                vendorPrefixRule.declarations.some(declaration => declaration.property.startsWith('-webkit-')) === true &&
                vendorPrefixRule.declarations.some(declaration => declaration.property.startsWith('-moz-')) === true;

            expect(vendorPrefixExists).toBeTruthy();
        });
    });
});
