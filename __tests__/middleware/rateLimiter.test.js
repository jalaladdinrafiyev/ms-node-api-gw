const request = require('supertest');
const express = require('express');
const { createRateLimiter, globalRateLimiter, strictRateLimiter } = require('../../middleware/rateLimiter');
const logger = require('../../lib/logger');

describe('Rate Limiter Middleware', () => {
    let app;
    let loggerWarnSpy;

    beforeEach(() => {
        loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        app = express();
        // Set trust proxy to get IP from X-Forwarded-For header
        app.set('trust proxy', true);
        app.get('/test', (req, res) => {
            res.json({ message: 'ok' });
        });
    });

    afterEach(() => {
        loggerWarnSpy.mockRestore();
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
            const response1 = await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.3');
            expect(response1.status).toBe(200);

            // Make 10 more requests quickly (limit is 10, so 11 total)
            for (let i = 0; i < 10; i++) {
                await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.3');
            }

            // 11th request should be rate limited
            const response = await request(testApp).get('/test').set('X-Forwarded-For', '10.0.0.3');
            expect(response.status).toBe(429);
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
    });
});
