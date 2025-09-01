# 🎮 ECS Game Engine

<div align="center">

**A high-performance Entity Component System (ECS) game engine built with TypeScript and Bun**

[![CI](https://github.com/danjdewhurst/ecs-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/danjdewhurst/ecs-ts/actions/workflows/ci.yml)
[![Release](https://github.com/danjdewhurst/ecs-ts/actions/workflows/release.yml/badge.svg)](https://github.com/danjdewhurst/ecs-ts/actions/workflows/release.yml)
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
- Pluggable architecture for extensibility

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.1.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/danjdewhurst/ecs-ts.git
cd ecs-ts

# Install dependencies
bun install

# Run the example
bun examples/basic-example.ts
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

- ✅ **22 Unit Tests** - 100% core functionality coverage
- ✅ **EntityManager** - 5 test cases covering ID recycling and lifecycle
- ✅ **ComponentStorage** - 7 test cases covering storage operations
- ✅ **World Integration** - 10 test cases covering full ECS workflows

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
- [x] System Architecture
- [x] Query System

### 🔄 Phase 2: Event System (Next)
- [ ] Event Bus Implementation
- [ ] Event-Component Integration
- [ ] System Event Handling

### 🔄 Phase 3: WebSocket Integration
- [ ] Bun WebSocket Server
- [ ] Client Connection Management
- [ ] Message Protocol

### 🔄 Phase 4: Plugin Architecture
- [ ] Plugin Manager
- [ ] Core Plugin Interfaces
- [ ] Example Plugins

See the full [Implementation Plan](PLAN.md) for detailed progress tracking.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/yourusername/ecs-ts.git
cd ecs-ts

# Install dependencies
bun install

# Run tests in watch mode
bun test --watch

# Run the example
bun examples/basic-example.ts
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
