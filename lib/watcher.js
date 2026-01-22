/**
 * Configuration File Watcher
 * 
 * Watches gateway.yaml for changes and triggers hot-reload
 * with debouncing to prevent rapid successive reloads.
 * 
 * @module lib/watcher
 */

const chokidar = require('chokidar');
const config = require('./config');
const { clearPluginCache } = require('./pluginLoader');
const logger = require('./logger');

// Debounce timer
let reloadTimer = null;

/**
 * Sets up file watcher for gateway.yaml
 * @param {string} configPath - Path to the gateway.yaml file
 * @param {Function} onReload - Callback function on config change
 * @returns {chokidar.FSWatcher} Watcher instance for cleanup
 * @throws {Error} If configPath or onReload is invalid
 */
const setupWatcher = (configPath = config.gatewayConfigPath, onReload) => {
    // Validate inputs
    if (!configPath || typeof configPath !== 'string') {
        throw new Error('Config path must be a non-empty string');
    }
    
    if (typeof onReload !== 'function') {
        throw new Error('onReload must be a function');
    }
    
    const watcher = chokidar.watch(configPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: config.watcher.stabilityThreshold,
            pollInterval: config.watcher.pollInterval
        }
    });
    
    watcher.on('change', () => {
        // Debounce rapid file changes
        if (reloadTimer) {
            clearTimeout(reloadTimer);
        }
        
        reloadTimer = setTimeout(() => {
            logger.info('Configuration file changed, reloading', { configPath });
            
            // Clear plugin cache for hot-reload of plugin code
            clearPluginCache();
            
            // Trigger reload callback
            try {
                onReload();
            } catch (error) {
                logger.error('Error during config reload', { 
                    error: error.message, 
                    stack: error.stack,
                    configPath 
                });
            }
            
            reloadTimer = null;
        }, config.watcher.debounceMs);
    });
    
    watcher.on('error', (error) => {
        logger.error('File watcher error', { 
            error: error.message, 
            stack: error.stack,
            configPath 
        });
    });
    
    return watcher;
};

module.exports = {
    setupWatcher
};
