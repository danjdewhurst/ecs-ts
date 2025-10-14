# 🛠️ CLI Scaffolding Documentation

The ECS Game Engine CLI scaffolding tool provides an interactive way to generate type-safe, tested code that follows ECS patterns and integrates seamlessly with your project structure.

## Overview

The CLI tool offers five main scaffolding options:
- **Components**: Generate ECS components with custom properties and factory functions
- **Systems**: Generate systems with dependencies, queries, and lifecycle methods
- **Examples**: Create complete usage examples demonstrating functionality
- **Game Templates**: Generate full game setups with components and systems
- **Plugins**: Create plugins following the plugin architecture

## Getting Started

### Installation & Setup

The CLI tool is included with the ECS Game Engine. No additional installation required.

```bash
# Launch the interactive scaffolding wizard
bun run scaffold

# Alternative: Direct execution
bun src/cli/index.ts
```

### Usage Modes

The CLI supports both **interactive** and **non-interactive** modes:

**Interactive Mode (Default):**
```bash
bun run scaffold                    # Launch interactive wizard
bun run scaffold --interactive      # Force interactive mode
bun run scaffold -i                 # Short flag for interactive
```

**Non-Interactive Mode with Commands:**
```bash
bun run scaffold component          # Generate component interactively
bun run scaffold c                  # Generate component (alias)
bun run scaffold system             # Generate system interactively
bun run scaffold s                  # Generate system (alias)
bun run scaffold example            # Generate example
bun run scaffold e                  # Generate example (alias)
bun run scaffold game               # Generate game template
bun run scaffold g                  # Generate game template (alias)
bun run scaffold plugin             # Generate plugin
bun run scaffold p                  # Generate plugin (alias)
```

**Help & Information:**
```bash
bun run scaffold --help             # Show help message
bun run scaffold -h                 # Short help flag
bun run scaffold --version          # Show version information
bun run scaffold -v                 # Short version flag
```

### Command Aliases

For faster development, the CLI supports short aliases:

| Full Command | Aliases | Description |
|-------------|---------|-------------|
| `component` | `c`, `comp` | Generate ECS component |
| `system` | `s`, `sys` | Generate ECS system |
| `example` | `e`, `ex` | Generate usage example |
| `game` | `g`, `game-template` | Generate game template |
| `plugin` | `p`, `plug` | Generate plugin |

### Interactive Interface

The tool provides an intuitive interactive interface with:
- ✅ **Input validation** to prevent naming conflicts
- 🎯 **Smart defaults** based on project analysis
- 📝 **Interactive prompts** for customization
- 🔍 **Project structure analysis** for intelligent suggestions

## Component Scaffolding

Generate ECS components with custom properties and factory functions.

### Usage

```bash
bun run scaffold
# Select: "Component - Generate ECS component with interface and factory"
```

### Features

- **Custom Properties**: Define component properties with TypeScript types
- **Built-in Types**: Support for common types (Vector2, Vector3, arrays, primitives)
- **Optional Properties**: Define optional properties with defaults
- **Factory Functions**: Auto-generate creation functions
- **Test Generation**: Comprehensive test coverage
- **Index Updates**: Automatic export management

### Example Workflow

1. **Component Name**: Enter component name (e.g., "Health")
2. **Add Properties**: Choose to add custom properties
3. **Property Definition**: For each property:
   - Property name (e.g., "hp")
   - Type selection (number, string, boolean, Vector2, etc.)
   - Optional/required flag
   - Default value (if required)
4. **Test Generation**: Choose to generate tests (recommended)

### Generated Files

```typescript
// HealthComponent.ts - Generated component
export interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
    isAlive?: boolean;
}

export function createHealthComponent(
    hp: number,
    maxHp: number,
    isAlive?: boolean
): HealthComponent {
    return {
        type: 'health',
        hp,
        maxHp,
        ...(isAlive !== undefined && { isAlive }),
    };
}
```

```typescript
// HealthComponent.test.ts - Generated tests
import { test, expect, describe } from 'bun:test';
import { HealthComponent, createHealthComponent } from './HealthComponent.ts';

describe('HealthComponent', () => {
    test('should create HealthComponent with correct type', () => {
        const component = createHealthComponent(100, 100);

        expect(component.type).toBe('health');
        expect(component.hp).toBe(100);
        expect(component.maxHp).toBe(100);
    });

    test('should follow Component interface', () => {
        const component = createHealthComponent(100, 100);

        expect(component).toHaveProperty('type');
        expect(typeof component.type).toBe('string');
    });
});
```

## System Scaffolding

Generate ECS systems with dependencies, component queries, and lifecycle methods.

### Usage

```bash
bun run scaffold
# Select: "System - Generate ECS system extending BaseSystem"
```

### Features

- **Priority Configuration**: Set system execution priority
- **Dependency Management**: Define system dependencies
- **Component Queries**: Choose query patterns (simple iteration or callback-based)
- **Import Generation**: Auto-generate imports for referenced components
- **Test Generation**: System tests with entity setup
- **Index Updates**: Automatic export management

### Example Workflow

1. **System Name**: Enter system name (e.g., "Movement")
2. **Priority**: Set execution priority (lower numbers run first)
3. **Dependencies**: Select dependent systems from existing systems
4. **Component Queries**: Add component queries:
   - Select components for the query
   - Choose query pattern (simple or callback-based)
5. **Test Generation**: Choose to generate tests

### Generated Files

```typescript
// MovementSystem.ts - Generated system
import { BaseSystem } from '../core/ecs/System.ts';
import type { World } from '../core/ecs/World.ts';
import type { PositionComponent, VelocityComponent } from '../components/index.ts';

export class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';
    readonly dependencies = ['InputSystem'];

    update(world: World, deltaTime: number): void {
        // Query entities with position, velocity components
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

            if (position && velocity) {
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;
            }
        }
    }
}
```

### Query Patterns

**Simple Iteration Pattern:**
```typescript
const entities = this.queryEntities(world, 'position', 'velocity');
for (const entityId of entities) {
    const position = world.getComponent<PositionComponent>(entityId, 'position');
    const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');
    // Process components
}
```

**Callback-based Pattern:**
```typescript
this.queryWithComponents<PositionComponent>(world, 'position', (entityId, position) => {
    // Process position component
});
```

## Example Scaffolding

Generate complete usage examples demonstrating specific functionality.

### Usage

```bash
bun run scaffold
# Select: "Example - Generate complete usage example"
```

### Features

- **Runnable Examples**: Complete, executable code
- **Documentation**: Inline comments and explanations
- **Best Practices**: Demonstrates proper ECS patterns
- **Integration**: Shows system and component interactions

### Example Types

- **Basic ECS**: Entity creation, component attachment, system updates
- **Event System**: Event subscription and emission patterns
- **WebSocket Multiplayer**: Real-time multiplayer setup
- **Plugin System**: Plugin creation and integration
- **Performance Optimization**: Dirty tracking and object pooling

## Game Template Scaffolding

Generate complete game setups with components, systems, and examples.

### Usage

```bash
bun run scaffold
# Select: "Game Template - Generate complete game setup"
```

### Features

- **Complete Game Structure**: Components, systems, and main game loop
- **Integrated Examples**: Working demonstrations of game mechanics
- **Plugin Integration**: Example plugin usage
- **Performance Patterns**: Optimized code patterns

### Template Types

- **2D Platformer**: Basic 2D game with physics and input
- **Top-down Shooter**: Entity-based projectile system
- **RPG System**: Stats, inventory, and progression systems
- **Multiplayer Game**: Real-time networking setup

## Plugin Scaffolding

Generate plugins following the plugin architecture.

### Usage

```bash
bun run scaffold
# Select: "Plugin - Generate plugin following plugin architecture"
```

### Features

- **Plugin Interface**: Proper Plugin interface implementation
- **Lifecycle Management**: Initialize and shutdown methods
- **Dependency Handling**: Plugin dependency management
- **Integration Patterns**: World and system integration

### Generated Structure

```typescript
export class MyGamePlugin implements Plugin {
    readonly name = 'MyGamePlugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    async initialize(world: World): Promise<void> {
        // Setup custom systems, components
        world.addSystem(new CustomSystem());

        // Subscribe to events
        world.subscribeToEvent('game-start', this.handleGameStart.bind(this));
    }

    async shutdown(): Promise<void> {
        // Cleanup resources
    }

    private handleGameStart(event: GameEvent): void {
        // Handle game start event
    }
}
```

## Advanced Features

### Project Analysis

The CLI tool analyzes your project structure to:
- **Prevent Conflicts**: Check for existing component types and system names
- **Suggest Imports**: Auto-generate imports for existing components
- **Maintain Structure**: Follow established project patterns

### Template System

The scaffolding uses a powerful template system that:
- **Renders Variables**: Inject dynamic content into templates
- **Supports Conditionals**: Include/exclude code based on options
- **Maintains Formatting**: Preserve TypeScript formatting and style

### File Operations

Automated file operations include:
- **File Creation**: Generate new files with proper structure
- **Index Updates**: Automatically update index.ts files
- **Validation**: Check file names and prevent overwrites

## Best Practices

### Component Design

- Keep components as pure data containers
- Use factory functions for component creation
- Define clear TypeScript interfaces
- Add meaningful property defaults

### System Design

- Define explicit dependencies between systems
- Use appropriate query patterns for performance
- Keep system logic focused and single-purpose
- Test system behavior with realistic entity setups

### Project Organization

- Use the scaffolding tool consistently for all new code
- Run `bun run check:fix` after scaffolding to format code
- Run `bun test` to ensure generated tests pass
- Follow conventional commit patterns for scaffolded code

## Troubleshooting

### Common Issues

**File Already Exists:**
- The tool prevents overwriting existing files
- Choose a different name or manually remove the existing file

**Invalid Names:**
- Component and system names must be valid TypeScript identifiers
- Use PascalCase for class names (e.g., "HealthComponent")

**Missing Dependencies:**
- Ensure all referenced components exist before creating systems
- Use component scaffolding first, then system scaffolding

**Build Errors:**
- Run `bun run typecheck` after scaffolding
- Check generated imports and exports
- Ensure all dependencies are properly declared

### Getting Help

- Check the generated test files for usage examples
- Review existing components and systems for patterns
- Use `bun run check:fix` to auto-format generated code
- Run `bun test` to verify all generated code works correctly

---

**🚀 Ready to scaffold? Run `bun run scaffold` to get started!**