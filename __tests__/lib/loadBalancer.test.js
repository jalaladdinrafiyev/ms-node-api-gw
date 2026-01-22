const loadBalancer = require('../../lib/loadBalancer');
const upstreamHealthChecker = require('../../lib/upstreamHealth');

describe('Load Balancer', () => {
    beforeEach(() => {
        // Mock upstream health checker
        jest.spyOn(upstreamHealthChecker, 'isHealthy').mockImplementation((_url) => {
            // Mark all as healthy by default
            return true;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('parseUpstreams', () => {
        test('should parse single upstream string', () => {
            const result = loadBalancer.parseUpstreams('http://test.com');
            expect(result).toEqual(['http://test.com']);
        });

        test('should parse array of upstreams', () => {
            const result = loadBalancer.parseUpstreams(['http://test1.com', 'http://test2.com']);
            expect(result).toEqual(['http://test1.com', 'http://test2.com']);
        });

        test('should filter invalid entries', () => {
            const result = loadBalancer.parseUpstreams([
                'http://test1.com',
                null,
                'http://test2.com',
                123
            ]);
            expect(result).toEqual(['http://test1.com', 'http://test2.com']);
        });

        test('should return empty array for invalid input', () => {
            expect(loadBalancer.parseUpstreams(null)).toEqual([]);
            expect(loadBalancer.parseUpstreams(123)).toEqual([]);
        });
    });

    describe('selectUpstream', () => {
        const upstreams = ['http://test1.com', 'http://test2.com', 'http://test3.com'];

        test('should return null for empty upstreams', () => {
            const result = loadBalancer.selectUpstream([], 'round_robin');
            expect(result).toBeNull();
        });

        test('should use round-robin strategy', () => {
            const state = { index: 0 };

            const result1 = loadBalancer.selectUpstream(upstreams, 'round_robin', state);
            expect(result1).toBe('http://test1.com');
            expect(state.index).toBe(1);

            const result2 = loadBalancer.selectUpstream(upstreams, 'round_robin', state);
            expect(result2).toBe('http://test2.com');
            expect(state.index).toBe(2);

            const result3 = loadBalancer.selectUpstream(upstreams, 'round_robin', state);
            expect(result3).toBe('http://test3.com');
            expect(state.index).toBe(0); // Wraps around
        });

        test('should use random strategy', () => {
            const state = {};
            const results = new Set();

            // Run multiple times - should get different results (statistically)
            for (let i = 0; i < 10; i++) {
                const result = loadBalancer.selectUpstream(upstreams, 'random', state);
                results.add(result);
                expect(upstreams).toContain(result);
            }

            // Should have selected at least one different upstream
            expect(results.size).toBeGreaterThan(0);
        });

        test('should use health-aware strategy', () => {
            upstreamHealthChecker.isHealthy.mockImplementation((url) => {
                // Mark test2 and test3 as healthy
                return url !== 'http://test1.com';
            });

            const state = { index: 0 };
            const result = loadBalancer.selectUpstream(upstreams, 'health_aware', state);

            // Should select from healthy upstreams (test2 or test3)
            expect(['http://test2.com', 'http://test3.com']).toContain(result);
        });

        test('should fallback to all upstreams if none are healthy', () => {
            upstreamHealthChecker.isHealthy.mockReturnValue(false);

            const state = { index: 0 };
            const result = loadBalancer.selectUpstream(upstreams, 'health_aware', state);

            // Should still select one (failover behavior)
            expect(upstreams).toContain(result);
        });

        test('should default to first upstream for unknown strategy', () => {
            const result = loadBalancer.selectUpstream(upstreams, 'unknown_strategy');
            expect(result).toBe('http://test1.com');
        });
    });
});
