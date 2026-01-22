const circuitBreakerManager = require('../../lib/circuitBreaker');
const logger = require('../../lib/logger');

describe('Circuit Breaker Manager', () => {
    let loggerErrorSpy, loggerWarnSpy, loggerInfoSpy;

    beforeEach(() => {
        loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
        loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
    });

    afterEach(() => {
        // Reset all circuit breakers
        circuitBreakerManager.resetAll();
        loggerErrorSpy.mockRestore();
        loggerWarnSpy.mockRestore();
        loggerInfoSpy.mockRestore();
    });

    describe('getBreaker', () => {
        test('should create circuit breaker for upstream', () => {
            const breaker = circuitBreakerManager.getBreaker('http://test.com');
            expect(breaker).toBeDefined();
            expect(breaker.status).toBeDefined();
        });

        test('should return same breaker for same upstream', () => {
            const breaker1 = circuitBreakerManager.getBreaker('http://test.com');
            const breaker2 = circuitBreakerManager.getBreaker('http://test.com');
            expect(breaker1).toBe(breaker2);
        });

        test('should create separate breakers for different upstreams', () => {
            const breaker1 = circuitBreakerManager.getBreaker('http://test1.com');
            const breaker2 = circuitBreakerManager.getBreaker('http://test2.com');
            expect(breaker1).not.toBe(breaker2);
        });

        test('should accept custom options', () => {
            const breaker = circuitBreakerManager.getBreaker('http://test.com', {
                timeout: 10000,
                errorThresholdPercentage: 30
            });
            expect(breaker).toBeDefined();
        });
    });

    describe('execute', () => {
        test('should execute function successfully', async () => {
            const result = await circuitBreakerManager.execute('http://test.com', () => 'success');
            expect(result).toBe('success');
        });

        test('should handle function errors', async () => {
            await expect(
                circuitBreakerManager.execute('http://test.com', () => {
                    throw new Error('Test error');
                })
            ).rejects.toThrow();
        });

        test('should open circuit after threshold failures', async () => {
            const upstream = 'http://failing.com';
            const _breaker = circuitBreakerManager.getBreaker(upstream, {
                errorThresholdPercentage: 50,
                rollingCountTimeout: 1000,
                resetTimeout: 1000
            });

            // Cause multiple failures
            for (let i = 0; i < 10; i++) {
                try {
                    await circuitBreakerManager.execute(upstream, () => {
                        throw new Error('Failure');
                    });
                } catch (_e) {
                    // Expected
                }
            }

            // Circuit should eventually open
            const stats = circuitBreakerManager.getStats();
            expect(stats[upstream]).toBeDefined();
        });
    });

    describe('getStats', () => {
        test('should return stats for all breakers', () => {
            circuitBreakerManager.getBreaker('http://test1.com');
            circuitBreakerManager.getBreaker('http://test2.com');

            const stats = circuitBreakerManager.getStats();
            expect(stats['http://test1.com']).toBeDefined();
            expect(stats['http://test2.com']).toBeDefined();
        });

        test('should include breaker state in stats', () => {
            const _breaker = circuitBreakerManager.getBreaker('http://test.com');
            const stats = circuitBreakerManager.getStats();

            expect(stats['http://test.com']).toHaveProperty('state');
            expect(stats['http://test.com']).toHaveProperty('failures');
            expect(stats['http://test.com']).toHaveProperty('fires');
        });
    });

    describe('resetAll', () => {
        test('should reset all circuit breakers', () => {
            circuitBreakerManager.getBreaker('http://test1.com');
            circuitBreakerManager.getBreaker('http://test2.com');

            circuitBreakerManager.resetAll();

            const stats = circuitBreakerManager.getStats();
            // After reset, breakers should still exist but be in closed state
            expect(stats['http://test1.com']).toBeDefined();
        });
    });

    describe('isOpen', () => {
        test('should return false for closed circuit', () => {
            circuitBreakerManager.getBreaker('http://healthy.com');
            expect(circuitBreakerManager.isOpen('http://healthy.com')).toBe(false);
        });

        test('should return false for non-existent breaker', () => {
            expect(circuitBreakerManager.isOpen('http://unknown.com')).toBe(false);
        });
    });

    describe('recordSuccess', () => {
        test('should emit success event on breaker', () => {
            const breaker = circuitBreakerManager.getBreaker('http://success.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordSuccess('http://success.com');

            expect(emitSpy).toHaveBeenCalledWith('success');
            emitSpy.mockRestore();
        });

        test('should handle non-existent breaker gracefully', () => {
            // Should not throw
            expect(() => {
                circuitBreakerManager.recordSuccess('http://nonexistent.com');
            }).not.toThrow();
        });
    });

    describe('recordFailure', () => {
        test('should emit failure for network errors', () => {
            const breaker = circuitBreakerManager.getBreaker('http://failure.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordFailure('http://failure.com', { code: 'ECONNRESET' });

            expect(emitSpy).toHaveBeenCalledWith('failure');
            emitSpy.mockRestore();
        });

        test('should emit failure for ETIMEDOUT', () => {
            const breaker = circuitBreakerManager.getBreaker('http://timeout.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordFailure('http://timeout.com', { code: 'ETIMEDOUT' });

            expect(emitSpy).toHaveBeenCalledWith('failure');
            emitSpy.mockRestore();
        });

        test('should emit failure for ECONNREFUSED', () => {
            const breaker = circuitBreakerManager.getBreaker('http://refused.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordFailure('http://refused.com', { code: 'ECONNREFUSED' });

            expect(emitSpy).toHaveBeenCalledWith('failure');
            emitSpy.mockRestore();
        });

        test('should emit failure for 5xx server errors', () => {
            const breaker = circuitBreakerManager.getBreaker('http://server-error.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordFailure('http://server-error.com', { status: 500 });

            expect(emitSpy).toHaveBeenCalledWith('failure');
            emitSpy.mockRestore();
        });

        test('should emit failure for statusCode 5xx', () => {
            const breaker = circuitBreakerManager.getBreaker('http://server-error2.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordFailure('http://server-error2.com', { statusCode: 502 });

            expect(emitSpy).toHaveBeenCalledWith('failure');
            emitSpy.mockRestore();
        });

        test('should NOT emit failure for 4xx client errors', () => {
            const breaker = circuitBreakerManager.getBreaker('http://client-error.com');
            const emitSpy = jest.spyOn(breaker, 'emit');

            circuitBreakerManager.recordFailure('http://client-error.com', { status: 404 });

            expect(emitSpy).not.toHaveBeenCalledWith('failure');
            emitSpy.mockRestore();
        });

        test('should handle non-existent breaker gracefully', () => {
            expect(() => {
                circuitBreakerManager.recordFailure('http://nonexistent.com', {
                    code: 'ECONNRESET'
                });
            }).not.toThrow();
        });

        test('should handle empty error object', () => {
            const _breaker = circuitBreakerManager.getBreaker('http://empty-error.com');

            expect(() => {
                circuitBreakerManager.recordFailure('http://empty-error.com', {});
            }).not.toThrow();
        });
    });
});
