import fs from 'fs-extra';
import path from 'path';
import url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const rootDir = path.join(__dirname, '..');

export default async function () {
    // Cleans up artifacts (`.css` files and `screenshots` folder from `test`)
    const files = await fs.readdir(__dirname);
    await Promise.all(
        files
            .filter(fileOrFolder => fileOrFolder.endsWith('.css') || fileOrFolder === 'screenshots')
            .map(fileOrFolder => fs.remove(path.join('./test/', fileOrFolder))),
    );
}
