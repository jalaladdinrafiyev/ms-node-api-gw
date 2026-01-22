const request = require('supertest');
const express = require('express');
const requestIdMiddleware = require('../../middleware/requestId');

describe('Request ID Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(requestIdMiddleware);
        app.get('/test', (req, res) => {
            res.json({ 
                requestId: req.requestId,
                correlationId: req.correlationId
            });
        });
    });

    test('should generate request ID when none provided', async () => {
        const response = await request(app).get('/test');
        
        expect(response.status).toBe(200);
        expect(response.body.requestId).toBeDefined();
        expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$|^[0-9a-f]{32}$/);
        expect(response.body.correlationId).toBe(response.body.requestId);
    });

    test('should propagate X-Request-ID header', async () => {
        const customId = 'custom-request-id-12345';
        
        const response = await request(app)
            .get('/test')
            .set('X-Request-ID', customId);
        
        expect(response.status).toBe(200);
        expect(response.body.requestId).toBe(customId);
    });

    test('should propagate X-Correlation-ID header', async () => {
        const customId = 'correlation-id-67890';
        
        const response = await request(app)
            .get('/test')
            .set('X-Correlation-ID', customId);
        
        expect(response.status).toBe(200);
        expect(response.body.requestId).toBe(customId);
    });

    test('should propagate X-Trace-ID header', async () => {
        const traceId = 'trace-id-abc123';
        
        const response = await request(app)
            .get('/test')
            .set('X-Trace-ID', traceId);
        
        expect(response.status).toBe(200);
        expect(response.body.requestId).toBe(traceId);
    });

    test('should prefer X-Request-ID over X-Correlation-ID', async () => {
        const requestId = 'request-id-priority';
        const correlationId = 'correlation-id-secondary';
        
        const response = await request(app)
            .get('/test')
            .set('X-Request-ID', requestId)
            .set('X-Correlation-ID', correlationId);
        
        expect(response.body.requestId).toBe(requestId);
    });

    test('should set X-Request-ID response header', async () => {
        const response = await request(app).get('/test');
        
        expect(response.headers['x-request-id']).toBeDefined();
    });

    test('should reject invalid request IDs (too long)', async () => {
        const longId = 'a'.repeat(200);
        
        const response = await request(app)
            .get('/test')
            .set('X-Request-ID', longId);
        
        // Should generate new ID instead of using invalid one
        expect(response.body.requestId).not.toBe(longId);
        expect(response.body.requestId.length).toBeLessThanOrEqual(36);
    });

    test('should handle empty header values', async () => {
        const response = await request(app)
            .get('/test')
            .set('X-Request-ID', '');
        
        // Should generate new ID for empty value
        expect(response.body.requestId).toBeDefined();
        expect(response.body.requestId).not.toBe('');
    });
});
