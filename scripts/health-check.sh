#!/bin/bash
# Health check script for the API Gateway
# Usage: ./scripts/health-check.sh [host] [port]

HOST=${1:-localhost}
PORT=${2:-3000}
TIMEOUT=${3:-5}

echo "Checking API Gateway health at $HOST:$PORT..."

# Check /health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "http://$HOST:$PORT/health")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Health check passed (HTTP $HTTP_CODE)"
    
    # Get detailed health info
    echo ""
    echo "Health details:"
    curl -s "http://$HOST:$PORT/health" | head -c 500
    echo ""
    exit 0
else
    echo "✗ Health check failed (HTTP $HTTP_CODE)"
    exit 1
fi
