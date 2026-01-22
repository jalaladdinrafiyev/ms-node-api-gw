/**
 * Library Barrel Export
 *
 * Provides clean imports for all core library modules.
 *
 * Usage:
 *   const { config, logger, circuitBreaker } = require('./lib');
 */

module.exports = {
    // Configuration
    config: require('./config'),

    // Logging
    logger: require('./logger'),

    // Core modules
    circuitBreaker: require('./circuitBreaker'),
    retry: require('./retry'),
    loadBalancer: require('./loadBalancer'),
    upstreamHealth: require('./upstreamHealth'),

    // Route building
    configLoader: require('./configLoader'),
    routeBuilder: require('./routeBuilder'),
    pluginLoader: require('./pluginLoader'),

    // Lifecycle
    watcher: require('./watcher'),
    shutdown: require('./shutdown'),

    // Errors
    errors: require('./errors')
};
