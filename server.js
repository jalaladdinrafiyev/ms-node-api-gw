/**
 * API Gateway Server
 * 
 * Enterprise-grade API Gateway with hot-reload, circuit breakers,
 * load balancing, and comprehensive middleware stack.
 * 
 * @module server
 */

const express = require('express');

// Core library imports (using barrel exports)
const { config, logger, configLoader, watcher, shutdown } = require('./lib');

// Middleware imports (using barrel exports)
const {
    security,
    globalRateLimiter,
    requestId,
    requestTimeout,
    requestLogger,
    notFoundHandler,
    globalErrorHandler,
    gatewayNotConfiguredHandler
} = require('./middleware');

// Route imports (using barrel exports)
const { 
    healthCheck, 
    metricsMiddleware, 
    metricsHandler,
    livenessProbe,
    readinessProbe
} = require('./routes');

// ============================================
// APPLICATION SETUP
// ============================================

const app = express();

/** @type {express.Router|null} */
let dynamicRouter = null;

/** @type {http.Server|null} */
let server = null;

/** @type {chokidar.FSWatcher|null} */
let fileWatcher = null;

// ============================================
// MIDDLEWARE STACK (order matters!)
// ============================================

// 1. Security headers, CORS, compression, body parsing
security(app);

// 2. Request ID generation (early for tracing)
app.use(requestId);

// 3. Rate limiting (early to prevent abuse)
app.use(globalRateLimiter);

// 4. Request timeout (prevent slow client attacks)
app.use(requestTimeout());

// 5. Metrics collection (track all requests)
app.use(metricsMiddleware);

// 6. Request logging
app.use(requestLogger);

// ============================================
// STATIC ENDPOINTS (before dynamic router)
// ============================================

// Comprehensive health check
app.get('/health', healthCheck(() => dynamicRouter));

// Kubernetes probes
app.get('/livez', livenessProbe);
app.get('/readyz', readinessProbe(() => dynamicRouter));

// Prometheus metrics
app.get('/metrics', metricsHandler);

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================

/**
 * Reload configuration and rebuild router
 */
const reloadConfig = () => {
    try {
        const newRouter = configLoader.loadConfig(config.gatewayConfigPath);
        
        if (newRouter) {
            // Atomic swap (thread-safe in Node.js)
            const routeCount = newRouter.stack?.length || 0;
            dynamicRouter = newRouter;
            logger.info('Router updated', { routeCount });
        } else {
            logger.warn('Config reload failed, keeping existing router');
        }
    } catch (error) {
        logger.error('Error during config reload', { 
            error: error.message, 
            stack: error.stack 
        });
    }
};

// Initial configuration load
reloadConfig();

// Setup hot-reload file watcher
try {
    fileWatcher = watcher.setupWatcher(config.gatewayConfigPath, reloadConfig);
} catch (error) {
    logger.error('Failed to setup file watcher', { 
        error: error.message, 
        stack: error.stack 
    });
}

// ============================================
// DYNAMIC ROUTING
// ============================================

app.use((req, res, next) => {
    if (!dynamicRouter) {
        return gatewayNotConfiguredHandler(req, res);
    }
    dynamicRouter(req, res, next);
});

// ============================================
// ERROR HANDLING (must be last)
// ============================================

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ============================================
// SERVER STARTUP
// ============================================

/**
 * Start the HTTP server
 */
const startServer = () => {
    const port = config.server.port;
    
    // Validate port
    if (isNaN(port) || port < 1 || port > 65535) {
        logger.error('Invalid PORT configuration', { port });
        process.exit(1);
    }
    
    server = app.listen(port, () => {
        logger.info('Gateway started', { 
            port,
            env: config.env,
            pid: process.pid
        });
    });
    
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            logger.error('Port already in use', { port, code: error.code });
        } else {
            logger.error('Server error', { 
                error: error.message, 
                code: error.code,
                stack: error.stack 
            });
        }
        process.exit(1);
    });
    
    // Setup graceful shutdown
    shutdown.setupGracefulShutdown({ 
        server, 
        watcher: fileWatcher 
    });
};

// Start server
startServer();

// Export for testing
module.exports = { app, reloadConfig };
