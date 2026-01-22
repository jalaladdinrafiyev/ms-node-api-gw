const express = require('express');
const { buildRouter } = require('../../lib/routeBuilder');
const { loadPlugin } = require('../../lib/pluginLoader');
const upstreamHealthChecker = require('../../lib/upstreamHealth');

// Mock pluginLoader
jest.mock('../../lib/pluginLoader', () => ({
    loadPlugin: jest.fn()
}));

// Mock upstream health checker
jest.mock('../../lib/upstreamHealth', () => ({
    startMonitoring: jest.fn(),
    isHealthy: jest.fn().mockReturnValue(true),
    stopAll: jest.fn()
}));

describe('Route Builder', () => {
    let app;
    let server;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        loadPlugin.mockClear();
    });

    afterEach(() => {
        if (server) {
            server.close();
        }
    });

    test('should build router with routes', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080'
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });

    test('should attach plugins when enabled', () => {
        const mockMiddleware = jest.fn((req, res, next) => next());
        loadPlugin.mockReturnValue(mockMiddleware);

        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080',
                plugins: [
                    {
                        name: 'test-plugin',
                        enabled: true,
                        config: 'value'
                    }
                ]
            }
        ];

        const router = buildRouter(routes);
        expect(loadPlugin).toHaveBeenCalledWith('test-plugin', {
            name: 'test-plugin',
            enabled: true,
            config: 'value'
        });
    });

    test('should skip disabled plugins', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080',
                plugins: [
                    {
                        name: 'test-plugin',
                        enabled: false
                    }
                ]
            }
        ];

        const router = buildRouter(routes);
        expect(loadPlugin).not.toHaveBeenCalled();
    });

    test('should handle routes without plugins', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080'
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
        expect(loadPlugin).not.toHaveBeenCalled();
    });

    test('should build router for multiple routes', () => {
        const routes = [
            {
                path: '/route1',
                upstream: 'http://localhost:8080'
            },
            {
                path: '/route2',
                upstream: 'http://localhost:8081'
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });

        test('should support multiple upstreams for load balancing', () => {
            // Clear previous calls
            upstreamHealthChecker.startMonitoring.mockClear();
            
            const routes = [
                {
                    path: '/test',
                    upstream: [
                        'http://localhost:8080',
                        'http://localhost:8081'
                    ]
                }
            ];

            const router = buildRouter(routes);
            expect(router).toBeDefined();
            // Should be called for each upstream
            expect(upstreamHealthChecker.startMonitoring.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

    test('should start health monitoring for upstreams', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080'
            }
        ];

        buildRouter(routes);
        expect(upstreamHealthChecker.startMonitoring).toHaveBeenCalledWith(
            'http://localhost:8080',
            expect.objectContaining({})
        );
    });

    test('should handle route with custom timeout', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080',
                timeout: 10000
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });

    test('should handle route with load balance strategy', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080',
                loadBalanceStrategy: 'round_robin'
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });

    test('should handle route with retry configuration', () => {
        const routes = [
            {
                path: '/test',
                upstream: 'http://localhost:8080',
                retry: true,
                maxRetries: 5
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });

    test('should skip invalid route paths', () => {
        const routes = [
            {
                path: '', // Invalid empty path
                upstream: 'http://localhost:8080'
            },
            {
                path: '/valid',
                upstream: 'http://localhost:8080'
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });

    test('should skip invalid upstream configurations', () => {
        const routes = [
            {
                path: '/test',
                upstream: null // Invalid upstream
            },
            {
                path: '/valid',
                upstream: 'http://localhost:8080'
            }
        ];

        const router = buildRouter(routes);
        expect(router).toBeDefined();
    });
});
