/**
 * Custom Error Classes for the API Gateway
 *
 * Provides structured error handling with HTTP status codes
 * and standardized error responses.
 */

/**
 * Base class for all gateway errors
 */
class GatewayError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {string} code - Error code for programmatic handling
     * @param {object} details - Additional error details
     */
    constructor(message, statusCode = 500, code = 'GATEWAY_ERROR', details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON response format
     * @param {boolean} includeStack - Include stack trace (dev only)
     * @returns {object}
     */
    toJSON(includeStack = false) {
        const json = {
            error: this.name
                .replace('Error', '')
                .replace(/([A-Z])/g, ' $1')
                .trim(),
            message: this.message,
            code: this.code,
            timestamp: this.timestamp
        };

        if (Object.keys(this.details).length > 0) {
            json.details = this.details;
        }

        if (includeStack) {
            json.stack = this.stack;
        }

        return json;
    }
}

/**
 * 400 Bad Request - Invalid request data
 */
class BadRequestError extends GatewayError {
    constructor(message = 'Bad Request', details = {}) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}

/**
 * 401 Unauthorized - Authentication required
 */
class UnauthorizedError extends GatewayError {
    constructor(message = 'Unauthorized', details = {}) {
        super(message, 401, 'UNAUTHORIZED', details);
    }
}

/**
 * 403 Forbidden - Access denied
 */
class ForbiddenError extends GatewayError {
    constructor(message = 'Forbidden', details = {}) {
        super(message, 403, 'FORBIDDEN', details);
    }
}

/**
 * 404 Not Found - Resource not found
 */
class NotFoundError extends GatewayError {
    constructor(message = 'Not Found', details = {}) {
        super(message, 404, 'NOT_FOUND', details);
    }
}

/**
 * 408 Request Timeout - Request took too long
 */
class RequestTimeoutError extends GatewayError {
    constructor(message = 'Request Timeout', details = {}) {
        super(message, 408, 'REQUEST_TIMEOUT', details);
    }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
class RateLimitError extends GatewayError {
    constructor(message = 'Too Many Requests', retryAfter = 60, details = {}) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', { ...details, retryAfter });
        this.retryAfter = retryAfter;
    }
}

/**
 * 502 Bad Gateway - Upstream service error
 */
class BadGatewayError extends GatewayError {
    constructor(message = 'Bad Gateway', details = {}) {
        super(message, 502, 'BAD_GATEWAY', details);
    }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
class ServiceUnavailableError extends GatewayError {
    constructor(message = 'Service Unavailable', details = {}) {
        super(message, 503, 'SERVICE_UNAVAILABLE', details);
    }
}

/**
 * 504 Gateway Timeout - Upstream timeout
 */
class GatewayTimeoutError extends GatewayError {
    constructor(message = 'Gateway Timeout', details = {}) {
        super(message, 504, 'GATEWAY_TIMEOUT', details);
    }
}

/**
 * Circuit Breaker Open - Upstream circuit is open
 */
class CircuitBreakerOpenError extends GatewayError {
    constructor(upstream, details = {}) {
        super(`Circuit breaker open for ${upstream}`, 503, 'CIRCUIT_BREAKER_OPEN', {
            upstream,
            ...details
        });
        this.upstream = upstream;
    }
}

/**
 * Configuration Error - Invalid configuration
 */
class ConfigurationError extends GatewayError {
    constructor(message = 'Configuration Error', details = {}) {
        super(message, 500, 'CONFIGURATION_ERROR', details);
    }
}

/**
 * Plugin Error - Plugin loading or execution error
 */
class PluginError extends GatewayError {
    constructor(pluginName, message = 'Plugin Error', details = {}) {
        super(message, 500, 'PLUGIN_ERROR', { pluginName, ...details });
        this.pluginName = pluginName;
    }
}

/**
 * Check if error is a known gateway error
 * @param {Error} error
 * @returns {boolean}
 */
const isGatewayError = (error) => error instanceof GatewayError;

/**
 * Wrap unknown errors as gateway errors
 * @param {Error} error
 * @returns {GatewayError}
 */
const wrapError = (error) => {
    if (isGatewayError(error)) {
        return error;
    }
    return new GatewayError(error.message, 500, 'INTERNAL_ERROR', {
        originalName: error.name,
        originalCode: error.code
    });
};

module.exports = {
    GatewayError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    RequestTimeoutError,
    RateLimitError,
    BadGatewayError,
    ServiceUnavailableError,
    GatewayTimeoutError,
    CircuitBreakerOpenError,
    ConfigurationError,
    PluginError,
    isGatewayError,
    wrapError
};
