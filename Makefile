# API Gateway Makefile
# Common development and deployment tasks

.PHONY: help install dev test lint format build docker-build docker-run clean

# Default target
help:
	@echo "API Gateway - Available Commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make install       Install dependencies"
	@echo "    make dev           Run in development mode"
	@echo ""
	@echo "  Testing:"
	@echo "    make test          Run tests"
	@echo "    make test-coverage Run tests with coverage"
	@echo ""
	@echo "  Code Quality:"
	@echo "    make lint          Run ESLint"
	@echo "    make lint-fix      Run ESLint with auto-fix"
	@echo "    make format        Format code with Prettier"
	@echo "    make validate      Run lint + format check + tests"
	@echo ""
	@echo "  Docker:"
	@echo "    make docker-build  Build Docker image"
	@echo "    make docker-run    Run Docker container"
	@echo "    make docker-up     Docker compose up (dev)"
	@echo "    make docker-down   Docker compose down"
	@echo ""
	@echo "  Utilities:"
	@echo "    make clean         Remove build artifacts"
	@echo "    make logs          View application logs"
	@echo ""

# Install dependencies
install:
	npm ci

# Development server
dev:
	NODE_ENV=development npm start

# Run tests
test:
	npm test

# Run tests with coverage
test-coverage:
	npm run test:coverage

# Lint code
lint:
	npm run lint

# Lint and fix
lint-fix:
	npm run lint:fix

# Format code
format:
	npm run format

# Check formatting
format-check:
	npm run format:check

# Validate (lint + format + test)
validate:
	npm run validate

# Build Docker image
docker-build:
	docker build -t ms-node-api-gw:latest .

# Run Docker container
docker-run:
	docker run -p 3000:3000 \
		-v $(PWD)/gateway.yaml:/app/gateway.yaml:ro \
		--env-file .env \
		ms-node-api-gw:latest

# Docker compose up (development)
docker-up:
	docker-compose up -d

# Docker compose down
docker-down:
	docker-compose down

# Docker compose up (production)
docker-up-prod:
	docker-compose -f docker-compose.prod.yml up -d

# Clean build artifacts
clean:
	rm -rf coverage/
	rm -rf logs/*.log
	rm -rf node_modules/

# View logs
logs:
	tail -f logs/app-*.log 2>/dev/null || echo "No log files found"
