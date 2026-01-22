const upstreamHealthChecker = require('../../lib/upstreamHealth');
const axios = require('axios');
const logger = require('../../lib/logger');

jest.mock('axios');

describe('Upstream Health Checker', () => {
    let loggerInfoSpy, _loggerWarnSpy, _loggerDebugSpy;

    beforeEach(() => {
        loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
        _loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation();
        _loggerDebugSpy = jest.spyOn(logger, 'debug').mockImplementation();
        upstreamHealthChecker.stopAll(); // Clean up any existing monitoring
    });

    afterEach(() => {
        upstreamHealthChecker.stopAll();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('checkHealth', () => {
        test('should return true for healthy upstream', async () => {
            axios.get.mockResolvedValue({ status: 200 });

            const result = await upstreamHealthChecker.checkHealth('http://test.com');
            expect(result).toBe(true);
        });

        test('should return false for unhealthy upstream', async () => {
            axios.get.mockRejectedValue({ code: 'ECONNREFUSED' });

            const result = await upstreamHealthChecker.checkHealth('http://test.com');
            expect(result).toBe(false);
        });

        test('should return true for 4xx responses (client errors)', async () => {
            axios.get.mockResolvedValue({ status: 404 });

            const result = await upstreamHealthChecker.checkHealth('http://test.com');
            expect(result).toBe(true); // 4xx is considered healthy (service is responding)
        });

        test('should return false for 5xx responses', async () => {
            axios.get.mockResolvedValue({ status: 500 });

            const result = await upstreamHealthChecker.checkHealth('http://test.com');
            expect(result).toBe(false);
        });
    });

    describe('updateHealthStatus', () => {
        test('should mark upstream as healthy after threshold successes', async () => {
            axios.get.mockResolvedValue({ status: 200 });

            // Make multiple successful checks
            for (let i = 0; i < 2; i++) {
                await upstreamHealthChecker.checkHealth('http://test.com');
            }

            const status = upstreamHealthChecker.isHealthy('http://test.com');
            expect(status).toBe(true);
        });

        test('should mark upstream as unhealthy after threshold failures', async () => {
            axios.get.mockRejectedValue({ code: 'ECONNREFUSED' });

            // Make multiple failed checks
            for (let i = 0; i < 4; i++) {
                await upstreamHealthChecker.checkHealth('http://test.com');
            }

            const status = upstreamHealthChecker.isHealthy('http://test.com');
            expect(status).toBe(false);
        });
    });

    describe('startMonitoring', () => {
        test('should start periodic health checks', async () => {
            axios.get.mockResolvedValue({ status: 200 });

            upstreamHealthChecker.startMonitoring('http://test.com');

            // Wait a bit for initial check
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(axios.get).toHaveBeenCalled();
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Started monitoring'),
                expect.objectContaining({ upstream: 'http://test.com' })
            );
        });

        test('should not start monitoring twice for same upstream', () => {
            upstreamHealthChecker.startMonitoring('http://test.com');
            upstreamHealthChecker.startMonitoring('http://test.com');

            // Should only log once
            expect(loggerInfoSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('stopMonitoring', () => {
        test('should stop monitoring upstream', () => {
            upstreamHealthChecker.startMonitoring('http://test.com');
            upstreamHealthChecker.stopMonitoring('http://test.com');

            expect(loggerInfoSpy).toHaveBeenCalledWith(
                expect.stringContaining('Stopped monitoring'),
                expect.objectContaining({ upstream: 'http://test.com' })
            );
        });
    });

    describe('isHealthy', () => {
        test('should return true by default for unmonitored upstream', () => {
            const status = upstreamHealthChecker.isHealthy('http://unmonitored.com');
            expect(status).toBe(true); // Optimistic default
        });

        test('should return current health status', async () => {
            axios.get.mockResolvedValue({ status: 200 });
            await upstreamHealthChecker.checkHealth('http://test.com');

            const status = upstreamHealthChecker.isHealthy('http://test.com');
            expect(status).toBeDefined();
        });
    });

    describe('getAllHealthStatus', () => {
        test('should return health status for all monitored upstreams', async () => {
            axios.get.mockResolvedValue({ status: 200 });
            await upstreamHealthChecker.checkHealth('http://test1.com');
            await upstreamHealthChecker.checkHealth('http://test2.com');

            const status = upstreamHealthChecker.getAllHealthStatus();

            expect(status['http://test1.com']).toBeDefined();
            expect(status['http://test2.com']).toBeDefined();
            expect(status['http://test1.com']).toHaveProperty('healthy');
            expect(status['http://test1.com']).toHaveProperty('lastCheck');
        });
    });

    describe('stopAll', () => {
        test('should stop all monitoring', () => {
            upstreamHealthChecker.startMonitoring('http://test1.com');
            upstreamHealthChecker.startMonitoring('http://test2.com');

            upstreamHealthChecker.stopAll();

            const status = upstreamHealthChecker.getAllHealthStatus();
            expect(Object.keys(status)).toHaveLength(0);
        });
    });
});
