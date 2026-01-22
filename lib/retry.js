/**
 * Retry Manager
 * 
 * Provides retry logic with exponential backoff and jitter
 * for handling transient failures gracefully.
 * 
 * @module lib/retry
 */

const config = require('./config');
const logger = require('./logger');

/**
 * Handles retry logic with configurable backoff
 */
class RetryManager {
    /**
     * Execute a function with retry logic
     * @param {Function} fn - Async function to retry
     * @param {object} options - Retry options
     * @param {number} [options.maxRetries] - Maximum retry attempts
     * @param {number} [options.initialDelay] - Initial delay in ms
     * @param {number} [options.maxDelay] - Maximum delay in ms
     * @param {number} [options.factor] - Exponential backoff factor
     * @param {string[]} [options.retryableErrors] - Error codes to retry on
     * @param {Function} [options.onRetry] - Callback on each retry
     * @returns {Promise<*>} Result of function execution
     */
    async execute(fn, options = {}) {
        const {
            maxRetries = config.retry.maxRetries,
            initialDelay = config.retry.initialDelay,
            maxDelay = config.retry.maxDelay,
            factor = config.retry.factor,
            retryableErrors = config.retry.retryableCodes,
            onRetry = null
        } = options;

        let lastError;
        let delay = initialDelay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Check if error is retryable
                const isRetryable = this._isRetryable(error, retryableErrors);

                // Don't retry if not retryable or exhausted retries
                if (!isRetryable || attempt >= maxRetries) {
                    throw error;
                }

                // Log retry attempt
                logger.warn('Retrying request', {
                    attempt: attempt + 1,
                    maxRetries,
                    error: error.message,
                    code: error.code,
                    delay
                });

                // Call retry callback if provided
                if (onRetry) {
                    onRetry(attempt + 1, error, delay);
                }

                // Wait before retrying
                await this.sleep(delay);

                // Calculate next delay with jitter
                delay = this._calculateNextDelay(delay, factor, maxDelay);
            }
        }

        throw lastError;
    }

    /**
     * Check if an error is retryable
     * @private
     */
    _isRetryable(error, retryableErrors) {
        if (!error) return false;
        return retryableErrors.some(code => 
            error.code === code || error.message?.includes(code)
        );
    }

    /**
     * Calculate next delay with exponential backoff and jitter
     * @private
     */
    _calculateNextDelay(currentDelay, factor, maxDelay) {
        let nextDelay = Math.min(currentDelay * factor, maxDelay);
        // Add ±20% jitter to prevent thundering herd
        const jitter = nextDelay * 0.2 * (Math.random() * 2 - 1);
        return Math.floor(nextDelay + jitter);
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
module.exports = new RetryManager();
