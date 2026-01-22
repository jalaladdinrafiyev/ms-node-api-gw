# Microservices API Gateway

A production-ready, enterprise-level API Gateway built with Node.js and Express. Features dynamic route configuration, plugin-based middleware, circuit breakers, load balancing, distributed rate limiting, and zero-downtime configuration updates.

## Features

- 🚀 **Hot Reload**: Configuration changes reload automatically without restart
- 🔌 **Plugin System**: Modular middleware architecture
- 🔒 **Enterprise Security**: Helmet, CORS, rate limiting, request timeouts
- ⚡ **Circuit Breakers**: Prevent cascading failures with automatic recovery
- ⚖️ **Load Balancing**: Round-robin, random, and health-aware strategies
- 🔄 **Retry Logic**: Exponential backoff with jitter for transient failures
- 📊 **Prometheus Metrics**: Full observability with `/metrics` endpoint
- ❤️ **Health Checks**: Comprehensive `/health` endpoint with upstream status
- 🎯 **Kubernetes Ready**: Liveness (`/livez`) and readiness (`/readyz`) probes
- 📁 **Structured Logging**: Winston with daily/hourly rotation
- 🐳 **Docker Ready**: Full Docker and Docker Compose support with Redis
- ⚡ **Zero Downtime**: Atomic router updates prevent service interruption
- 🛡️ **Graceful Shutdown**: Clean connection draining on SIGTERM/SIGINT
- 🔗 **Request Tracing**: Correlation IDs for distributed tracing
- 🚦 **Distributed Rate Limiting**: Redis-backed for multi-instance deployments

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the gateway
npm start
```

The gateway runs on `http://localhost:3000` by default.

### Docker (Development)

```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Docker (Production)

```bash
# Copy environment template
cp env.example .env
# Edit .env with your values

# Start with Redis for distributed rate limiting
docker compose -f docker-compose.prod.yml up -d

# Check health
curl http://localhost:3000/readyz
```

## Usage Guide

### How Request Routing Works

```
Client Request → API Gateway → Backend Service
     ↓
http://gateway:3000/api/users/123
     ↓
Gateway strips "/api/users" prefix
     ↓
http://user-service:8080/123
```

### Common Use Cases

#### 1. Simple Proxy (No Authentication)

```yaml
# gateway.yaml
routes:
  - path: /api/products
    upstream: http://product-service:8080
```

```bash
# Client request
curl http://localhost:3000/api/products

# Gateway forwards to: http://product-service:8080/products
```

#### 2. Protected Route (With Authentication)

```yaml
# gateway.yaml
routes:
  - path: /api/orders
    upstream: http://order-service:8080
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://auth-service:9000
```

```bash
# Client request with JWT token
curl -H "Authorization: Bearer eyJhbGc..." \
     http://localhost:3000/api/orders

# Gateway:
# 1. Validates token with auth service
# 2. Adds X-User-Id header to request
# 3. Strips Authorization header
# 4. Forwards to order-service
```

#### 3. Load Balanced Route (Multiple Backends)

```yaml
# gateway.yaml
routes:
  - path: /api/search
    upstream: http://search-1:8080,http://search-2:8080,http://search-3:8080
    loadBalanceStrategy: health_aware
    healthPath: /health
```

Gateway automatically:
- Monitors health of all backends
- Routes traffic to healthy instances
- Opens circuit breaker if a backend fails repeatedly

#### 4. Route with Timeout and Retry

```yaml
# gateway.yaml
routes:
  - path: /api/payments
    upstream: http://payment-service:8080
    timeout: 30000        # 30 second timeout
    maxRetries: 3         # Retry up to 3 times on failure
    retry: true
```

### Complete Example: E-commerce Setup

**Scenario:** Gateway for an e-commerce platform with multiple microservices.

```yaml
# gateway.yaml
version: 2.2.0

routes:
  # Public auth endpoints - no authentication needed
  - path: /auth
    upstream: http://auth-service:9000
    timeout: 5000
    
  # Products API - public read access
  - path: /api/products
    upstream: http://product-service:8080
    healthPath: /actuator/health
    loadBalanceStrategy: round_robin
    
  # Orders API - requires authentication
  - path: /api/orders
    upstream: http://order-service-1:8080,http://order-service-2:8080
    loadBalanceStrategy: health_aware
    healthPath: /health
    timeout: 15000
    maxRetries: 2
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://auth-service:9000
        
  # Admin API - requires authentication, stricter settings
  - path: /admin
    upstream: http://admin-service:8080
    timeout: 30000
    maxRetries: 1
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://auth-service:9000
```

**Client Usage:**

```bash
# 1. Login (public endpoint)
curl -X POST http://localhost:3000/auth/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "+99455xxxxxxx", "password": "secret"}'

# Response: { "data": { "accessToken": "eyJhbGc...", ... } }

# 2. Browse products (public)
curl http://localhost:3000/api/products

# 3. Create order (requires token)
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"productId": 123, "quantity": 2}'

# 4. Admin operations (requires token)
curl http://localhost:3000/admin/dashboard \
  -H "Authorization: Bearer eyJhbGc..."
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│              (Web, Mobile, External APIs)                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY (:3000)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Security → Rate Limit → Auth → Load Balance → Proxy  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Endpoints:                                                  │
│  • /health  - Health check                                   │
│  • /metrics - Prometheus metrics                             │
│  • /livez   - Kubernetes liveness                            │
│  • /readyz  - Kubernetes readiness                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Service A│    │ Service B│    │ Service C│
    │  :8080   │    │  :8081   │    │  :8082   │
    └──────────┘    └──────────┘    └──────────┘
```

### Monitoring Your Gateway

```bash
# Check gateway health
curl http://localhost:3000/health | jq

# Check if ready (for load balancers)
curl http://localhost:3000/readyz

# Get Prometheus metrics
curl http://localhost:3000/metrics

# Key metrics to monitor:
# - http_requests_total
# - http_request_duration_seconds
# - circuit_breaker_state
# - upstream_requests_total
```

---

## Configuration

Routes are configured in `gateway.yaml`:

```yaml
version: 2.2.0

routes:
  # Simple route
  - path: /api/users
    upstream: http://user-service:8080
    healthPath: /actuator/health

  # Protected route with authentication
  - path: /api/orders
    upstream: http://order-service:8080
    healthPath: /health
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://auth-service:9000

  # Load-balanced route with multiple upstreams
  - path: /api/products
    upstream: http://product-service-1:8080,http://product-service-2:8080
    loadBalanceStrategy: health_aware
    healthPath: /actuator/health
    timeout: 10000
    maxRetries: 3
```

### Route Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | required | URL path prefix to match |
| `upstream` | string/array | required | Backend service URL(s) |
| `healthPath` | string | `/health` | Custom health check path for upstream |
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

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Gateway listen port |
| `NODE_ENV` | `development` | Environment mode |
| `GATEWAY_CONFIG_PATH` | `./gateway.yaml` | Path to route configuration |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUST_PROXY` | `false` | Trust X-Forwarded-For header |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | `true` | Allow credentials in CORS |
| `REQUEST_BODY_LIMIT` | `10mb` | Max request body size |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis URL for distributed rate limiting |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_STRICT_MAX` | `10` | Strict rate limit for sensitive endpoints |

### Timeouts

| Variable | Default | Description |
|----------|---------|-------------|
| `REQUEST_TIMEOUT_MS` | `15000` | Client request timeout |
| `UPSTREAM_TIMEOUT_MS` | `30000` | Upstream proxy timeout |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Graceful shutdown timeout |
| `HEALTH_CHECK_TIMEOUT_MS` | `5000` | Health check timeout |

### Retry & Circuit Breaker

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_RETRIES` | `3` | Retry attempts for failures |
| `RETRY_INITIAL_DELAY_MS` | `100` | Initial retry delay |
| `RETRY_MAX_DELAY_MS` | `10000` | Maximum retry delay |
| `CIRCUIT_BREAKER_TIMEOUT_MS` | `10000` | Circuit breaker timeout |
| `CIRCUIT_BREAKER_ERROR_THRESHOLD` | `50` | Error % to open circuit |
| `CIRCUIT_BREAKER_RESET_TIMEOUT_MS` | `30000` | Time before half-open |

### Health Checks

| Variable | Default | Description |
|----------|---------|-------------|
| `HEALTH_CHECK_INTERVAL_MS` | `30000` | Upstream health check interval |
| `HEALTH_CHECK_UNHEALTHY_THRESHOLD` | `3` | Failures before unhealthy |
| `HEALTH_CHECK_HEALTHY_THRESHOLD` | `2` | Successes before healthy |

### Connection Pool

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_SOCKETS` | `256` | Max concurrent connections per upstream |
| `MAX_FREE_SOCKETS` | `64` | Max idle connections to keep |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |

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

### Kubernetes Probes

```
GET /livez     # Liveness probe - is the process alive?
GET /readyz    # Readiness probe - is the gateway ready to serve traffic?
```

**Liveness Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-22T15:30:00.000Z"
}
```

**Readiness Response:**
```json
{
  "status": "ready",
  "timestamp": "2026-01-22T15:30:00.000Z",
  "checks": {
    "routes": "loaded",
    "memory": "ok"
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

# HELP upstream_requests_total Total upstream requests
# TYPE upstream_requests_total counter
upstream_requests_total{upstream="http://api-server:8080",method="GET",status_code="200"} 1500
```

## Request Flow

```
Client Request
     ↓
┌─────────────────────────────────────┐
│          API Gateway                │
├─────────────────────────────────────┤
│  1. Security (Helmet, CORS)         │
│  2. Request ID Generation           │
│  3. Rate Limiting (Redis/Memory)    │
│  4. Request Timeout                 │
│  5. Metrics Collection              │
│  6. Request Logging                 │
│  7. Route Matching                  │
│  8. Plugin Middleware (Auth, etc.)  │
│  9. Circuit Breaker Check           │
│ 10. Load Balancer Selection         │
│ 11. Proxy to Upstream               │
│ 12. Retry on Failure                │
│ 13. Record Success/Failure          │
└─────────────────────────────────────┘
     ↓
Upstream Service
```

## Request Tracing

The gateway automatically generates and propagates request correlation IDs:

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Unique request identifier |
| `X-Correlation-ID` | Propagated from client or generated |
| `X-Trace-ID` | Propagated for distributed tracing |

These headers are:
- Generated if not present in the incoming request
- Propagated to upstream services
- Included in all log entries
- Returned in response headers

---

## Production Deployment

### Docker Compose (Recommended)

The production Docker Compose setup includes:
- API Gateway container
- Redis for distributed rate limiting
- Resource limits and health checks
- Automatic restarts

```bash
# 1. Create environment file
cp env.example .env

# 2. Edit with your production values
nano .env

# 3. Start the stack
docker compose -f docker-compose.prod.yml up -d

# 4. View logs
docker compose -f docker-compose.prod.yml logs -f api-gateway

# 5. Stop
docker compose -f docker-compose.prod.yml down
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: api-gateway:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          value: "redis://redis:6379"
        - name: TRUST_PROXY
          value: "true"
        - name: CORS_ORIGIN
          value: "https://app.example.com"
        livenessProbe:
          httpGet:
            path: /livez
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readyz
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          limits:
            cpu: "1"
            memory: "512Mi"
          requests:
            cpu: "100m"
            memory: "128Mi"
```

### Building Docker Image

```bash
# Using the build script (Windows PowerShell)
.\build-docker.ps1

# Or manually
docker build -t api-gateway:1.0.0 .

# Save for distribution
docker save api-gateway:1.0.0 | gzip > api-gateway-1.0.0.tar.gz

# Load on target server
gunzip -c api-gateway-1.0.0.tar.gz | docker load
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` (not `*`)
- [ ] Enable `TRUST_PROXY=true` if behind load balancer
- [ ] Connect Redis via `REDIS_URL` for distributed rate limiting
- [ ] Set appropriate `RATE_LIMIT_MAX` for your traffic
- [ ] Configure health check paths in `gateway.yaml`
- [ ] Set up Prometheus scraping on `/metrics`
- [ ] Configure log aggregation (ELK, CloudWatch, etc.)
- [ ] Set up alerting on circuit breaker opens
- [ ] Load test with expected traffic patterns

---

## Authentication Service Integration

This gateway integrates with the **Risk Admin Authentication Service** for token validation and user authorization.

### Auth Service Configuration

```yaml
# gateway.yaml
routes:
  - path: /ms-risk-admin
    upstream: http://ms-risk-admin:8080
    healthPath: /actuator/health
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  - path: /ms-limit
    upstream: http://ms-limit:8080
    healthPath: /actuator/health
    plugins:
      - name: central-auth
        enabled: true
        authServiceUrl: http://sb-ms-auth-risk:9000

  - path: /ms-blacklist
    upstream: http://ms-blacklist:8080
    healthPath: /actuator/health
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

---

## Project Structure

```
ms-node-api-gw/
├── server.js                  # Application entry point
├── gateway.yaml               # Route configuration
├── package.json               # Dependencies
├── env.example                # Environment template
├── Dockerfile                 # Container definition
├── docker-compose.yml         # Dev orchestration
├── docker-compose.prod.yml    # Production orchestration (with Redis)
├── build-docker.ps1           # Docker build script
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
│   ├── rateLimiter.js         # Rate limiting (Redis/Memory)
│   ├── requestId.js           # Request correlation IDs
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
│   ├── metrics.js             # Prometheus metrics
│   └── probes.js              # Kubernetes probes
│
├── __tests__/                 # Test suite (275 tests)
│   ├── lib/                   # Library tests
│   ├── middleware/            # Middleware tests
│   ├── plugins/               # Plugin tests
│   ├── routes/                # Route tests
│   ├── integration/           # Integration tests
│   └── functional/            # Functional tests
│
└── logs/                      # Log files (auto-created)
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
console.log(config.isProduction);          // true/false
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

## Enterprise Features

### Circuit Breakers

Prevents cascading failures when upstream services are down:

- Opens after 50% error rate in rolling window
- Half-opens after 30 seconds to test recovery
- Closes on successful request in half-open state
- **Only 5xx errors and network failures trip the circuit** (4xx client errors do not)

### Retry Logic

Automatic retry with exponential backoff:

- Retries on: `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `ENOTFOUND`
- Exponential backoff with ±20% jitter
- Configurable max retries and delays

### Health Monitoring

Continuous upstream health checking:

- Periodic health checks (default: 30s interval)
- Configurable health check paths per route
- Consecutive failure threshold before marking unhealthy
- Automatic recovery on success

### Rate Limiting

Per-IP rate limiting with configurable windows:

- **Redis-backed for distributed deployments**
- Falls back to in-memory if Redis unavailable
- Skips `/health`, `/metrics`, `/livez`, `/readyz` endpoints
- Returns `429 Too Many Requests` with `Retry-After` header
- Configurable via environment variables

### Distributed Rate Limiting with Redis

For multi-instance deployments, configure Redis:

```bash
# Enable Redis rate limiting
REDIS_URL=redis://localhost:6379
```

The gateway will:
1. Attempt to connect to Redis on startup
2. Log success/failure of connection
3. Fall back to in-memory if Redis is unavailable
4. Properly close Redis connection on shutdown

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

### Log Format

All logs include request correlation IDs:

```json
{
  "level": "info",
  "message": "Request completed",
  "requestId": "abc-123-def",
  "method": "GET",
  "url": "/api/users",
  "statusCode": 200,
  "duration": "45ms",
  "timestamp": "2026-01-22T15:30:00.000Z"
}
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

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

**Test Coverage:** 275 tests across 26 test suites covering:
- Unit tests for all core modules
- Integration tests for middleware combinations
- Functional tests for end-to-end flows
- Edge cases and error handling
- Custom error classes
- Configuration validation
- Barrel exports

## Monitoring

### Prometheus Integration

Scrape configuration:

```yaml
scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3000']
    metrics_path: /metrics
    scrape_interval: 15s
```

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| `http_request_duration_seconds` p99 | > 5s |
| `http_request_errors_total` rate | > 10/min |
| `circuit_breaker_state` | = 1 (open) |
| `upstream_request_duration_seconds` p99 | > 10s |

### Alerting

Set up alerts for:
- Circuit breaker opens (upstream failures)
- High error rates
- High latency
- Rate limit exceeded spikes
- Memory usage

## License

ISC
