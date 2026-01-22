const fs = require('fs');
const yaml = require('js-yaml');
const { buildRouter } = require('./routeBuilder');
const logger = require('./logger');

/**
 * Loads and parses the gateway.yaml configuration file
 * @param {string} configPath - Path to the gateway.yaml file
 * @returns {object|null} - Parsed configuration object or null on error
 */
const loadConfigFile = (configPath = './gateway.yaml') => {
    try {
        // Validate config path
        if (!configPath || typeof configPath !== 'string') {
            throw new Error('Config path must be a non-empty string');
        }

        const fileContents = fs.readFileSync(configPath, 'utf8');

        // Validate file is not empty
        if (!fileContents || fileContents.trim().length === 0) {
            throw new Error('Configuration file is empty');
        }

        const config = yaml.load(fileContents);

        // Validate config structure
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid configuration: must be an object');
        }

        if (!config.routes || !Array.isArray(config.routes)) {
            throw new Error('Invalid configuration: routes must be an array');
        }

        if (config.routes.length === 0) {
            logger.warn('Configuration has no routes defined', { configPath });
        }

        return config;
    } catch (err) {
        // Distinguish between file system errors and parsing errors
        if (err.code === 'ENOENT') {
            logger.error('Config file not found', { configPath, code: err.code });
        } else if (err.code === 'EACCES') {
            logger.error('Permission denied reading config file', { configPath, code: err.code });
        } else if (err instanceof yaml.YAMLException) {
            logger.error('Failed to parse config file (YAML error)', {
                configPath,
                error: err.message,
                stack: err.stack
            });
        } else {
            logger.error('Failed to load config file', {
                configPath,
                error: err.message,
                stack: err.stack
            });
        }
        return null;
    }
};

/**
 * Loads configuration and builds router
 * @param {string} configPath - Path to the gateway.yaml file
 * @returns {express.Router|null} - Built router or null on error
 */
const loadConfig = (configPath = './gateway.yaml') => {
    logger.info('Loading configuration', { configPath });

    const config = loadConfigFile(configPath);
    if (!config) {
        logger.error('Configuration load failed', { configPath });
        return null;
    }

    try {
        const router = buildRouter(config.routes);
        logger.info('Configuration reloaded successfully', {
            configPath,
            routeCount: config.routes.length,
            routes: config.routes.map((r) => r.path)
        });
        return router;
    } catch (err) {
        logger.error('Failed to build routes', {
            error: err.message,
            stack: err.stack,
            configPath
        });
        return null;
    }
};

module.exports = {
    loadConfig,
    loadConfigFile
};
