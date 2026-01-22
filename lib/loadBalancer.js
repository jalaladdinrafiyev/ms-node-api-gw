const logger = require('./logger');
const upstreamHealthChecker = require('./upstreamHealth');

/**
 * Enterprise load balancer
 * Supports multiple upstreams with health-aware routing
 */
class LoadBalancer {
    constructor() {
        this.strategies = {
            ROUND_ROBIN: 'round_robin',
            LEAST_CONNECTIONS: 'least_connections',
            HEALTH_AWARE: 'health_aware',
            RANDOM: 'random'
        };
    }

    /**
     * Select an upstream from a list using the specified strategy
     * @param {Array<string>} upstreams - Array of upstream URLs
     * @param {string} strategy - Load balancing strategy
     * @param {object} state - State object for tracking (round-robin index, etc.)
     * @returns {string|null} - Selected upstream URL or null if none available
     */
    selectUpstream(upstreams, strategy = this.strategies.HEALTH_AWARE, state = {}) {
        if (!upstreams || upstreams.length === 0) {
            return null;
        }

        // Filter to only healthy upstreams if health-aware
        let candidates = upstreams;
        if (strategy === this.strategies.HEALTH_AWARE) {
            candidates = upstreams.filter(upstream => 
                upstreamHealthChecker.isHealthy(upstream)
            );
            
            // If no healthy upstreams, fall back to all (failover)
            if (candidates.length === 0) {
                logger.warn('No healthy upstreams available, using all upstreams', {
                    upstreams,
                    strategy
                });
                candidates = upstreams;
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        // Select based on strategy
        switch (strategy) {
            case this.strategies.ROUND_ROBIN:
                if (!state.index) state.index = 0;
                const selected = candidates[state.index % candidates.length];
                state.index = (state.index + 1) % candidates.length;
                return selected;

            case this.strategies.RANDOM:
                return candidates[Math.floor(Math.random() * candidates.length)];

            case this.strategies.HEALTH_AWARE:
                // Prefer healthy, but use round-robin among healthy ones
                if (!state.index) state.index = 0;
                const healthySelected = candidates[state.index % candidates.length];
                state.index = (state.index + 1) % candidates.length;
                return healthySelected;

            default:
                // Default to first available
                return candidates[0];
        }
    }

    /**
     * Parse upstream configuration (supports single URL or array)
     * @param {string|Array<string>} upstreamConfig - Upstream configuration
     * @returns {Array<string>} - Array of upstream URLs
     */
    parseUpstreams(upstreamConfig) {
        if (typeof upstreamConfig === 'string') {
            return [upstreamConfig];
        }
        if (Array.isArray(upstreamConfig)) {
            return upstreamConfig.filter(u => typeof u === 'string');
        }
        return [];
    }
}

// Singleton instance
const loadBalancer = new LoadBalancer();

module.exports = loadBalancer;
