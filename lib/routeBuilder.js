/**
 * Route Builder
 * 
 * Builds Express router from gateway.yaml configuration
 * with enterprise features: circuit breakers, retry, load balancing.
 * 
 * @module lib/routeBuilder
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const https = require('https');
const config = require('./config');
const { loadPlugin } = require('./pluginLoader');
const logger = require('./logger');
const circuitBreakerManager = require('./circuitBreaker');
const retryManager = require('./retry');
const loadBalancer = require('./loadBalancer');
const upstreamHealthChecker = require('./upstreamHealth');
const { upstreamRequestDuration, upstreamRequestTotal } = require('../routes/metrics');

// Connection pooling agents
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: config.connectionPool.keepAliveMs,
    maxSockets: config.connectionPool.maxSockets,
    maxFreeSockets: config.connectionPool.maxFreeSockets,
    timeout: config.connectionPool.timeout
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: config.connectionPool.keepAliveMs,
    maxSockets: config.connectionPool.maxSockets,
    maxFreeSockets: config.connectionPool.maxFreeSockets,
    timeout: config.connectionPool.timeout
});

// Per-route state for load balancing
const routeState = new Map();

/**
 * Build Express router from route configuration
 * @param {Array} routes - Route configurations from gateway.yaml
 * @returns {express.Router} Configured Express router
 * @throws {Error} If routes is not an array
 */
const buildRouter = (routes) => {
    if (!Array.isArray(routes)) {
        throw new Error('Routes must be an array');
    }
    
    const router = express.Router();
    routeState.clear();

    for (const route of routes) {
        if (!isValidRoute(route)) {
            continue;
        }

        const upstreams = loadBalancer.parseUpstreams(route.upstream);
        if (upstreams.length === 0) {
            logger.warn('Skipping invalid route: no valid upstreams', { route });
            continue;
        }

        // Start health monitoring for all upstreams
        upstreams.forEach(upstream => upstreamHealthChecker.startMonitoring(upstream, {
            healthPath: route.healthPath  // Optional per-route health check path
        }));

        // Initialize load balancer state
        routeState.set(route.path, { index: 0 });

        // Attach plugins
        attachPlugins(router, route);

        // Create enterprise proxy middleware
        const proxyMiddleware = createEnterpriseProxy(route, upstreams);
        router.use(route.path, proxyMiddleware);
    }

    return router;
};

/**
 * Validate route configuration
 * @private
 */
function isValidRoute(route) {
    if (!route.path || typeof route.path !== 'string') {
        logger.warn('Skipping invalid route: path must be a non-empty string', { route });
        return false;
    }
    return true;
}

/**
 * Attach plugin middleware to router
 * @private
 */
function attachPlugins(router, route) {
    if (!Array.isArray(route.plugins)) {
        return;
    }

    for (const pluginConfig of route.plugins) {
        if (!pluginConfig?.enabled) {
            continue;
        }
        
        if (typeof pluginConfig.name !== 'string') {
            logger.warn('Invalid plugin config: name must be a string', { 
                routePath: route.path, 
                pluginConfig 
            });
            continue;
        }

        const middleware = loadPlugin(pluginConfig.name, pluginConfig);
        if (middleware) {
            router.use(route.path, middleware);
        }
    }
}

/**
 * Create enterprise proxy middleware
 * @private
 */
function createEnterpriseProxy(route, upstreams) {
    const routePath = route.path;
    const timeout = route.timeout || config.timeouts.upstream;
    const loadBalanceStrategy = route.loadBalanceStrategy || 'health_aware';
    const enableRetry = route.retry !== false;
    const maxRetries = route.maxRetries || config.retry.maxRetries;

    return (req, res, next) => {
        const startTime = process.hrtime.bigint();
        const state = routeState.get(routePath) || { index: 0 };

        const tryProxy = (upstreamList, currentAttempt = 0) => {
            // Filter out upstreams with open circuit breakers
            const availableUpstreams = upstreamList.filter(upstream => 
                !circuitBreakerManager.isOpen(upstream)
            );

            // Select upstream
            const selectedUpstream = availableUpstreams.length > 0
                ? loadBalancer.selectUpstream(availableUpstreams, loadBalanceStrategy, state)
                : loadBalancer.selectUpstream(upstreamList, loadBalanceStrategy, state);
            
            if (!selectedUpstream) {
                logger.error('No upstream available', { routePath, upstreams: upstreamList });
                if (!res.headersSent) {
                    return res.status(503).json({
                        error: 'Service Unavailable',
                        message: 'No upstream services available'
                    });
                }
                return;
            }

            routeState.set(routePath, state);

            // Check circuit breaker
            if (circuitBreakerManager.isOpen(selectedUpstream)) {
                if (currentAttempt < maxRetries && upstreamList.length > 1) {
                    const remaining = upstreamList.filter(u => u !== selectedUpstream);
                    return tryProxy(remaining, currentAttempt + 1);
                }
                
                if (!res.headersSent) {
                    return res.status(503).json({
                        error: 'Service Unavailable',
                        message: `Upstream ${selectedUpstream} is unavailable (circuit breaker open)`,
                        timestamp: new Date().toISOString()
                    });
                }
                return;
            }

            // Create proxy
            const proxy = createProxyMiddleware({
                target: selectedUpstream,
                changeOrigin: true,
                pathRewrite: { [`^${routePath}`]: '' },
                timeout,
                proxyTimeout: timeout,
                agent: selectedUpstream.startsWith('https') ? httpsAgent : httpAgent,
                
                onProxyReq: (proxyReq, req) => {
                    req.on('close', () => {
                        if (!res.headersSent) {
                            proxyReq.destroy();
                        }
                    });

                    logger.debug('Proxying request', {
                        method: req.method,
                        originalUrl: req.originalUrl,
                        target: selectedUpstream,
                        attempt: currentAttempt + 1
                    });
                },
                
                onProxyRes: (proxyRes, req) => {
                    recordMetrics(startTime, selectedUpstream, req.method, proxyRes.statusCode);
                    
                    // Update circuit breaker state based on response
                    // Success: 2xx, 3xx, 4xx (client errors don't indicate upstream failure)
                    // Failure: 5xx (server errors indicate upstream issues)
                    if (proxyRes.statusCode < 500) {
                        circuitBreakerManager.recordSuccess(selectedUpstream);
                    } else {
                        circuitBreakerManager.recordFailure(selectedUpstream, { 
                            status: proxyRes.statusCode 
                        });
                    }
                    
                    logger.debug('Proxy response received', {
                        method: req.method,
                        originalUrl: req.originalUrl,
                        target: selectedUpstream,
                        statusCode: proxyRes.statusCode
                    });
                },
                
                onError: async (err, req, res) => {
                    logger.error('Proxy error', {
                        requestId: req.requestId,
                        error: err.message,
                        code: err.code,
                        method: req.method,
                        url: req.originalUrl,
                        target: selectedUpstream,
                        attempt: currentAttempt + 1
                    });

                    // Record failure in circuit breaker (let it manage state)
                    // Only network/server errors affect circuit state (not 4xx)
                    circuitBreakerManager.recordFailure(selectedUpstream, err);

                    // Retry if possible
                    const isRetryable = config.retry.retryableCodes.includes(err.code);
                    
                    if (enableRetry && isRetryable && currentAttempt < maxRetries && !res.headersSent) {
                        const delay = Math.min(100 * Math.pow(2, currentAttempt), 1000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return tryProxy(upstreamList, currentAttempt + 1);
                    }

                    if (!res.headersSent) {
                        res.status(502).json({
                            error: 'Bad Gateway',
                            message: `Failed to connect to upstream: ${selectedUpstream}`,
                            details: config.isDevelopment ? err.message : undefined,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            });

            proxy(req, res, (err) => {
                if (err && !res.headersSent) {
                    if (enableRetry && currentAttempt < maxRetries) {
                        const delay = Math.min(100 * Math.pow(2, currentAttempt), 1000);
                        setTimeout(() => tryProxy(upstreamList, currentAttempt + 1), delay);
                    } else {
                        res.status(502).json({
                            error: 'Bad Gateway',
                            message: 'Proxy error',
                            timestamp: new Date().toISOString()
                        });
                    }
                } else if (!err) {
                    next();
                }
            });
        };

        tryProxy(upstreams, 0);
    };
}

/**
 * Record upstream metrics
 * @private
 */
function recordMetrics(startTime, upstream, method, statusCode) {
    const durationNs = process.hrtime.bigint() - startTime;
    const durationSeconds = Number(durationNs) / 1e9;
    const statusStr = statusCode.toString();

    upstreamRequestDuration.observe(
        { upstream, method, status_code: statusStr },
        durationSeconds
    );
    upstreamRequestTotal.inc({ upstream, method, status_code: statusStr });
}

module.exports = { buildRouter };
