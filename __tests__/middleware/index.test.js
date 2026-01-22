describe('Middleware Barrel Exports', () => {
    test('should export all middleware modules', () => {
        const middleware = require('../../middleware');
        
        // Security
        expect(middleware.security).toBeDefined();
        expect(middleware.applySecurityMiddleware).toBeDefined();
        expect(typeof middleware.security).toBe('function');
        
        // Rate limiting
        expect(middleware.rateLimiter).toBeDefined();
        expect(middleware.createRateLimiter).toBeDefined();
        expect(middleware.globalRateLimiter).toBeDefined();
        expect(middleware.strictRateLimiter).toBeDefined();
        
        // Request handling
        expect(middleware.requestId).toBeDefined();
        expect(middleware.requestLogger).toBeDefined();
        expect(middleware.requestTimeout).toBeDefined();
        
        // Error handling
        expect(middleware.errorHandler).toBeDefined();
        expect(middleware.notFoundHandler).toBeDefined();
        expect(middleware.globalErrorHandler).toBeDefined();
        expect(middleware.gatewayNotConfiguredHandler).toBeDefined();
    });

    test('security should be a function', () => {
        const { security } = require('../../middleware');
        expect(typeof security).toBe('function');
    });

    test('requestLogger should be a middleware function', () => {
        const { requestLogger } = require('../../middleware');
        expect(typeof requestLogger).toBe('function');
    });

    test('requestTimeout should return middleware function', () => {
        const { requestTimeout } = require('../../middleware');
        expect(typeof requestTimeout).toBe('function');
        expect(typeof requestTimeout()).toBe('function');
    });

    test('error handlers should be functions', () => {
        const { notFoundHandler, globalErrorHandler, gatewayNotConfiguredHandler } = require('../../middleware');
        expect(typeof notFoundHandler).toBe('function');
        expect(typeof globalErrorHandler).toBe('function');
        expect(typeof gatewayNotConfiguredHandler).toBe('function');
    });
});
