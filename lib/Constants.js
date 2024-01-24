const path = require('path');
const package_json = require(path.join('..', 'package.json'));

module.exports = {
    // DEFAULTS
    PROJECT_DIR: path.resolve('..'),

    // CRITTR BASED

    PRINT_BROWSER_CONSOLE: false,
    DROP_KEYFRAMES: true,
    PUPPETEER_HEADLESS: "new",
    BROWSER_USER_AGENT: 'Crittr ' + package_json.version,
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
