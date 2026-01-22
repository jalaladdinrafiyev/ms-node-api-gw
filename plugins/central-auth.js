/**
 * Central Authentication Plugin
 *
 * Validates JWT tokens via the Risk Admin Authentication Service.
 * Integrates with /api/v1/authz/verify endpoint.
 *
 * @module plugins/central-auth
 */

const axios = require('axios');
const logger = require('../lib/logger');

// Create axios instance with optimized defaults
const authClient = axios.create({
    timeout: 5000,
    maxRedirects: 0,
    validateStatus: (status) => status < 500,
    httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 5000
    }),
    httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 5000
    })
});

/**
 * Headers to forward from client to auth service
 */
const FORWARDED_HEADERS = [
    'accept-language',
    'device-type',
    'app-version',
    'device-id',
    'x-device-os',
    'gps-coordinates',
    'x-forwarded-for',
    'x-real-ip',
    'user-agent'
];

/**
 * Central authentication plugin factory
 * @param {object} params - Plugin configuration
 * @param {boolean} params.enabled - Whether auth is enabled
 * @param {string} params.authServiceUrl - Auth service base URL
 * @returns {Function} Express middleware
 */
module.exports = (params) => {
    // Validate params
    if (!params || typeof params !== 'object') {
        throw new Error('Plugin params must be an object');
    }

    if (params.enabled && !params.authServiceUrl) {
        throw new Error('authServiceUrl is required when plugin is enabled');
    }

    // Validate and normalize auth service URL
    let authServiceUrl = params.authServiceUrl;
    if (authServiceUrl && typeof authServiceUrl === 'string') {
        authServiceUrl = authServiceUrl.trim().replace(/\/+$/, ''); // Remove trailing slashes
        if (!authServiceUrl.startsWith('http://') && !authServiceUrl.startsWith('https://')) {
            throw new Error('authServiceUrl must be a valid HTTP/HTTPS URL');
        }
    }

    /**
     * Middleware function - runs for every request
     */
    return async (req, res, next) => {
        // Fast path: skip if disabled
        if (!params.enabled) {
            return next();
        }

        // Extract authorization header (case-insensitive)
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (!authHeader || typeof authHeader !== 'string') {
            return res.status(401).json({
                status: 'fail',
                error: 'UNAUTHORIZED',
                errorDetails: [
                    {
                        message: 'Authorization header is required'
                    }
                ]
            });
        }

        try {
            // Build headers to forward to auth service
            const forwardHeaders = {
                Authorization: authHeader,
                'X-Original-URI': req.originalUrl || req.url,
                'X-Original-Method': req.method || 'GET',
                'Content-Type': 'application/json'
            };

            // Forward relevant client headers for context and localization
            for (const header of FORWARDED_HEADERS) {
                const value = req.headers[header];
                if (value) {
                    forwardHeaders[header] = value;
                }
            }

            // Call auth service verify endpoint
            const response = await authClient.post(
                `${authServiceUrl}/api/v1/authz/verify`,
                {}, // Empty body - auth uses Authorization header
                { headers: forwardHeaders }
            );

            // Success: HTTP 200-299 AND verifyStatus: true
            if (
                response.status >= 200 &&
                response.status < 300 &&
                response.data?.data?.verifyStatus === true
            ) {
                // Extract userId (can be string or number)
                const userId = response.data.data.userId;
                if (userId !== undefined && userId !== null) {
                    // Convert to string for header (handles both string and number)
                    req.headers['X-User-Id'] = String(userId);
                } else {
                    logger.warn('Auth service returned empty userId', {
                        url: req.originalUrl,
                        method: req.method
                    });
                }

                // Strip Authorization header before forwarding to downstream
                delete req.headers['authorization'];
                delete req.headers['Authorization'];

                // Continue to next middleware/proxy
                return next();
            }

            // Auth failed - forward the exact response from auth service
            // This preserves localized error messages from ms-i18n
            const statusCode =
                response.status >= 400 && response.status < 500 ? response.status : 401;

            return res.status(statusCode).json(
                response.data || {
                    status: 'fail',
                    error: 'UNAUTHORIZED',
                    errorDetails: [
                        {
                            message: 'Authentication failed'
                        }
                    ]
                }
            );
        } catch (error) {
            // Network/connection errors
            const errorContext = {
                error: error.message,
                code: error.code,
                url: `${authServiceUrl}/api/v1/authz/verify`,
                method: req.method,
                originalUrl: req.originalUrl
            };

            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                logger.error('Auth Service unreachable', errorContext);
                return res.status(502).json({
                    status: 'fail',
                    error: 'AUTH_SERVICE_UNAVAILABLE',
                    errorDetails: [
                        {
                            message: 'Authentication service is not responding'
                        }
                    ]
                });
            }

            if (error.code === 'ENOTFOUND') {
                logger.error('Auth Service host not found', errorContext);
                return res.status(502).json({
                    status: 'fail',
                    error: 'AUTH_SERVICE_UNAVAILABLE',
                    errorDetails: [
                        {
                            message: 'Authentication service host not found'
                        }
                    ]
                });
            }

            // Generic error
            logger.error('Auth Service Error', { ...errorContext, stack: error.stack });
            return res.status(502).json({
                status: 'fail',
                error: 'AUTH_SERVICE_UNAVAILABLE',
                errorDetails: [
                    {
                        message: 'An error occurred while authenticating'
                    }
                ]
            });
        }
    };
};
