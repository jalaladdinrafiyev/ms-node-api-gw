/**
 * Kubernetes Probes
 * 
 * Provides separate endpoints for liveness and readiness probes.
 * 
 * Liveness: Is the process alive? (restarts container if fails)
 * Readiness: Is the service ready to receive traffic? (removes from load balancer if fails)
 * 
 * @module routes/probes
 */

const circuitBreakerManager = require('../lib/circuitBreaker');
const upstreamHealthChecker = require('../lib/upstreamHealth');

/**
 * Liveness probe - checks if the process is alive
 * Returns 200 if the event loop is responsive
 * @param {express.Request} req
 * @param {express.Response} res
 */
const livenessProbe = (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: Math.floor(process.uptime())
    });
};

/**
 * Readiness probe factory - checks if the service is ready for traffic
 * @param {Function} getRouter - Function that returns the current dynamic router
 * @returns {Function} Express request handler
 */
const readinessProbe = (getRouter) => {
    const getRouterValue = typeof getRouter === 'function' 
        ? getRouter 
        : () => getRouter;

    return (req, res) => {
        const router = getRouterValue();
        const timestamp = new Date().toISOString();
        
        // Check conditions for readiness
        const issues = [];
        
        // 1. Routes must be loaded
        if (!router) {
            issues.push('Routes not loaded');
        }
        
        // 2. Check circuit breakers - too many open = not ready
        const breakerStats = circuitBreakerManager.getStats();
        const openBreakers = Object.entries(breakerStats)
            .filter(([_, stats]) => stats.state === 'open')
            .map(([upstream]) => upstream);
        
        if (openBreakers.length > 0) {
            issues.push(`Circuit breakers open: ${openBreakers.join(', ')}`);
        }
        
        // 3. Check upstream health - all unhealthy = not ready
        const upstreamHealth = upstreamHealthChecker.getAllHealthStatus();
        const upstreamEntries = Object.entries(upstreamHealth);
        const unhealthyUpstreams = upstreamEntries
            .filter(([_, status]) => !status.healthy)
            .map(([upstream]) => upstream);
        
        // Only mark not ready if ALL upstreams are unhealthy (and we have upstreams)
        if (upstreamEntries.length > 0 && unhealthyUpstreams.length === upstreamEntries.length) {
            issues.push('All upstreams unhealthy');
        }
        
        const isReady = issues.length === 0;
        const statusCode = isReady ? 200 : 503;
        
        res.status(statusCode).json({
            status: isReady ? 'ready' : 'not_ready',
            timestamp,
            issues: isReady ? undefined : issues,
            checks: {
                routesLoaded: !!router,
                openCircuitBreakers: openBreakers.length,
                unhealthyUpstreams: unhealthyUpstreams.length,
                totalUpstreams: upstreamEntries.length
            }
        });
    };
};

/**
 * Startup probe - checks if the application has started
 * More lenient than readiness - only checks basic startup conditions
 * @param {Function} getRouter - Function that returns the current dynamic router
 * @returns {Function} Express request handler
 */
const startupProbe = (getRouter) => {
    const getRouterValue = typeof getRouter === 'function' 
        ? getRouter 
        : () => getRouter;

    return (req, res) => {
        const router = getRouterValue();
        const timestamp = new Date().toISOString();
        
        // Startup probe is more lenient - just check if routes are loading
        // This gives the app time to load config without being killed
        const isStarted = router !== undefined; // null or actual router = started
        const statusCode = isStarted ? 200 : 503;
        
        res.status(statusCode).json({
            status: isStarted ? 'started' : 'starting',
            timestamp,
            routesLoaded: !!router
        });
    };
};

module.exports = {
    livenessProbe,
    readinessProbe,
    startupProbe
};
