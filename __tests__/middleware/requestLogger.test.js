const requestLogger = require('../../middleware/requestLogger');
const logger = require('../../lib/logger');

describe('Request Logger Middleware', () => {
    let req, res, next;
    let loggerInfoSpy, loggerRequestSpy;

    beforeEach(() => {
        loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
        loggerRequestSpy = jest.spyOn(logger, 'request').mockImplementation();
        
        req = {
            method: 'GET',
            originalUrl: '/test',
            ip: '127.0.0.1',
            connection: {
                remoteAddress: '127.0.0.1'
            }
        };

        res = {
            statusCode: 200,
            on: jest.fn((event, callback) => {
                if (event === 'finish') {
                    // Store callback for synchronous invocation in tests
                    res._finishCallback = callback;
                }
            }),
            _finishCallback: null
        };

        next = jest.fn();
    });

    afterEach(() => {
        loggerInfoSpy.mockRestore();
        loggerRequestSpy.mockRestore();
    });

    test('should log request information', () => {
        requestLogger(req, res, next);

        expect(loggerInfoSpy).toHaveBeenCalledWith('Request received', expect.objectContaining({
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1'
        }));
    });

    test('should call next()', () => {
        requestLogger(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('should log response when finish event fires', () => {
        requestLogger(req, res, next);
        
        // Verify finish event was registered
        expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
        
        // Call the finish callback synchronously
        if (res._finishCallback) {
            res._finishCallback();
        }
        
        // Check that logger.request was called with correct parameters
        expect(loggerRequestSpy).toHaveBeenCalledWith(
            req,
            expect.objectContaining({ statusCode: 200 }),
            expect.any(Number) // duration is a number
        );
    });

    test('should use connection.remoteAddress if ip is not available', () => {
        delete req.ip;
        requestLogger(req, res, next);
        
        expect(loggerInfoSpy).toHaveBeenCalledWith('Request received', expect.objectContaining({
            ip: '127.0.0.1'
        }));
    });
});
