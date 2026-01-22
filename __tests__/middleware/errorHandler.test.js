const {
    notFoundHandler,
    globalErrorHandler,
    gatewayNotConfiguredHandler
} = require('../../middleware/errorHandler');
const logger = require('../../lib/logger');

describe('Error Handler Middleware', () => {
    let req, res;
    let loggerErrorSpy, loggerWarnSpy;

    beforeEach(() => {
        loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
        loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        
        req = {
            method: 'GET',
            originalUrl: '/nonexistent'
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    afterEach(() => {
        loggerErrorSpy.mockRestore();
        loggerWarnSpy.mockRestore();
    });

    describe('notFoundHandler', () => {
        test('should return 404 status', () => {
            notFoundHandler(req, res);
            
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalled();
        });

        test('should return correct error structure', () => {
            notFoundHandler(req, res);
            
            const response = res.json.mock.calls[0][0];
            expect(response).toHaveProperty('error', 'Not Found');
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('timestamp');
            expect(response.message).toContain('GET');
            expect(response.message).toContain('/nonexistent');
        });
    });

    describe('globalErrorHandler', () => {
        test('should return 500 status for errors without status', () => {
            const err = new Error('Test error');
            const next = jest.fn();
            
            globalErrorHandler(err, req, res, next);
            
            expect(loggerErrorSpy).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalled();
        });

        test('should use error status if provided', () => {
            const err = { status: 400, message: 'Bad Request' };
            const next = jest.fn();
            
            globalErrorHandler(err, req, res, next);
            
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should show error message in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            const err = new Error('Test error');
            const next = jest.fn();
            
            globalErrorHandler(err, req, res, next);
            
            const response = res.json.mock.calls[0][0];
            expect(response.message).toBe('Test error');
            
            process.env.NODE_ENV = originalEnv;
        });

        test('should hide error message in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const err = new Error('Test error');
            const next = jest.fn();
            
            globalErrorHandler(err, req, res, next);
            
            const response = res.json.mock.calls[0][0];
            expect(response.message).toBe('An unexpected error occurred');
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('gatewayNotConfiguredHandler', () => {
        test('should return 503 status', () => {
            gatewayNotConfiguredHandler(req, res);
            
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalled();
        });

        test('should return correct error structure', () => {
            gatewayNotConfiguredHandler(req, res);
            
            const response = res.json.mock.calls[0][0];
            expect(response).toHaveProperty('error', 'Gateway not configured');
            expect(response).toHaveProperty('message');
        });
    });
});
