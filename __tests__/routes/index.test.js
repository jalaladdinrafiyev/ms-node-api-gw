describe('Routes Barrel Exports', () => {
    test('should export all route modules', () => {
        const routes = require('../../routes');

        // Health check
        expect(routes.healthCheck).toBeDefined();
        expect(typeof routes.healthCheck).toBe('function');

        // Probes
        expect(routes.probes).toBeDefined();
        expect(routes.livenessProbe).toBeDefined();
        expect(routes.readinessProbe).toBeDefined();
        expect(routes.startupProbe).toBeDefined();

        // Metrics
        expect(routes.metrics).toBeDefined();
        expect(routes.metricsMiddleware).toBeDefined();
        expect(routes.metricsHandler).toBeDefined();
        expect(routes.metricsRegister).toBeDefined();
    });

    test('healthCheck should return a middleware factory', () => {
        const { healthCheck } = require('../../routes');
        const middleware = healthCheck(() => null);
        expect(typeof middleware).toBe('function');
    });

    test('livenessProbe should be a request handler', () => {
        const { livenessProbe } = require('../../routes');
        expect(typeof livenessProbe).toBe('function');
    });

    test('readinessProbe should return a request handler', () => {
        const { readinessProbe } = require('../../routes');
        const handler = readinessProbe(() => null);
        expect(typeof handler).toBe('function');
    });

    test('metricsMiddleware should be a middleware function', () => {
        const { metricsMiddleware } = require('../../routes');
        expect(typeof metricsMiddleware).toBe('function');
    });

    test('metricsHandler should be an async function', () => {
        const { metricsHandler } = require('../../routes');
        expect(typeof metricsHandler).toBe('function');
    });
});
