/**
 * Circuit Breaker Manager
 *
 * Prevents cascading failures by tracking upstream health
 * and short-circuiting requests to failing services.
 *
 * @module lib/circuitBreaker
 */

const CircuitBreaker = require('opossum');
const config = require('./config');
const logger = require('./logger');

/**
 * Manages circuit breakers for all upstream services
 */
class CircuitBreakerManager {
    constructor() {
        /** @type {Map<string, CircuitBreaker>} */
        this.breakers = new Map();

        /** @type {object} Default circuit breaker options */
        this.defaultOptions = {
            timeout: config.circuitBreaker.timeout,
            errorThresholdPercentage: config.circuitBreaker.errorThresholdPercentage,
            resetTimeout: config.circuitBreaker.resetTimeout,
            rollingCountTimeout: config.circuitBreaker.rollingCountTimeout,
            rollingCountBuckets: config.circuitBreaker.rollingCountBuckets,
            name: 'default',
            enabled: true
        };
    }

    /**
     * Get or create circuit breaker for an upstream URL
     * @param {string} upstreamUrl - The upstream service URL
     * @param {object} options - Circuit breaker options override
     * @returns {CircuitBreaker} Circuit breaker instance
     */
    getBreaker(upstreamUrl, options = {}) {
        if (this.breakers.has(upstreamUrl)) {
            return this.breakers.get(upstreamUrl);
        }

        const breakerOptions = {
            ...this.defaultOptions,
            ...options,
            name: upstreamUrl
        };

        // Breaker wraps async functions - returns promise directly
        const breakerFunction = (requestFn) => requestFn();
        const breaker = new CircuitBreaker(breakerFunction, breakerOptions);

        // Event handlers for monitoring
        this._attachEventHandlers(breaker, upstreamUrl);

        this.breakers.set(upstreamUrl, breaker);
        return breaker;
    }

    /**
     * Attach event handlers to circuit breaker
     * @private
     */
    _attachEventHandlers(breaker, upstreamUrl) {
        breaker.on('open', () => {
            logger.error('Circuit breaker opened', { upstream: upstreamUrl, state: 'open' });
        });

        breaker.on('halfOpen', () => {
            logger.warn('Circuit breaker half-open', { upstream: upstreamUrl, state: 'halfOpen' });
        });

        breaker.on('close', () => {
            logger.info('Circuit breaker closed', { upstream: upstreamUrl, state: 'closed' });
        });

        breaker.on('timeout', () => {
            logger.warn('Circuit breaker timeout', { upstream: upstreamUrl });
        });
    }

    /**
     * Execute a function with circuit breaker protection
     * @param {string} upstreamUrl - The upstream service URL
     * @param {Function} fn - Async function to execute
     * @param {object} options - Circuit breaker options override
     * @returns {Promise<*>} Result of function execution
     */
    async execute(upstreamUrl, fn, options = {}) {
        const breaker = this.getBreaker(upstreamUrl, options);

        try {
            return await breaker.fire(() => fn());
        } catch (error) {
            if (error.name === 'CircuitOpenError') {
                logger.error('Circuit breaker is open', {
                    upstream: upstreamUrl,
                    error: error.message
                });
                throw new Error(`Service unavailable: ${upstreamUrl} is currently down`);
            }
            throw error;
        }
    }

    /**
     * Get statistics for all circuit breakers
     * @returns {object} Stats keyed by upstream URL
     */
    getStats() {
        const stats = {};

        for (const [url, breaker] of this.breakers.entries()) {
            stats[url] = {
                state: breaker.status?.state || 'unknown',
                failures: breaker.status?.failures || 0,
                fires: breaker.status?.fires || 0,
                cacheHits: breaker.status?.cacheHits || 0,
                cacheMisses: breaker.status?.cacheMisses || 0
            };
        }

        return stats;
    }

    /**
     * Reset all circuit breakers to closed state
     */
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.close();
        }
    }

    /**
     * Check if circuit is open for an upstream
     * @param {string} upstreamUrl
     * @returns {boolean}
     */
    isOpen(upstreamUrl) {
        const breaker = this.breakers.get(upstreamUrl);
        return breaker?.opened || false;
    }

    /**
     * Record a successful request for circuit breaker tracking
     * @param {string} upstreamUrl
     */
    recordSuccess(upstreamUrl) {
        const breaker = this.breakers.get(upstreamUrl);
        if (breaker && typeof breaker.emit === 'function') {
            breaker.emit('success');
        }
    }

    /**
     * Record a failed request for circuit breaker tracking
     * Only records failures for server/network errors, not client errors (4xx)
     * @param {string} upstreamUrl
     * @param {Error|object} error - The error that occurred
     */
    recordFailure(upstreamUrl, error = {}) {
        const breaker = this.breakers.get(upstreamUrl);
        if (!breaker) {
            return;
        }

        // Only count as circuit breaker failure for:
        // - Network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED, ENOTFOUND)
        // - 5xx server errors
        const networkErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ECONNREFUSED',
            'ENOTFOUND',
            'ECONNABORTED'
        ];
        const isNetworkError = error.code && networkErrors.includes(error.code);
        const isServerError = error.status >= 500 || error.statusCode >= 500;

        if (isNetworkError || isServerError) {
            if (typeof breaker.emit === 'function') {
                breaker.emit('failure');
            }
        }
    }
}

// Singleton instance
module.exports = new CircuitBreakerManager();
