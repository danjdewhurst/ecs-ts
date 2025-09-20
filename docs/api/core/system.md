# System API Reference

Systems contain all game logic and behavior in the ECS engine. They process entities with specific component combinations and are the only place where game behavior should be implemented.

## Overview

Systems provide:

- **Pure Game Logic**: All behavior and processing logic lives in systems
- **Entity Processing**: Query and process entities with specific component combinations
- **Lifecycle Management**: Initialize and shutdown hooks for resource management
- **Dependency Resolution**: Declare dependencies to ensure correct execution order
- **Performance Optimization**: Helper methods for efficient entity processing

Systems follow the principle that **all game logic belongs in systems** - components are pure data, entities are IDs, and systems provide all behavior.

## System Interface

### System

The base interface that all systems must implement.

```typescript
interface System {
  readonly priority: number;
  readonly name: string;
  readonly dependencies?: string[];
  update(world: World, deltaTime: number): void;
  initialize?(world: World): void;
  shutdown?(world: World): void;
}
```

**Required Properties:**
- `priority: number` - Execution order (lower numbers run first)
- `name: string` - Unique identifier for the system

**Optional Properties:**
- `dependencies?: string[]` - System names this system depends on

**Required Methods:**
- `update(world, deltaTime)` - Main processing logic called each frame

**Optional Methods:**
- `initialize?(world)` - Setup code called when system is first added
- `shutdown?(world)` - Cleanup code called when system is removed

## BaseSystem Class

Abstract base class that provides common system functionality and helper methods.

```typescript
abstract class BaseSystem implements System {
  abstract readonly priority: number;
  abstract readonly name: string;
  dependencies?: string[] = [];

  abstract update(world: World, deltaTime: number): void;

  initialize?(world: World): void;
  shutdown?(world: World): void;

  // Helper methods
  protected queryEntities(world: World, ...componentTypes: string[]): number[];
  protected queryWithComponents<T>(world: World, componentType: string, callback: Function): void;
}
```

## Quick Example

```typescript
import { BaseSystem, type World, type Component } from '@danjdewhurst/ecs-ts';

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
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;
      }
    }
  }
}
```

## System Lifecycle

### Construction and Registration

```typescript
const world = new World();

// Create and add systems
world.addSystem(new MovementSystem());
world.addSystem(new RenderSystem());
world.addSystem(new InputSystem());

// Systems are automatically sorted by priority
```

### initialize(world)

Called once when the system is first added to the world or before the first update.

```typescript
class AudioSystem extends BaseSystem {
  readonly priority = 50;
  readonly name = 'AudioSystem';

  private audioContext?: AudioContext;

  initialize(world: World): void {
    // Setup resources when system is added
    this.audioContext = new AudioContext();

    // Subscribe to events
    world.subscribeToEvent('play-sound', (event) => {
      this.playSound(event.data.soundId);
    });

    console.log('AudioSystem initialized');
  }

  update(world: World): void {
    // Process audio entities
  }

  private playSound(soundId: string): void {
    // Audio playback logic
  }
}
```

**Use Cases:**
- Setting up external resources (audio contexts, rendering contexts)
- Subscribing to events
- Loading assets or configuration
- Establishing connections

### update(world, deltaTime)

Main processing method called every frame during `world.update()`.

```typescript
class HealthSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'HealthSystem';

  update(world: World, deltaTime: number): void {
    // Process all entities with health components
    const entities = this.queryEntities(world, 'health');

    for (const entityId of entities) {
      const health = world.getComponent<HealthComponent>(entityId, 'health');

      if (health) {
        // Handle health regeneration
        if (health.current < health.maximum) {
          health.current = Math.min(
            health.maximum,
            health.current + 10 * deltaTime // Regen 10 HP per second
          );
        }

        // Handle death
        if (health.current <= 0) {
          world.emitEvent({
            type: 'entity-died',
            data: { entityId },
            timestamp: Date.now()
          });
        }
      }
    }
  }
}
```

**Parameters:**
- `world: World` - The world instance containing all entities and components
- `deltaTime: number` - Time elapsed since last update (in seconds)

**Best Practices:**
- Keep logic focused on single responsibility
- Use deltaTime for frame-rate independent behavior
- Emit events for communication with other systems
- Process entities efficiently using queries

### shutdown(world)

Called when the system is removed from the world or during cleanup.

```typescript
class NetworkSystem extends BaseSystem {
  readonly priority = 10;
  readonly name = 'NetworkSystem';

  private connection?: WebSocket;

  initialize(world: World): void {
    this.connection = new WebSocket('ws://localhost:8080');
  }

  update(world: World): void {
    // Process network messages
  }

  shutdown(world: World): void {
    // Clean up resources
    if (this.connection) {
      this.connection.close();
      this.connection = undefined;
    }

    console.log('NetworkSystem shut down');
  }
}
```

**Use Cases:**
- Closing connections and releasing resources
- Unsubscribing from events
- Saving state or configuration
- Cleanup operations

## System Dependencies

Systems can declare dependencies to ensure correct execution order.

```typescript
class PhysicsSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'PhysicsSystem';
  // No dependencies - runs first
}

class CollisionSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem']; // Runs after physics
}

class RenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'RenderSystem';
  readonly dependencies = ['PhysicsSystem', 'CollisionSystem']; // Runs last
}
```

**Dependency Resolution:**
- Systems with dependencies wait for their dependencies to be added
- Execution order respects both priorities and dependencies
- Circular dependencies are detected and prevented
- Missing dependencies cause system loading to fail

## Helper Methods

### queryEntities(...componentTypes)

Finds entities that have all specified component types.

```typescript
protected queryEntities(world: World, ...componentTypes: string[]): number[]
```

**Parameters:**
- `world: World` - World instance to query
- `...componentTypes: string[]` - Component types that entities must have

**Returns:** `number[]` - Array of entity IDs

**Example:**
```typescript
class MovementSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // Find entities with both position and velocity
    const movingEntities = this.queryEntities(world, 'position', 'velocity');

    // Find entities with position, velocity, and health
    const livingMovingEntities = this.queryEntities(world, 'position', 'velocity', 'health');

    // Process each entity
    for (const entityId of movingEntities) {
      // Process entity logic
    }
  }
}
```

### queryWithComponents<T>(componentType, callback)

Processes entities with a specific component type using a callback.

```typescript
protected queryWithComponents<T extends Component>(
  world: World,
  componentType: string,
  callback: (entityId: number, component: T) => void
): void
```

**Parameters:**
- `world: World` - World instance to query
- `componentType: string` - Component type to process
- `callback: Function` - Function called for each entity with the component

**Example:**
```typescript
class HealthRegenSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // Process all health components
    this.queryWithComponents<HealthComponent>(
      world, 'health',
      (entityId, health) => {
        if (health.current < health.maximum) {
          health.current = Math.min(
            health.maximum,
            health.current + 5 * deltaTime
          );
        }
      }
    );
  }
}
```

## System Patterns

### Input System

Handle user input and update component state:

```typescript
class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';

  private keys = new Set<string>();

  initialize(): void {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  update(world: World): void {
    // Update input components with current key state
    this.queryWithComponents<InputComponent>(
      world, 'input',
      (entityId, input) => {
        input.keys.clear();
        this.keys.forEach(key => input.keys.add(key));
      }
    );

    // Process player movement
    const players = this.queryEntities(world, 'player', 'input', 'velocity');

    for (const entityId of players) {
      const input = world.getComponent<InputComponent>(entityId, 'input');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (input && velocity) {
        velocity.dx = 0;
        velocity.dy = 0;

        if (input.keys.has('ArrowLeft')) velocity.dx = -200;
        if (input.keys.has('ArrowRight')) velocity.dx = 200;
        if (input.keys.has('ArrowUp')) velocity.dy = -200;
        if (input.keys.has('ArrowDown')) velocity.dy = 200;
      }
    }
  }

  shutdown(): void {
    // Remove event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
```

### Render System

Draw entities to screen (typically runs last):

```typescript
class RenderSystem extends BaseSystem {
  readonly priority = 100; // High priority = runs last
  readonly name = 'RenderSystem';

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  update(world: World): void {
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render all sprites
    const renderables = this.queryEntities(world, 'position', 'sprite');

    for (const entityId of renderables) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const sprite = world.getComponent<SpriteComponent>(entityId, 'sprite');

      if (position && sprite) {
        this.ctx.fillStyle = sprite.color;
        this.ctx.fillRect(position.x, position.y, sprite.width, sprite.height);
      }
    }
  }
}
```

### AI System

Implement game AI behavior:

```typescript
class AISystem extends BaseSystem {
  readonly priority = 3;
  readonly name = 'AISystem';

  update(world: World, deltaTime: number): void {
    const aiEntities = this.queryEntities(world, 'ai', 'position', 'velocity');

    for (const entityId of aiEntities) {
      const ai = world.getComponent<AIComponent>(entityId, 'ai');
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (ai && position && velocity) {
        switch (ai.behavior) {
          case 'patrol':
            this.handlePatrol(ai, position, velocity);
            break;
          case 'chase':
            this.handleChase(world, ai, position, velocity);
            break;
          case 'flee':
            this.handleFlee(world, ai, position, velocity);
            break;
        }
      }
    }
  }

  private handlePatrol(ai: AIComponent, position: PositionComponent, velocity: VelocityComponent): void {
    const target = ai.patrolPoints[ai.currentPatrolIndex];
    const distance = Math.hypot(target.x - position.x, target.y - position.y);

    if (distance < 10) {
      ai.currentPatrolIndex = (ai.currentPatrolIndex + 1) % ai.patrolPoints.length;
    } else {
      const speed = 50;
      velocity.dx = (target.x - position.x) / distance * speed;
      velocity.dy = (target.y - position.y) / distance * speed;
    }
  }

  private handleChase(world: World, ai: AIComponent, position: PositionComponent, velocity: VelocityComponent): void {
    if (ai.target && world.hasComponent(ai.target, 'position')) {
      const targetPos = world.getComponent<PositionComponent>(ai.target, 'position');
      if (targetPos) {
        const distance = Math.hypot(targetPos.x - position.x, targetPos.y - position.y);
        const speed = 100;
        velocity.dx = (targetPos.x - position.x) / distance * speed;
        velocity.dy = (targetPos.y - position.y) / distance * speed;
      }
    }
  }

  private handleFlee(world: World, ai: AIComponent, position: PositionComponent, velocity: VelocityComponent): void {
    // Implementation for flee behavior
  }
}
```

### Event-Driven System

Use events for loose coupling between systems:

```typescript
class WeaponSystem extends BaseSystem {
  readonly priority = 4;
  readonly name = 'WeaponSystem';

  initialize(world: World): void {
    // Listen for attack events
    world.subscribeToEvent('player-attack', (event) => {
      this.handleAttack(world, event.data);
    });
  }

  update(world: World): void {
    // Process weapon entities
    const weapons = this.queryEntities(world, 'weapon', 'position');

    for (const entityId of weapons) {
      const weapon = world.getComponent<WeaponComponent>(entityId, 'weapon');

      if (weapon && weapon.cooldown > 0) {
        weapon.cooldown -= deltaTime;
      }
    }
  }

  private handleAttack(world: World, attackData: any): void {
    const weapon = world.getComponent<WeaponComponent>(attackData.weaponId, 'weapon');

    if (weapon && weapon.cooldown <= 0) {
      // Create projectile
      const projectile = world.createEntity();
      world.addComponent(projectile, {
        type: 'position',
        x: attackData.x,
        y: attackData.y
      });
      world.addComponent(projectile, {
        type: 'projectile',
        damage: weapon.damage
      });

      weapon.cooldown = weapon.cooldownDuration;
    }
  }
}
```

## Performance Optimization

### Dirty Tracking

Only process entities that have changed:

```typescript
class OptimizedRenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'OptimizedRenderSystem';

  update(world: World): void {
    // Only re-render entities whose position or sprite changed
    const dirtyPositions = world.getDirtyEntities('position');
    const dirtySprites = world.getDirtyEntities('sprite');
    const dirtyEntities = new Set([...dirtyPositions, ...dirtySprites]);

    for (const entityId of dirtyEntities) {
      if (world.hasComponent(entityId, 'position') &&
          world.hasComponent(entityId, 'sprite')) {
        this.renderEntity(world, entityId);
      }
    }
  }

  private renderEntity(world: World, entityId: number): void {
    // Render individual entity
  }
}
```

### Batch Processing

Process similar entities together for cache efficiency:

```typescript
class BatchedMovementSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'BatchedMovementSystem';

  update(world: World, deltaTime: number): void {
    // Get all moving entities at once
    const entities = this.queryEntities(world, 'position', 'velocity');

    // Batch process for better cache locality
    const positions: PositionComponent[] = [];
    const velocities: VelocityComponent[] = [];

    // Collect components
    for (const entityId of entities) {
      const pos = world.getComponent<PositionComponent>(entityId, 'position');
      const vel = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (pos && vel) {
        positions.push(pos);
        velocities.push(vel);
      }
    }

    // Process in batch
    for (let i = 0; i < positions.length; i++) {
      positions[i].x += velocities[i].dx * deltaTime;
      positions[i].y += velocities[i].dy * deltaTime;
    }
  }
}
```

### System Grouping

Group related systems for better organization:

```typescript
// Physics systems
class MovementSystem extends BaseSystem {
  readonly priority = 10;
  readonly name = 'MovementSystem';
}

class CollisionSystem extends BaseSystem {
  readonly priority = 11;
  readonly name = 'CollisionSystem';
  readonly dependencies = ['MovementSystem'];
}

class PhysicsSystem extends BaseSystem {
  readonly priority = 12;
  readonly name = 'PhysicsSystem';
  readonly dependencies = ['MovementSystem', 'CollisionSystem'];
}

// Rendering systems
class SpriteSystem extends BaseSystem {
  readonly priority = 90;
  readonly name = 'SpriteSystem';
}

class ParticleSystem extends BaseSystem {
  readonly priority = 91;
  readonly name = 'ParticleSystem';
}

class RenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'RenderSystem';
  readonly dependencies = ['SpriteSystem', 'ParticleSystem'];
}
```

## Debugging Systems

### System Performance Monitoring

```typescript
class DebuggingSystem extends BaseSystem {
  readonly priority = 999; // Run last for monitoring
  readonly name = 'DebuggingSystem';

  private systemTimes = new Map<string, number>();

  update(world: World): void {
    // Monitor system performance
    const stats = world.getDirtyTrackingStats();
    console.log('Dirty tracking stats:', stats);

    // Log archetype information
    const archetypes = world.getArchetypeStats();
    console.log('Archetype distribution:', archetypes);

    // Monitor entity count
    console.log('Total entities:', world.getEntityCount());
  }
}
```

### System State Inspection

```typescript
function debugSystem(system: System, world: World): void {
  console.log(`System: ${system.name}`);
  console.log(`Priority: ${system.priority}`);
  console.log(`Dependencies: ${system.dependencies || 'none'}`);

  if (system instanceof BaseSystem) {
    // Test system queries
    const entities = (system as any).queryEntities(world, 'position');
    console.log(`Entities with position: ${entities.length}`);
  }
}
```

## Error Handling

Systems should handle errors gracefully:

```typescript
class RobustSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'RobustSystem';

  update(world: World, deltaTime: number): void {
    try {
      const entities = this.queryEntities(world, 'component');

      for (const entityId of entities) {
        try {
          this.processEntity(world, entityId);
        } catch (error) {
          console.error(`Error processing entity ${entityId}:`, error);
          // Continue processing other entities
        }
      }
    } catch (error) {
      console.error(`Critical error in ${this.name}:`, error);
      // System-level error handling
    }
  }

  private processEntity(world: World, entityId: number): void {
    // Entity processing logic that might throw
  }
}
```

## See Also

- **[World API](./world.md)** - Managing systems through the World interface
- **[System Scheduler](./system-scheduler.md)** - Advanced system dependency and scheduling
- **[Component API](./component.md)** - Understanding component data that systems process
- **[Query System](./query.md)** - Advanced entity querying techniques
- **[Event System](../events/event-bus.md)** - Inter-system communication
- **[Performance Guide](../../guides/performance-optimization.md)** - System optimization strategies