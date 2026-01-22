const {
    GatewayError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    RequestTimeoutError,
    RateLimitError,
    BadGatewayError,
    ServiceUnavailableError,
    GatewayTimeoutError,
    CircuitBreakerOpenError,
    ConfigurationError,
    PluginError,
    isGatewayError,
    wrapError
} = require('../../lib/errors');

describe('Custom Error Classes', () => {
    describe('GatewayError (base class)', () => {
        test('should create error with default values', () => {
            const error = new GatewayError('Test error');

            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('GATEWAY_ERROR');
            expect(error.name).toBe('GatewayError');
            expect(error.timestamp).toBeDefined();
            expect(error.stack).toBeDefined();
        });

        test('should create error with custom values', () => {
            const error = new GatewayError('Custom error', 418, 'TEAPOT', { extra: 'data' });

            expect(error.statusCode).toBe(418);
            expect(error.code).toBe('TEAPOT');
            expect(error.details).toEqual({ extra: 'data' });
        });

        test('toJSON should return formatted object', () => {
            const error = new GatewayError('Test', 500, 'TEST_CODE', { key: 'value' });
            const json = error.toJSON();

            expect(json.error).toBe('Gateway');
            expect(json.message).toBe('Test');
            expect(json.code).toBe('TEST_CODE');
            expect(json.timestamp).toBeDefined();
            expect(json.details).toEqual({ key: 'value' });
            expect(json.stack).toBeUndefined();
        });

        test('toJSON should include stack when requested', () => {
            const error = new GatewayError('Test');
            const json = error.toJSON(true);

            expect(json.stack).toBeDefined();
        });

        test('toJSON should omit empty details', () => {
            const error = new GatewayError('Test');
            const json = error.toJSON();

            expect(json.details).toBeUndefined();
        });
    });

    describe('BadRequestError (400)', () => {
        test('should have correct defaults', () => {
            const error = new BadRequestError();

            expect(error.message).toBe('Bad Request');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('BAD_REQUEST');
        });

        test('should accept custom message and details', () => {
            const error = new BadRequestError('Invalid input', { field: 'email' });

            expect(error.message).toBe('Invalid input');
            expect(error.details).toEqual({ field: 'email' });
        });
    });

    describe('UnauthorizedError (401)', () => {
        test('should have correct defaults', () => {
            const error = new UnauthorizedError();

            expect(error.message).toBe('Unauthorized');
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('ForbiddenError (403)', () => {
        test('should have correct defaults', () => {
            const error = new ForbiddenError();

            expect(error.message).toBe('Forbidden');
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('FORBIDDEN');
        });
    });

    describe('NotFoundError (404)', () => {
        test('should have correct defaults', () => {
            const error = new NotFoundError();

            expect(error.message).toBe('Not Found');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
        });

        test('should accept custom message', () => {
            const error = new NotFoundError('User not found');
            expect(error.message).toBe('User not found');
        });
    });

    describe('RequestTimeoutError (408)', () => {
        test('should have correct defaults', () => {
            const error = new RequestTimeoutError();

            expect(error.message).toBe('Request Timeout');
            expect(error.statusCode).toBe(408);
            expect(error.code).toBe('REQUEST_TIMEOUT');
        });
    });

    describe('RateLimitError (429)', () => {
        test('should have correct defaults', () => {
            const error = new RateLimitError();

            expect(error.message).toBe('Too Many Requests');
            expect(error.statusCode).toBe(429);
            expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(error.retryAfter).toBe(60);
            expect(error.details.retryAfter).toBe(60);
        });

        test('should accept custom retryAfter', () => {
            const error = new RateLimitError('Slow down', 120);

            expect(error.retryAfter).toBe(120);
            expect(error.details.retryAfter).toBe(120);
        });
    });

    describe('BadGatewayError (502)', () => {
        test('should have correct defaults', () => {
            const error = new BadGatewayError();

            expect(error.message).toBe('Bad Gateway');
            expect(error.statusCode).toBe(502);
            expect(error.code).toBe('BAD_GATEWAY');
        });
    });

    describe('ServiceUnavailableError (503)', () => {
        test('should have correct defaults', () => {
            const error = new ServiceUnavailableError();

            expect(error.message).toBe('Service Unavailable');
            expect(error.statusCode).toBe(503);
            expect(error.code).toBe('SERVICE_UNAVAILABLE');
        });
    });

    describe('GatewayTimeoutError (504)', () => {
        test('should have correct defaults', () => {
            const error = new GatewayTimeoutError();

            expect(error.message).toBe('Gateway Timeout');
            expect(error.statusCode).toBe(504);
            expect(error.code).toBe('GATEWAY_TIMEOUT');
        });
    });

    describe('CircuitBreakerOpenError', () => {
        test('should include upstream in message and details', () => {
            const error = new CircuitBreakerOpenError('http://api.example.com');

            expect(error.message).toBe('Circuit breaker open for http://api.example.com');
            expect(error.statusCode).toBe(503);
            expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
            expect(error.upstream).toBe('http://api.example.com');
            expect(error.details.upstream).toBe('http://api.example.com');
        });
    });

    describe('ConfigurationError', () => {
        test('should have correct defaults', () => {
            const error = new ConfigurationError();

            expect(error.message).toBe('Configuration Error');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('CONFIGURATION_ERROR');
        });

        test('should accept details', () => {
            const error = new ConfigurationError('Invalid config', { file: 'gateway.yaml' });
            expect(error.details.file).toBe('gateway.yaml');
        });
    });

    describe('PluginError', () => {
        test('should include plugin name', () => {
            const error = new PluginError('auth-plugin', 'Failed to initialize');

            expect(error.message).toBe('Failed to initialize');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('PLUGIN_ERROR');
            expect(error.pluginName).toBe('auth-plugin');
            expect(error.details.pluginName).toBe('auth-plugin');
        });
    });

    describe('isGatewayError', () => {
        test('should return true for GatewayError instances', () => {
            expect(isGatewayError(new GatewayError('test'))).toBe(true);
            expect(isGatewayError(new BadRequestError())).toBe(true);
            expect(isGatewayError(new NotFoundError())).toBe(true);
            expect(isGatewayError(new CircuitBreakerOpenError('url'))).toBe(true);
        });

        test('should return false for non-GatewayError', () => {
            expect(isGatewayError(new Error('test'))).toBe(false);
            expect(isGatewayError(null)).toBe(false);
            expect(isGatewayError(undefined)).toBe(false);
            expect(isGatewayError({ message: 'fake error' })).toBe(false);
        });
    });

    describe('wrapError', () => {
        test('should return GatewayError as-is', () => {
            const original = new BadRequestError('test');
            const wrapped = wrapError(original);

            expect(wrapped).toBe(original);
        });

        test('should wrap standard Error', () => {
            const original = new Error('Standard error');
            original.code = 'ERR_CODE';
            const wrapped = wrapError(original);

            expect(wrapped).toBeInstanceOf(GatewayError);
            expect(wrapped.message).toBe('Standard error');
            expect(wrapped.statusCode).toBe(500);
            expect(wrapped.code).toBe('INTERNAL_ERROR');
            expect(wrapped.details.originalName).toBe('Error');
            expect(wrapped.details.originalCode).toBe('ERR_CODE');
        });

        test('should wrap TypeError', () => {
            const original = new TypeError('Type error');
            const wrapped = wrapError(original);

            expect(wrapped.details.originalName).toBe('TypeError');
        });
    });
});
