const path         = require('path');
const package_json = require(path.join("..", "package.json"));

module.exports = {
    USER_AGENT:            "CriticalExtractor " + package_json.version,
    BROWSER_CACHE_ENABLED: false,
    BROWSER_JS_ENABLED:    true,
    DEVICE_WIDTH:          1200,
    DEVICE_HEIGHT:         1080,
    DEVICE_SCALE_FACTOR:   1,
    DEVICE_IS_MOBILE:      false,
    DEVICE_HAS_TOUCH:      false,
    DEVICE_IS_LANDSCAPE:   false,
    TIMEOUT:               30000,
    PAGE_LOAD_TIMEOUT:     2000,
    PAGE_RENDER_TIMEOUT:   300
};