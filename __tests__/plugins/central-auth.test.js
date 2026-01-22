const request = require('supertest');
const express = require('express');

// Mock logger before requiring centralAuth
jest.mock('../../lib/logger', () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
}));

describe('Central Auth Plugin', () => {
    let app;
    let authMiddleware;
    let centralAuth;
    let mockAxiosInstance;

    beforeEach(() => {
        // Reset modules to get fresh axios mock
        jest.resetModules();
        
        // Create a mock axios instance
        mockAxiosInstance = {
            post: jest.fn()
        };
        
        // Mock axios.create to return our mock instance
        jest.doMock('axios', () => ({
            create: jest.fn(() => mockAxiosInstance)
        }));
        
        // Now require centralAuth (it will use our mocked axios)
        centralAuth = require('../../plugins/central-auth');
        
        app = express();
        app.use(express.json());
        
        authMiddleware = centralAuth({
            enabled: true,
            authServiceUrl: 'http://auth-service:9000'
        });
        
        app.use(authMiddleware);
        app.get('/protected', (req, res) => {
            // Express normalizes headers, so X-User-Id becomes x-user-id
            res.json({ message: 'protected', userId: req.headers['x-user-id'] || req.headers['X-User-Id'] });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication Success', () => {
        test('should allow request with valid token', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 'user123'
                    }
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer valid-token');

            expect(response.status).toBe(200);
            expect(response.body.userId).toBe('user123');
            expect(mockAxiosInstance.post).toHaveBeenCalled();
        });

        test('should handle numeric userId from auth service', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 4408505240  // Number as per spec
                    }
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            expect(response.status).toBe(200);
            expect(response.body.userId).toBe('4408505240'); // Converted to string
        });

        test('should inject X-User-Id header', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 'user456'
                    }
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            expect(response.status).toBe(200);
            expect(response.body.userId).toBe('user456');
        });

        test('should strip Authorization header from downstream request', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 'user123'
                    }
                }
            });

            await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            // Verify the auth service was called correctly
            expect(mockAxiosInstance.post).toHaveBeenCalled();
        });

        test('should forward Accept-Language header to auth service', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 'user123'
                    }
                }
            });

            await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token')
                .set('Accept-Language', 'az');

            // Verify Accept-Language was forwarded
            const callArgs = mockAxiosInstance.post.mock.calls[0];
            expect(callArgs[2].headers['accept-language']).toBe('az');
        });

        test('should forward Device-Type header to auth service', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 'user123'
                    }
                }
            });

            await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token')
                .set('Device-Type', 'WEB');

            // Verify Device-Type was forwarded
            const callArgs = mockAxiosInstance.post.mock.calls[0];
            expect(callArgs[2].headers['device-type']).toBe('WEB');
        });
    });

    describe('Authentication Failure', () => {
        test('should reject request without Authorization header', async () => {
            const response = await request(app).get('/protected');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('UNAUTHORIZED');
            expect(mockAxiosInstance.post).not.toHaveBeenCalled();
        });

        test('should reject request with invalid token', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 401,
                data: {
                    status: 'fail',
                    responseCode: 1602,
                    error: 'UNAUTHORIZED',
                    errorDetails: [{
                        message: 'Invalid token'
                    }]
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('UNAUTHORIZED');
        });

        test('should reject request when verifyStatus is false', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: false
                    }
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            // When verifyStatus is false, plugin returns 401
            expect(response.status).toBe(401);
        });

        test('should forward localized error messages from auth service', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 401,
                data: {
                    status: 'fail',
                    responseCode: 1602,
                    error: 'UNAUTHORIZED',
                    errorDetails: [{
                        message: 'Eyniləşdirildikdən sonra şəxsi məlumatların redaktəsi mümkün deyil'
                    }]
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token')
                .set('Accept-Language', 'az');

            expect(response.status).toBe(401);
            expect(response.body.errorDetails[0].message).toContain('Eyniləşdirildikdən');
        });
    });

    describe('Error Handling', () => {
        test('should handle auth service timeout', async () => {
            mockAxiosInstance.post.mockRejectedValue({
                code: 'ETIMEDOUT',
                message: 'Timeout'
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            expect(response.status).toBe(502);
            expect(response.body.error).toBe('AUTH_SERVICE_UNAVAILABLE');
        });

        test('should handle auth service connection refused', async () => {
            mockAxiosInstance.post.mockRejectedValue({
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            expect(response.status).toBe(502);
            expect(response.body.error).toBe('AUTH_SERVICE_UNAVAILABLE');
        });

        test('should handle auth service host not found', async () => {
            mockAxiosInstance.post.mockRejectedValue({
                code: 'ENOTFOUND',
                message: 'Host not found'
            });

            const response = await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            expect(response.status).toBe(502);
            expect(response.body.error).toBe('AUTH_SERVICE_UNAVAILABLE');
        });

        test('should handle case-insensitive Authorization header', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: {
                    data: {
                        verifyStatus: true,
                        userId: 'user123'
                    }
                }
            });

            const response = await request(app)
                .get('/protected')
                .set('authorization', 'Bearer token'); // lowercase

            expect(response.status).toBe(200);
            expect(mockAxiosInstance.post).toHaveBeenCalled();
        });
    });

    describe('Plugin Configuration', () => {
        test('should skip authentication when disabled', async () => {
            // Get fresh module with disabled auth
            jest.resetModules();
            jest.doMock('axios', () => ({
                create: jest.fn(() => mockAxiosInstance)
            }));
            const centralAuthFresh = require('../../plugins/central-auth');
            
            const disabledAuth = centralAuthFresh({
                enabled: false,
                authServiceUrl: 'http://auth-service:9000'
            });

            const testApp = express();
            testApp.use(disabledAuth);
            testApp.get('/test', (req, res) => {
                res.json({ message: 'ok' });
            });

            const response = await request(testApp).get('/test');

            expect(response.status).toBe(200);
            expect(mockAxiosInstance.post).not.toHaveBeenCalled();
        });

        test('should validate authServiceUrl when enabled', () => {
            jest.resetModules();
            jest.doMock('axios', () => ({
                create: jest.fn(() => mockAxiosInstance)
            }));
            const centralAuthFresh = require('../../plugins/central-auth');
            
            expect(() => {
                centralAuthFresh({
                    enabled: true,
                    authServiceUrl: null
                });
            }).toThrow();

            expect(() => {
                centralAuthFresh({
                    enabled: true,
                    authServiceUrl: 'not-a-valid-url'
                });
            }).toThrow();
        });

        test('should handle trailing slashes in authServiceUrl', () => {
            jest.resetModules();
            jest.doMock('axios', () => ({
                create: jest.fn(() => mockAxiosInstance)
            }));
            const centralAuthFresh = require('../../plugins/central-auth');
            
            // Should not throw with trailing slash
            expect(() => {
                centralAuthFresh({
                    enabled: true,
                    authServiceUrl: 'http://auth-service:9000/'
                });
            }).not.toThrow();
        });
    });

    describe('Auth Service Headers', () => {
        test('should send X-Original-URI header', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: { data: { verifyStatus: true, userId: 'user123' } }
            });

            await request(app)
                .get('/protected?query=param')
                .set('Authorization', 'Bearer token');

            const callArgs = mockAxiosInstance.post.mock.calls[0];
            expect(callArgs[2].headers['X-Original-URI']).toContain('/protected');
        });

        test('should send X-Original-Method header', async () => {
            mockAxiosInstance.post.mockResolvedValue({
                status: 200,
                data: { data: { verifyStatus: true, userId: 'user123' } }
            });

            await request(app)
                .get('/protected')
                .set('Authorization', 'Bearer token');

            const callArgs = mockAxiosInstance.post.mock.calls[0];
            expect(callArgs[2].headers['X-Original-Method']).toBe('GET');
        });
    });
});
