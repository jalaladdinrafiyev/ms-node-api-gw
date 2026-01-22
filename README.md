# Microservices API Gateway

A production-ready, enterprise-level API Gateway built with Node.js and Express. Features dynamic route configuration, plugin-based middleware, circuit breakers, load balancing, and zero-downtime configuration updates.

## Features

- 🚀 **Hot Reload**: Configuration changes reload automatically without restart
- 🔌 **Plugin System**: Modular middleware architecture
- 🔒 **Enterprise Security**: Helmet, CORS, rate limiting, request timeouts
- ⚡ **Circuit Breakers**: Prevent cascading failures with automatic recovery
- ⚖️ **Load Balancing**: Round-robin, random, and health-aware strategies
- 🔄 **Retry Logic**: Exponential backoff with jitter for transient failures
- 📊 **Prometheus Metrics**: Full observability with `/metrics` endpoint
- ❤️ **Health Checks**: Comprehensive `/health` endpoint with upstream status
- 📁 **Structured Logging**: Winston with daily/hourly rotation
- 🐳 **Docker Ready**: Full Docker and Docker Compose support
- ⚡ **Zero Downtime**: Atomic router updates prevent service interruption
- 🛡️ **Graceful Shutdown**: Clean connection draining on SIGTERM/SIGINT

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the gateway
npm start
```

The gateway runs on `http://localhost:3000` by default.

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or standalone Docker
docker build -t api-gateway .
docker run -p 3000:3000 -v $(pwd)/gateway.yaml:/app/gateway.yaml api-gateway
```

## Configuration

Routes are configured in `gateway.yaml`:

```yaml
version: 2.2.0

routes:
  # Simple route
  - path: /api/users
    upstream: http://user-service:8080

  # Protected route with authentication
  - path: /api/orders
    upstream: http://order-service:8080
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://auth-service:9000

  # Load-balanced route with multiple upstreams
  - path: /api/products
    upstream:
      - http://product-service-1:8080
      - http://product-service-2:8080
    loadBalanceStrategy: health_aware
    timeout: 10000
    maxRetries: 3
```

### Route Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | required | URL path prefix to match |
| `upstream` | string/array | required | Backend service URL(s) |
| `timeout` | number | `30000` | Request timeout in milliseconds |
| `maxRetries` | number | `3` | Max retry attempts on failure |
| `retry` | boolean | `true` | Enable/disable retry logic |
| `loadBalanceStrategy` | string | `health_aware` | Load balancing strategy |
| `plugins` | array | `[]` | List of plugins to apply |

### Load Balancing Strategies

| Strategy | Description |
|----------|-------------|
| `health_aware` | Prefers healthy upstreams, round-robin among them |
| `round_robin` | Cycles through upstreams sequentially |
| `random` | Random upstream selection |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Gateway listen port |
| `NODE_ENV` | `development` | Environment mode |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `REQUEST_TIMEOUT_MS` | `15000` | Client request timeout |
| `UPSTREAM_TIMEOUT_MS` | `30000` | Upstream proxy timeout |
| `MAX_RETRIES` | `3` | Retry attempts for failures |
| `RETRY_INITIAL_DELAY_MS` | `100` | Initial retry delay |
| `RETRY_MAX_DELAY_MS` | `10000` | Maximum retry delay |
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | Upstream health check interval |
| `HEALTH_CHECK_TIMEOUT_MS` | `5000` | Health check timeout |
| `MAX_SOCKETS` | `256` | Connection pool size |
| `TRUST_PROXY` | `false` | Trust X-Forwarded-For header |
| `REQUEST_BODY_LIMIT` | `10mb` | Max request body size |
| `LOG_LEVEL` | `info` | Logging level |

## API Endpoints

### Health Check

```
GET /health
```

Returns comprehensive gateway status:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T15:30:00.000Z",
  "uptime": 3600,
  "routes": "loaded",
  "memory": {
    "rss": "45.23 MB",
    "heapUsed": "22.15 MB"
  },
  "circuitBreakers": {
    "http://api-server:8080": {
      "state": "closed",
      "failures": 0
    }
  },
  "upstreams": {
    "http://api-server:8080": {
      "healthy": true,
      "lastCheck": "2026-01-22T15:29:30.000Z"
    }
  }
}
```

### Prometheus Metrics

```
GET /metrics
```

Returns Prometheus-formatted metrics:

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/users",status_code="200"} 1542

# HELP http_request_duration_seconds Duration of HTTP requests
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/users",le="0.1"} 1200

# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)
# TYPE circuit_breaker_state gauge
circuit_breaker_state{upstream="http://api-server:8080"} 0
```

## Request Flow

```
Client Request
     ↓
┌─────────────────────────────────────┐
│          API Gateway                │
├─────────────────────────────────────┤
│  1. Security (Helmet, CORS)         │
│  2. Rate Limiting                   │
│  3. Request Timeout                 │
│  4. Metrics Collection              │
│  5. Request Logging                 │
│  6. Route Matching                  │
│  7. Plugin Middleware (Auth, etc.)  │
│  8. Circuit Breaker Check           │
│  9. Load Balancer Selection         │
│ 10. Proxy to Upstream               │
│ 11. Retry on Failure                │
└─────────────────────────────────────┘
     ↓
Upstream Service
```

---

## Authentication Service Integration

This gateway integrates with the **Risk Admin Authentication Service** for token validation and user authorization.

### Auth Service Configuration

```yaml
# gateway.yaml
routes:
  - path: /ms-risk-admin
    upstream: http://ms-risk-admin:8080
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  - path: /ms-limit
    upstream: http://ms-limit:8080
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  - path: /ms-blacklist
    upstream: http://ms-blacklist:8080
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000
```

### Authentication Flow

```
Client Request (with Bearer Token)
     ↓
┌─────────────────────────────────────┐
│          API Gateway                │
│                                     │
│  1. Extract Authorization header    │
│  2. Call Auth Service /verify       │
│  3. If valid: inject X-User-Id      │
│  4. Strip Authorization header      │
│  5. Forward to upstream             │
└─────────────────────────────────────┘
     ↓
Upstream Microservice (receives X-User-Id)
```

### Auth Service API Reference

**Base URL:** `https://sb-ms-risk-admin.mpay.az/api`  
**Internal Route:** `{risk/sb-ms-auth-risk}/api`

#### 1. Authentication Endpoints

##### 1.1 Login

Authenticate user with username and password.

```
POST /v1/auth/login
```

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `Accept` | Yes | `*/*` |
| `Accept-Language` | No | `az`, `en`, `ru` (Default: `az`) |
| `Device-Type` | Yes | `WEB`, `ANDROID`, `IOS`, `EXTERNAL` |
| `App-Version` | No | Client application version |
| `Device-Id` | No | Unique device identifier |
| `X-Device-OS` | No | Operating system version |
| `GPS-Coordinates` | No | User location |
| `X-Forwarded-For` | No | Origin IP |

**Request:**

```json
{
  "username": "+99455xxxxxxx",
  "password": "your_secure_password"
}
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": {
    "nextStep": "COMPLETED",
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "otpExpireTime": 0,
    "otpRequired": false
  }
}
```

##### 1.2 Refresh Token

Obtain new access token using refresh token.

```
POST /v1/auth/refresh
```

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": {
    "accessToken": "new_access_token_string...",
    "refreshToken": "new_refresh_token_string..."
  }
}
```

##### 1.3 Logout

Invalidate current session.

```
POST /v1/auth/logout
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": null
}
```

##### 1.4 Logout All

Invalidate all sessions across all devices.

```
POST /v1/auth/logout/all
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": null
}
```

#### 2. Password Management

##### 2.1 Change Password (Initiate)

```
POST /v1/auth/change-password
```

**Request:**

```json
{
  "username": "+99455xxxxxxx",
  "type": "RESET"
}
```

> Note: `type` can be `FORGOT` or `RESET`

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": {
    "nextStep": "CHANGE-PASSWORD-CONFIRM",
    "accessToken": "temp_access_token...",
    "refreshToken": "temp_refresh_token..."
  }
}
```

##### 2.2 Confirm OTP

```
POST /v1/auth/change-password/confirm
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "otp": "614564"
}
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": {
    "nextStep": "RESET-PASSWORD",
    "accessToken": "temp_access_token...",
    "refreshToken": "temp_refresh_token..."
  }
}
```

##### 2.3 Reset Password

```
POST /v1/auth/reset-password
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "password": "new_secure_password"
}
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "data": {
    "nextStep": "COMPLETED",
    "accessToken": "new_access_token...",
    "refreshToken": "new_refresh_token..."
  }
}
```

##### 2.4 Check Password

```
POST /v1/auth/check-password
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "password": "password_to_check"
}
```

**Response:**

```json
{
  "status": "ok",
  "data": {
    "passwordIsMatch": true
  }
}
```

#### 3. Gateway Token Verification (Internal)

The gateway uses this endpoint to validate tokens on every protected request.

```
POST /api/v1/authz/verify
```

**Headers:**

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <access_token>` |
| `X-Original-URI` | Target URI (e.g., `/api/actuator`) |
| `X-Original-Method` | Target Method (e.g., `GET`) |

**Success Response (HTTP 200-299):**

When `verifyStatus` is `true`, the gateway:
1. Extracts `userId` from response
2. Injects `X-User-Id` header (e.g., `X-User-Id: 4408505240`)
3. Forwards request to downstream microservice
4. Strips the `Authorization` header

**Routing Logic:**
- `.../ms-limit/api` → routed to `ms-limit`
- `.../ms-blacklist/api` → routed to `ms-blacklist`
- `.../api` (default) → routed to `ms-risk-admin`

**Failure Response (HTTP 401):**

```json
{
  "status": "fail",
  "responseCode": 1602,
  "error": "UNAUTHORIZED",
  "errorDetails": [
    {
      "message": "Unauthorized: invalid: token validation failed..."
    }
  ]
}
```

> Error messages are localized via `ms-i18n` service based on `Accept-Language` header.

### Example: Complete Auth-Enabled Setup

```yaml
# gateway.yaml
version: 2.2.0

routes:
  # Public auth endpoints (no auth required)
  - path: /auth
    upstream: http://sb-ms-auth-risk:9000
    timeout: 5000

  # Protected Risk Admin API
  - path: /ms-risk-admin
    upstream:
      - http://ms-risk-admin-1:8080
      - http://ms-risk-admin-2:8080
    loadBalanceStrategy: health_aware
    timeout: 15000
    maxRetries: 3
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  # Protected Limit Service
  - path: /ms-limit
    upstream: http://ms-limit:8080
    timeout: 10000
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  # Protected Blacklist Service
  - path: /ms-blacklist
    upstream: http://ms-blacklist:8080
    timeout: 10000
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000
```

---

## Project Structure

```
ms-node-api-gw/
├── server.js                  # Application entry point
├── gateway.yaml               # Route configuration
├── package.json               # Dependencies
│
├── lib/                       # Core library modules
│   ├── index.js               # Barrel export
│   ├── config/                # Centralized configuration
│   │   ├── index.js           # Config with env overrides
│   │   └── defaults.js        # Default values
│   ├── errors/                # Custom error classes
│   │   └── index.js           # GatewayError, NotFoundError, etc.
│   ├── circuitBreaker.js      # Circuit breaker manager
│   ├── configLoader.js        # YAML config loader
│   ├── loadBalancer.js        # Load balancing strategies
│   ├── logger.js              # Winston logging
│   ├── pluginLoader.js        # Plugin system
│   ├── retry.js               # Retry with backoff
│   ├── routeBuilder.js        # Route/proxy builder
│   ├── shutdown.js            # Graceful shutdown
│   ├── upstreamHealth.js      # Health monitoring
│   └── watcher.js             # Hot-reload file watcher
│
├── middleware/                # Express middleware
│   ├── index.js               # Barrel export
│   ├── errorHandler.js        # Error handling
│   ├── rateLimiter.js         # Rate limiting
│   ├── requestLogger.js       # Request logging
│   ├── requestTimeout.js      # Timeout handling
│   └── security.js            # Helmet, CORS, compression
│
├── plugins/                   # Plugin middleware
│   └── central-auth.js        # Authentication plugin
│
├── routes/                    # Route handlers
│   ├── index.js               # Barrel export
│   ├── health.js              # Health check endpoint
│   └── metrics.js             # Prometheus metrics
│
├── __tests__/                 # Test suite (165 tests)
│   ├── lib/                   # Library tests
│   ├── middleware/            # Middleware tests
│   ├── plugins/               # Plugin tests
│   ├── routes/                # Route tests
│   ├── integration/           # Integration tests
│   └── functional/            # Functional tests
│
├── logs/                      # Log files (auto-created)
├── Dockerfile                 # Container definition
└── docker-compose.yml         # Docker orchestration
```

## Architecture

### Centralized Configuration

All configuration is managed through `lib/config/`:

```javascript
const { config } = require('./lib');

// Access configuration
console.log(config.server.port);           // 3000
console.log(config.timeouts.request);      // 15000
console.log(config.retry.maxRetries);      // 3
console.log(config.isDevelopment);         // true/false
```

### Custom Error Classes

Structured error handling with `lib/errors/`:

```javascript
const { errors } = require('./lib');
const { NotFoundError, BadGatewayError, RateLimitError } = errors;

// Throw typed errors
throw new NotFoundError('User not found');
throw new BadGatewayError('Upstream failed', { upstream: 'http://api:8080' });
throw new RateLimitError('Too many requests', 60);
```

Available error classes:
- `GatewayError` - Base class
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `RequestTimeoutError` (408)
- `RateLimitError` (429)
- `BadGatewayError` (502)
- `ServiceUnavailableError` (503)
- `GatewayTimeoutError` (504)
- `CircuitBreakerOpenError` (503)
- `ConfigurationError` (500)
- `PluginError` (500)

### Clean Imports with Barrel Exports

```javascript
// Import from lib
const { config, logger, circuitBreaker, errors } = require('./lib');

// Import from middleware
const { security, globalRateLimiter, requestTimeout } = require('./middleware');

// Import from routes
const { healthCheck, metricsMiddleware, metricsHandler } = require('./routes');
```

## Plugins

Plugins are located in the `plugins/` directory. Each plugin exports a factory function that returns Express middleware.

### Available Plugins

#### central-auth

Validates JWT tokens via external auth service (`/api/v1/authz/verify`).

```yaml
plugins:
  - name: central-auth
    enabled: true
    authServiceUrl: http://sb-ms-auth-risk:9000
```

**Behavior:**
1. Extracts `Authorization: Bearer <token>` header
2. Calls auth service `POST /api/v1/authz/verify` with:
   - `Authorization` header (forwarded)
   - `X-Original-URI` header (target path)
   - `X-Original-Method` header (HTTP method)
3. On success (`verifyStatus: true`):
   - Injects `X-User-Id` header with user ID
   - Strips `Authorization` header
   - Forwards request to upstream
4. On failure:
   - Returns `401 Unauthorized` for invalid tokens
   - Returns `502 Bad Gateway` if auth service unavailable

### Creating Custom Plugins

Create a new file in `plugins/` directory:

```javascript
// plugins/custom-header.js
module.exports = (params) => {
    const { headerName = 'X-Custom', headerValue = 'default' } = params;
    
    return (req, res, next) => {
        req.headers[headerName] = headerValue;
        next();
    };
};
```

Use in `gateway.yaml`:

```yaml
routes:
  - path: /api/custom
    upstream: http://backend:8080
    plugins:
      - name: custom-header
        enabled: true
        headerName: X-Request-Source
        headerValue: api-gateway
```

## Enterprise Features

### Circuit Breakers

Prevents cascading failures when upstream services are down:

- Opens after 50% error rate in rolling window
- Half-opens after 30 seconds to test recovery
- Closes on successful request in half-open state

### Retry Logic

Automatic retry with exponential backoff:

- Retries on: `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `ENOTFOUND`
- Exponential backoff with ±20% jitter
- Configurable max retries and delays

### Health Monitoring

Continuous upstream health checking:

- Periodic health checks (default: 30s interval)
- Consecutive failure threshold before marking unhealthy
- Automatic recovery on success

### Rate Limiting

Per-IP rate limiting with configurable windows:

- Skips `/health` and `/metrics` endpoints
- Returns `429 Too Many Requests` with `Retry-After` header
- Configurable via environment variables

## Logging

Winston-based structured logging with rotation:

### Log Structure

```
logs/
├── app-2026-01-22/
│   ├── 20.log          # Hour 20 logs
│   └── 21.log          # Hour 21 logs
├── error.log           # All errors
├── exceptions.log      # Uncaught exceptions
└── rejections.log      # Unhandled rejections
```

### Log Levels

| Level | Description |
|-------|-------------|
| `error` | Errors and 5xx responses |
| `warn` | Warnings and 4xx responses |
| `info` | Normal operations |
| `debug` | Detailed debugging (dev only) |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test Coverage:** 165 tests across 19 test suites covering:
- Unit tests for all core modules
- Integration tests for middleware combinations
- Functional tests for end-to-end flows
- Edge cases and error handling

## Example: Complete Production Setup

```yaml
# gateway.yaml
version: 2.2.0

routes:
  # Public auth endpoints
  - path: /auth
    upstream: http://sb-ms-auth-risk:9000
    timeout: 5000

  # Protected API with load balancing
  - path: /api
    upstream:
      - http://api-server-1:8080
      - http://api-server-2:8080
      - http://api-server-3:8080
    loadBalanceStrategy: health_aware
    timeout: 15000
    maxRetries: 3
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  # Admin endpoints with stricter settings
  - path: /admin
    upstream: http://admin-service:8080
    timeout: 30000
    maxRetries: 1
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000
```

```bash
# Start with production settings
NODE_ENV=production \
PORT=3000 \
RATE_LIMIT_MAX=1000 \
MAX_SOCKETS=512 \
TRUST_PROXY=true \
npm start
```

## License

ISC
