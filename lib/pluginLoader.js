const path = require('path');
const logger = require('./logger');

// Cache for plugin paths to avoid repeated path.join calls
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

/**
 * Loads a plugin from the plugins directory
 * Optimized: Avoids fs.existsSync (use try/catch instead), caches path
 * @param {string} pluginName - Name of the plugin file (without .js extension)
 * @param {object} pluginConfig - Configuration object for the plugin
 * @returns {Function|null} - The plugin middleware function or null if not found
 */
const loadPlugin = (pluginName, pluginConfig) => {
    // Validate input
    if (!pluginName || typeof pluginName !== 'string') {
        logger.warn('Invalid plugin name: must be a non-empty string', { pluginName });
        return null;
    }
    
    // Security: Prevent path traversal
    if (pluginName.includes('..') || pluginName.includes('/') || pluginName.includes('\\')) {
        logger.warn('Invalid plugin name: path traversal detected', { pluginName });
        return null;
    }
    
    const pluginPath = path.join(PLUGINS_DIR, `${pluginName}.js`);
    
    // Use try/catch instead of existsSync - faster and handles race conditions
    try {
        const pluginFactory = require(pluginPath);
        
        // Validate plugin factory is a function
        if (typeof pluginFactory !== 'function') {
            logger.error('Plugin does not export a function', { pluginName, pluginPath });
            return null;
        }
        
        const middleware = pluginFactory(pluginConfig);
        
        // Validate middleware is a function
        if (typeof middleware !== 'function') {
            logger.error('Plugin factory did not return a middleware function', { pluginName, pluginPath });
            return null;
        }
        
        return middleware;
    } catch (error) {
        // Check if it's a MODULE_NOT_FOUND (file doesn't exist) vs other errors
        if (error.code === 'MODULE_NOT_FOUND') {
            logger.warn('Plugin not found', { pluginName, pluginPath, code: error.code });
        } else {
            logger.error('Error loading plugin', { 
                pluginName, 
                pluginPath,
                error: error.message, 
                stack: error.stack 
            });
        }
        return null;
    }
};

/**
 * Clears the require cache for all plugin files
 * Optimized: Uses for...of instead of forEach, single regex replace
 * This allows hot-reloading of plugins
 */
const clearPluginCache = () => {
    const pluginsDirNormalized = PLUGINS_DIR.replace(/\\/g, '/');
    const keys = Object.keys(require.cache);
    
    for (const key of keys) {
        // Normalize path and check if it's in plugins directory
        const normalizedKey = key.replace(/\\/g, '/');
        if (normalizedKey.includes(pluginsDirNormalized)) {
            delete require.cache[key];
        }
    }
};

module.exports = {
    loadPlugin,
    clearPluginCache
};
