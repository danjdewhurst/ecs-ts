# Contributing to ECS Game Engine

We love your input! We want to make contributing to the ECS Game Engine as easy and transparent as possible.

## 🚀 Quick Start

1. Fork the repo and create your branch from `main`
2. Install dependencies: `bun install`
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass: `bun test`
6. Make sure TypeScript compiles: `bun run typecheck`
7. Submit a pull request!

## 📋 Development Process

We use GitHub to sync code, track issues, feature requests, and accept pull requests.

### Pull Request Process

1. **Fork & Branch**: Create your feature branch from `main`
   ```bash
   git checkout -b feat/my-amazing-feature
   ```

2. **Develop**: Make your changes with comprehensive tests
   - Write tests for new functionality
   - Update existing tests if needed
   - Follow the existing code style and patterns

3. **Test**: Ensure all tests pass locally
   ```bash
   bun test
   bun run typecheck
   ```

4. **Document**: Update documentation if needed
   - Update README.md for user-facing changes
   - Update inline comments for complex logic
   - Add tests for the new functionality

5. **Submit**: Create a pull request with:
   - Clear title and description
   - Reference any related issues
   - Screenshots/GIFs for UI changes (if applicable)

## 🧪 Testing Guidelines

- **Unit Tests**: All new code should have corresponding unit tests
- **Integration Tests**: Add integration tests for complex features
- **Test Coverage**: Aim to maintain or improve test coverage
- **Test Naming**: Use descriptive test names that explain the behavior

Example test structure:
```typescript
describe('MyNewFeature', () => {
    test('should handle normal case correctly', () => {
        // Arrange
        const input = createTestInput();

        // Act
        const result = myNewFeature(input);

        // Assert
        expect(result).toEqual(expectedOutput);
    });
});
```

## 🎯 Code Style

We use TypeScript with strict type checking. Please follow these guidelines:

### General Principles
- **Type Safety**: Use strict TypeScript settings
- **Readability**: Code should be self-documenting
- **Performance**: Consider performance implications
- **Consistency**: Follow existing patterns and conventions

### Specific Guidelines
- Use `interface` for public APIs, `type` for internal types
- Prefer `readonly` arrays and objects where appropriate
- Use descriptive variable names
- Add JSDoc comments for public APIs
- Use proper error handling with meaningful messages

### File Organization
```
src/
├── core/           # Core engine functionality
├── components/     # Reusable components
├── systems/        # Game systems
├── utils/          # Utility functions
└── types/          # Type definitions
```

## 🐛 Bug Reports

We use GitHub Issues to track bugs. Report a bug by [opening a new issue](https://github.com/danjdewhurst/ecs-ts/issues/new).

**Great bug reports** include:
- Quick summary of the issue
- Steps to reproduce (be specific!)
- Expected vs actual behavior
- Code samples if applicable
- Your environment (Bun version, OS, etc.)

## 💡 Feature Requests

We welcome feature requests! Please [open an issue](https://github.com/danjdewhurst/ecs-ts/issues/new) with:
- Clear description of the feature
- Use case and motivation
- Proposed API (if you have ideas)
- Willingness to implement (bonus points!)

## 📦 Release Process

We use [Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/) for automated releases.

### Automated Release Workflow

1. **Conventional Commits**: Use conventional commit format for all commits
2. **Release Please**: Automatically creates release PRs based on commits
3. **GitHub Releases**: Automatically created when release PRs are merged
4. **Assets**: Build artifacts and distributions attached to releases

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature (bumps minor version)
- `fix`: Bug fix (bumps patch version)
- `feat!` or `BREAKING CHANGE`: Breaking change (bumps major version)
- `docs`: Documentation changes
- `test`: Adding tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

**Scopes:**
- `core`: Core ECS engine
- `systems`: System-related changes
- `components`: Component definitions
- `events`: Event system
- `websocket`: WebSocket functionality
- `plugins`: Plugin architecture

**Examples:**
```bash
feat(core): add entity ID recycling to EntityManager
fix(systems): resolve dependency resolution in SystemScheduler
feat(events)!: change event subscription API

BREAKING CHANGE: Event subscription now requires explicit event types
```

### Using Commitizen

For interactive commit creation:
```bash
bun run commit
```

### Version Types

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features (backward compatible)
- **Patch** (1.0.0 → 1.0.1): Bug fixes
- **Pre-release** (1.0.0-alpha.1): Alpha/Beta/RC versions

### Release Checklist

Before major releases:
- [ ] All tests pass
- [ ] Performance benchmarks reviewed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide created (if needed)

## 🎯 Current Priorities

The core engine is production-ready with all major features complete. Current priorities include:

### Help Wanted
- Performance optimizations and benchmarking
- Additional example games and use cases
- Documentation improvements and tutorials
- Test coverage improvements
- Community plugins and extensions

## 📖 Resources

- [Philosophy](PHILOSOPHY.md) - Core design principles and architecture
- [Examples](examples/) - Working code examples
- [Tests](src/**/*.test.ts) - Test suite for reference
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript reference
- [Bun Documentation](https://bun.sh/docs) - Bun runtime reference

## ❓ Questions?

Feel free to:
- [Open an issue](https://github.com/danjdewhurst/ecs-ts/issues/new) for questions
- Start a [discussion](https://github.com/danjdewhurst/ecs-ts/discussions) for ideas
- Reach out to [@danjdewhurst](https://github.com/danjdewhurst)

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the ECS Game Engine! 🎮✨
