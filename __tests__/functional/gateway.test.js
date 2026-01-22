const request = require('supertest');
const express = require('express');
const requestLogger = require('../../middleware/requestLogger');
const {
    notFoundHandler,
    globalErrorHandler,
    gatewayNotConfiguredHandler
} = require('../../middleware/errorHandler');
const { loadConfig } = require('../../lib/configLoader');
const healthCheck = require('../../routes/health');
const circuitBreakerManager = require('../../lib/circuitBreaker');
const upstreamHealthChecker = require('../../lib/upstreamHealth');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Gateway Functional Tests', () => {
    let app;
    let dynamicRouter;
    const testConfigPath = path.join(__dirname, '../fixtures/test-gateway.yaml');
    const testConfigDir = path.dirname(testConfigPath);

    beforeEach(() => {
        // Create test fixtures directory
        if (!fs.existsSync(testConfigDir)) {
            fs.mkdirSync(testConfigDir, { recursive: true });
        }

        // Reset circuit breakers and health checkers
        circuitBreakerManager.resetAll();
        upstreamHealthChecker.stopAll();

        // Mock upstream health to return empty (no unhealthy upstreams)
        jest.spyOn(upstreamHealthChecker, 'getAllHealthStatus').mockReturnValue({});

        app = express();
        app.use(express.json());
        app.use(requestLogger);

        // Setup health check
        app.get(
            '/health',
            healthCheck(() => dynamicRouter)
        );

        // Setup main router
        app.use((req, res, next) => {
            if (!dynamicRouter) {
                return gatewayNotConfiguredHandler(req, res);
            }
            dynamicRouter(req, res, next);
        });

        app.use(notFoundHandler);
        app.use(globalErrorHandler);
    });

    afterEach(() => {
        dynamicRouter = null;
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
        // Restore mocks
        jest.restoreAllMocks();
    });

    describe('Health Check Endpoint', () => {
        test('GET /health should return 200', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('routes');
        });

        test('GET /health should indicate routes not loaded initially', async () => {
            const response = await request(app).get('/health');

            expect(response.body.routes).toBe('not loaded');
        });
    });

    describe('Gateway Not Configured', () => {
        test('should return 503 when no routes are loaded', async () => {
            const response = await request(app).get('/any-route');

            expect(response.status).toBe(503);
            expect(response.body.error).toBe('Gateway not configured');
        });
    });

    describe('404 Handler', () => {
        test('should return 404 for unmatched routes after router is loaded', async () => {
            // Create a minimal config
            const config = {
                version: '2.2.0',
                routes: [
                    {
                        path: '/test',
                        upstream: 'http://localhost:8080'
                    }
                ]
            };

            fs.writeFileSync(testConfigPath, yaml.dump(config));
            dynamicRouter = loadConfig(testConfigPath);

            const response = await request(app).get('/nonexistent-route');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Not Found');
            expect(response.body.message).toContain('nonexistent-route');
        });
    });

    describe('Error Handling', () => {
        test('should handle errors gracefully', async () => {
            // Create a route that throws an error
            const express = require('express');
            const errorRouter = express.Router();
            errorRouter.get('/error', (req, res, next) => {
                next(new Error('Test error'));
            });

            dynamicRouter = errorRouter;

            const response = await request(app).get('/error');

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Internal Server Error');
        });

        test('should show error message in development', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const express = require('express');
            const errorRouter = express.Router();
            errorRouter.get('/error', (req, res, next) => {
                next(new Error('Test error message'));
            });

            dynamicRouter = errorRouter;

            const response = await request(app).get('/error');

            expect(response.body.message).toBe('Test error message');

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('Request Logging', () => {
        test('should log requests', async () => {
            const logger = require('../../lib/logger');
            const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();

            await request(app).get('/health');

            expect(loggerInfoSpy).toHaveBeenCalled();

            loggerInfoSpy.mockRestore();
        });
    });

    describe('Metrics Endpoint', () => {
        test('should expose metrics endpoint', async () => {
            const { metricsHandler } = require('../../routes/metrics');
            const testApp = express();
            testApp.get('/metrics', metricsHandler);

            const response = await request(testApp).get('/metrics');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toContain('text/plain');
        });
    });

    describe('Enhanced Health Endpoint', () => {
        test('should include circuit breaker stats', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('circuitBreakers');
            expect(response.body).toHaveProperty('upstreams');
            expect(response.body).toHaveProperty('node');
        });
    });
});
