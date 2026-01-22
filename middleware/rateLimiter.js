/**
 * Rate Limiting Middleware
 * 
 * Prevents DDoS and brute force attacks by limiting
 * requests per IP address within a time window.
 * 
 * Supports:
 * - In-memory store (development/single instance)
 * - Redis store (production/distributed)
 * 
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');
const config = require('../lib/config');
const logger = require('../lib/logger');

/** @type {object|null} Redis client instance */
let redisClient = null;

/** @type {object|null} Redis store for rate limiting */
let redisStore = null;

/**
 * Initialize Redis connection for distributed rate limiting
 * @returns {Promise<boolean>} True if Redis is connected
 */
const initializeRedis = async () => {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
        logger.info('REDIS_URL not configured, using in-memory rate limiting');
        return false;
    }

    try {
        // Dynamic import to avoid requiring ioredis when not needed
        const Redis = require('ioredis');
        const { RedisStore } = require('rate-limit-redis');

        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            connectTimeout: 5000,
            lazyConnect: true
        });

        // Connect and test
        await redisClient.connect();
        await redisClient.ping();

        redisStore = new RedisStore({
            sendCommand: (...args) => redisClient.call(...args),
            prefix: 'rl:'
        });

        logger.info('Redis rate limiter initialized', { url: redisUrl.replace(/:[^:@]+@/, ':***@') });
        return true;
    } catch (error) {
        logger.warn('Failed to connect to Redis, falling back to in-memory rate limiting', {
            error: error.message,
            code: error.code
        });
        redisClient = null;
        redisStore = null;
        return false;
    }
};

/**
 * Get the current rate limit store (Redis or in-memory)
 * @returns {object|undefined} Redis store or undefined for in-memory
 */
const getStore = () => redisStore || undefined;

/**
 * Check if Redis is connected
 * @returns {boolean}
 */
const isRedisConnected = () => {
    return redisClient?.status === 'ready';
};

/**
 * Create a rate limiter with custom options
 * @param {object} options - Rate limiter options
 * @param {number} [options.windowMs] - Time window in milliseconds
 * @param {number} [options.max] - Max requests per window
 * @param {string} [options.message] - Error message
 * @param {boolean} [options.useRedis] - Force Redis store (default: auto-detect)
 * @returns {Function} Rate limiter middleware
 */
const createRateLimiter = (options = {}) => {
    const {
        windowMs = config.rateLimit.windowMs,
        max = config.rateLimit.max,
        message = 'Too many requests from this IP, please try again later.',
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
        useRedis = true,
        ...restOptions
    } = options;

    const store = useRedis ? getStore() : undefined;

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
        store,
        ...restOptions,
        
        // IPv6-safe key generator
        keyGenerator: (req) => {
            // Use X-Forwarded-For if behind proxy and trusted
            if (config.server.trustProxy && req.headers['x-forwarded-for']) {
                const forwarded = req.headers['x-forwarded-for'];
                const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
                return ip;
            }
            return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
        },
        
        // Custom rate limit exceeded handler
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip || req.connection?.remoteAddress || 'unknown',
                url: req.originalUrl || req.url,
                method: req.method,
                store: store ? 'redis' : 'memory'
            });
            res.status(429).json({
                error: 'Rate Limit Exceeded',
                message,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        },
        
        // Skip rate limiting for health and metrics endpoints
        skip: (req) => {
            const skipPaths = ['/health', '/metrics', '/livez', '/readyz', '/startupz'];
            return skipPaths.includes(req.path);
        }
    });
};

// Pre-configured limiters (created lazily after potential Redis init)
let _globalRateLimiter = null;
let _strictRateLimiter = null;

/**
 * Get global rate limiter (lazy initialization)
 * @returns {Function}
 */
const getGlobalRateLimiter = () => {
    if (!_globalRateLimiter) {
        _globalRateLimiter = createRateLimiter();
    }
    return _globalRateLimiter;
};

/**
 * Get strict rate limiter (lazy initialization)
 * @returns {Function}
 */
const getStrictRateLimiter = () => {
    if (!_strictRateLimiter) {
        _strictRateLimiter = createRateLimiter({
            windowMs: 60000,
            max: config.rateLimit.strictMax
        });
    }
    return _strictRateLimiter;
};

/**
 * Middleware wrapper that ensures rate limiter is initialized
 * @param {Function} getLimiter - Function that returns the limiter
 * @returns {Function} Express middleware
 */
const wrapLimiter = (getLimiter) => {
    return (req, res, next) => {
        const limiter = getLimiter();
        return limiter(req, res, next);
    };
};

// Export lazy wrappers for backward compatibility
const globalRateLimiter = wrapLimiter(getGlobalRateLimiter);
const strictRateLimiter = wrapLimiter(getStrictRateLimiter);

/**
 * Graceful shutdown - close Redis connection
 */
const shutdown = async () => {
    if (redisClient) {
        try {
            await redisClient.quit();
            logger.info('Redis rate limiter connection closed');
        } catch (error) {
            logger.error('Error closing Redis connection', { error: error.message });
        }
    }
};

module.exports = {
    createRateLimiter,
    globalRateLimiter,
    strictRateLimiter,
    initializeRedis,
    isRedisConnected,
    getStore,
    shutdown
};
