/**
 * Graceful Shutdown Handler
 *
 * Handles SIGTERM, SIGINT, and uncaught exceptions
 * with proper cleanup and connection draining.
 *
 * @module lib/shutdown
 */

const config = require('./config');
const logger = require('./logger');

/** @type {Function[]} */
let shutdownHandlers = [];

/** @type {boolean} */
let isShuttingDown = false;

/**
 * Setup graceful shutdown handling
 * @param {object} cleanupHandlers - Objects to clean up
 * @param {object} [cleanupHandlers.server] - HTTP server instance
 * @param {object} [cleanupHandlers.watcher] - File watcher instance
 */
const setupGracefulShutdown = (cleanupHandlers = {}) => {
    const { server, watcher } = cleanupHandlers;

    /**
     * Perform graceful shutdown
     * @param {string} signal - Signal that triggered shutdown
     */
    const shutdown = async (signal) => {
        if (isShuttingDown) {
            logger.warn('Shutdown already in progress', { signal });
            return;
        }

        isShuttingDown = true;
        logger.info('Shutdown signal received', { signal });

        // Force exit timeout
        const forceExitTimer = setTimeout(() => {
            logger.error('Forced shutdown after timeout', { signal });
            process.exit(1);
        }, config.timeouts.shutdown);

        try {
            // 1. Stop accepting new connections
            if (server) {
                await closeServer(server);
            }

            // 2. Close file watcher
            if (watcher) {
                await closeWatcher(watcher);
            }

            // 3. Stop upstream health monitoring
            await stopHealthMonitoring();

            // 4. Run custom cleanup handlers
            await runCustomHandlers();

            clearTimeout(forceExitTimer);
            logger.info('Graceful shutdown complete', { signal });

            // Give logger time to flush
            setTimeout(() => process.exit(0), 100);
        } catch (error) {
            logger.error('Error during shutdown', {
                error: error.message,
                stack: error.stack,
                signal
            });
            clearTimeout(forceExitTimer);
            setTimeout(() => process.exit(1), 100);
        }
    };

    // Register signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception', {
            error: error.message,
            stack: error.stack
        });
        shutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            promise: promise?.toString?.() || 'N/A'
        });
        shutdown('UNHANDLED_REJECTION');
    });
};

/**
 * Close HTTP server
 * @private
 */
function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) {
                logger.error('Error closing server', { error: err.message });
                return reject(err);
            }
            logger.info('HTTP server closed');
            resolve();
        });
    });
}

/**
 * Close file watcher
 * @private
 */
async function closeWatcher(watcher) {
    try {
        await watcher.close();
        logger.info('File watcher closed');
    } catch (err) {
        logger.error('Error closing watcher', { error: err.message });
    }
}

/**
 * Stop upstream health monitoring
 * @private
 */
function stopHealthMonitoring() {
    try {
        const upstreamHealthChecker = require('./upstreamHealth');
        upstreamHealthChecker.stopAll();
        logger.info('Upstream health monitoring stopped');
    } catch (err) {
        logger.error('Error stopping health monitoring', { error: err.message });
    }
}

/**
 * Run custom shutdown handlers
 * @private
 */
async function runCustomHandlers() {
    for (const handler of shutdownHandlers) {
        try {
            await handler();
        } catch (err) {
            logger.error('Error in shutdown handler', { error: err.message });
        }
    }
}

/**
 * Register a custom shutdown handler
 * @param {Function} handler - Async cleanup function
 */
const registerShutdownHandler = (handler) => {
    if (typeof handler === 'function') {
        shutdownHandlers.push(handler);
    }
};

module.exports = {
    setupGracefulShutdown,
    registerShutdownHandler
};
