import { createRequire } from 'node:module';
import path from 'node:path';
import url from 'node:url';
import type { ScreenshotNameGenerator } from './types.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

// Walk upwards from this module until we find the nearest package.json.
// In source tree: lib/Constants.ts → crittr/package.json (one level up).
// In build tree:  dist/lib/Constants.js → crittr/package.json (two levels up).
const findPackageJson = (): { version: string } => {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
        try {
            return require(path.join(dir, 'package.json')) as { version: string };
        } catch {
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
    }
    return { version: '0.0.0' };
};
const package_json = findPackageJson();

export interface CrittrConstants {
    PROJECT_DIR: string;
    PRINT_BROWSER_CONSOLE: boolean;
    DROP_KEYFRAMES: boolean;
    PUPPETEER_HEADLESS: boolean | 'shell';
    BROWSER_USER_AGENT: string;
    BROWSER_CACHE_ENABLED: boolean;
    BROWSER_JS_ENABLED: boolean;
    BROWSER_CONCURRENT_TABS: number;
    DEVICE_WIDTH: number;
    DEVICE_HEIGHT: number;
    DEVICE_SCALE_FACTOR: number;
    DEVICE_IS_MOBILE: boolean;
    DEVICE_HAS_TOUCH: boolean;
    DEVICE_IS_LANDSCAPE: boolean;
    TIMEOUT: number;
    PAGE_LOAD_TIMEOUT: number;
    PAGE_RENDER_TIMEOUT: number;
    PAGE_SCREENSHOT: boolean;
    OUTPUT_REMAINING_CSS: boolean;
    RULE_SEPARATOR: string;
    SCREENSHOT_NAME_GENERATOR: ScreenshotNameGenerator | null;
}

const CONSTANTS: CrittrConstants = {
    // DEFAULTS
    PROJECT_DIR: path.resolve(__dirname, '..'),

    // CRITTR BASED
    PRINT_BROWSER_CONSOLE: false,
    DROP_KEYFRAMES: true,
    PUPPETEER_HEADLESS: true,
    BROWSER_USER_AGENT: `Crittr ${package_json.version}`,
    BROWSER_CACHE_ENABLED: true,
    BROWSER_JS_ENABLED: true,
    BROWSER_CONCURRENT_TABS: 10,
    DEVICE_WIDTH: 1200,
    DEVICE_HEIGHT: 1080,
    DEVICE_SCALE_FACTOR: 1,
    DEVICE_IS_MOBILE: false,
    DEVICE_HAS_TOUCH: false,
    DEVICE_IS_LANDSCAPE: false,
    TIMEOUT: 30000,
    PAGE_LOAD_TIMEOUT: 2000,
    PAGE_RENDER_TIMEOUT: 300,
    PAGE_SCREENSHOT: false,
    OUTPUT_REMAINING_CSS: true,

    // CODE BASED
    RULE_SEPARATOR: '-#-',

    SCREENSHOT_NAME_GENERATOR: null,
};

export default CONSTANTS;
