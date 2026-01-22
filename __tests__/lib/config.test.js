describe('Config Module', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('Default values', () => {
        test('should have default server config', () => {
            const config = require('../../lib/config');
            
            expect(config.server.port).toBe(3000);
            expect(config.server.trustProxy).toBe(false);
            expect(config.server.requestBodyLimit).toBe('10mb');
        });

        test('should have default rate limit config', () => {
            const config = require('../../lib/config');
            
            expect(config.rateLimit.windowMs).toBe(60000);
            expect(config.rateLimit.max).toBe(100);
        });

        test('should have default timeout config', () => {
            const config = require('../../lib/config');
            
            expect(config.timeouts.request).toBe(15000);
            expect(config.timeouts.upstream).toBe(30000);
            expect(config.timeouts.healthCheck).toBe(5000);
            expect(config.timeouts.shutdown).toBe(10000);
        });

        test('should have default retry config', () => {
            const config = require('../../lib/config');
            
            expect(config.retry.maxRetries).toBe(3);
            expect(config.retry.initialDelay).toBe(100);
            expect(config.retry.maxDelay).toBe(10000);
            expect(config.retry.factor).toBe(2);
            expect(config.retry.retryableCodes).toContain('ECONNRESET');
        });

        test('should have default circuit breaker config', () => {
            const config = require('../../lib/config');
            
            expect(config.circuitBreaker.timeout).toBe(30000);
            expect(config.circuitBreaker.errorThresholdPercentage).toBe(50);
            expect(config.circuitBreaker.resetTimeout).toBe(30000);
        });

        test('should have default health check config', () => {
            const config = require('../../lib/config');
            
            expect(config.healthCheck.intervalMs).toBe(30000);
            expect(config.healthCheck.unhealthyThreshold).toBe(3);
            expect(config.healthCheck.healthyThreshold).toBe(1);
        });

        test('should have default connection pool config', () => {
            const config = require('../../lib/config');
            
            expect(config.connectionPool.maxSockets).toBe(256);
            expect(config.connectionPool.maxFreeSockets).toBe(256);
        });

        test('should have default CORS config', () => {
            const config = require('../../lib/config');
            
            expect(config.cors.origin).toBe('*');
            expect(config.cors.credentials).toBe(true);
        });
    });

    describe('Environment variable overrides', () => {
        test('should override PORT', () => {
            process.env.PORT = '8080';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.server.port).toBe(8080);
        });

        test('should override TRUST_PROXY', () => {
            process.env.TRUST_PROXY = 'true';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.server.trustProxy).toBe(true);
        });

        test('should override LOG_LEVEL', () => {
            process.env.LOG_LEVEL = 'debug';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.logging.level).toBe('debug');
        });

        test('should override RATE_LIMIT_MAX', () => {
            process.env.RATE_LIMIT_MAX = '500';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.rateLimit.max).toBe(500);
        });

        test('should override MAX_RETRIES', () => {
            process.env.MAX_RETRIES = '5';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.retry.maxRetries).toBe(5);
        });

        test('should override CORS_ORIGIN', () => {
            process.env.CORS_ORIGIN = 'https://example.com';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.cors.origin).toBe('https://example.com');
        });

        test('should override CORS_CREDENTIALS', () => {
            process.env.CORS_CREDENTIALS = 'false';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.cors.credentials).toBe(false);
        });

        test('should override GATEWAY_CONFIG_PATH', () => {
            process.env.GATEWAY_CONFIG_PATH = '/etc/gateway/config.yaml';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.gatewayConfigPath).toBe('/etc/gateway/config.yaml');
        });
    });

    describe('Environment helpers', () => {
        test('isDevelopment should be true in development', () => {
            process.env.NODE_ENV = 'development';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.isDevelopment).toBe(true);
            expect(config.isProduction).toBe(false);
            expect(config.isTest).toBe(false);
        });

        test('isProduction should be true in production', () => {
            process.env.NODE_ENV = 'production';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.isDevelopment).toBe(false);
            expect(config.isProduction).toBe(true);
            expect(config.isTest).toBe(false);
        });

        test('isTest should be true in test', () => {
            process.env.NODE_ENV = 'test';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.isDevelopment).toBe(false);
            expect(config.isProduction).toBe(false);
            expect(config.isTest).toBe(true);
        });
    });

    describe('Validation', () => {
        test('should validate PORT range', () => {
            process.env.PORT = '99999';
            jest.resetModules();
            const config = require('../../lib/config');
            
            // Should fall back to default due to max constraint
            expect(config.server.port).toBe(3000);
            expect(config.validationErrors.length).toBeGreaterThan(0);
        });

        test('should validate negative PORT', () => {
            process.env.PORT = '-1';
            jest.resetModules();
            const config = require('../../lib/config');
            
            // Should fall back to default due to min constraint
            expect(config.server.port).toBe(3000);
        });

        test('should validate invalid integer', () => {
            process.env.PORT = 'not-a-number';
            jest.resetModules();
            const config = require('../../lib/config');
            
            // Should fall back to default
            expect(config.server.port).toBe(3000);
        });

        test('should validate MAX_RETRIES max value', () => {
            process.env.MAX_RETRIES = '100';
            jest.resetModules();
            const config = require('../../lib/config');
            
            // Should fall back to default due to max: 10 constraint
            expect(config.retry.maxRetries).toBe(3);
        });

        test('validate() should return true when no errors', () => {
            jest.resetModules();
            const config = require('../../lib/config');
            
            // Clear any validation errors from other tests
            config.validationErrors.length = 0;
            expect(config.validate()).toBe(true);
        });

        test('validate() should return false when errors exist', () => {
            process.env.PORT = 'invalid';
            jest.resetModules();
            const config = require('../../lib/config');
            
            expect(config.validate()).toBe(false);
        });

        test('getValidationErrors() should return copy of errors', () => {
            process.env.PORT = 'invalid';
            jest.resetModules();
            const config = require('../../lib/config');
            
            const errors = config.getValidationErrors();
            expect(Array.isArray(errors)).toBe(true);
            
            // Should be a copy, not the original
            errors.push('test');
            expect(config.getValidationErrors().length).not.toBe(errors.length);
        });
    });

    describe('Config immutability', () => {
        test('config object should be frozen', () => {
            const config = require('../../lib/config');
            
            expect(Object.isFrozen(config)).toBe(true);
        });

        test('nested objects should be frozen', () => {
            const config = require('../../lib/config');
            
            expect(Object.isFrozen(config.server)).toBe(true);
            expect(Object.isFrozen(config.rateLimit)).toBe(true);
            expect(Object.isFrozen(config.timeouts)).toBe(true);
        });
    });
});
