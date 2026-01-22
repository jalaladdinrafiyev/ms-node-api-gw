/**
 * Centralized Configuration Module
 *
 * Provides type-safe access to all configuration values.
 * Reads from environment variables with sensible defaults.
 * Validates critical configuration on load.
 *
 * Usage:
 *   const config = require('./lib/config');
 *   console.log(config.server.port);
 */

const defaults = require('./defaults');

/** @type {string[]} Validation errors collected during config load */
const validationErrors = [];

/**
 * Parse integer from environment variable with fallback and validation
 * @param {string} envVar - Environment variable name
 * @param {number} defaultValue - Default value if not set
 * @param {object} [constraints] - Validation constraints
 * @param {number} [constraints.min] - Minimum value
 * @param {number} [constraints.max] - Maximum value
 * @returns {number}
 */
const parseIntEnv = (envVar, defaultValue, constraints = {}) => {
    const value = process.env[envVar];
    if (value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        validationErrors.push(`${envVar}: invalid integer value "${value}"`);
        return defaultValue;
    }

    if (constraints.min !== undefined && parsed < constraints.min) {
        validationErrors.push(`${envVar}: value ${parsed} below minimum ${constraints.min}`);
        return defaultValue;
    }

    if (constraints.max !== undefined && parsed > constraints.max) {
        validationErrors.push(`${envVar}: value ${parsed} above maximum ${constraints.max}`);
        return defaultValue;
    }

    return parsed;
};

/**
 * Parse boolean from environment variable with fallback
 * @param {string} envVar - Environment variable name
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
const parseBoolEnv = (envVar, defaultValue) => {
    const value = process.env[envVar];
    if (value === undefined || value === '') {
        return defaultValue;
    }
    return value === 'true' || value === '1';
};

/**
 * Parse string from environment variable with fallback
 * @param {string} envVar - Environment variable name
 * @param {string} defaultValue - Default value if not set
 * @returns {string}
 */
const parseStringEnv = (envVar, defaultValue) => {
    return process.env[envVar] || defaultValue;
};

/**
 * Configuration object - frozen to prevent accidental mutation
 */
const config = Object.freeze({
    // Environment
    env: parseStringEnv('NODE_ENV', 'development'),
    isDevelopment: parseStringEnv('NODE_ENV', 'development') === 'development',
    isProduction: parseStringEnv('NODE_ENV', 'development') === 'production',
    isTest: parseStringEnv('NODE_ENV', 'development') === 'test',

    // Server
    server: Object.freeze({
        port: parseIntEnv('PORT', defaults.server.port, { min: 1, max: 65535 }),
        trustProxy: parseBoolEnv('TRUST_PROXY', defaults.server.trustProxy),
        requestBodyLimit: parseStringEnv('REQUEST_BODY_LIMIT', defaults.server.requestBodyLimit)
    }),

    // Rate limiting
    rateLimit: Object.freeze({
        windowMs: parseIntEnv('RATE_LIMIT_WINDOW_MS', defaults.rateLimit.windowMs, { min: 1000 }),
        max: parseIntEnv('RATE_LIMIT_MAX', defaults.rateLimit.max, { min: 1 }),
        strictMax: parseIntEnv('RATE_LIMIT_STRICT_MAX', defaults.rateLimit.strictMax, { min: 1 })
    }),

    // Timeouts
    timeouts: Object.freeze({
        request: parseIntEnv('REQUEST_TIMEOUT_MS', defaults.timeouts.request, { min: 1000 }),
        upstream: parseIntEnv('UPSTREAM_TIMEOUT_MS', defaults.timeouts.upstream, { min: 1000 }),
        healthCheck: parseIntEnv('HEALTH_CHECK_TIMEOUT_MS', defaults.timeouts.healthCheck, {
            min: 100
        }),
        shutdown: parseIntEnv('SHUTDOWN_TIMEOUT_MS', defaults.timeouts.shutdown, { min: 1000 })
    }),

    // Retry
    retry: Object.freeze({
        maxRetries: parseIntEnv('MAX_RETRIES', defaults.retry.maxRetries, { min: 0, max: 10 }),
        initialDelay: parseIntEnv('RETRY_INITIAL_DELAY_MS', defaults.retry.initialDelay, {
            min: 10
        }),
        maxDelay: parseIntEnv('RETRY_MAX_DELAY_MS', defaults.retry.maxDelay, { min: 100 }),
        factor: parseIntEnv('RETRY_FACTOR', defaults.retry.factor, { min: 1, max: 10 }),
        retryableCodes: defaults.retry.retryableCodes
    }),

    // Circuit breaker
    circuitBreaker: Object.freeze({
        timeout: parseIntEnv('CIRCUIT_BREAKER_TIMEOUT_MS', defaults.circuitBreaker.timeout, {
            min: 1000
        }),
        errorThresholdPercentage: parseIntEnv(
            'CIRCUIT_BREAKER_ERROR_THRESHOLD',
            defaults.circuitBreaker.errorThresholdPercentage,
            { min: 1, max: 100 }
        ),
        resetTimeout: parseIntEnv(
            'CIRCUIT_BREAKER_RESET_TIMEOUT_MS',
            defaults.circuitBreaker.resetTimeout,
            { min: 1000 }
        ),
        rollingCountTimeout: defaults.circuitBreaker.rollingCountTimeout,
        rollingCountBuckets: defaults.circuitBreaker.rollingCountBuckets
    }),

    // Health checking
    healthCheck: Object.freeze({
        intervalMs: parseIntEnv('HEALTH_CHECK_INTERVAL_MS', defaults.healthCheck.intervalMs, {
            min: 1000
        }),
        unhealthyThreshold: parseIntEnv(
            'HEALTH_CHECK_UNHEALTHY_THRESHOLD',
            defaults.healthCheck.unhealthyThreshold,
            { min: 1 }
        ),
        healthyThreshold: parseIntEnv(
            'HEALTH_CHECK_HEALTHY_THRESHOLD',
            defaults.healthCheck.healthyThreshold,
            { min: 1 }
        )
    }),

    // Connection pooling
    connectionPool: Object.freeze({
        maxSockets: parseIntEnv('MAX_SOCKETS', defaults.connectionPool.maxSockets, {
            min: 1,
            max: 1024
        }),
        maxFreeSockets: parseIntEnv('MAX_FREE_SOCKETS', defaults.connectionPool.maxFreeSockets, {
            min: 1,
            max: 1024
        }),
        keepAliveMs: defaults.connectionPool.keepAliveMs,
        timeout: defaults.connectionPool.timeout
    }),

    // File watcher
    watcher: Object.freeze({
        debounceMs: defaults.watcher.debounceMs,
        stabilityThreshold: defaults.watcher.stabilityThreshold,
        pollInterval: defaults.watcher.pollInterval
    }),

    // Logging
    logging: Object.freeze({
        level: parseStringEnv('LOG_LEVEL', defaults.logging.level),
        maxFileSize: defaults.logging.maxFileSize,
        maxFiles: defaults.logging.maxFiles
    }),

    // CORS (configurable for production)
    cors: Object.freeze({
        origin: parseStringEnv('CORS_ORIGIN', '*'),
        credentials: parseBoolEnv('CORS_CREDENTIALS', true)
    }),

    // Gateway config file
    gatewayConfigPath: parseStringEnv('GATEWAY_CONFIG_PATH', './gateway.yaml'),

    // Validation errors (exposed as readonly array)
    validationErrors,

    /**
     * Validate configuration and log any errors
     * @returns {boolean} True if valid, false if errors exist
     */
    validate: () => {
        if (validationErrors.length > 0) {
            // In test environment, don't log (tests may set invalid values intentionally)
            if (process.env.NODE_ENV !== 'test') {
                console.error('[CONFIG] Validation errors:');
                validationErrors.forEach((err) => console.error(`  - ${err}`));
            }
            return false;
        }
        return true;
    },

    /**
     * Get validation errors
     * @returns {string[]} Array of validation error messages
     */
    getValidationErrors: () => [...validationErrors]
});

module.exports = config;
