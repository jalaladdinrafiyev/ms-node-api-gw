/**
 * Routes Barrel Export
 *
 * Provides clean imports for all route handlers.
 *
 * Usage:
 *   const { healthCheck, metrics } = require('./routes');
 */

const healthCheck = require('./health');
const metrics = require('./metrics');
const probes = require('./probes');

module.exports = {
    // Health check endpoint (backward compatible)
    healthCheck,

    // Kubernetes probes
    probes,
    livenessProbe: probes.livenessProbe,
    readinessProbe: probes.readinessProbe,
    startupProbe: probes.startupProbe,

    // Prometheus metrics
    metrics,
    metricsMiddleware: metrics.metricsMiddleware,
    metricsHandler: metrics.metricsHandler,
    metricsRegister: metrics.register
};
