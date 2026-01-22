const circuitBreakerManager = require('../lib/circuitBreaker');
const upstreamHealthChecker = require('../lib/upstreamHealth');

/**
 * Enterprise health check route handler
 * Returns comprehensive gateway status including upstream health and circuit breakers
 * @param {Function|Object} getRouter - Function that returns the current dynamic router, or router directly
 */
const healthCheck = (getRouter) => {
    // Support both function and direct router patterns
    const getRouterValue = typeof getRouter === 'function' ? getRouter : () => getRouter;

    return (req, res) => {
        const router = getRouterValue();
        const timestamp = new Date().toISOString();
        const memoryUsage = process.memoryUsage();

        // Get circuit breaker stats
        const circuitBreakerStats = circuitBreakerManager.getStats();

        // Get upstream health status
        const upstreamHealth = upstreamHealthChecker.getAllHealthStatus();

        // Determine overall health
        // Gateway is healthy if no circuit breakers are open and no upstreams are unhealthy
        // Router being null just means routes aren't loaded yet, but gateway itself is healthy
        const hasOpenCircuitBreakers = Object.values(circuitBreakerStats).some(
            (stats) => stats.state === 'open'
        );
        const hasUnhealthyUpstreams = Object.values(upstreamHealth).some(
            (status) => !status.healthy
        );

        // Only mark as degraded if there are actual problems (open circuits or unhealthy upstreams)
        // Router being null is not a health issue, just a configuration state
        const overallStatus =
            hasOpenCircuitBreakers || hasUnhealthyUpstreams ? 'degraded' : 'healthy';

        const statusCode = overallStatus === 'healthy' ? 200 : 503;

        res.status(statusCode).json({
            status: overallStatus,
            timestamp,
            uptime: Math.floor(process.uptime()), // Round to integer seconds
            routes: router ? 'loaded' : 'not loaded',
            memory: {
                rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
            },
            circuitBreakers: circuitBreakerStats,
            upstreams: upstreamHealth,
            node: {
                version: process.version,
                pid: process.pid,
                platform: process.platform
            }
        });
    };
};

module.exports = healthCheck;
