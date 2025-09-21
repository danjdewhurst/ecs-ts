# 🎮 ECS Game Engine

<div align="center">
  <h3>High-Performance Entity Component System for TypeScript</h3>
  <p>
    <a href="https://github.com/danjdewhurst/ecs-ts/actions/workflows/ci.yml"><img src="https://github.com/danjdewhurst/ecs-ts/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
    <a href="https://github.com/danjdewhurst/ecs-ts/actions/workflows/release-please.yml"><img src="https://github.com/danjdewhurst/ecs-ts/actions/workflows/release-please.yml/badge.svg" alt="Release" /></a>
    <a href="https://www.npmjs.com/package/@danjdewhurst/ecs-ts"><img src="https://img.shields.io/npm/v/@danjdewhurst/ecs-ts.svg" alt="npm version" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Runtime-Bun-000?logo=bun&logoColor=white" alt="Bun" /></a>
  </p>
  <p>
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-features">Features</a> •
    <a href="#-documentation">Documentation</a> •
    <a href="#-examples">Examples</a> •
    <a href="PHILOSOPHY.md">Philosophy</a>
  </p>
</div>

## ✨ Features

<table>
<tr>
<td width="50%">

### 🚀 Core Performance
- **Archetype-based storage** for O(1) queries
- **Entity ID recycling** with zero allocations
- **Cache-friendly** data structures
- **Dirty tracking** for selective updates

### 🎯 Developer Experience
- **Full TypeScript** with strict typing
- **Zero runtime dependencies**
- **Hot reloading** with Bun
- **Comprehensive test coverage**

</td>
<td width="50%">

### 🧩 Architecture
- **System dependencies** & scheduling
- **Event-driven** communication
- **Plugin system** with hot loading
- **Object pooling** for memory efficiency

### 🌐 Multiplayer
- **WebSocket server** built-in
- **Type-safe** network protocol
- **Session management**
- **Real-time synchronization**

</td>
</tr>
</table>

## 📜 Core Principles

> **Entities = IDs • Components = Data • Systems = Logic**

Built on proven ECS patterns for maximum performance and maintainability. [Learn more →](PHILOSOPHY.md)

## 🚀 Quick Start

### Installation

```bash
# Using Bun (recommended)
bun add @danjdewhurst/ecs-ts

# Using npm/yarn/pnpm
npm install @danjdewhurst/ecs-ts
```

**Requirements:** Bun v1.1.0+ or Node.js 18+

## 💻 Basic Usage

```typescript
import { World, BaseSystem, type Component } from '@danjdewhurst/ecs-ts';

// 1. Define components (pure data)
interface Position extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

// 2. Create systems (game logic)
class MovementSystem extends BaseSystem {
  readonly name = 'MovementSystem';
  readonly priority = 1;

  update(world: World, deltaTime: number): void {
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      const pos = world.getComponent<Position>(entityId, 'position');
      const vel = world.getComponent<Velocity>(entityId, 'velocity');

      if (pos && vel) {
        pos.x += vel.dx * deltaTime;
        pos.y += vel.dy * deltaTime;
      }
    }
  }
}

// 3. Create world and run
const world = new World();
world.addSystem(new MovementSystem());

const entity = world.createEntity();
world.addComponent(entity, { type: 'position', x: 0, y: 0 });
world.addComponent(entity, { type: 'velocity', dx: 10, dy: 5 });

world.update(1/60); // Update at 60 FPS
```

## 📚 Documentation

### Core Concepts

| Concept | Description | Example |
|---------|-------------|----------|
| **World** | Container for all ECS data | `const world = new World()` |
| **Entity** | Unique ID representing a game object | `world.createEntity()` |
| **Component** | Pure data attached to entities | `{ type: 'health', hp: 100 }` |
| **System** | Logic that processes entities | `class MovementSystem extends BaseSystem` |
| **Query** | Find entities by components | `world.query('position', 'velocity')` |

### Advanced Features

<details>
<summary><b>📡 Event System</b> - Decoupled communication</summary>

```typescript
// Subscribe to events
world.subscribeToEvent('player-death', (event) => {
  console.log(`Player ${event.data.playerId} died`);
});

// Emit events
world.emitEvent({
  type: 'player-death',
  timestamp: Date.now(),
  data: { playerId: entity }
});
```
</details>

<details>
<summary><b>🌐 Multiplayer</b> - WebSocket server built-in</summary>

```typescript
import { GameServer } from '@danjdewhurst/ecs-ts/websocket';

const server = new GameServer(world, {
  port: 3000,
  maxClients: 100
});

await server.start();
```
</details>

<details>
<summary><b>🔌 Plugin System</b> - Extend with custom functionality</summary>

```typescript
class MyPlugin implements Plugin {
  readonly name = 'MyPlugin';
  readonly version = '1.0.0';

  async initialize(world: World): Promise<void> {
    // Setup systems, components, etc.
  }
}

const pluginManager = new PluginManager();
await pluginManager.loadPlugin(new MyPlugin());
await pluginManager.initializeAll(world);
```
</details>

<details>
<summary><b>⚡ Performance Tools</b> - Optimization utilities</summary>

```typescript
// Object pooling
const bulletPool = new ObjectPool(
  () => ({ x: 0, y: 0, active: false }),
  (bullet) => { bullet.active = false; }
);

// Dirty tracking for selective updates
world.dirtyTracker.markDirty(entityId, 'position');
```
</details>


## 🧩 Examples

```bash
# Clone and run examples
git clone https://github.com/danjdewhurst/ecs-ts.git
cd ecs-ts && bun install

bun examples/basic-example.ts              # Core ECS
bun examples/event-system-example.ts       # Events
bun examples/websocket-example.ts          # Multiplayer
bun examples/plugin-system-example.ts      # Plugins
bun examples/performance-optimization.ts   # Optimization
```

## 🧩 Development

```bash
# Install dependencies
bun install

# Development commands
bun test           # Run tests (100% coverage)
bun run typecheck  # Type checking
bun run check      # Lint & format
bun run build      # Build for production

# Commit with conventional commits
bun run commit     # Interactive commit helper
```

### Test Coverage

- ✅ 14 test suites with comprehensive coverage
- ✅ Core ECS, Events, WebSocket, Plugins, Performance
- ✅ Unit and integration tests
- ✅ 100% critical path coverage

## 📈 Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Entity Creation | O(1) | ID recycling |
| Component Add/Remove | O(1) | Hash map |
| Single Query | O(1) | Archetype lookup |
| Multi Query | O(k) | k = matching entities |
| System Update | O(n) | n = active entities |

## 🤝 Contributing

Contributions welcome! Please follow [conventional commits](https://www.conventionalcommits.org/) and ensure all tests pass.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

[MIT](LICENSE) © 2024 [danjdewhurst](https://github.com/danjdewhurst)

---

<div align="center">
  <p>
    <a href="https://github.com/danjdewhurst/ecs-ts">GitHub</a> •
    <a href="https://www.npmjs.com/package/@danjdewhurst/ecs-ts">npm</a> •
    <a href="https://github.com/danjdewhurst/ecs-ts/issues">Issues</a> •
    <a href="PHILOSOPHY.md">Philosophy</a>
  </p>
</div>
