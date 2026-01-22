const request = require('supertest');
const express = require('express');
const { livenessProbe, readinessProbe, startupProbe } = require('../../routes/probes');

// Mock dependencies
jest.mock('../../lib/circuitBreaker', () => ({
    getStats: jest.fn(() => ({}))
}));

jest.mock('../../lib/upstreamHealth', () => ({
    getAllHealthStatus: jest.fn(() => ({}))
}));

const circuitBreakerManager = require('../../lib/circuitBreaker');
const upstreamHealthChecker = require('../../lib/upstreamHealth');

describe('Kubernetes Probes', () => {
    describe('Liveness Probe', () => {
        let app;

        beforeEach(() => {
            app = express();
            app.get('/livez', livenessProbe);
        });

        test('should return 200 status', async () => {
            const response = await request(app).get('/livez');
            expect(response.status).toBe(200);
        });

        test('should return alive status', async () => {
            const response = await request(app).get('/livez');
            expect(response.body.status).toBe('alive');
        });

        test('should include timestamp', async () => {
            const response = await request(app).get('/livez');
            expect(response.body.timestamp).toBeDefined();
            expect(new Date(response.body.timestamp).getTime()).not.toBeNaN();
        });

        test('should include process info', async () => {
            const response = await request(app).get('/livez');
            expect(response.body.pid).toBe(process.pid);
            expect(typeof response.body.uptime).toBe('number');
        });
    });

    describe('Readiness Probe', () => {
        let app;

        beforeEach(() => {
            jest.clearAllMocks();
            circuitBreakerManager.getStats.mockReturnValue({});
            upstreamHealthChecker.getAllHealthStatus.mockReturnValue({});

            app = express();
        });

        test('should return 200 when routes are loaded', async () => {
            app.get(
                '/readyz',
                readinessProbe(() => ({ stack: [] }))
            );

            const response = await request(app).get('/readyz');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ready');
        });

        test('should return 503 when routes are not loaded', async () => {
            app.get(
                '/readyz',
                readinessProbe(() => null)
            );

            const response = await request(app).get('/readyz');
            expect(response.status).toBe(503);
            expect(response.body.status).toBe('not_ready');
            expect(response.body.issues).toContain('Routes not loaded');
        });

        test('should return 503 when circuit breakers are open', async () => {
            circuitBreakerManager.getStats.mockReturnValue({
                'http://upstream1': { state: 'open' }
            });
            app.get(
                '/readyz',
                readinessProbe(() => ({ stack: [] }))
            );

            const response = await request(app).get('/readyz');
            expect(response.status).toBe(503);
            expect(response.body.issues).toBeDefined();
            expect(response.body.issues.some((i) => i.includes('Circuit breakers open'))).toBe(
                true
            );
        });

        test('should return 503 when all upstreams are unhealthy', async () => {
            upstreamHealthChecker.getAllHealthStatus.mockReturnValue({
                'http://upstream1': { healthy: false },
                'http://upstream2': { healthy: false }
            });
            app.get(
                '/readyz',
                readinessProbe(() => ({ stack: [] }))
            );

            const response = await request(app).get('/readyz');
            expect(response.status).toBe(503);
            expect(response.body.issues).toContain('All upstreams unhealthy');
        });

        test('should return 200 when some upstreams are healthy', async () => {
            upstreamHealthChecker.getAllHealthStatus.mockReturnValue({
                'http://upstream1': { healthy: true },
                'http://upstream2': { healthy: false }
            });
            app.get(
                '/readyz',
                readinessProbe(() => ({ stack: [] }))
            );

            const response = await request(app).get('/readyz');
            expect(response.status).toBe(200);
        });

        test('should include checks summary', async () => {
            app.get(
                '/readyz',
                readinessProbe(() => ({ stack: [] }))
            );

            const response = await request(app).get('/readyz');
            expect(response.body.checks).toBeDefined();
            expect(response.body.checks.routesLoaded).toBe(true);
            expect(typeof response.body.checks.openCircuitBreakers).toBe('number');
        });
    });

    describe('Startup Probe', () => {
        let app;

        beforeEach(() => {
            app = express();
        });

        test('should return 200 when router is defined (even null means startup complete)', async () => {
            // null router means routes failed to load, but startup is complete
            app.get(
                '/startupz',
                startupProbe(() => null)
            );

            const response = await request(app).get('/startupz');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('started');
        });

        test('should return 503 when router is undefined (still starting)', async () => {
            app.get(
                '/startupz',
                startupProbe(() => undefined)
            );

            const response = await request(app).get('/startupz');
            expect(response.status).toBe(503);
            expect(response.body.status).toBe('starting');
        });

        test('should return 200 when router is loaded', async () => {
            app.get(
                '/startupz',
                startupProbe(() => ({ stack: [] }))
            );

            const response = await request(app).get('/startupz');
            expect(response.status).toBe(200);
            expect(response.body.routesLoaded).toBe(true);
        });
    });
});
