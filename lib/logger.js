const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Custom format for file output (JSON for easier parsing)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create daily rotate file transport for hourly rotation
// Format: logs/YYYY-MM-DD/app-YYYY-MM-DD-HH.log
const DailyRotateFile = require('winston-daily-rotate-file');

// For hourly rotation in day folders:
// datePattern 'YYYY-MM-DD/HH' creates day folders and rotates hourly
// filename 'app-%DATE%.log' where %DATE% is replaced with the datePattern value
// This creates: logs/YYYY-MM-DD/app-YYYY-MM-DD-HH.log
const dailyRotateTransport = new DailyRotateFile({
    dirname: LOGS_DIR,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD/HH', // Hourly rotation in day folders
    maxSize: '20m',
    maxFiles: '14d', // Keep logs for 14 days
    format: fileFormat,
    createSymlink: true,
    symlinkName: 'current.log',
    zippedArchive: false // Set to true to compress old logs
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    defaultMeta: { service: 'api-gateway' },
    transports: [
        // Write all logs to daily rotate file (hourly rotation)
        dailyRotateTransport,
        // Write errors to separate error log
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: '20m',
            maxFiles: '30d' // Keep error logs for 30 days
        })
    ],
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'exceptions.log'),
            format: fileFormat
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(LOGS_DIR, 'rejections.log'),
            format: fileFormat
        })
    ]
});

// Add console transport in development (but not during tests)
// During tests, we keep file transports but don't add console to reduce noise
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    logger.add(
        new winston.transports.Console({
            format: consoleFormat,
            level: 'debug'
        })
    );
}

// During tests, set logger level to 'error' to reduce noise
// File transports remain active but only errors are logged
if (process.env.NODE_ENV === 'test') {
    logger.level = 'error';
}

// Helper function for request logging
logger.request = (req, res, duration) => {
    const logData = {
        requestId: req.requestId || req.headers?.['x-request-id'] || undefined,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: `${duration.toFixed(2)}ms`,
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: (req.get && req.get('user-agent')) || req.headers?.['user-agent'] || 'unknown',
        contentLength:
            (res.get && res.get('content-length')) || res.headers?.['content-length'] || undefined
    };

    // Remove undefined values
    Object.keys(logData).forEach((key) => {
        if (logData[key] === undefined) {
            delete logData[key];
        }
    });

    // Log based on status code
    if (res.statusCode >= 500) {
        logger.error('Request Error', logData);
    } else if (res.statusCode >= 400) {
        logger.warn('Request Warning', logData);
    } else {
        logger.info('Request', logData);
    }
};

module.exports = logger;
