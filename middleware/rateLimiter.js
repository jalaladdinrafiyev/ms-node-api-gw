/**
 * Rate Limiting Middleware
 * 
 * Prevents DDoS and brute force attacks by limiting
 * requests per IP address within a time window.
 * 
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');
const config = require('../lib/config');
const logger = require('../lib/logger');

// Get ipKeyGenerator from express-rate-limit
const { ipKeyGenerator } = rateLimit;

/**
 * Create a rate limiter with custom options
 * @param {object} options - Rate limiter options
 * @param {number} [options.windowMs] - Time window in milliseconds
 * @param {number} [options.max] - Max requests per window
 * @param {string} [options.message] - Error message
 * @returns {Function} Rate limiter middleware
 */
const createRateLimiter = (options = {}) => {
    const {
        windowMs = config.rateLimit.windowMs,
        max = config.rateLimit.max,
        message = 'Too many requests from this IP, please try again later.',
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
        ...restOptions
    } = options;

    return rateLimit({
        windowMs,
        max,
        message: {
            error: 'Rate Limit Exceeded',
            message,
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        skipFailedRequests,
        ...restOptions,
        
        // IPv6-safe key generator
        keyGenerator: (req) => {
            const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
            if (ipKeyGenerator && typeof ipKeyGenerator === 'function') {
                return ipKeyGenerator(ip);
            }
            return ip;
        },
        
        // Custom rate limit exceeded handler
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip || req.connection?.remoteAddress || 'unknown',
                url: req.originalUrl || req.url,
                method: req.method
            });
            res.status(429).json({
                error: 'Rate Limit Exceeded',
                message,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        },
        
        // Skip rate limiting for health and metrics endpoints
        skip: (req) => req.path === '/health' || req.path === '/metrics'
    });
};

// Pre-configured limiters
const globalRateLimiter = createRateLimiter();

const strictRateLimiter = createRateLimiter({
    windowMs: 60000,
    max: config.rateLimit.strictMax
});

module.exports = {
    createRateLimiter,
    globalRateLimiter,
    strictRateLimiter
};
