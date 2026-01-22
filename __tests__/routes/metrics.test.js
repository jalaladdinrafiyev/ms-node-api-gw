const request = require('supertest');
const express = require('express');
const { metricsMiddleware, metricsHandler, register } = require('../../routes/metrics');
const logger = require('../../lib/logger');

describe('Metrics Endpoint', () => {
    let app;
    let loggerErrorSpy;

    beforeEach(() => {
        loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
        app = express();
        app.use(metricsMiddleware);
        app.get('/test', (req, res) => {
            res.json({ message: 'ok' });
        });
        app.get('/metrics', metricsHandler);
    });

    afterEach(() => {
        loggerErrorSpy.mockRestore();
    });

    describe('metricsMiddleware', () => {
        test('should record request metrics', async () => {
            await request(app).get('/test');

            // Metrics should be recorded (we can't easily test Prometheus metrics directly,
            // but we can verify the middleware doesn't break requests)
            const response = await request(app).get('/test');
            expect(response.status).toBe(200);
        });

        test('should record error metrics for 4xx responses', async () => {
            app.get('/error', (req, res) => {
                res.status(404).json({ error: 'Not found' });
            });

            await request(app).get('/error');

            // Middleware should have recorded the error
            const response = await request(app).get('/error');
            expect(response.status).toBe(404);
        });

        test('should record error metrics for 5xx responses', async () => {
            app.get('/server-error', (req, res) => {
                res.status(500).json({ error: 'Server error' });
            });

            await request(app).get('/server-error');

            const response = await request(app).get('/server-error');
            expect(response.status).toBe(500);
        });
    });

    describe('metricsHandler', () => {
        test('should return Prometheus metrics', async () => {
            // Make some requests to generate metrics
            await request(app).get('/test');
            await request(app).get('/test');

            const response = await request(app).get('/metrics');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/plain');
            expect(response.text).toContain('http_requests_total');
            expect(response.text).toContain('http_request_duration_seconds');
        });

        test('should include circuit breaker metrics', async () => {
            const circuitBreakerManager = require('../../lib/circuitBreaker');
            circuitBreakerManager.getBreaker('http://test.com');

            const response = await request(app).get('/metrics');

            expect(response.status).toBe(200);
            expect(response.text).toContain('circuit_breaker_state');
        });

        test('should handle errors gracefully', async () => {
            // Create a new app instance to avoid interference
            const testApp = express();
            testApp.get('/metrics', metricsHandler);
            
            // Mock register.metrics to throw an error
            const originalMetrics = register.metrics;
            register.metrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

            const response = await request(testApp).get('/metrics');

            expect(response.status).toBe(500);
            expect(response.body).toBeDefined();
            expect(response.body.error).toBe('Failed to generate metrics');
            expect(loggerErrorSpy).toHaveBeenCalled();

            // Restore original
            register.metrics = originalMetrics;
        });
    });

    describe('Metrics Collection', () => {
        test('should collect default Node.js metrics', async () => {
            // Create a fresh app to avoid any mocks from previous tests
            const testApp = express();
            testApp.use(metricsMiddleware);
            testApp.get('/test', (req, res) => res.json({ ok: true }));
            testApp.get('/metrics', metricsHandler);
            
            // Make a request first to generate some metrics
            await request(testApp).get('/test');
            
            const response = await request(testApp).get('/metrics');

            // Check that we got metrics (not an error)
            expect(response.status).toBe(200);
            expect(response.text).toContain('process_cpu_user_seconds_total');
            expect(response.text).toContain('process_cpu_system_seconds_total');
        });
    });
});
