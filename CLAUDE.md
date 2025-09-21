---
description: Development guidelines for the ECS Game Engine project
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json, *.md"
alwaysApply: true
---

# ECS Game Engine Development Guidelines

## Core Philosophy

**CRITICAL**: All development must adhere to [PHILOSOPHY.md](PHILOSOPHY.md) principles.

**NON-NEGOTIABLE RULES:**
- **Entities = IDs only, Components = pure data** (no logic in components)
- **All game logic in systems** (system-driven behavior required)
- **Performance first** (cache locality, data-driven design)
- **Single Responsibility** (one purpose per system/component/entity)
- **Simple APIs** (avoid boilerplate, focus on ergonomics)
- **Robust tooling** (debugging/profiling are first-class)

## Runtime & Tools

**Use Bun for all operations:**
- `bun <file>` for running TypeScript files directly
- `bun test` for running the test suite
- `bun run <script>` for package.json scripts
- `bun install` for dependency management
- `bun build` for production builds

**Essential Commands:**
- `bun test` - Run tests (REQUIRED before commits)
- `bun run typecheck` - TypeScript check (REQUIRED before commits)
- `bun run check` - Lint/format check (REQUIRED before commits)
- `bun run commit` - Interactive conventional commit
- `bun examples/basic-example.ts` - Basic usage
- `bun examples/websocket-example.ts` - Multiplayer server
- `bun examples/plugin-system-example.ts` - Plugin system
- `bun examples/performance-optimization-example.ts` - Performance

**Release & Publishing Commands:**
- `bun run commit` - Interactive conventional commit creation (uses commitizen)
- `bun run changelog` - Generate changelog from conventional commits
- `bun run build` - Build distribution with TypeScript declarations
- `bun run build:clean` - Clean build (removes dist/ first)
- `bun run check` - Run Biome linting and formatting checks
- `bun run check:fix` - Auto-fix linting and formatting issues

## Project Structure

```
src/
├── core/ecs/           # Core ECS implementation
│   ├── EntityManager.ts    # Entity lifecycle management
│   ├── Component.ts        # Component interfaces & storage
│   ├── ArchetypeManager.ts # Entity archetype optimization
│   ├── World.ts           # Central ECS coordinator
│   ├── System.ts          # System interfaces
│   └── SystemScheduler.ts # Dependency-aware scheduling
├── core/events/        # Event system (Phase 3) ✅
├── core/websocket/     # WebSocket integration (Phase 4) ✅
├── core/plugins/       # Plugin architecture (Phase 5) ✅
├── core/performance/   # Performance optimization (Phase 6) ✅
├── systems/           # Game systems
└── components/        # Game components
```

## Code Standards

### TypeScript Guidelines

**Strict Type Safety:**
- Use `interface` for component definitions
- Prefer `readonly` for immutable data
- Use generics with proper constraints: `<T extends Component>`
- Always define explicit return types for public methods

**Component Pattern:**
```typescript
interface MyComponent extends Component {
    readonly type: 'my-component';
    data: number;
}
```

**System Pattern:**
```typescript
class MySystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MySystem';
    readonly dependencies = ['OtherSystem'];
    
    update(world: World, deltaTime: number): void {
        // Implementation
    }
}
```

### Testing Requirements

**MANDATORY: All new code must include tests:**
- Unit tests for individual classes
- Integration tests for system interactions
- Descriptive test names explaining behavior
- AAA pattern: Arrange, Act, Assert
- Test coverage must be maintained

**Test Structure:**
```typescript
import { test, expect, describe } from "bun:test";

describe('FeatureName', () => {
    test('should handle expected behavior correctly', () => {
        // Arrange
        const world = new World();
        
        // Act
        const result = world.someMethod();
        
        // Assert
        expect(result).toBe(expectedValue);
    });
});
```

### Performance Guidelines

**ECS Optimization Rules:**
- Components should be data-only (no methods)
- Systems should be stateless where possible
- Use archetype queries for multi-component operations
- Avoid entity creation/destruction in hot loops
- Cache query results when appropriate
- Use dirty tracking for selective system updates
- Leverage object pooling for frequently created/destroyed objects

## WebSocket Integration ✅

Phase 4 complete with full multiplayer support:
- `Bun.serve()` with built-in WebSocket support
- No external WebSocket libraries needed
- High-performance networking with type-safe protocols

```typescript
// WebSocket server implementation
import { GameServer } from './src/core/websocket';

const server = new GameServer(world, {
  port: 3000,
  maxClients: 100,
  heartbeatInterval: 30000
});

await server.start();
```

## Commit Standards

**MUST follow Conventional Commits v1.0.0:**

### Commit Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Required Types
- `feat`: New feature
- `fix`: Bug fix  
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `chore`: Build process or auxiliary tool changes
- `ci`: CI/CD configuration changes

### Scopes (optional)
- `core`: Core ECS engine
- `systems`: System-related changes  
- `components`: Component definitions
- `events`: Event system
- `websocket`: WebSocket functionality
- `plugins`: Plugin architecture
- `performance`: Performance optimization
- `tests`: Test-related changes
- `docs`: Documentation updates

### Examples
```bash
feat(core): add entity ID recycling to EntityManager
fix(systems): resolve dependency resolution in SystemScheduler  
docs: update README with performance metrics
test(core): add comprehensive World integration tests
chore(ci): add CodeQL security analysis workflow
```

### Breaking Changes
Use `!` after type/scope for breaking changes:
```bash
feat(core)!: change Component interface to require readonly type
```

### Commit Body Guidelines
- Use imperative mood ("add feature" not "added feature")
- Wrap at 72 characters
- Explain what and why, not how
- Reference issues: "Closes #123"

## Development Workflow

1. **Start Development:**
   ```bash
   bun install
   bun test --watch  # Run tests in watch mode
   ```

2. **Before Committing:**
   ```bash
   bun test         # Ensure all tests pass
   bun run typecheck # Verify TypeScript compilation
   bun run check    # Run linting and formatting
   ```

3. **Commit Changes (Automated Release System):**
   ```bash
   git add .
   bun run commit   # Interactive conventional commit creation
   # OR manually:
   git commit -m "feat(core): add new ECS feature"
   ```

4. **Push Changes:**
   ```bash
   git push origin main
   # Release Please will automatically create release PRs based on conventional commits
   ```

5. **Run Example:**
   ```bash
   bun examples/basic-example.ts
   ```

## Release Management & Automation

**Automated Release System:**
- Uses Release Please for automated version management
- Conventional commits trigger automatic version bumps
- Automated changelog generation from commit history
- GitHub releases created automatically when release PRs are merged

**Release Process:**
1. **Development**: Use conventional commits (feat, fix, etc.)
2. **Release PR**: Release Please automatically creates PRs with version bumps
3. **Review & Merge**: Maintainer reviews and merges release PR
4. **GitHub Release**: Automatically created with assets and changelog
5. **NPM Publishing**: Ready (currently disabled while private)

**Version Bumping Rules:**
- `feat: new feature` → Minor version bump (0.4.0 → 0.5.0)
- `fix: bug fix` → Patch version bump (0.4.0 → 0.4.1)
- `feat!: breaking change` → Major version bump (0.4.0 → 1.0.0)
- `docs:, test:, chore:` → No version bump

**Release Commands:**
```bash
# Interactive commit (recommended)
bun run commit

# Check what would be included in next release
git log --oneline $(git describe --tags --abbrev=0)..HEAD

# Generate changelog manually (for preview)
bun run changelog

# Build for release
bun run build:clean
```

**Security & Quality Gates:**
- All releases include security scanning (Trivy)
- Dependency vulnerability checks
- Performance benchmark tracking
- Comprehensive test coverage requirements
- Type checking and linting validation

**Release Assets:**
- Source code archives with checksums
- Built distribution packages
- TypeScript declaration files
- Updated documentation and examples

**Pre-release Support:**
- Alpha: `git tag v0.5.0-alpha.1`
- Beta: `git tag v0.5.0-beta.1`
- RC: `git tag v0.5.0-rc.1`

## Implementation Status

**✅ ALL PHASES COMPLETE - PRODUCTION READY**

- ✅ **Phase 1**: Core ECS Implementation
- ✅ **Phase 2**: System Architecture
- ✅ **Phase 3**: Event System Implementation
- ✅ **Phase 4**: WebSocket Integration with Bun
- ✅ **Phase 5**: Plugin Architecture
- ✅ **Phase 6**: Performance Optimization

**Engine is production-ready with full feature set completed.**

## Claude Release Assistance

**When helping with releases, Claude should:**

1. **Always use conventional commits** when making changes:
   ```bash
   feat(core): add new system architecture
   fix(events): resolve memory leak in event handlers
   docs: update API documentation for v0.5.0
   test(websocket): add integration tests for multiplayer
   ```

2. **Run quality checks before committing:**
   ```bash
   bun test && bun run typecheck && bun run check
   ```

3. **Use the interactive commit tool** for complex changes:
   ```bash
   bun run commit
   ```

4. **Check release readiness** by reviewing:
   - All tests passing
   - TypeScript compilation clean
   - No linting errors
   - Performance benchmarks stable
   - Documentation updated

5. **Help create release PRs** by ensuring:
   - CHANGELOG.md is accurate
   - Breaking changes are documented
   - Migration guides provided (if needed)
   - Version numbers are consistent

6. **Never manually edit version numbers** - let Release Please handle this
7. **Always test builds** with `bun run build:clean` before releases
8. **Update examples** when APIs change
9. **Verify security** with dependency audits

**Release Troubleshooting:**
- If Release Please doesn't create PR: check conventional commit format
- If builds fail: verify TypeScript configuration and dependencies
- If tests fail: ensure all changes include proper test coverage
- If security scans fail: review and update vulnerable dependencies

## Notes

- This is a game engine, not a web application
- Focus on performance and type safety
- All APIs should be game-developer friendly
- Maintain comprehensive test coverage
- Document performance characteristics
- **Always use conventional commits for proper release automation**
