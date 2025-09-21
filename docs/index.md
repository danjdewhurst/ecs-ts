# 🎮 ECS Game Engine Documentation

Welcome to the comprehensive documentation for the high-performance Entity Component System (ECS) game engine built with TypeScript and Bun.

## 📚 Table of Contents

### 🚀 Getting Started
- [Quick Start Guide](#quick-start-guide)
- [Installation](#installation)
- [Basic Usage](#basic-usage)

### 🏗️ Core Architecture
- [Entity Component System Overview](#entity-component-system-overview)
- [World Management](#world-management)
- [Entities](#entities)
- [Components](#components)
- [Systems](#systems)
- [Archetype System](#archetype-system)

### 🔍 Advanced Features
- [Query System](#query-system)
- [Event System](#event-system)
- [System Dependencies](#system-dependencies)
- [Performance Optimization](#performance-optimization)

### 🌐 Multiplayer & Networking
- [WebSocket Server](#websocket-server)
- [Client-Server Communication](#client-server-communication)
- [Real-time Multiplayer](#real-time-multiplayer)

### 🔌 Plugin Architecture
- [Plugin System Overview](#plugin-system-overview)
- [Creating Custom Plugins](#creating-custom-plugins)
- [Plugin Dependencies](#plugin-dependencies)

### 🛠️ CLI Scaffolding
- [CLI Scaffolding Overview](#cli-scaffolding-overview)
- [Component Generation](#component-generation)
- [System Generation](#system-generation)
- [Example & Template Generation](#example-template-generation)

### ⚡ Performance
- [Dirty Component Tracking](#dirty-component-tracking)
- [Object Pooling](#object-pooling)
- [Memory Optimization](#memory-optimization)
- [Performance Benchmarks](#performance-benchmarks)

### 🧪 Testing & Development
- [Testing Guide](#testing-guide)
- [Development Workflow](#development-workflow)
- [Contributing](#contributing)

---

## Quick Start Guide

### Installation

```bash
# Install from npm
bun add @danjdewhurst/ecs-ts

# Or clone for development
git clone git@github.com:danjdewhurst/ecs-ts.git
cd ecs-ts
bun install
```

### Basic Usage

```typescript
import { World, BaseSystem, type Component } from '@danjdewhurst/ecs-ts/game-engine';

// Define components
interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

// Create systems
class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';

    update(world: World, deltaTime: number): void {
        const entities = this.queryEntities(world, 'position', 'velocity');
        // Process entities...
    }
}

// Initialize the world
const world = new World();
world.addSystem(new MovementSystem());

// Create entities
const player = world.createEntity();
world.addComponent(player, { type: 'position', x: 0, y: 0 } as PositionComponent);

// Game loop
world.update(1/60); // 60 FPS
```

## Entity Component System Overview

The ECS architecture separates data (Components) from behavior (Systems) while using simple IDs for Entities. This design provides excellent performance, modularity, and scalability.

### Core Principles

1. **Entities**: Unique identifiers (numbers) that represent game objects
2. **Components**: Pure data containers with no logic
3. **Systems**: Logic processors that operate on entities with specific components
4. **World**: Central container managing all entities, components, and systems

### Performance Benefits

- **Archetype-based storage**: Entities with identical component sets are stored together
- **Cache-friendly memory layout**: Components of the same type stored contiguously
- **O(1) operations**: Direct hash map access for most operations
- **Efficient queries**: Fast entity lookups based on component composition

## World Management

The `World` class is the central coordinator of your ECS:

```typescript
const world = new World();

// Entity lifecycle
const entity = world.createEntity();
world.removeEntity(entity);

// Component management
world.addComponent(entity, component);
world.removeComponent(entity, 'componentType');
world.getComponent(entity, 'componentType');

// System management
world.addSystem(new MySystem());
world.removeSystem('MySystem');

// Update loop
world.update(deltaTime);
```

## Entities

Entities are lightweight identifiers (numbers) with automatic ID recycling for memory efficiency:

```typescript
// Create entities
const player = world.createEntity();
const enemy = world.createEntity();

// Entities are just numbers
console.log(typeof player); // "number"

// Efficient ID recycling
world.removeEntity(player);
const newEntity = world.createEntity(); // May reuse player's ID
```

## Components

Components are pure data containers implementing the `Component` interface:

```typescript
interface Component {
    readonly type: string;
}

// Example components
interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

interface TransformComponent extends Component {
    readonly type: 'transform';
    x: number;
    y: number;
    rotation: number;
    scale: number;
}

// Component usage
world.addComponent(entity, {
    type: 'health',
    hp: 100,
    maxHp: 100
} as HealthComponent);
```

## Systems

Systems contain all game logic and process entities with specific component combinations:

```typescript
class HealthRegenerationSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'HealthRegenerationSystem';
    readonly dependencies = ['DamageSystem']; // Optional dependencies

    update(world: World, deltaTime: number): void {
        // Query entities with health components
        const entities = this.queryEntities(world, 'health');

        for (const entityId of entities) {
            const health = world.getComponent<HealthComponent>(entityId, 'health');

            if (health && health.hp < health.maxHp) {
                health.hp = Math.min(health.maxHp, health.hp + 10 * deltaTime);
            }
        }
    }
}
```

## Archetype System

Entities are automatically organized into archetypes based on their component composition for ultra-fast queries:

```typescript
// Entities with [Position, Velocity] components
// are automatically grouped into the same archetype

// Fast archetype-based queries
const movingEntities = world.queryMultiple(['position', 'velocity']);
const renderableEntities = world.queryMultiple(['position', 'sprite']);
```

## Query System

Efficient entity queries with multiple patterns:

```typescript
// Single component queries
const allPositions = world.query<PositionComponent>('position');

// Multi-component queries
const movingEntities = world.queryMultiple(['position', 'velocity']);

// System helper methods
class MySystem extends BaseSystem {
    update(world: World, deltaTime: number): void {
        // Query entities with specific components
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            // Process each entity
        }
    }
}
```

## Event System

Decoupled communication between systems using events:

```typescript
// Subscribe to events
world.subscribeToEvent('player-death', (event) => {
    console.log(`Player ${event.data.playerId} died!`);
});

// Emit events from systems
world.emitEvent({
    type: 'player-death',
    timestamp: Date.now(),
    data: { playerId: entity, cause: 'enemy' }
});

// Component-based events
const eventComponent = new EventComponent();
eventComponent.queueEvent('level-complete', { score: 1000 });
world.addComponent(entity, eventComponent);
```

## System Dependencies

Systems can declare dependencies for ordered execution:

```typescript
class RenderSystem extends BaseSystem {
    readonly priority = 10;
    readonly name = 'RenderSystem';
    readonly dependencies = ['MovementSystem', 'AnimationSystem'];

    update(world: World, deltaTime: number): void {
        // Runs after MovementSystem and AnimationSystem
    }
}
```

## WebSocket Server

Create multiplayer games with built-in WebSocket support:

```typescript
import { GameServer } from '@danjdewhurst/ecs-ts/websocket';

const server = new GameServer(world, {
    port: 3000,
    maxClients: 100,
    heartbeatInterval: 30000
});

// Handle client connections
world.subscribeToEvent('client_authenticated', (event) => {
    const { clientId, entityId } = event.data;

    // Create player entity
    const playerComponent = createPlayerComponent(clientId, 'Player');
    world.addComponent(entityId, playerComponent);
});

await server.start();
```

## Plugin System Overview

Extend the engine with custom functionality:

```typescript
import { PluginManager, Plugin, World } from '@danjdewhurst/ecs-ts/plugins';

class MyGamePlugin implements Plugin {
    readonly name = 'MyGamePlugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    async initialize(world: World): Promise<void> {
        // Setup custom systems, components
    }

    async shutdown(): Promise<void> {
        // Cleanup resources
    }
}

// Use plugins
const pluginManager = new PluginManager();
await pluginManager.loadPlugin(new MyGamePlugin());
await pluginManager.initializeAll(world);
```

## CLI Scaffolding Overview

The ECS Game Engine includes a powerful interactive CLI scaffolding tool for rapid development. Generate type-safe, tested code that follows ECS patterns and automatically integrates with your project structure.

### Quick Start

```bash
# Launch interactive scaffolding wizard
bun run scaffold

# OR use direct commands with aliases
bun run scaffold component    # or: bun run scaffold c
bun run scaffold system       # or: bun run scaffold s
bun run scaffold --help       # Show help and all options
```

### Scaffolding Features

- **Interactive prompts** with validation and smart defaults
- **Type-safe code generation** following ECS patterns
- **Automatic test generation** with comprehensive coverage
- **Index file updates** maintaining clean project structure
- **Project analysis** to prevent naming conflicts
- **Template system** for consistent code patterns

## Component Generation

Generate ECS components with custom properties and factory functions:

```bash
bun run scaffold
# Select: Component - Generate ECS component with interface and factory
```

**Features:**
- Custom property definitions with TypeScript types
- Built-in support for common types (Vector2, Vector3, arrays)
- Optional properties with default values
- Factory function generation
- Comprehensive test generation
- Automatic index file updates

**Generated Structure:**
```typescript
// Generated component interface
export interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

// Generated factory function
export function createHealthComponent(hp: number, maxHp: number): HealthComponent {
    return {
        type: 'health',
        hp,
        maxHp,
    };
}

// Generated tests
describe('HealthComponent', () => {
    test('should create HealthComponent with correct type', () => {
        const component = createHealthComponent(100, 100);
        expect(component.type).toBe('health');
        expect(component.hp).toBe(100);
        expect(component.maxHp).toBe(100);
    });
});
```

## System Generation

Generate ECS systems with dependencies, component queries, and lifecycle methods:

```bash
bun run scaffold
# Select: System - Generate ECS system extending BaseSystem
```

**Features:**
- System priority configuration
- Dependency management
- Component query patterns (simple iteration or callback-based)
- Import generation for referenced components
- Test generation with entity setup
- Automatic index file updates

**Generated Structure:**
```typescript
// Generated system class
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

            // System logic here
        }
    }
}
```

## Example & Template Generation

Generate complete examples or game templates:

```bash
bun run scaffold
# Select: Example - Generate complete usage example
# OR
# Select: Game Template - Generate complete game setup
```

**Example Generation:**
- Demonstrates specific ECS functionality
- Complete runnable examples
- Documentation and comments
- Best practice patterns

**Game Template Generation:**
- Full game setup with components and systems
- Integrated examples showing system interactions
- Plugin architecture demonstrations
- Performance optimization examples

**Plugin Generation:**
- Plugin interface implementation
- Lifecycle management
- Integration patterns
- Dependency handling

## Performance Optimization

### Dirty Component Tracking

Process only changed entities:

```typescript
import { DirtyTracker } from '@danjdewhurst/ecs-ts/performance';

class OptimizedSystem extends BaseSystem {
    update(world: World, deltaTime: number): void {
        // Only process entities with position changes
        const dirtyEntities = world.dirtyTracker.getDirtyEntities('position');

        for (const entityId of dirtyEntities) {
            // Process only changed entities
        }

        world.dirtyTracker.clearDirty('position');
    }
}
```

### Object Pooling

Reduce garbage collection with object reuse:

```typescript
import { ObjectPool } from '@danjdewhurst/ecs-ts/performance';

const bulletPool = new ObjectPool(
    () => ({ x: 0, y: 0, active: false }), // Create function
    (bullet) => { bullet.active = false; }  // Reset function
);

// Use pooled objects
const bullet = bulletPool.acquire();
// ... use bullet
bulletPool.release(bullet);
```

## Testing Guide

Run the comprehensive test suite:

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Watch mode for development
bun test --watch

# Type checking
bun run typecheck

# Build verification
bun run build
```

## Development Workflow

1. **Setup Development Environment:**
```bash
git clone git@github.com:danjdewhurst/ecs-ts.git
cd ecs-ts
bun install
```

2. **Run Examples:**
```bash
bun examples/basic-example.ts
bun examples/websocket-example.ts
bun examples/plugin-system-example.ts
```

3. **Development Loop:**
```bash
bun test --watch  # Run tests in watch mode
bun run typecheck # Verify TypeScript
bun run check     # Lint and format
```

## Performance Benchmarks

| Operation | Complexity | Performance |
|-----------|------------|-------------|
| Entity Creation | O(1) | ~1M entities/sec |
| Component Add/Remove | O(1) | ~2M operations/sec |
| Single Component Query | O(1) | ~10M queries/sec |
| Multi-Component Query | O(k) | ~1M entities/sec |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed contribution guidelines.

### Quick Contributing Steps:
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure all tests pass: `bun test`
5. Submit a pull request

---

**🌟 Ready to build amazing games? Start with the [Quick Start Guide](#quick-start-guide)!**