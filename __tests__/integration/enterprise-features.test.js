const request = require('supertest');
const express = require('express');
const securityMiddleware = require('../../middleware/security');
const { globalRateLimiter } = require('../../middleware/rateLimiter');
const requestTimeout = require('../../middleware/requestTimeout');
const { metricsMiddleware, metricsHandler } = require('../../routes/metrics');
const circuitBreakerManager = require('../../lib/circuitBreaker');
const upstreamHealthChecker = require('../../lib/upstreamHealth');

describe('Enterprise Features Integration', () => {
    let app;

    beforeEach(() => {
        app = express();
        securityMiddleware(app);
        app.use(globalRateLimiter);
        app.use(requestTimeout(5000));
        app.use(metricsMiddleware);
        app.get('/test', (req, res) => {
            res.json({ message: 'ok' });
        });
        app.get('/metrics', metricsHandler);
    });

    afterEach(() => {
        circuitBreakerManager.resetAll();
        upstreamHealthChecker.stopAll();
    });

    describe('Security + Rate Limiting + Metrics', () => {
        test('should apply all middleware in correct order', async () => {
            const response = await request(app).get('/test');

            // Security headers
            expect(response.headers['x-content-type-options']).toBe('nosniff');

            // Should not be rate limited
            expect(response.status).toBe(200);

            // Metrics should be recorded
            const metricsResponse = await request(app).get('/metrics');
            expect(metricsResponse.status).toBe(200);
        });

        test('should handle rate limiting with security headers', async () => {
            // Create strict rate limiter
            const strictLimiter = require('../../middleware/rateLimiter').createRateLimiter({
                windowMs: 1000,
                max: 1
            });

            const testApp = express();
            securityMiddleware(testApp);
            testApp.use(strictLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            await request(testApp).get('/test');
            const response = await request(testApp).get('/test');

            expect(response.status).toBe(429);
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });
    });

    describe('Circuit Breaker + Health Check Integration', () => {
        test('should track circuit breaker state in health endpoint', async () => {
            const healthCheck = require('../../routes/health');
            app.get(
                '/health',
                healthCheck(() => ({ some: 'router' }))
            );

            // Create a circuit breaker
            circuitBreakerManager.getBreaker('http://test.com');

            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('circuitBreakers');
            expect(response.body.circuitBreakers['http://test.com']).toBeDefined();
        });

        test('should show degraded status when circuit breakers are open', async () => {
            const healthCheck = require('../../routes/health');
            const upstreamHealthChecker = require('../../lib/upstreamHealth');

            // Mock upstream health to return empty
            jest.spyOn(upstreamHealthChecker, 'getAllHealthStatus').mockReturnValue({});

            // Mock circuit breaker stats to return open state
            jest.spyOn(circuitBreakerManager, 'getStats').mockReturnValue({
                'http://test.com': {
                    state: 'open',
                    failures: 5,
                    fires: 10
                }
            });

            app.get(
                '/health',
                healthCheck(() => ({ some: 'router' }))
            );

            const response = await request(app).get('/health');

            expect(response.status).toBe(503);
            expect(response.body.status).toBe('degraded');

            // Restore mocks
            circuitBreakerManager.getStats.mockRestore();
            upstreamHealthChecker.getAllHealthStatus.mockRestore();
        });
    });

    describe('Metrics + Circuit Breaker Integration', () => {
        test('should include circuit breaker metrics', async () => {
            circuitBreakerManager.getBreaker('http://test1.com');
            circuitBreakerManager.getBreaker('http://test2.com');

            const response = await request(app).get('/metrics');

            expect(response.status).toBe(200);
            expect(response.text).toContain('circuit_breaker_state');
        });
    });

    describe('Request Flow Integration', () => {
        test('should handle complete request flow with all middleware', async () => {
            // Make a request
            const response = await request(app).get('/test');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('ok');

            // Check metrics were recorded
            const metricsResponse = await request(app).get('/metrics');
            expect(metricsResponse.text).toContain('http_requests_total');
        });

        test('should handle errors through all middleware layers', async () => {
            app.get('/error', (req, res, next) => {
                next(new Error('Test error'));
            });
            app.use((err, req, res, _next) => {
                res.status(500).json({ error: err.message });
            });

            const response = await request(app).get('/error');

            expect(response.status).toBe(500);

            // Metrics should still be recorded
            const metricsResponse = await request(app).get('/metrics');
            expect(metricsResponse.text).toContain('http_request_errors_total');
        });
    });
});
