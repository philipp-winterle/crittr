import fs from 'fs-extra';
import path from 'path';
import css from 'css';
import url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const testResultDir = path.join(rootDir, 'test', 'results');

describe('Media Query Special Tests', () => {
    describe('Media Query Order', () => {
        const resultCSS = fs.readFileSync(path.join(testResultDir, 'test_result.css'), 'utf8');
        const remainingCSS = fs.readFileSync(path.join(testResultDir, 'test_result_remaining.css'), 'utf8');
        const resultAstRules = css.parse(resultCSS).stylesheet.rules;
        const remainingAstRules = css.parse(remainingCSS).stylesheet.rules;

        let mediaRulesArr = [];
        for (const rule of resultAstRules) {
            if (rule.type === 'media') {
                mediaRulesArr.push(rule.media);
            }
        }

        test('Media Queries exists', () => {
            const rule = mediaRulesArr[0] || null;
            expect(rule).not.toBeNull();
        });

        test('First Media Query is 800px', () => {
            const rule = mediaRulesArr[0] || null;
            expect(rule).toContain('800px');
        });

        test('Second Media Query is 900px', () => {
            const rule = mediaRulesArr[1] || null;
            expect(rule).toContain('900px');
        });

        test('Third Media Query is 1024px', () => {
            const rule = mediaRulesArr[2] || null;
            expect(rule).toContain('1024px');
        });

        test('Last Media Query is MaxWidth 1337px', () => {
            const rule = mediaRulesArr[mediaRulesArr.length - 1] || null;
            expect(rule).toContain('max-width: 1337px');
        });
    });
});
