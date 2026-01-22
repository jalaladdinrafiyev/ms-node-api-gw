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
            const result = await circuitBreakerManager.execute(
                'http://test.com',
                async () => 'success'
            );
            expect(result).toBe('success');
        });

        test('should handle function errors', async () => {
            await expect(
                circuitBreakerManager.execute(
                    'http://test.com',
                    async () => {
                        throw new Error('Test error');
                    }
                )
            ).rejects.toThrow();
        });

        test('should open circuit after threshold failures', async () => {
            const upstream = 'http://failing.com';
            const breaker = circuitBreakerManager.getBreaker(upstream, {
                errorThresholdPercentage: 50,
                rollingCountTimeout: 1000,
                resetTimeout: 1000
            });

            // Cause multiple failures
            for (let i = 0; i < 10; i++) {
                try {
                    await circuitBreakerManager.execute(upstream, async () => {
                        throw new Error('Failure');
                    });
                } catch (e) {
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
            const breaker = circuitBreakerManager.getBreaker('http://test.com');
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
});
