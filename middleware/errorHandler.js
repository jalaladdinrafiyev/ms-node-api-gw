/**
 * Error Handler Middleware
 * 
 * Provides centralized error handling with proper
 * logging and formatted error responses.
 * 
 * @module middleware/errorHandler
 */

const config = require('../lib/config');
const logger = require('../lib/logger');
const { GatewayError, isGatewayError } = require('../lib/errors');

/**
 * Handle 404 Not Found errors
 * @param {express.Request} req
 * @param {express.Response} res
 */
const notFoundHandler = (req, res) => {
    logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection?.remoteAddress
    });
    
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
    });
};

/**
 * Global error handler middleware
 * @param {Error} err
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
const globalErrorHandler = (err, req, res, next) => {
    // Check development mode at runtime (for testability)
    const isDev = process.env.NODE_ENV === 'development';
    
    // Determine status code
    const statusCode = err.statusCode || err.status || 500;
    
    // Log error
    const logData = {
        error: err.message,
        code: err.code,
        statusCode,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection?.remoteAddress
    };
    
    if (statusCode >= 500) {
        logData.stack = err.stack;
        logger.error('Server error', logData);
    } else {
        logger.warn('Client error', logData);
    }
    
    // Build response
    const response = {
        error: 'Internal Server Error',
        message: isDev ? err.message : 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };
    
    // Use custom error response if available
    if (isGatewayError(err)) {
        Object.assign(response, err.toJSON(isDev));
    }
    
    // Include stack trace in development
    if (isDev) {
        response.stack = err.stack;
    }
    
    res.status(statusCode).json(response);
};

/**
 * Handle gateway not configured state
 * @param {express.Request} req
 * @param {express.Response} res
 */
const gatewayNotConfiguredHandler = (req, res) => {
    logger.warn('Gateway not configured', {
        method: req.method,
        url: req.originalUrl
    });
    
    res.status(503).json({
        error: 'Gateway not configured',
        message: 'The gateway is starting up or configuration is not loaded',
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    notFoundHandler,
    globalErrorHandler,
    gatewayNotConfiguredHandler
};
