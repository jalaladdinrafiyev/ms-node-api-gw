const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { loadConfig, loadConfigFile } = require('../../lib/configLoader');
const { buildRouter } = require('../../lib/routeBuilder');

// Mock routeBuilder
jest.mock('../../lib/routeBuilder', () => ({
    buildRouter: jest.fn(() => require('express').Router())
}));

describe('Config Loader', () => {
    const testConfigPath = path.join(__dirname, '../fixtures/test-gateway.yaml');
    const testConfigDir = path.dirname(testConfigPath);

    beforeEach(() => {
        // Create test fixtures directory
        if (!fs.existsSync(testConfigDir)) {
            fs.mkdirSync(testConfigDir, { recursive: true });
        }
        buildRouter.mockClear();
    });

    afterEach(() => {
        // Clean up test config file
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
    });

    describe('loadConfigFile', () => {
        test('should load valid YAML config file', () => {
            const config = {
                version: '2.2.0',
                routes: [
                    {
                        path: '/test',
                        upstream: 'http://localhost:8080'
                    }
                ]
            };

            fs.writeFileSync(testConfigPath, yaml.dump(config));

            const result = loadConfigFile(testConfigPath);

            expect(result).toBeDefined();
            expect(result.version).toBe('2.2.0');
            expect(result.routes).toHaveLength(1);
        });

        test('should return null for non-existent file', () => {
            const logger = require('../../lib/logger');
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

            const result = loadConfigFile('./nonexistent.yaml');

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalled();

            loggerErrorSpy.mockRestore();
        });

        test('should return null for invalid YAML', () => {
            fs.writeFileSync(testConfigPath, 'invalid: yaml: content: [');

            const logger = require('../../lib/logger');
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
            const result = loadConfigFile(testConfigPath);

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalled();

            loggerErrorSpy.mockRestore();
        });

        test('should return null if routes is not an array', () => {
            const config = {
                version: '2.2.0',
                routes: 'not-an-array'
            };

            fs.writeFileSync(testConfigPath, yaml.dump(config));

            const logger = require('../../lib/logger');
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
            const result = loadConfigFile(testConfigPath);

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalled();

            loggerErrorSpy.mockRestore();
        });

        test('should return null if routes is missing', () => {
            const config = {
                version: '2.2.0'
            };

            fs.writeFileSync(testConfigPath, yaml.dump(config));

            const logger = require('../../lib/logger');
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
            const result = loadConfigFile(testConfigPath);

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalled();

            loggerErrorSpy.mockRestore();
        });
    });

    describe('loadConfig', () => {
        test('should load config and build router', () => {
            const config = {
                version: '2.2.0',
                routes: [
                    {
                        path: '/test',
                        upstream: 'http://localhost:8080'
                    }
                ]
            };

            fs.writeFileSync(testConfigPath, yaml.dump(config));

            const logger = require('../../lib/logger');
            const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
            const result = loadConfig(testConfigPath);

            expect(result).toBeDefined();
            expect(buildRouter).toHaveBeenCalledWith(config.routes);
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                'Loading configuration',
                expect.objectContaining({ configPath: testConfigPath })
            );
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                'Configuration reloaded successfully',
                expect.any(Object)
            );

            loggerInfoSpy.mockRestore();
        });

        test('should return null if config file cannot be loaded', () => {
            const logger = require('../../lib/logger');
            const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation();
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

            const result = loadConfig('./nonexistent.yaml');

            expect(result).toBeNull();
            expect(buildRouter).not.toHaveBeenCalled();
            expect(loggerErrorSpy).toHaveBeenCalled();

            loggerInfoSpy.mockRestore();
            loggerErrorSpy.mockRestore();
        });

        test('should return null if router build fails', () => {
            const config = {
                version: '2.2.0',
                routes: [
                    {
                        path: '/test',
                        upstream: 'http://localhost:8080'
                    }
                ]
            };

            fs.writeFileSync(testConfigPath, yaml.dump(config));
            buildRouter.mockImplementation(() => {
                throw new Error('Build failed');
            });

            const logger = require('../../lib/logger');
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();
            const result = loadConfig(testConfigPath);

            expect(result).toBeNull();
            expect(loggerErrorSpy).toHaveBeenCalled();

            loggerErrorSpy.mockRestore();
        });
    });
});
