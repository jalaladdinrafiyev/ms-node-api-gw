// Mock logger before requiring modules
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
};

jest.mock('../../lib/logger', () => mockLogger);

jest.mock('chokidar', () => ({
    watch: jest.fn()
}));

jest.mock('../../lib/pluginLoader', () => ({
    clearPluginCache: jest.fn()
}));

const chokidar = require('chokidar');
const { clearPluginCache } = require('../../lib/pluginLoader');
const { setupWatcher } = require('../../lib/watcher');

describe('File Watcher', () => {
    let mockWatcher;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        mockWatcher = {
            on: jest.fn().mockReturnThis(),
            close: jest.fn().mockResolvedValue(undefined)
        };

        chokidar.watch.mockReturnValue(mockWatcher);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('setupWatcher', () => {
        test('should setup file watcher with correct options', () => {
            const onReload = jest.fn();
            const watcher = setupWatcher('./gateway.yaml', onReload);

            expect(chokidar.watch).toHaveBeenCalledWith('./gateway.yaml', {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 200,
                    pollInterval: 100
                }
            });
            expect(watcher).toBe(mockWatcher);
        });

        test('should register change event handler', () => {
            const onReload = jest.fn();
            setupWatcher('./gateway.yaml', onReload);

            expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
        });

        test('should register error event handler', () => {
            const onReload = jest.fn();
            setupWatcher('./gateway.yaml', onReload);

            expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
        });

        test('should trigger reload on file change', () => {
            jest.useFakeTimers();

            const onReload = jest.fn();
            setupWatcher('./gateway.yaml', onReload);

            // Get the change handler
            const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === 'change')[1];

            // Trigger change
            changeHandler('./gateway.yaml');

            // Fast-forward past debounce (500ms)
            jest.advanceTimersByTime(600);

            expect(clearPluginCache).toHaveBeenCalled();
            expect(onReload).toHaveBeenCalled();
        });

        test('should debounce rapid file changes', () => {
            jest.useFakeTimers();

            const onReload = jest.fn();
            setupWatcher('./gateway.yaml', onReload);

            const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === 'change')[1];

            // Trigger multiple rapid changes
            changeHandler('./gateway.yaml');
            jest.advanceTimersByTime(100);
            changeHandler('./gateway.yaml');
            jest.advanceTimersByTime(100);
            changeHandler('./gateway.yaml');

            // Fast-forward past debounce
            jest.advanceTimersByTime(600);

            // Should only call once due to debouncing
            expect(onReload).toHaveBeenCalledTimes(1);
        });

        test('should handle watcher errors gracefully', () => {
            const onReload = jest.fn();
            setupWatcher('./gateway.yaml', onReload);

            const errorHandler = mockWatcher.on.mock.calls.find((call) => call[0] === 'error')[1];

            const error = new Error('Watcher error');
            errorHandler(error);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('File watcher error'),
                expect.objectContaining({ error: 'Watcher error' })
            );
        });

        test('should validate configPath parameter', () => {
            expect(() => {
                setupWatcher('', jest.fn());
            }).toThrow();

            expect(() => {
                setupWatcher(null, jest.fn());
            }).toThrow();
        });

        test('should validate onReload callback', () => {
            expect(() => {
                setupWatcher('./gateway.yaml', null);
            }).toThrow();

            expect(() => {
                setupWatcher('./gateway.yaml', 'not a function');
            }).toThrow();
        });

        test('should handle reload callback errors gracefully', () => {
            jest.useFakeTimers();

            const onReload = jest.fn().mockImplementation(() => {
                throw new Error('Reload error');
            });
            setupWatcher('./gateway.yaml', onReload);

            const changeHandler = mockWatcher.on.mock.calls.find((call) => call[0] === 'change')[1];

            // Trigger change - should not throw
            changeHandler('./gateway.yaml');
            jest.advanceTimersByTime(600);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error during config reload'),
                expect.objectContaining({ error: 'Reload error' })
            );
        });
    });
});
