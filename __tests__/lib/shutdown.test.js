// Mock process.exit BEFORE any module loading
const mockExit = jest.fn();
const originalExit = process.exit;

// Mock logger at module level
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

jest.mock('../../lib/logger', () => mockLogger);

jest.mock('../../lib/upstreamHealth', () => ({
    stopAll: jest.fn()
}));

beforeAll(() => {
    process.exit = mockExit;
});

afterAll(() => {
    process.exit = originalExit;
});

describe('Graceful Shutdown', () => {
    let mockServer, mockWatcher;
    let setupGracefulShutdown;
    let upstreamHealthChecker;

    beforeEach(() => {
        // Reset modules to get fresh shutdown state (isShuttingDown flag)
        jest.resetModules();
        
        // Re-apply mocks after reset
        jest.doMock('../../lib/logger', () => mockLogger);
        jest.doMock('../../lib/upstreamHealth', () => ({
            stopAll: jest.fn()
        }));
        
        // Get fresh modules
        const shutdownModule = require('../../lib/shutdown');
        setupGracefulShutdown = shutdownModule.setupGracefulShutdown;
        upstreamHealthChecker = require('../../lib/upstreamHealth');
        
        // Clear mock call history
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear();
        mockExit.mockClear();

        mockServer = {
            close: jest.fn((callback) => {
                setTimeout(() => callback(), 10);
            })
        };

        mockWatcher = {
            close: jest.fn().mockResolvedValue(undefined)
        };
        
        // Clear all process listeners
        process.removeAllListeners('SIGTERM');
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
    });

    afterEach(() => {
        process.removeAllListeners('SIGTERM');
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
    });

    describe('setupGracefulShutdown', () => {
        test('should register SIGTERM handler', () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            expect(process.listenerCount('SIGTERM')).toBe(1);
        });

        test('should register SIGINT handler', () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            expect(process.listenerCount('SIGINT')).toBe(1);
        });

        test('should close server on shutdown', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            // Trigger shutdown
            process.emit('SIGTERM');

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockServer.close).toHaveBeenCalled();
        });

        test('should close watcher on shutdown', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockWatcher.close).toHaveBeenCalled();
        });

        test('should stop upstream health monitoring on shutdown', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(upstreamHealthChecker.stopAll).toHaveBeenCalled();
        });

        test('should handle shutdown without server', async () => {
            setupGracefulShutdown({ server: null, watcher: mockWatcher });

            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockWatcher.close).toHaveBeenCalled();
        });

        test('should handle shutdown without watcher', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: null });

            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockServer.close).toHaveBeenCalled();
        });

        test('should prevent multiple simultaneous shutdowns', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            // Trigger shutdown twice rapidly
            process.emit('SIGTERM');
            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 200));

            // Should log warning about already shutting down
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Shutdown already in progress'),
                expect.any(Object)
            );
        });

        test('should handle uncaught exceptions', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            const error = new Error('Uncaught exception');
            process.emit('uncaughtException', error);

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Uncaught Exception'),
                expect.objectContaining({ error: 'Uncaught exception' })
            );
        });

        test('should handle unhandled rejections', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            const reason = new Error('Unhandled rejection');
            process.emit('unhandledRejection', reason, Promise.resolve());

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Unhandled Rejection'),
                expect.any(Object)
            );
        });

        test('should handle server close errors', async () => {
            mockServer.close = jest.fn((callback) => {
                callback(new Error('Close error'));
            });

            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error closing server'),
                expect.any(Object)
            );
        });

        test('should call process.exit after shutdown', async () => {
            setupGracefulShutdown({ server: mockServer, watcher: mockWatcher });

            process.emit('SIGTERM');

            await new Promise(resolve => setTimeout(resolve, 300));

            expect(mockExit).toHaveBeenCalledWith(0);
        });
    });
});
