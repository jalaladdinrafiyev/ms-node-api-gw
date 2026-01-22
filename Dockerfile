# ============================================
# API Gateway - Production Dockerfile
# ============================================

# Stage 1: Build dependencies
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev for any build steps)
RUN npm ci

# Copy source files
COPY server.js ./
COPY lib/ ./lib/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY plugins/ ./plugins/

# Prune dev dependencies for production
RUN npm prune --production

# ============================================
# Stage 2: Production image
# ============================================
FROM node:18-alpine AS production

# Security: Don't run as root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gateway -u 1001

WORKDIR /app

# Copy production dependencies and source
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:nodejs /app/server.js ./
COPY --from=builder --chown=gateway:nodejs /app/lib ./lib
COPY --from=builder --chown=gateway:nodejs /app/middleware ./middleware
COPY --from=builder --chown=gateway:nodejs /app/routes ./routes
COPY --from=builder --chown=gateway:nodejs /app/plugins ./plugins
COPY --from=builder --chown=gateway:nodejs /app/package.json ./

# Copy gateway config (can be overridden via volume mount)
COPY --chown=gateway:nodejs gateway.yaml ./

# Create logs directory
RUN mkdir -p /app/logs && chown gateway:nodejs /app/logs

# Switch to non-root user
USER gateway

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/livez', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "server.js"]
