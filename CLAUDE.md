---
description: Development guidelines for the ECS Game Engine project
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json, *.md"
alwaysApply: true
---

# ECS Game Engine Development Guidelines

## Runtime & Tools

**Use Bun for all operations:**
- `bun <file>` for running TypeScript files directly
- `bun test` for running the test suite
- `bun run <script>` for package.json scripts
- `bun install` for dependency management
- `bun build` for production builds

**Key Commands:**
- `bun test` - Run all tests with coverage
- `bun run typecheck` - TypeScript compilation check
- `bun run dev` - Development mode with watch
- `bun examples/basic-example.ts` - Run the example

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
├── core/events/        # Event system (Phase 3)
├── core/websocket/     # WebSocket integration (Phase 4)
├── plugins/           # Plugin architecture (Phase 5)
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

**All new code must include tests:**
- Unit tests for individual classes
- Integration tests for system interactions
- Use descriptive test names explaining behavior
- Follow AAA pattern: Arrange, Act, Assert

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

## WebSocket Integration (Future)

When implementing Phase 4:
- Use `Bun.serve()` with built-in WebSocket support
- No external WebSocket libraries needed
- Leverage Bun's high-performance networking

```typescript
// Future WebSocket server pattern
Bun.serve({
  websocket: {
    open: (ws) => { /* handle connection */ },
    message: (ws, message) => { /* handle message */ },
    close: (ws) => { /* handle disconnect */ }
  }
});
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
   ```

3. **Commit Changes:**
   ```bash
   git add .
   git commit -m "feat(core): add new ECS feature"
   ```

4. **Run Example:**
   ```bash
   bun examples/basic-example.ts
   ```

## Implementation Phases

Follow the [PLAN.md](PLAN.md) progression:
- ✅ **Phase 1**: Core ECS Implementation (Complete)
- ✅ **Phase 2**: System Architecture (Complete)  
- 🔄 **Phase 3**: Event System Implementation
- 🔄 **Phase 4**: WebSocket Integration with Bun
- 🔄 **Phase 5**: Plugin Architecture
- 🔄 **Phase 6**: Performance Optimisation

## Notes

- This is a game engine, not a web application
- Focus on performance and type safety
- All APIs should be game-developer friendly
- Maintain comprehensive test coverage
- Document performance characteristics
