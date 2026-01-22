// Mock the sleep function to make tests fast
jest.mock('../../lib/logger', () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
}));

describe('Retry Manager', () => {
    let retryManager;

    beforeEach(() => {
        jest.resetModules();
        retryManager = require('../../lib/retry');
        // Override sleep to make it instant for testing
        retryManager.sleep = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('execute', () => {
        test('should execute function successfully on first try', async () => {
            const fn = jest.fn().mockResolvedValue('success');

            const result = await retryManager.execute(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(retryManager.sleep).not.toHaveBeenCalled();
        });

        test('should retry on retryable errors', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce({ code: 'ECONNRESET' })
                .mockResolvedValueOnce('success');

            const result = await retryManager.execute(fn, {
                maxRetries: 3,
                initialDelay: 100
            });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
            expect(retryManager.sleep).toHaveBeenCalledTimes(1);
        });

        test('should not retry on non-retryable errors', async () => {
            const fn = jest.fn().mockRejectedValue({ code: 'EACCES' });

            await expect(
                retryManager.execute(fn, {
                    maxRetries: 3
                })
            ).rejects.toMatchObject({ code: 'EACCES' });

            expect(fn).toHaveBeenCalledTimes(1);
            expect(retryManager.sleep).not.toHaveBeenCalled();
        });

        test('should respect max retries', async () => {
            const fn = jest.fn().mockRejectedValue({ code: 'ETIMEDOUT' });

            await expect(
                retryManager.execute(fn, {
                    maxRetries: 2,
                    initialDelay: 100
                })
            ).rejects.toMatchObject({ code: 'ETIMEDOUT' });

            expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
            expect(retryManager.sleep).toHaveBeenCalledTimes(2);
        });

        test('should call onRetry callback', async () => {
            const fn = jest.fn().mockRejectedValue({ code: 'ECONNREFUSED' });
            const onRetry = jest.fn();

            try {
                await retryManager.execute(fn, {
                    maxRetries: 2,
                    initialDelay: 100,
                    factor: 2,
                    onRetry
                });
            } catch (e) {
                // Expected to fail
            }

            expect(onRetry).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenCalledWith(1, expect.any(Object), expect.any(Number));
            expect(onRetry).toHaveBeenCalledWith(2, expect.any(Object), expect.any(Number));
        });

        test('should retry on errors with retryable message', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce({ message: 'ECONNRESET: connection reset' })
                .mockResolvedValueOnce('success');

            const result = await retryManager.execute(fn, {
                maxRetries: 3
            });

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        test('should respect max delay', async () => {
            const fn = jest.fn().mockRejectedValue({ code: 'ETIMEDOUT' });
            const sleepCalls = [];

            retryManager.sleep = jest.fn().mockImplementation((ms) => {
                sleepCalls.push(ms);
                return Promise.resolve();
            });

            try {
                await retryManager.execute(fn, {
                    maxRetries: 5,
                    initialDelay: 100,
                    maxDelay: 500,
                    factor: 10
                });
            } catch (e) {
                // Expected
            }

            // All delays should be <= maxDelay (500) accounting for jitter
            sleepCalls.forEach((delay) => {
                expect(delay).toBeLessThanOrEqual(600); // 500 + 20% jitter
            });
        });
    });

    describe('sleep (real implementation)', () => {
        test('should sleep for specified milliseconds', async () => {
            // Get a fresh module without mocked sleep
            jest.resetModules();
            const freshRetryManager = require('../../lib/retry');

            const start = Date.now();
            await freshRetryManager.sleep(50); // Short sleep for testing
            const duration = Date.now() - start;

            expect(duration).toBeGreaterThanOrEqual(40); // Allow some timing variance
            expect(duration).toBeLessThan(200);
        });
    });

    describe('error handling', () => {
        test('should handle errors without code property', async () => {
            const fn = jest.fn().mockRejectedValue(new Error('Generic error'));

            await expect(retryManager.execute(fn, { maxRetries: 3 })).rejects.toThrow(
                'Generic error'
            );

            // Should not retry since no code matches retryableErrors
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('should handle null/undefined error', async () => {
            const fn = jest.fn().mockRejectedValue(null);

            // The retry manager should not retry on null errors (not retryable)
            // and should reject with null
            await expect(retryManager.execute(fn, { maxRetries: 3 })).rejects.toBeNull();

            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});
