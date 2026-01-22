/**
 * Security Middleware
 * 
 * Applies security headers, CORS, compression,
 * and body parsing with size limits.
 * 
 * @module middleware/security
 */

const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const express = require('express');
const config = require('../lib/config');

/**
 * Apply security middleware to Express app
 * @param {express.Application} app - Express application
 */
const securityMiddleware = (app) => {
    // Helmet - Security headers
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));

    // CORS - Cross-Origin Resource Sharing
    // Configurable via CORS_ORIGIN and CORS_CREDENTIALS env vars
    const corsOrigin = config.cors.origin === '*' 
        ? true  // Allow all origins
        : config.cors.origin.includes(',')
            ? config.cors.origin.split(',').map(o => o.trim())  // Multiple origins
            : config.cors.origin;  // Single origin

    app.use(cors({
        origin: corsOrigin,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type', 
            'Authorization', 
            'X-Requested-With',
            'X-Request-ID',
            'Accept-Language',
            'Device-Type'
        ],
        credentials: config.cors.credentials,
        maxAge: 86400
    }));

    // Compression
    app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        }
    }));

    // Trust proxy (for load balancers)
    if (config.server.trustProxy) {
        app.set('trust proxy', true);
    }

    // Body parsers with size limits
    app.use(express.json({ 
        limit: config.server.requestBodyLimit 
    }));
    
    app.use(express.urlencoded({ 
        extended: true, 
        limit: config.server.requestBodyLimit 
    }));
};

module.exports = securityMiddleware;
