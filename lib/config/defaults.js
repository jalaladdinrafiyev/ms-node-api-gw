/**
 * Default configuration values for the API Gateway
 * All values can be overridden via environment variables
 */

module.exports = {
    // Server configuration
    server: {
        port: 3000,
        trustProxy: false,
        requestBodyLimit: '10mb'
    },

    // Rate limiting
    rateLimit: {
        windowMs: 60000,        // 1 minute
        max: 100,               // requests per window
        strictMax: 10           // for auth endpoints
    },

    // Timeouts (in milliseconds)
    timeouts: {
        request: 15000,         // client request timeout
        upstream: 30000,        // proxy to upstream timeout
        healthCheck: 5000,      // health check timeout
        shutdown: 10000         // graceful shutdown timeout
    },

    // Retry configuration
    retry: {
        maxRetries: 3,
        initialDelay: 100,      // ms
        maxDelay: 10000,        // ms
        factor: 2,              // exponential backoff factor
        retryableCodes: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']
    },

    // Circuit breaker
    circuitBreaker: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 60000,
        rollingCountBuckets: 10
    },

    // Health checking
    healthCheck: {
        intervalMs: 30000,      // check every 30 seconds
        unhealthyThreshold: 3,  // failures before marking unhealthy
        healthyThreshold: 1     // successes before marking healthy
    },

    // Connection pooling
    connectionPool: {
        maxSockets: 256,
        maxFreeSockets: 256,
        keepAliveMs: 1000,
        timeout: 60000
    },

    // File watcher
    watcher: {
        debounceMs: 500,
        stabilityThreshold: 200,
        pollInterval: 100
    },

    // Logging
    logging: {
        level: 'info',
        maxFileSize: '20m',
        maxFiles: '14d'
    }
};
