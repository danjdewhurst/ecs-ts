# Quick Start Guide

Build your first ECS application in just 5 minutes! This guide walks you through creating a simple entity that moves around the screen.

## Prerequisites

- ECS engine installed ([Installation Guide](./installation.md))
- Basic TypeScript knowledge

## Step 1: Create Your First Components

Components are pure data containers that define what an entity has.

**`src/components.ts`**

```typescript
import type { Component } from '@danjdewhurst/ecs-ts';

// Position component - where something is
export interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

// Velocity component - how fast something moves
export interface VelocityComponent extends Component {
  readonly type: 'velocity';
  dx: number;  // pixels per second
  dy: number;
}
```

## Step 2: Create Your First System

Systems contain the game logic and operate on entities with specific components.

**`src/movement-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type { PositionComponent, VelocityComponent } from './components';

export class MovementSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'MovementSystem';

  update(world: World, deltaTime: number): void {
    // Find all entities that have both position and velocity
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      // Get the components for this entity
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (position && velocity) {
        // Update position based on velocity and time
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;

        console.log(`Entity ${entityId} is at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
      }
    }
  }
}
```

## Step 3: Put It All Together

Create the main application that ties everything together.

**`src/index.ts`**

```typescript
import { World } from '@danjdewhurst/ecs-ts';
import { MovementSystem } from './movement-system';
import type { PositionComponent, VelocityComponent } from './components';

// Create the world - this manages all entities, components, and systems
const world = new World();

// Add the movement system
world.addSystem(new MovementSystem());

// Create a player entity
const player = world.createEntity();

// Give the player a starting position
world.addComponent(player, {
  type: 'position',
  x: 0,
  y: 0
} as PositionComponent);

// Give the player some velocity (moving right and slightly up)
world.addComponent(player, {
  type: 'velocity',
  dx: 50,   // 50 pixels per second to the right
  dy: 20    // 20 pixels per second upward
} as VelocityComponent);

// Create an enemy entity
const enemy = world.createEntity();

world.addComponent(enemy, {
  type: 'position',
  x: 100,
  y: 50
} as PositionComponent);

world.addComponent(enemy, {
  type: 'velocity',
  dx: -30,  // Moving left
  dy: 10    // Moving down slowly
} as VelocityComponent);

console.log('🎮 Quick Start Example');
console.log(`Created ${world.getEntityCount()} entities`);
console.log('Starting simulation...\n');

// Simulate 5 seconds of game time
const deltaTime = 1.0; // 1 second per update

for (let second = 1; second <= 5; second++) {
  console.log(`--- Second ${second} ---`);
  world.update(deltaTime);
  console.log('');
}

console.log('✨ Simulation complete!');
```

## Step 4: Run Your Application

```bash
bun src/index.ts
```

You should see output like:

```
🎮 Quick Start Example
Created 2 entities
Starting simulation...

--- Second 1 ---
Entity 0 is at (50.0, 20.0)
Entity 1 is at (70.0, 60.0)

--- Second 2 ---
Entity 0 is at (100.0, 40.0)
Entity 1 is at (40.0, 70.0)

--- Second 3 ---
Entity 0 is at (150.0, 60.0)
Entity 1 is at (10.0, 80.0)

--- Second 4 ---
Entity 0 is at (200.0, 80.0)
Entity 1 is at (-20.0, 90.0)

--- Second 5 ---
Entity 0 is at (250.0, 100.0)
Entity 1 is at (-50.0, 100.0)

✨ Simulation complete!
```

## Understanding What Happened

Let's break down what your ECS application just did:

### 🏗️ **World Creation**
```typescript
const world = new World();
```
The World is the central coordinator that manages all entities, components, and systems.

### ⚙️ **System Registration**
```typescript
world.addSystem(new MovementSystem());
```
Systems define behavior. The MovementSystem updates entity positions based on their velocities.

### 👤 **Entity Creation**
```typescript
const player = world.createEntity();
const enemy = world.createEntity();
```
Entities are just IDs (0, 1, 2, etc.). They're containers for components.

### 📦 **Component Assignment**
```typescript
world.addComponent(player, { type: 'position', x: 0, y: 0 });
world.addComponent(player, { type: 'velocity', dx: 50, dy: 20 });
```
Components are data. Position holds location, Velocity holds movement speed.

### 🔄 **Game Loop**
```typescript
world.update(deltaTime);
```
Each update cycle, all systems run and process their relevant entities.

## Key ECS Concepts Demonstrated

- **🎯 Composition over Inheritance**: Entities are composed of components, not inherited from classes
- **📊 Data-Driven Design**: Components are pure data, systems contain all logic
- **🔍 Query-Based Processing**: Systems find entities by their component composition
- **⚡ Performance**: Archetype-based storage makes component queries extremely fast

## What's Next?

Your first ECS application is working! Here are some ideas to explore:

### Add More Components
```typescript
interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

interface SpriteComponent extends Component {
  readonly type: 'sprite';
  image: string;
  width: number;
  height: number;
}
```

### Create More Systems
- **RenderSystem**: Draw entities to a canvas
- **CollisionSystem**: Detect when entities collide
- **HealthSystem**: Handle damage and healing
- **InputSystem**: Process player input

### Try Query Variations
```typescript
// Find entities with health below 50%
const damagedEntities = world.queryWith<HealthComponent>('health',
  (health) => health.current / health.maximum < 0.5
);

// Process multiple component types together
this.queryWithComponents<PositionComponent, SpriteComponent>(
  world, 'position', 'sprite',
  (entityId, position, sprite) => {
    // Render sprite at position
  }
);
```

## Next Steps

- 🎯 **[Core Concepts](./core-concepts.md)** - Deep dive into ECS architecture
- 🎮 **[First Game Tutorial](./first-game.md)** - Build a complete game
- 📚 **[API Reference](../api/core/world.md)** - Explore all available methods
- 🌐 **[Examples](../examples/)** - See more complex applications

## Troubleshooting

**Nothing appears to happen:**
- Check that you're calling `world.update(deltaTime)`
- Verify your system extends `BaseSystem` correctly

**Type errors:**
- Ensure your components extend the `Component` interface
- Check that component `type` properties are readonly strings

**Entities not found by queries:**
- Verify component types match exactly (case-sensitive)
- Make sure components are added before systems run

**Performance concerns:**
- The ECS engine is highly optimized for thousands of entities
- Use `world.getArchetypeStats()` to monitor internal performance

Congratulations! You've built your first ECS application. The entity-component-system pattern will scale beautifully as your game grows in complexity.