const request = require('supertest');
const express = require('express');
const requestTimeout = require('../../middleware/requestTimeout');
const logger = require('../../lib/logger');

describe('Request Timeout Middleware', () => {
    let app;
    let loggerWarnSpy;

    beforeEach(() => {
        loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        app = express();
    });

    afterEach(() => {
        loggerWarnSpy.mockRestore();
        jest.clearAllTimers();
    });

    test('should set request timeout', async () => {
        app.use(requestTimeout(1000)); // 1 second timeout
        app.get('/test', (req, res) => {
            res.json({ message: 'ok' });
        });

        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
    });

    test('should use default timeout from config', () => {
        const middleware = requestTimeout();
        expect(middleware).toBeDefined();
        expect(typeof middleware).toBe('function');
    });

    test('should use custom timeout value', () => {
        const middleware = requestTimeout(5000);
        expect(middleware).toBeDefined();
        expect(typeof middleware).toBe('function');
    });

    test('should call next() to continue middleware chain', () => {
        const nextSpy = jest.fn();
        const middleware = requestTimeout(1000);

        const mockReq = {
            setTimeout: jest.fn()
        };
        const mockRes = {};

        middleware(mockReq, mockRes, nextSpy);

        expect(nextSpy).toHaveBeenCalled();
        expect(mockReq.setTimeout).toHaveBeenCalledWith(1000, expect.any(Function));
    });

    test('should set setTimeout on request object', () => {
        const middleware = requestTimeout(2000);

        const mockReq = {
            setTimeout: jest.fn()
        };
        const mockRes = {};
        const mockNext = jest.fn();

        middleware(mockReq, mockRes, mockNext);

        expect(mockReq.setTimeout).toHaveBeenCalledWith(2000, expect.any(Function));
    });

    test('should handle timeout callback when headers not sent', () => {
        const middleware = requestTimeout(100);

        const mockReq = {
            setTimeout: jest.fn(),
            method: 'GET',
            originalUrl: '/test-endpoint',
            destroy: jest.fn()
        };
        const mockRes = {
            headersSent: false,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const mockNext = jest.fn();

        middleware(mockReq, mockRes, mockNext);

        // Get the timeout callback
        const timeoutCallback = mockReq.setTimeout.mock.calls[0][1];

        // Execute the timeout callback
        timeoutCallback();

        // Verify timeout response
        expect(loggerWarnSpy).toHaveBeenCalledWith('Request timed out', {
            method: 'GET',
            url: '/test-endpoint',
            timeout: 100
        });
        expect(mockRes.status).toHaveBeenCalledWith(504);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Gateway Timeout',
            message: 'Request timed out',
            timestamp: expect.any(String)
        });
        expect(mockReq.destroy).toHaveBeenCalled();
    });

    test('should not send response if headers already sent', () => {
        const middleware = requestTimeout(100);

        const mockReq = {
            setTimeout: jest.fn(),
            method: 'GET',
            originalUrl: '/test',
            destroy: jest.fn()
        };
        const mockRes = {
            headersSent: true,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const mockNext = jest.fn();

        middleware(mockReq, mockRes, mockNext);

        // Get the timeout callback
        const timeoutCallback = mockReq.setTimeout.mock.calls[0][1];

        // Execute the timeout callback
        timeoutCallback();

        // Should NOT send response since headers already sent
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();

        // But should still destroy the request
        expect(mockReq.destroy).toHaveBeenCalled();
    });

    test('should use req.url when originalUrl is not available', () => {
        const middleware = requestTimeout(100);

        const mockReq = {
            setTimeout: jest.fn(),
            method: 'POST',
            url: '/fallback-url',
            destroy: jest.fn()
        };
        const mockRes = {
            headersSent: false,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const mockNext = jest.fn();

        middleware(mockReq, mockRes, mockNext);

        const timeoutCallback = mockReq.setTimeout.mock.calls[0][1];
        timeoutCallback();

        expect(loggerWarnSpy).toHaveBeenCalledWith('Request timed out', {
            method: 'POST',
            url: '/fallback-url',
            timeout: 100
        });
    });

    test('should include ISO timestamp in timeout response', () => {
        const middleware = requestTimeout(100);

        const mockReq = {
            setTimeout: jest.fn(),
            method: 'GET',
            originalUrl: '/test',
            destroy: jest.fn()
        };
        const mockRes = {
            headersSent: false,
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const mockNext = jest.fn();

        middleware(mockReq, mockRes, mockNext);

        const timeoutCallback = mockReq.setTimeout.mock.calls[0][1];
        timeoutCallback();

        const jsonCall = mockRes.json.mock.calls[0][0];
        expect(jsonCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
});
