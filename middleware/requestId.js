/**
 * Request ID Middleware
 *
 * Generates or propagates correlation IDs for distributed tracing.
 * Supports X-Request-ID, X-Correlation-ID, and generates UUIDs.
 *
 * @module middleware/requestId
 */

const crypto = require('crypto');

/**
 * Header names for request IDs (in priority order)
 */
const REQUEST_ID_HEADERS = ['x-request-id', 'x-correlation-id', 'x-trace-id'];

/**
 * Generate a unique request ID
 * Uses crypto.randomUUID() for RFC 4122 compliant UUIDs
 * @returns {string}
 */
const generateRequestId = () => {
    // Node 14.17+ has crypto.randomUUID()
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older Node versions
    return crypto.randomBytes(16).toString('hex');
};

/**
 * Request ID middleware
 * Extracts existing ID from headers or generates a new one
 */
const requestIdMiddleware = (req, res, next) => {
    // Check for existing request ID from upstream (load balancer, etc.)
    let requestId = null;

    for (const header of REQUEST_ID_HEADERS) {
        const value = req.headers[header];
        if (value && typeof value === 'string' && value.length <= 128) {
            requestId = value.trim();
            break;
        }
    }

    // Generate new ID if none found
    if (!requestId) {
        requestId = generateRequestId();
    }

    // Attach to request object for downstream use
    req.requestId = requestId;
    req.correlationId = requestId;

    // Set response header for tracing
    res.setHeader('X-Request-ID', requestId);

    next();
};

module.exports = requestIdMiddleware;
