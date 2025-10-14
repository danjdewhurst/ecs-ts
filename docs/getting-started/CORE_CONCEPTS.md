# Core Concepts

Understanding the Entity-Component-System (ECS) architecture is key to building efficient, scalable games. This guide covers the fundamental concepts that power the ECS engine.

## What is ECS?

Entity-Component-System is an architectural pattern that prioritizes **composition over inheritance**. Instead of deep class hierarchies, you build complex game objects by combining simple, reusable pieces.

### The Problem ECS Solves

Traditional object-oriented game programming leads to problems like:

```typescript
// ❌ Traditional OOP approach - rigid and hard to extend
class GameObject {
  position: Position;
  render(): void { /* ... */ }
}

class Player extends GameObject {
  health: number;
  input: InputHandler;
  // What if we want a Player without health? Or health without Player?
}

class Enemy extends GameObject {
  ai: AIBehavior;
  health: number;
  // Duplicate health code, hard to share behaviors
}
```

ECS solves this by separating **data** (components) from **behavior** (systems), with entities as simple containers.

## The Three Pillars of ECS

### 🎯 Entities: The "What"

> **Entities are IDs, and nothing more.**

An entity is just a unique identifier (like 0, 1, 2...) that serves as a container for components.

```typescript
const player = world.createEntity();    // Creates entity ID: 0
const enemy = world.createEntity();     // Creates entity ID: 1
const bullet = world.createEntity();    // Creates entity ID: 2
```

**Key Principles:**
- Entities have no logic or behavior
- They're lightweight containers for component composition
- Entity IDs are recycled when entities are destroyed (memory efficient)

### 📦 Components: The "Data"

> **Components are pure data. Components must never contain behavior.**

Components define what an entity **has**. They're plain data structures with no methods or logic.

```typescript
// ✅ Good: Pure data, no behavior
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

// ❌ Bad: Contains behavior
interface BadComponent extends Component {
  readonly type: 'bad';
  data: number;
  updateData(): void { /* NO! */ }
}
```

**Component Best Practices:**

1. **Single Responsibility**: Each component should represent one concept
   ```typescript
   // ✅ Good: Focused components
   interface VelocityComponent extends Component {
     readonly type: 'velocity';
     dx: number;
     dy: number;
   }

   interface SpriteComponent extends Component {
     readonly type: 'sprite';
     image: string;
     width: number;
     height: number;
   }

   // ❌ Bad: Mixed concerns
   interface MovingSprite extends Component {
     readonly type: 'moving-sprite';
     x: number; y: number;        // Position data
     dx: number; dy: number;      // Velocity data
     image: string;               // Rendering data
   }
   ```

2. **Immutable Type**: The `type` field must be readonly for performance
   ```typescript
   interface MyComponent extends Component {
     readonly type: 'my-component'; // ✅ Readonly
     data: number;
   }
   ```

3. **Value Objects**: Use plain data that's easy to serialize
   ```typescript
   interface TransformComponent extends Component {
     readonly type: 'transform';
     position: { x: number; y: number };
     rotation: number;
     scale: { x: number; y: number };
   }
   ```

### ⚙️ Systems: The "How"

> **All game logic belongs in systems. Only systems update, process, or apply behavior.**

Systems contain all the game logic and operate on entities that have specific component combinations.

```typescript
class MovementSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'MovementSystem';

  update(world: World, deltaTime: number): void {
    // Find entities with both position and velocity
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (position && velocity) {
        // Apply velocity to position
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;
      }
    }
  }
}
```

**System Responsibilities:**

1. **Query Entities**: Find entities with relevant components
2. **Process Logic**: Apply game rules and behaviors
3. **Update Components**: Modify component data based on logic
4. **Coordinate**: Communicate with other systems through events

## ECS in Action: Building a Player

Let's see how ECS composition works by building a player character:

### Step 1: Define Components

```typescript
// What the player has
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

interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

interface InputComponent extends Component {
  readonly type: 'input';
  keys: Set<string>;
}

interface SpriteComponent extends Component {
  readonly type: 'sprite';
  image: string;
  width: number;
  height: number;
}
```

### Step 2: Compose the Player Entity

```typescript
const world = new World();

// Create the player entity
const player = world.createEntity();

// Compose the player by adding components
world.addComponent(player, {
  type: 'position',
  x: 100,
  y: 100
} as PositionComponent);

world.addComponent(player, {
  type: 'velocity',
  dx: 0,
  dy: 0
} as VelocityComponent);

world.addComponent(player, {
  type: 'health',
  current: 100,
  maximum: 100
} as HealthComponent);

world.addComponent(player, {
  type: 'input',
  keys: new Set<string>()
} as InputComponent);

world.addComponent(player, {
  type: 'sprite',
  image: 'player.png',
  width: 32,
  height: 32
} as SpriteComponent);
```

### Step 3: Create Systems for Behavior

```typescript
// Handle player input
class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';

  update(world: World): void {
    const entities = this.queryEntities(world, 'input', 'velocity');

    for (const entityId of entities) {
      const input = world.getComponent<InputComponent>(entityId, 'input');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (input && velocity) {
        velocity.dx = 0;
        velocity.dy = 0;

        if (input.keys.has('ArrowLeft')) velocity.dx = -100;
        if (input.keys.has('ArrowRight')) velocity.dx = 100;
        if (input.keys.has('ArrowUp')) velocity.dy = -100;
        if (input.keys.has('ArrowDown')) velocity.dy = 100;
      }
    }
  }
}

// Apply movement
class MovementSystem extends BaseSystem {
  readonly priority = 2;
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

// Render sprites
class RenderSystem extends BaseSystem {
  readonly priority = 100; // Render last
  readonly name = 'RenderSystem';

  update(world: World): void {
    const entities = this.queryEntities(world, 'position', 'sprite');

    for (const entityId of entities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const sprite = world.getComponent<SpriteComponent>(entityId, 'sprite');

      if (position && sprite) {
        // Render sprite at position
        this.drawSprite(sprite.image, position.x, position.y, sprite.width, sprite.height);
      }
    }
  }

  private drawSprite(image: string, x: number, y: number, width: number, height: number): void {
    // Canvas rendering logic
  }
}
```

## Advanced Concepts

### Archetype-Based Storage

The ECS engine uses **archetype-based storage** for optimal performance:

```typescript
// Entities with the same component combination share storage
const entity1 = world.createEntity();
const entity2 = world.createEntity();

// Both entities have position + velocity = same archetype
world.addComponent(entity1, positionComponent);
world.addComponent(entity1, velocityComponent);
world.addComponent(entity2, positionComponent);
world.addComponent(entity2, velocityComponent);

// Internally stored together for cache efficiency
// Query performance is O(1) for archetype access
```

### System Dependencies and Scheduling

Systems can declare dependencies to ensure correct execution order:

```typescript
class PhysicsSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'PhysicsSystem';
  readonly dependencies = []; // Runs first
}

class CollisionSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem']; // Runs after physics
}

class RenderSystem extends BaseSystem {
  readonly priority = 3;
  readonly name = 'RenderSystem';
  readonly dependencies = ['PhysicsSystem', 'CollisionSystem']; // Runs last
}
```

### Flexible Querying

The ECS engine provides multiple ways to find and process entities:

```typescript
class ExampleSystem extends BaseSystem {
  update(world: World): void {
    // Basic multi-component query
    const entities = this.queryEntities(world, 'position', 'velocity');

    // Query with component processing
    this.queryWithComponents<PositionComponent, VelocityComponent>(
      world, 'position', 'velocity',
      (entityId, position, velocity) => {
        // Process position and velocity together
        position.x += velocity.dx;
        position.y += velocity.dy;
      }
    );

    // Conditional queries
    const damagedEntities = world.queryWith<HealthComponent>('health',
      (health) => health.current < health.maximum
    );

    // Complex queries
    const movingSprites = world.queryMultiple(['position', 'velocity', 'sprite']);
  }
}
```

## Design Patterns and Best Practices

### 1. Composition over Inheritance

```typescript
// ✅ Good: Compose different entity types from components
function createPlayer(world: World): number {
  const entity = world.createEntity();
  world.addComponent(entity, { type: 'position', x: 0, y: 0 });
  world.addComponent(entity, { type: 'health', current: 100, maximum: 100 });
  world.addComponent(entity, { type: 'input', keys: new Set() });
  return entity;
}

function createNPC(world: World): number {
  const entity = world.createEntity();
  world.addComponent(entity, { type: 'position', x: 0, y: 0 });
  world.addComponent(entity, { type: 'health', current: 50, maximum: 50 });
  world.addComponent(entity, { type: 'ai', behavior: 'patrol' });
  return entity;
}

// ❌ Bad: Inheritance creates rigid hierarchies
class Entity {}
class MovableEntity extends Entity {}
class Player extends MovableEntity {} // Hard to share with NPCs
```

### 2. Single Responsibility Systems

```typescript
// ✅ Good: Focused systems
class MovementSystem extends BaseSystem {
  // Only handles applying velocity to position
}

class CollisionSystem extends BaseSystem {
  // Only handles collision detection and response
}

class HealthSystem extends BaseSystem {
  // Only handles health changes and death
}

// ❌ Bad: God system
class GameplaySystem extends BaseSystem {
  // Handles movement, collision, health, input, rendering... TOO MUCH!
}
```

### 3. Event-Driven Communication

```typescript
// Systems communicate through events, not direct coupling
class HealthSystem extends BaseSystem {
  update(world: World): void {
    const entities = this.queryEntities(world, 'health');

    for (const entityId of entities) {
      const health = world.getComponent<HealthComponent>(entityId, 'health');

      if (health && health.current <= 0) {
        // Emit event instead of directly handling death
        world.emit('entity-died', { entityId, position: this.getPosition(entityId) });
      }
    }
  }
}

class ScoreSystem extends BaseSystem {
  init(world: World): void {
    // Listen for death events
    world.on('entity-died', (data) => {
      this.awardPoints(data.entityId);
    });
  }
}
```

## Performance Characteristics

The ECS engine is designed for high performance:

- **Entity Creation**: O(1) with ID recycling
- **Component Access**: O(1) with archetype-based storage
- **System Queries**: O(1) archetype lookup + O(n) entity iteration
- **Memory Usage**: Cache-friendly component storage, minimal overhead

### Benchmarks

Typical performance on modern hardware:

- **100,000 entities**: Smooth 60 FPS
- **Component queries**: Sub-microsecond access times
- **System updates**: Minimal overhead, dependency-aware scheduling
- **Memory footprint**: Optimized for cache locality

## Next Steps

Now that you understand ECS fundamentals:

- 🎮 **[Build Your First Game](./first-game.md)** - Apply these concepts in practice
- 📚 **[World API Reference](../api/core/world.md)** - Explore the full World interface
- ⚙️ **[System Documentation](../api/core/system.md)** - Learn advanced system patterns
- 🌐 **[Event System](../api/events/event-bus.md)** - Master inter-system communication

## Common Questions

**Q: When should I create a new component vs. adding fields to existing ones?**

A: Follow the Single Responsibility Principle. If data represents a different concept or is used by different systems, create a separate component.

**Q: How do I handle entity relationships (parent/child)?**

A: Use components to represent relationships:
```typescript
interface ParentComponent extends Component {
  readonly type: 'parent';
  children: number[]; // Entity IDs
}

interface ChildComponent extends Component {
  readonly type: 'child';
  parent: number; // Entity ID
}
```

**Q: Should I query in every system update?**

A: Yes! Queries are highly optimized (O(1) archetype lookup). The engine handles caching and performance internally.

**Q: How do I debug ECS applications?**

A: Use the built-in introspection:
```typescript
console.log('Entity count:', world.getEntityCount());
console.log('Component types:', world.getComponentTypes());
console.log('Archetype stats:', world.getArchetypeStats());
```

The ECS pattern takes some adjustment if you're coming from traditional OOP, but it provides unmatched flexibility and performance for game development.