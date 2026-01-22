describe('Lib Barrel Exports', () => {
    test('should export all lib modules', () => {
        const lib = require('../../lib');
        
        expect(lib.config).toBeDefined();
        expect(lib.errors).toBeDefined();
        expect(lib.circuitBreaker).toBeDefined();
        expect(lib.configLoader).toBeDefined();
        expect(lib.loadBalancer).toBeDefined();
        expect(lib.logger).toBeDefined();
        expect(lib.pluginLoader).toBeDefined();
        expect(lib.retry).toBeDefined();
        expect(lib.routeBuilder).toBeDefined();
        expect(lib.shutdown).toBeDefined();
        expect(lib.upstreamHealth).toBeDefined();
        expect(lib.watcher).toBeDefined();
    });

    test('config should be frozen object', () => {
        const { config } = require('../../lib');
        expect(Object.isFrozen(config)).toBe(true);
    });

    test('errors should have error classes', () => {
        const { errors } = require('../../lib');
        expect(errors.GatewayError).toBeDefined();
        expect(errors.BadRequestError).toBeDefined();
        expect(errors.NotFoundError).toBeDefined();
    });

    test('logger should have logging methods', () => {
        const { logger } = require('../../lib');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
    });
});
