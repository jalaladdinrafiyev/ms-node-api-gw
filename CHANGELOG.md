# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ESLint configuration for code quality
- Prettier for consistent code formatting
- EditorConfig for editor consistency
- Makefile with common development commands
- CONTRIBUTING.md guide
- LICENSE file (MIT)
- Scripts directory with build and health check utilities
- JSConfig for better IDE support

### Changed

- Improved package.json with better scripts and metadata
- Enhanced .gitignore patterns
- Fixed all ESLint warnings and errors

## [1.0.0] - 2026-01-22

### Added

- **Core Gateway Features**
    - Dynamic route configuration via `gateway.yaml`
    - Hot-reload configuration without restart
    - Plugin system for extensible middleware

- **Enterprise Features**
    - Circuit breaker pattern (using Opossum)
    - Rate limiting with Redis support (distributed)
    - Load balancing (round-robin, random, health-aware)
    - Upstream health monitoring
    - Request retry with exponential backoff

- **Security**
    - Helmet security headers
    - CORS configuration
    - Request body size limits
    - Trust proxy support

- **Observability**
    - Prometheus metrics endpoint (`/metrics`)
    - Structured logging with Winston
    - Daily rotating log files
    - Request correlation IDs (X-Request-ID, X-Correlation-ID)

- **Kubernetes Support**
    - Liveness probe (`/livez`)
    - Readiness probe (`/readyz`)
    - Startup probe (`/startupz`)
    - Health endpoint (`/health`)

- **Authentication Plugin**
    - Central authentication via external service
    - Automatic token verification
    - User ID header injection

- **Developer Experience**
    - Comprehensive test suite (316 tests)
    - Docker and Docker Compose support
    - Environment variable configuration
    - Graceful shutdown handling

### Security

- Input validation on configuration files
- Protection against path traversal in plugin loader
- Rate limiting to prevent abuse

---

## Version History

| Version | Date       | Description     |
| ------- | ---------- | --------------- |
| 1.0.0   | 2026-01-22 | Initial release |

## Upgrade Guide

### Upgrading to 1.0.0

This is the initial release. No upgrade steps required.

---

[Unreleased]: https://github.com/your-org/ms-node-api-gw/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/ms-node-api-gw/releases/tag/v1.0.0
