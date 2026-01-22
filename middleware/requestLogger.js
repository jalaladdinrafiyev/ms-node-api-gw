const logger = require('../lib/logger');

/**
 * Request logging middleware
 * Logs all incoming requests with timestamp, method, URL, IP, and response time
 * Optimized: Uses hrtime.bigint() for precision, avoids Date allocation in hot path
 * Logger handles both console and file output (hourly rotation)
 */
const requestLogger = (req, res, next) => {
    // Use hrtime.bigint() for nanosecond precision, avoid Date allocation in hot path
    const startTime = process.hrtime.bigint();
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    
    // Log request start (logger handles timestamp formatting)
    logger.info('Request received', { method, url, ip });
    
    // Log response when finished
    res.on('finish', () => {
        const durationNs = process.hrtime.bigint() - startTime;
        const durationMs = Number(durationNs) / 1e6;
        
        // Use the logger.request helper for structured logging
        logger.request(req, res, durationMs);
    });
    
    next();
};

module.exports = requestLogger;
