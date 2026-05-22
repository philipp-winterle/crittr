import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const src = resolve(projectRoot, 'lib', 'evaluation');
const dest = resolve(projectRoot, 'dist', 'lib', 'evaluation');

if (!existsSync(src)) {
    console.error(`[copy-evaluation] source missing: ${src}`);
    process.exit(1);
}

cpSync(src, dest, { recursive: true });
console.log(`[copy-evaluation] copied ${src} → ${dest}`);
