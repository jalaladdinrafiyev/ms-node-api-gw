# Contributing to ms-node-api-gw

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** and clone your fork
2. **Install dependencies**: `npm ci`
3. **Run tests**: `npm test`
4. **Start development server**: `npm run dev`

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### Making Changes

1. Create a branch from `main`
2. Make your changes
3. Write/update tests
4. Run the validation suite: `npm run validate`
5. Commit with a clear message

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

- `feat(auth): add JWT token refresh endpoint`
- `fix(rate-limiter): handle Redis connection timeout`
- `docs(readme): update configuration examples`

## Code Style

- **ESLint**: Run `npm run lint` to check code style
- **Prettier**: Run `npm run format` to format code
- **EditorConfig**: Ensure your editor respects `.editorconfig`

### Guidelines

1. Use meaningful variable/function names
2. Add JSDoc comments for public APIs
3. Keep functions small and focused
4. Handle errors appropriately
5. Write tests for new functionality

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- `__tests__/lib/` - Unit tests for library modules
- `__tests__/middleware/` - Middleware tests
- `__tests__/routes/` - Route handler tests
- `__tests__/plugins/` - Plugin tests
- `__tests__/integration/` - Integration tests
- `__tests__/functional/` - End-to-end functional tests

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

### PR Checklist

- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated
- [ ] No merge conflicts

## Reporting Issues

### Bug Reports

Include:

- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:

- Use case description
- Proposed solution
- Alternative solutions considered

## Questions?

Open a discussion or issue if you have questions about contributing.

Thank you for contributing! 🎉
