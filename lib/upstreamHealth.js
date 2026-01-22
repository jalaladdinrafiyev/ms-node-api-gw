/**
 * Upstream Health Checker
 * 
 * Monitors upstream service availability with periodic health checks
 * and maintains health status for load balancing decisions.
 * 
 * @module lib/upstreamHealth
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('./config');
const logger = require('./logger');

// Connection pooling for health checks
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

/**
 * Health status structure
 * @typedef {object} HealthStatus
 * @property {boolean} healthy - Whether upstream is healthy
 * @property {Date} lastCheck - Last check timestamp
 * @property {number} consecutiveFailures - Consecutive failure count
 * @property {number} consecutiveSuccesses - Consecutive success count
 */

/**
 * Monitors upstream service health
 */
class UpstreamHealthChecker {
    constructor() {
        /** @type {Map<string, HealthStatus>} */
        this.healthStatus = new Map();
        
        /** @type {Map<string, NodeJS.Timeout>} */
        this.intervals = new Map();

        /** @type {Map<string, string>} Custom health check paths per upstream */
        this.healthPaths = new Map();
        
        // Configuration
        this.checkInterval = config.healthCheck.intervalMs;
        this.timeout = config.timeouts.healthCheck;
        this.unhealthyThreshold = config.healthCheck.unhealthyThreshold;
        this.healthyThreshold = config.healthCheck.healthyThreshold;
    }

    /**
     * Check health of an upstream service
     * @param {string} upstreamUrl - The upstream service URL
     * @returns {Promise<boolean>} True if healthy
     */
    async checkHealth(upstreamUrl) {
        try {
            const healthUrl = this._getHealthUrl(upstreamUrl);
            const response = await axios.get(healthUrl, {
                timeout: this.timeout,
                validateStatus: (status) => status < 500,
                httpAgent: upstreamUrl.startsWith('https') ? httpsAgent : httpAgent,
                maxRedirects: 0
            });

            const isHealthy = response.status >= 200 && response.status < 500;
            this.updateHealthStatus(upstreamUrl, isHealthy);
            return isHealthy;
        } catch (error) {
            logger.debug('Upstream health check failed', {
                upstream: upstreamUrl,
                error: error.message,
                code: error.code
            });
            this.updateHealthStatus(upstreamUrl, false);
            return false;
        }
    }

    /**
     * Get health check URL for upstream
     * @private
     */
    _getHealthUrl(upstreamUrl) {
        // Use custom path if configured, otherwise default to /health
        const healthPath = this.healthPaths.get(upstreamUrl) || '/health';
        
        try {
            const url = new URL(upstreamUrl);
            return `${url.origin}${healthPath}`;
        } catch {
            return `${upstreamUrl}${healthPath}`;
        }
    }

    /**
     * Set custom health check path for an upstream
     * @param {string} upstreamUrl - The upstream service URL
     * @param {string} healthPath - Custom health check path (e.g., '/api/health')
     */
    setHealthPath(upstreamUrl, healthPath) {
        if (healthPath && typeof healthPath === 'string') {
            // Ensure path starts with /
            const normalizedPath = healthPath.startsWith('/') ? healthPath : `/${healthPath}`;
            this.healthPaths.set(upstreamUrl, normalizedPath);
        }
    }

    /**
     * Update health status for an upstream
     * @param {string} upstreamUrl - The upstream service URL
     * @param {boolean} isHealthy - Whether the check was successful
     */
    updateHealthStatus(upstreamUrl, isHealthy) {
        const current = this.healthStatus.get(upstreamUrl) || {
            healthy: true,
            lastCheck: null,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0
        };

        current.lastCheck = new Date();

        if (isHealthy) {
            current.consecutiveSuccesses = (current.consecutiveSuccesses || 0) + 1;
            current.consecutiveFailures = 0;
            
            if (current.consecutiveSuccesses >= this.healthyThreshold) {
                if (!current.healthy) {
                    logger.info('Upstream marked as healthy', { upstream: upstreamUrl });
                }
                current.healthy = true;
            }
        } else {
            current.consecutiveFailures = (current.consecutiveFailures || 0) + 1;
            current.consecutiveSuccesses = 0;
            
            if (current.consecutiveFailures >= this.unhealthyThreshold) {
                if (current.healthy) {
                    logger.warn('Upstream marked as unhealthy', {
                        upstream: upstreamUrl,
                        consecutiveFailures: current.consecutiveFailures
                    });
                }
                current.healthy = false;
            }
        }

        this.healthStatus.set(upstreamUrl, current);
    }

    /**
     * Start monitoring an upstream service
     * @param {string} upstreamUrl - The upstream service URL
     * @param {object} [options] - Monitoring options
     * @param {string} [options.healthPath] - Custom health check path
     */
    startMonitoring(upstreamUrl, options = {}) {
        if (this.intervals.has(upstreamUrl)) {
            return; // Already monitoring
        }

        // Set custom health path if provided
        if (options.healthPath) {
            this.setHealthPath(upstreamUrl, options.healthPath);
        }

        // Initial health check
        this.checkHealth(upstreamUrl);

        // Set up periodic health checks
        const interval = setInterval(() => {
            this.checkHealth(upstreamUrl);
        }, this.checkInterval);

        this.intervals.set(upstreamUrl, interval);
        logger.info('Started monitoring upstream', { 
            upstream: upstreamUrl,
            healthPath: this.healthPaths.get(upstreamUrl) || '/health'
        });
    }

    /**
     * Stop monitoring an upstream service
     * @param {string} upstreamUrl - The upstream service URL
     */
    stopMonitoring(upstreamUrl) {
        const interval = this.intervals.get(upstreamUrl);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(upstreamUrl);
            this.healthStatus.delete(upstreamUrl);
            this.healthPaths.delete(upstreamUrl);
            logger.info('Stopped monitoring upstream', { upstream: upstreamUrl });
        }
    }

    /**
     * Check if upstream is healthy
     * @param {string} upstreamUrl - The upstream service URL
     * @returns {boolean} True if healthy (defaults to true if not monitored)
     */
    isHealthy(upstreamUrl) {
        const status = this.healthStatus.get(upstreamUrl);
        return status ? status.healthy : true; // Optimistic default
    }

    /**
     * Get health status for all monitored upstreams
     * @returns {object} Health status map
     */
    getAllHealthStatus() {
        const status = {};
        
        for (const [url, health] of this.healthStatus.entries()) {
            status[url] = {
                healthy: health.healthy,
                lastCheck: health.lastCheck?.toISOString(),
                consecutiveFailures: health.consecutiveFailures,
                consecutiveSuccesses: health.consecutiveSuccesses
            };
        }
        
        return status;
    }

    /**
     * Stop all monitoring (cleanup)
     */
    stopAll() {
        for (const interval of this.intervals.values()) {
            clearInterval(interval);
        }
        this.intervals.clear();
        this.healthStatus.clear();
        this.healthPaths.clear();
    }
}

// Singleton instance
module.exports = new UpstreamHealthChecker();
