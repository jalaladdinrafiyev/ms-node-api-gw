const request = require('supertest');
const express = require('express');
const {
    createRateLimiter,
    globalRateLimiter,
    strictRateLimiter,
    initializeRedis,
    isRedisConnected,
    getStore,
    shutdown
} = require('../../middleware/rateLimiter');
const logger = require('../../lib/logger');

describe('Rate Limiter Middleware', () => {
    let app;
    let loggerWarnSpy;
    let loggerInfoSpy;
    let loggerErrorSpy;

    beforeEach(() => {
        loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
        loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
        app = express();
        // Set trust proxy to get IP from X-Forwarded-For header
        app.set('trust proxy', true);
        app.get('/test', (req, res) => {
            res.json({ message: 'ok' });
        });
    });

    afterEach(() => {
        loggerWarnSpy.mockRestore();
        loggerInfoSpy.mockRestore();
        loggerErrorSpy.mockRestore();
    });

    describe('Global Rate Limiter', () => {
        test('should allow requests within limit', async () => {
            app.use(globalRateLimiter);

            const response = await request(app).get('/test');
            expect(response.status).toBe(200);
        });

        test('should rate limit excessive requests', async () => {
            // Create a strict rate limiter for testing (1 request per window)
            // Use a very short window and explicit store for testing
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();

            const testLimiter = createRateLimiter({
                windowMs: 100, // 100ms window for fast tests
                max: 1, // Only 1 request allowed
                store: store // Use explicit shared store
            });

            // Create a fresh app for this test
            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            // First request should succeed
            const response1 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '10.0.0.1'); // Set consistent IP
            expect(response1.status).toBe(200);

            // Immediately make second request - should be rate limited
            const response2 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '10.0.0.1'); // Same IP
            expect(response2.status).toBe(429);
            expect(response2.body.error).toBe('Rate Limit Exceeded');
        });

        test('should skip rate limiting for health endpoint', async () => {
            const testLimiter = createRateLimiter({
                windowMs: 60000,
                max: 1
            });
            app.use(testLimiter);
            app.get('/health', (req, res) => {
                res.json({ status: 'ok' });
            });

            // Make multiple health check requests - should not be rate limited
            const response1 = await request(app).get('/health');
            expect(response1.status).toBe(200);

            const response2 = await request(app).get('/health');
            expect(response2.status).toBe(200);
        });

        test('should skip rate limiting for metrics endpoint', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const testLimiter = createRateLimiter({
                windowMs: 60000,
                max: 1,
                store: new MemoryStore()
            });
            const testApp = express();
            testApp.use(testLimiter);
            testApp.get('/metrics', (req, res) => {
                res.send('metrics');
            });

            const response1 = await request(testApp).get('/metrics');
            expect(response1.status).toBe(200);

            const response2 = await request(testApp).get('/metrics');
            expect(response2.status).toBe(200);
        });

        test('should skip rate limiting for livez endpoint', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const testLimiter = createRateLimiter({
                windowMs: 60000,
                max: 1,
                store: new MemoryStore()
            });
            const testApp = express();
            testApp.use(testLimiter);
            testApp.get('/livez', (req, res) => {
                res.json({ status: 'ok' });
            });

            const response1 = await request(testApp).get('/livez');
            const response2 = await request(testApp).get('/livez');
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
        });

        test('should skip rate limiting for readyz endpoint', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const testLimiter = createRateLimiter({
                windowMs: 60000,
                max: 1,
                store: new MemoryStore()
            });
            const testApp = express();
            testApp.use(testLimiter);
            testApp.get('/readyz', (req, res) => {
                res.json({ status: 'ok' });
            });

            const response1 = await request(testApp).get('/readyz');
            const response2 = await request(testApp).get('/readyz');
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
        });

        test('should include retry-after header', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 100,
                max: 1,
                store: store
            });

            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.2'); // First request
            const response = await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.2'); // Rate limited

            expect(response.status).toBe(429);
            expect(response.headers['retry-after']).toBeDefined();
        });
    });

    describe('Strict Rate Limiter', () => {
        test('should have stricter limits', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 100,
                max: 10,
                store: store
            });

            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            // First request should succeed
            const response1 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '10.0.0.3');
            expect(response1.status).toBe(200);

            // Make 10 more requests quickly (limit is 10, so 11 total)
            for (let i = 0; i < 10; i++) {
                await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.3');
            }

            // 11th request should be rate limited
            const response = await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.3');
            expect(response.status).toBe(429);
        });

        test('should export strictRateLimiter', () => {
            expect(strictRateLimiter).toBeDefined();
            expect(typeof strictRateLimiter).toBe('function');
        });
    });

    describe('Custom Rate Limiter', () => {
        test('should accept custom options', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const customLimiter = createRateLimiter({
                windowMs: 100,
                max: 2,
                message: 'Custom rate limit message',
                store: store
            });

            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(customLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.4');
            await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.4');

            const response = await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.4');
            expect(response.status).toBe(429);
            expect(response.body.message).toBe('Custom rate limit message');
        });

        test('should use default values when options not provided', () => {
            const limiter = createRateLimiter();
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        test('should accept useRedis option set to false', () => {
            const limiter = createRateLimiter({ useRedis: false });
            expect(limiter).toBeDefined();
            expect(typeof limiter).toBe('function');
        });

        test('should accept skipSuccessfulRequests option', () => {
            const limiter = createRateLimiter({ skipSuccessfulRequests: true });
            expect(limiter).toBeDefined();
        });

        test('should accept skipFailedRequests option', () => {
            const limiter = createRateLimiter({ skipFailedRequests: true });
            expect(limiter).toBeDefined();
        });
    });

    describe('Key Generator', () => {
        test('should use req.ip when available', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 1000,
                max: 100,
                store: store
            });

            const testApp = express();
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ ip: req.ip });
            });

            const response = await request(testApp).get('/test');
            expect(response.status).toBe(200);
        });

        test('should use X-Forwarded-For when trust proxy is enabled', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 100,
                max: 1,
                store: store
            });

            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            // Different X-Forwarded-For IPs should be treated as different clients
            const response1 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '192.168.1.1');
            expect(response1.status).toBe(200);

            const response2 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '192.168.1.2');
            expect(response2.status).toBe(200);
        });

        test('should handle multiple IPs in X-Forwarded-For', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 100,
                max: 1,
                store: store
            });

            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            // X-Forwarded-For with multiple IPs (first should be used)
            const response1 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '10.0.0.100, 10.0.0.200, 10.0.0.300');
            expect(response1.status).toBe(200);

            // Same first IP should be rate limited
            const response2 = await request(testApp)
                .get('/test')
                .set('X-Forwarded-For', '10.0.0.100, 10.0.0.201');
            expect(response2.status).toBe(429);
        });

        test('should fall back to socket remoteAddress', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 1000,
                max: 100,
                store: store
            });

            const testApp = express();
            // Don't trust proxy - should use socket address
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            const response = await request(testApp).get('/test');
            expect(response.status).toBe(200);
        });
    });

    describe('Redis Integration', () => {
        test('should return false when REDIS_URL is not set', async () => {
            const originalRedisUrl = process.env.REDIS_URL;
            delete process.env.REDIS_URL;

            const result = await initializeRedis();
            expect(result).toBe(false);
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                'REDIS_URL not configured, using in-memory rate limiting'
            );

            process.env.REDIS_URL = originalRedisUrl;
        });

        test('isRedisConnected should return false when not connected', () => {
            const connected = isRedisConnected();
            expect(connected).toBe(false);
        });

        test('getStore should return undefined when Redis not connected', () => {
            const store = getStore();
            expect(store).toBeUndefined();
        });

        test('shutdown should handle case when Redis is not connected', async () => {
            // Should not throw when Redis client is null
            await expect(shutdown()).resolves.not.toThrow();
        });
    });

    describe('Rate Limit Handler', () => {
        test('should log warning when rate limit exceeded', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 100,
                max: 1,
                store: store
            });

            const testApp = express();
            testApp.set('trust proxy', true);
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.99');
            await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.99');

            expect(loggerWarnSpy).toHaveBeenCalledWith(
                'Rate limit exceeded',
                expect.objectContaining({
                    url: '/test',
                    method: 'GET'
                })
            );
        });

        test('should include retryAfter in response body', async () => {
            const { MemoryStore } = require('express-rate-limit');
            const store = new MemoryStore();
            const testLimiter = createRateLimiter({
                windowMs: 60000, // 60 seconds
                max: 1,
                store: store
            });

            const testApp = express();
            testApp.use(testLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            await request(testApp).get('/test');
            const response = await request(testApp).get('/test');

            expect(response.status).toBe(429);
            expect(response.body.retryAfter).toBe(60);
        });
    });

    describe('Lazy Initialization', () => {
        test('globalRateLimiter should be lazily initialized', () => {
            // globalRateLimiter is a wrapped function that creates limiter on first use
            expect(typeof globalRateLimiter).toBe('function');
        });

        test('strictRateLimiter should be lazily initialized', () => {
            // strictRateLimiter is a wrapped function that creates limiter on first use
            expect(typeof strictRateLimiter).toBe('function');
        });

        test('globalRateLimiter wrapper should call the limiter', async () => {
            const testApp = express();
            testApp.use(globalRateLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            const response = await request(testApp).get('/test');
            expect(response.status).toBe(200);
        });

        test('strictRateLimiter wrapper should call the limiter', async () => {
            const testApp = express();
            testApp.use(strictRateLimiter);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            const response = await request(testApp).get('/test');
            expect(response.status).toBe(200);
        });
    });
});
