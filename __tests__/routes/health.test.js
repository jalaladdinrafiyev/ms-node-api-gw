const healthCheck = require('../../routes/health');
const circuitBreakerManager = require('../../lib/circuitBreaker');
const upstreamHealthChecker = require('../../lib/upstreamHealth');

describe('Health Check Route', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        // Reset circuit breakers and health checkers
        circuitBreakerManager.resetAll();
        upstreamHealthChecker.stopAll();
        // Mock getAllHealthStatus to return empty by default
        jest.spyOn(upstreamHealthChecker, 'getAllHealthStatus').mockReturnValue({});
    });

    test('should return 200 status', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
    });

    test('should return healthy status', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response).toHaveProperty('status', 'healthy');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('uptime');
        expect(response).toHaveProperty('routes');
    });

    test('should indicate routes not loaded when router is null', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.routes).toBe('not loaded');
    });

    test('should indicate routes loaded when router exists', () => {
        const mockRouter = { some: 'router' };
        const handler = healthCheck(() => mockRouter);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.routes).toBe('loaded');
    });

    test('should accept router directly (not a function)', () => {
        const mockRouter = { some: 'router' };
        const handler = healthCheck(mockRouter);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.routes).toBe('loaded');
    });

    test('should include timestamp', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.timestamp).toBeDefined();
        expect(new Date(response.timestamp).getTime()).not.toBeNaN();
    });

    test('should include uptime', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response.uptime).toBeDefined();
        expect(typeof response.uptime).toBe('number');
        expect(response.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should include circuit breaker stats', () => {
        circuitBreakerManager.getBreaker('http://test.com');
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response).toHaveProperty('circuitBreakers');
        expect(response.circuitBreakers).toBeDefined();
    });

    test('should include upstream health status', async () => {
        // Mock upstream health checker
        jest.spyOn(upstreamHealthChecker, 'getAllHealthStatus').mockReturnValue({
            'http://test.com': {
                healthy: true,
                lastCheck: new Date().toISOString(),
                consecutiveFailures: 0,
                consecutiveSuccesses: 1
            }
        });

        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response).toHaveProperty('upstreams');
        expect(response.upstreams).toBeDefined();
    });

    test('should return degraded status when circuit breakers are open', () => {
        // Mock getAllHealthStatus to return empty (no unhealthy upstreams)
        upstreamHealthChecker.getAllHealthStatus.mockReturnValue({});
        
        // Mock getStats to return an open circuit breaker
        jest.spyOn(circuitBreakerManager, 'getStats').mockReturnValue({
            'http://test.com': {
                state: 'open',
                failures: 5,
                fires: 10
            }
        });

        const handler = healthCheck(() => ({ some: 'router' }));
        handler(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        const response = res.json.mock.calls[0][0];
        expect(response.status).toBe('degraded');
        
        // Restore the original method
        circuitBreakerManager.getStats.mockRestore();
    });

    test('should return degraded status when upstreams are unhealthy', () => {
        jest.spyOn(upstreamHealthChecker, 'getAllHealthStatus').mockReturnValue({
            'http://test.com': {
                healthy: false,
                lastCheck: new Date().toISOString(),
                consecutiveFailures: 3,
                consecutiveSuccesses: 0
            }
        });

        const handler = healthCheck(() => ({ some: 'router' }));
        handler(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        const response = res.json.mock.calls[0][0];
        expect(response.status).toBe('degraded');
    });

    test('should include node information', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response).toHaveProperty('node');
        expect(response.node).toHaveProperty('version');
        expect(response.node).toHaveProperty('pid');
        expect(response.node).toHaveProperty('platform');
    });

    test('should include memory information', () => {
        const handler = healthCheck(() => null);
        handler(req, res);

        const response = res.json.mock.calls[0][0];
        expect(response).toHaveProperty('memory');
        expect(response.memory).toHaveProperty('rss');
        expect(response.memory).toHaveProperty('heapTotal');
        expect(response.memory).toHaveProperty('heapUsed');
        expect(response.memory).toHaveProperty('external');
    });
});
