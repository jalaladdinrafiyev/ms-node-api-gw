/**
 * Middleware Barrel Export
 *
 * Provides clean imports for all middleware modules.
 *
 * Usage:
 *   const { security, rateLimiter, requestLogger } = require('./middleware');
 */

const security = require('./security');
const rateLimiter = require('./rateLimiter');
const requestId = require('./requestId');
const requestLogger = require('./requestLogger');
const requestTimeout = require('./requestTimeout');
const errorHandler = require('./errorHandler');

module.exports = {
    // Security middleware (applies to app)
    security,
    applySecurityMiddleware: security,

    // Rate limiting
    rateLimiter,
    createRateLimiter: rateLimiter.createRateLimiter,
    globalRateLimiter: rateLimiter.globalRateLimiter,
    strictRateLimiter: rateLimiter.strictRateLimiter,

    // Request handling
    requestId,
    requestLogger,
    requestTimeout,

    // Error handling
    errorHandler,
    notFoundHandler: errorHandler.notFoundHandler,
    globalErrorHandler: errorHandler.globalErrorHandler,
    gatewayNotConfiguredHandler: errorHandler.gatewayNotConfiguredHandler
};
