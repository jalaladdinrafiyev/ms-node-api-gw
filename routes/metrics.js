const client = require('prom-client');
const logger = require('../lib/logger');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for API Gateway
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

const httpRequestErrors = new client.Counter({
    name: 'http_request_errors_total',
    help: 'Total number of HTTP request errors',
    labelNames: ['method', 'route', 'error_type']
});

const upstreamRequestDuration = new client.Histogram({
    name: 'upstream_request_duration_seconds',
    help: 'Duration of upstream requests in seconds',
    labelNames: ['upstream', 'method', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const upstreamRequestTotal = new client.Counter({
    name: 'upstream_requests_total',
    help: 'Total number of upstream requests',
    labelNames: ['upstream', 'method', 'status_code']
});

const circuitBreakerState = new client.Gauge({
    name: 'circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['upstream']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestErrors);
register.registerMetric(upstreamRequestDuration);
register.registerMetric(upstreamRequestTotal);
register.registerMetric(circuitBreakerState);

/**
 * Metrics middleware - records request metrics
 */
const metricsMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const route = req.route?.path || req.path || 'unknown';

    // Record response when finished
    res.on('finish', () => {
        const durationNs = process.hrtime.bigint() - startTime;
        const durationSeconds = Number(durationNs) / 1e9;
        const statusCode = res.statusCode.toString();

        // Record metrics
        httpRequestDuration.observe(
            { method: req.method, route, status_code: statusCode },
            durationSeconds
        );
        httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });

        // Record errors
        if (res.statusCode >= 400) {
            httpRequestErrors.inc({
                method: req.method,
                route,
                error_type: res.statusCode >= 500 ? 'server_error' : 'client_error'
            });
        }
    });

    next();
};

/**
 * Metrics endpoint handler
 */
const metricsHandler = async (req, res) => {
    try {
        // Update circuit breaker metrics
        const circuitBreakerManager = require('../lib/circuitBreaker');
        const breakerStats = circuitBreakerManager.getStats();

        for (const [upstream, stats] of Object.entries(breakerStats)) {
            const stateValue = stats.state === 'open' ? 1 : stats.state === 'halfOpen' ? 2 : 0;
            circuitBreakerState.set({ upstream }, stateValue);
        }

        // Get metrics first, then set headers and send response
        const metrics = await register.metrics();

        // Only set headers if we successfully got metrics
        if (!res.headersSent) {
            res.set('Content-Type', register.contentType);
            res.end(metrics);
        }
    } catch (error) {
        logger.error('Error generating metrics', { error: error.message, stack: error.stack });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate metrics' });
        } else {
            // If headers already sent, we can't send JSON, so end the response
            res.end();
        }
    }
};

module.exports = {
    metricsMiddleware,
    metricsHandler,
    register,
    httpRequestDuration,
    httpRequestTotal,
    httpRequestErrors,
    upstreamRequestDuration,
    upstreamRequestTotal,
    circuitBreakerState
};
