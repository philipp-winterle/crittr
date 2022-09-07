const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.join(__dirname, '..', '..');
const helpers = require('./../helpers.js');
const Rule = require(path.join(rootDir, 'lib/classes/Rule.class'));

const urls = [
    'http://localhost:8000/test/data/test.html?1',
    'http://localhost:8000/test/data/test.html?2',
    'http://localhost:8000/test/data/test.html?3',
    'http://localhost:8000/test/data/test.html?4',
];

describe('Screenshots', () => {
    describe('Check screenshot names', () => {
        test('Check that the normal screenshots were generated with the name based on the URL', async () => {
            const files = await fs.readdir(path.join(__dirname, '..', 'screenshots', 'normal'));
            expect(
                urls.every(url => {
                    const expectedScreenName = url.replace(/[^\w\s]/gi, '_') + '.png';
                    return files.includes(expectedScreenName);
                })
            ).toBeTruthy();
        });

        test('Check that the screenshots with a name generator function were generated with the name as the URL SHA1 hashed', async () => {
            const files = await fs.readdir(path.join(__dirname, '..', 'screenshots', 'withFunction'));
            expect(
                urls.every(url => {
                    const sha1 = crypto.createHash('sha1');
                    sha1.update(url);
                    const expectedScreenName = `${sha1.digest('hex')}.png`;
                    return files.includes(expectedScreenName);
                })
            ).toBeTruthy();
        });
    });
});
