# 🎮 ECS Game Engine

<div align="center">

**A high-performance Entity Component System (ECS) game engine built with TypeScript and Bun**

[![CI](https://github.com/danjdewhurst/ecs-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/danjdewhurst/ecs-ts/actions/workflows/ci.yml)
[![Release](https://github.com/danjdewhurst/ecs-ts/actions/workflows/release-please.yml/badge.svg)](https://github.com/danjdewhurst/ecs-ts/actions/workflows/release-please.yml)
[![npm version](https://img.shields.io/npm/v/@danjdewhurst/ecs-ts.svg)](https://www.npmjs.com/package/@danjdewhurst/ecs-ts)
[![npm downloads](https://img.shields.io/npm/dm/@danjdewhurst/ecs-ts.svg)](https://www.npmjs.com/package/@danjdewhurst/ecs-ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## ✨ Features

🚀 **High Performance**
- Archetype-based component storage for optimal query performance
- Entity ID recycling for efficient memory management
- O(1) component operations with optimized data structures

🎯 **Type-Safe Architecture**
- Full TypeScript support with generics
- Compile-time type checking for components and systems
- IDE-friendly with excellent IntelliSense support

⚡ **Modern Runtime**
- Built for Bun's native TypeScript execution
- Zero-config development with hot reloading
- Fast startup times and excellent debugging

🧩 **Flexible System Design**
- Dependency-aware system scheduling
- Priority-based execution ordering
- Event-driven architecture with decoupled communication
- Pluggable architecture for extensibility

🔌 **Plugin Architecture**
- Dynamic plugin loading with dependency resolution
- Network and storage plugin interfaces
- Error isolation and graceful failure handling
- Plugin metadata and introspection capabilities

⚡ **Performance Optimization**
- Dirty component tracking for selective updates
- Object pooling for memory efficiency
- Performance statistics and monitoring
- Cache-friendly data structures

🌐 **Multiplayer Ready**
- High-performance WebSocket server with Bun
- Real-time client-server communication
- Type-safe network protocol
- Built-in authentication and session management

## 📜 Philosophy

This engine is built on a foundation of core principles that prioritize **purity, performance, and developer experience**. Our approach emphasizes:

- **Data-driven design** with pure components and system-driven behavior
- **Performance optimization** through cache-friendly memory layouts and archetype-based storage
- **Developer ergonomics** with simple, focused APIs that avoid boilerplate
- **Scalability and parallelism** designed for high-performance game development

For the complete philosophy and design principles that guide this project, see [PHILOSOPHY.md](PHILOSOPHY.md).

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.1.0 or higher

### Installation

```bash
# Install from npm
bun add @danjdewhurst/ecs-ts

# Or using npm
npm install @danjdewhurst/ecs-ts

# Or using yarn
yarn add @danjdewhurst/ecs-ts

# Or using pnpm
pnpm add @danjdewhurst/ecs-ts
```

### Run Examples (Development)

```bash
# Clone the repository to run examples
git clone git@github.com:danjdewhurst/ecs-ts.git
cd ecs-ts

# Install dependencies
bun install

# Run the basic example
bun examples/basic-example.ts

# Run the event system example
bun examples/event-system-example.ts

# Run the multiplayer WebSocket server example
bun examples/websocket-example.ts

# Run the plugin system example
bun examples/plugin-system-example.ts

# Run the performance optimization example
bun examples/performance-optimization-example.ts
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

interface VelocityComponent extends Component {
    readonly type: 'velocity';
    dx: number;
    dy: number;
}

// Create a system
class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';

    update(world: World, deltaTime: number): void {
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

// Use the engine
const world = new World();
world.addSystem(new MovementSystem());

const player = world.createEntity();
world.addComponent(player, { type: 'position', x: 0, y: 0 } as PositionComponent);
world.addComponent(player, { type: 'velocity', dx: 1, dy: 0.5 } as VelocityComponent);

// Game loop
const deltaTime = 1/60; // 60 FPS
world.update(deltaTime);
```

## 📚 Documentation

### Core Concepts

#### 🏗️ **World**
The central container that manages all entities, components, and systems.

```typescript
const world = new World();
const entity = world.createEntity();
```

#### 🎯 **Components**
Data containers that define entity properties.

```typescript
interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}
```

#### ⚙️ **Systems**
Logic processors that operate on entities with specific components.

```typescript
class HealthRegenSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'HealthRegenSystem';

    update(world: World, deltaTime: number): void {
        // Process entities with health components
    }
}
```

#### 🔍 **Queries**
Efficient ways to find entities with specific component combinations.

```typescript
// Single component query
const healthQuery = world.query<HealthComponent>('health');

// Multi-component query
const movingEntities = world.queryMultiple(['position', 'velocity']);
```

#### 📡 **Event System**
Decoupled communication between systems using events.

```typescript
// Subscribe to events
world.subscribeToEvent('player-death', (event) => {
    console.log(`Player ${event.data.playerId} died!`);
});

// Emit events from systems
world.emitEvent({
    type: 'player-death',
    timestamp: Date.now(),
    data: { playerId: entity }
});

// Components can queue events
const eventComponent = new EventComponent();
eventComponent.queueEvent('victory', { score: 1000 });
world.addComponent(entity, eventComponent);
```

#### 🌐 **WebSocket Server**
Create multiplayer games with real-time networking.

```typescript
import { GameServer } from '@danjdewhurst/ecs-ts/websocket';

// Create multiplayer server
const server = new GameServer(world, {
    port: 3000,
    maxClients: 100,
    heartbeatInterval: 30000
});

// Handle client events
world.subscribeToEvent('client_authenticated', (event) => {
    const { clientId, entityId } = event.data;

    // Create player entity for new client
    const playerComponent = createPlayerComponent(clientId, 'Player');
    const positionComponent = createPositionComponent(0, 0);

    world.addComponent(entityId, playerComponent);
    world.addComponent(entityId, positionComponent);
});

// Start server
await server.start();
console.log('🎮 Multiplayer server running on ws://localhost:3000/ws');
```

#### 🔌 **Plugin System**
Extend the engine with custom functionality through plugins.

```typescript
import { PluginManager, Plugin, World } from '@danjdewhurst/ecs-ts/plugins';

// Define a custom plugin
class MyGamePlugin implements Plugin {
    readonly name = 'MyGamePlugin';
    readonly version = '1.0.0';
    readonly dependencies: string[] = [];

    async initialize(world: World): Promise<void> {
        console.log('MyGamePlugin initialized!');
        // Setup custom systems, components, etc.
    }

    async shutdown(): Promise<void> {
        console.log('MyGamePlugin shutdown!');
        // Cleanup resources
    }
}

// Use the plugin system
const pluginManager = new PluginManager();
await pluginManager.loadPlugin(new MyGamePlugin());

// Plugin dependencies are automatically resolved
await pluginManager.initializeAll(world);
```

#### ⚡ **Performance Optimization**
Optimize your game with built-in performance tools.

```typescript
import { DirtyTracker, ObjectPool } from '@danjdewhurst/ecs-ts/performance';

// Track which entities need processing
const dirtyTracker = new DirtyTracker();
dirtyTracker.markDirty(entityId, 'position');

// Only process dirty entities in systems
class OptimizedMovementSystem extends BaseSystem {
    update(world: World, deltaTime: number): void {
        const dirtyEntities = world.dirtyTracker.getDirtyEntities('position');

        for (const entityId of dirtyEntities) {
            // Process only entities with position changes
        }

        world.dirtyTracker.clearDirty('position');
    }
}

// Reuse objects to reduce garbage collection
const bulletPool = new ObjectPool(
    () => ({ x: 0, y: 0, active: false }), // Create function
    (bullet) => { bullet.active = false; }  // Reset function
);

const bullet = bulletPool.acquire(); // Get from pool
// ... use bullet
bulletPool.release(bullet); // Return to pool
```

### Advanced Features

#### 📊 **Archetype System**
Entities are automatically organized into archetypes based on their component composition, enabling ultra-fast queries.

#### 🔗 **System Dependencies**
Systems can declare dependencies on other systems for ordered execution.

```typescript
class RenderSystem extends BaseSystem {
    readonly priority = 10;
    readonly name = 'RenderSystem';
    readonly dependencies = ['MovementSystem', 'AnimationSystem'];

    update(world: World, deltaTime: number): void {
        // Rendering logic runs after movement and animation
    }
}
```

## 🧪 Testing

The engine includes a comprehensive test suite covering all core functionality.

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Type checking
bun run typecheck

# Build the project
bun run build
```

### Test Coverage

- ✅ **132 Unit Tests** - 100% core functionality coverage
- ✅ **EntityManager** - 5 test cases covering ID recycling and lifecycle
- ✅ **ComponentStorage** - 7 test cases covering storage operations
- ✅ **World Integration** - 10 test cases covering full ECS workflows
- ✅ **Event System** - 19 test cases covering event bus, components, and integration
- ✅ **WebSocket System** - 18 test cases covering networking and multiplayer
- ✅ **Plugin System** - 38 test cases covering plugin management and architecture
- ✅ **Performance System** - 39 test cases covering dirty tracking and object pooling

## 📈 Performance

The engine is designed for high performance with several optimizations:

| Operation | Complexity | Description |
|-----------|------------|-------------|
| Entity Creation | O(1) | Constant time with ID recycling |
| Component Add/Remove | O(1) | Direct hash map operations |
| Single Component Query | O(1) | Direct archetype lookup |
| Multi-Component Query | O(k) | Where k is number of matching entities |
| System Execution | O(n×s) | Where n is entities and s is systems |

## 🗺️ Roadmap

### ✅ Phase 1: Core ECS (Complete)
- [x] Entity Management System
- [x] Component Storage Architecture
- [x] Archetype Management
- [x] World Container

### ✅ Phase 2: System Architecture (Complete)
- [x] System Base Classes
- [x] System Scheduler
- [x] Query System
- [x] Dependency Resolution

### ✅ Phase 3: Event System (Complete)
- [x] Event Bus Implementation
- [x] Event-Component Integration
- [x] System Event Handling
- [x] Error Resilience

### ✅ Phase 4: WebSocket Integration (Complete)
- [x] Bun WebSocket Server
- [x] Client Connection Management
- [x] Message Protocol
- [x] Real-time Multiplayer Support

### ✅ Phase 5: Plugin Architecture (Complete)
- [x] Plugin Manager
- [x] Core Plugin Interfaces
- [x] Example Plugins
- [x] Dependency Resolution
- [x] Error Isolation

### ✅ Phase 6: Performance Optimization (Complete)
- [x] Dirty Component Tracking
- [x] Object Pooling
- [x] Memory Optimization
- [x] Performance Statistics
- [x] Cache-Friendly Design

All development phases are complete and the engine is production-ready.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone the repository
git clone git@github.com:danjdewhurst/ecs-ts.git
cd ecs-ts

# Install dependencies
bun install

# Run tests in watch mode
bun test --watch

# Run the examples
bun examples/basic-example.ts
bun examples/event-system-example.ts
bun examples/websocket-example.ts
bun examples/plugin-system-example.ts
bun examples/performance-optimization-example.ts
```

### Pull Request Process

1. 🍴 Fork the repository
2. 🌟 Create a feature branch: `git checkout -b feature/amazing-feature`
3. 📝 Make your changes with tests
4. ✅ Ensure all tests pass: `bun test`
5. 📤 Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- Built with [Bun](https://bun.sh/) for native TypeScript performance
- Inspired by modern ECS architectures like [Bevy](https://bevyengine.org/) and [Unity DOTS](https://unity.com/dots)
- TypeScript patterns influenced by [Type Challenges](https://github.com/type-challenges/type-challenges)

---

<div align="center">

**Made with ❤️ by [danjdewhurst](https://github.com/danjdewhurst)**

[⭐ Star this repo](https://github.com/danjdewhurst/ecs-ts) • [🐛 Report Bug](https://github.com/danjdewhurst/ecs-ts/issues) • [💡 Request Feature](https://github.com/danjdewhurst/ecs-ts/issues)

</div>
