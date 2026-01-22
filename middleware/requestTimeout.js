/**
 * Request Timeout Middleware
 * 
 * Enforces request timeouts to prevent slow clients
 * from holding connections indefinitely.
 * 
 * @module middleware/requestTimeout
 */

const config = require('../lib/config');
const logger = require('../lib/logger');

/**
 * Create request timeout middleware
 * @param {number} [timeoutMs] - Timeout in milliseconds
 * @returns {Function} Express middleware
 */
const requestTimeout = (timeoutMs = config.timeouts.request) => {
    return (req, res, next) => {
        req.setTimeout(timeoutMs, () => {
            if (!res.headersSent) {
                logger.warn('Request timed out', {
                    method: req.method,
                    url: req.originalUrl || req.url,
                    timeout: timeoutMs
                });
                
                res.status(504).json({
                    error: 'Gateway Timeout',
                    message: 'Request timed out',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Terminate the underlying socket
            req.destroy();
        });
        
        next();
    };
};

module.exports = requestTimeout;
