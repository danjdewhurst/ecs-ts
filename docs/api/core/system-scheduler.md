# SystemScheduler API Reference

The SystemScheduler manages system execution order, dependency resolution, and lifecycle coordination. It ensures systems run in the correct order based on both priorities and dependencies while handling errors gracefully.

## Overview

The SystemScheduler provides:

- **Dependency Resolution**: Manages system dependencies and execution order
- **Topological Sorting**: Ensures dependencies are satisfied before execution
- **Priority Ordering**: Sorts systems by priority within dependency constraints
- **Error Isolation**: Continues execution even if individual systems fail
- **Lifecycle Management**: Coordinates system initialization and shutdown

## Quick Example

```typescript
import { SystemScheduler } from '@danjdewhurst/ecs-ts';

const scheduler = new SystemScheduler();

// Add systems with dependencies
scheduler.addSystem(new PhysicsSystem());      // No dependencies
scheduler.addSystem(new CollisionSystem());   // Depends on PhysicsSystem
scheduler.addSystem(new RenderSystem());      // Depends on both

// Systems will execute in dependency order
scheduler.update(world, deltaTime);
```

## Constructor

### SystemScheduler()

Creates a new SystemScheduler with empty state.

```typescript
const scheduler = new SystemScheduler();
```

**Initial State:**
- Empty systems list
- Empty execution order
- Clean dependency graph

## System Management

### addSystem(system)

Adds a system to the scheduler and recomputes execution order.

```typescript
addSystem(system: System): void
```

**Parameters:**
- `system: System` - System instance to add

**Example:**
```typescript
class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';
  // No dependencies
}

class MovementSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'MovementSystem';
  readonly dependencies = ['InputSystem'];
}

class RenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'RenderSystem';
  readonly dependencies = ['MovementSystem'];
}

const scheduler = new SystemScheduler();

scheduler.addSystem(new RenderSystem());    // Added first
scheduler.addSystem(new InputSystem());     // Added second
scheduler.addSystem(new MovementSystem());  // Added third

// Execution order: InputSystem → MovementSystem → RenderSystem
// (Dependencies override addition order)
```

**Throws:**
- `Error` - If system name already exists
- `Error` - If system dependencies don't exist
- `Error` - If circular dependencies are detected

**Behavior:**
- Automatically recomputes execution order
- Validates all dependencies exist
- Detects and prevents circular dependencies

### removeSystem(systemName)

Removes a system by name and recomputes execution order.

```typescript
removeSystem(systemName: string): boolean
```

**Parameters:**
- `systemName: string` - Name of system to remove

**Returns:** `boolean` - `true` if system was found and removed

**Example:**
```typescript
scheduler.addSystem(new InputSystem());
scheduler.addSystem(new MovementSystem());

const removed = scheduler.removeSystem('InputSystem');
console.log(removed); // true

const removedAgain = scheduler.removeSystem('InputSystem');
console.log(removedAgain); // false (already removed)
```

**Behavior:**
- Automatically recomputes execution order
- Safe to remove non-existent systems
- Other systems may fail validation if they depend on removed system

### getSystem(systemName)

Retrieves a system by name.

```typescript
getSystem(systemName: string): System | undefined
```

**Parameters:**
- `systemName: string` - Name of system to find

**Returns:** `System | undefined` - System instance or undefined if not found

**Example:**
```typescript
scheduler.addSystem(new MovementSystem());

const system = scheduler.getSystem('MovementSystem');
if (system) {
  console.log(`Found system with priority ${system.priority}`);
}

const missing = scheduler.getSystem('NonExistent');
console.log(missing); // undefined
```

### getSystems()

Returns all registered systems.

```typescript
getSystems(): readonly System[]
```

**Returns:** `readonly System[]` - Copy of systems array in registration order

**Example:**
```typescript
scheduler.addSystem(new InputSystem());
scheduler.addSystem(new MovementSystem());
scheduler.addSystem(new RenderSystem());

const systems = scheduler.getSystems();
console.log(systems.map(s => s.name));
// Output: ['InputSystem', 'MovementSystem', 'RenderSystem']
```

### getExecutionOrder()

Returns systems in execution order (post-dependency resolution).

```typescript
getExecutionOrder(): readonly System[]
```

**Returns:** `readonly System[]` - Copy of systems in execution order

**Example:**
```typescript
// Add systems in random order
scheduler.addSystem(new RenderSystem());     // Priority 100, depends on Movement
scheduler.addSystem(new InputSystem());      // Priority 1, no dependencies
scheduler.addSystem(new MovementSystem());   // Priority 2, depends on Input

const executionOrder = scheduler.getExecutionOrder();
console.log(executionOrder.map(s => s.name));
// Output: ['InputSystem', 'MovementSystem', 'RenderSystem']
// (Dependency order, not addition order)
```

## System Execution

### update(world, deltaTime)

Executes all systems in dependency order.

```typescript
update(world: World, deltaTime: number): void
```

**Parameters:**
- `world: World` - World instance to pass to systems
- `deltaTime: number` - Time elapsed since last update

**Example:**
```typescript
const world = new World();
const scheduler = new SystemScheduler();

scheduler.addSystem(new InputSystem());
scheduler.addSystem(new MovementSystem());
scheduler.addSystem(new RenderSystem());

// Game loop
function gameLoop() {
  const deltaTime = getDeltaTime();
  scheduler.update(world, deltaTime);
  requestAnimationFrame(gameLoop);
}
```

**Error Handling:**
- Catches exceptions from individual systems
- Logs errors but continues executing other systems
- Failed systems don't stop the entire update cycle

**Execution Order:**
1. Systems sorted by dependency requirements
2. Within same dependency level, sorted by priority
3. Lower priority numbers execute first

### initializeSystems(world)

Initializes all systems in execution order.

```typescript
initializeSystems(world: World): void
```

**Parameters:**
- `world: World` - World instance to pass to systems

**Example:**
```typescript
const world = new World();
const scheduler = new SystemScheduler();

scheduler.addSystem(new AudioSystem());    // Needs initialization
scheduler.addSystem(new NetworkSystem());  // Needs initialization
scheduler.addSystem(new MovementSystem()); // No initialization needed

// Initialize all systems
scheduler.initializeSystems(world);

// Now ready for update loop
scheduler.update(world, deltaTime);
```

**Behavior:**
- Calls `initialize(world)` on each system that implements it
- Executes in dependency order (dependencies initialize first)
- Catches and logs initialization errors
- Failed initialization doesn't prevent other systems from initializing

### shutdownSystems(world)

Shuts down all systems in reverse execution order.

```typescript
shutdownSystems(world: World): void
```

**Parameters:**
- `world: World` - World instance to pass to systems

**Example:**
```typescript
// Game cleanup
window.addEventListener('beforeunload', () => {
  scheduler.shutdownSystems(world);
});

// Or manual cleanup
function cleanupGame() {
  scheduler.shutdownSystems(world);
}
```

**Behavior:**
- Calls `shutdown(world)` on each system that implements it
- Executes in **reverse** dependency order (dependents shutdown first)
- Catches and logs shutdown errors
- Continues shutting down other systems even if some fail

## Dependency Resolution

### Understanding Dependencies

Systems can declare dependencies to ensure correct execution order:

```typescript
class PhysicsSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'PhysicsSystem';
  // No dependencies - can run first
}

class CollisionSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem']; // Must run after physics
}

class SoundSystem extends BaseSystem {
  readonly priority = 1; // Same priority as PhysicsSystem
  readonly name = 'SoundSystem';
  readonly dependencies = ['CollisionSystem']; // Must run after collision
}

class RenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'RenderSystem';
  readonly dependencies = ['PhysicsSystem', 'CollisionSystem']; // Must run after both
}
```

**Execution Order:**
1. `PhysicsSystem` (priority 1, no dependencies)
2. `CollisionSystem` (priority 2, depends on Physics)
3. `SoundSystem` (priority 1, but depends on Collision)
4. `RenderSystem` (priority 100, depends on Physics and Collision)

### Dependency Validation

The scheduler validates dependencies when systems are added:

```typescript
const scheduler = new SystemScheduler();

// This will work
scheduler.addSystem(new PhysicsSystem());
scheduler.addSystem(new CollisionSystem()); // PhysicsSystem exists

// This will throw an error
try {
  scheduler.addSystem(new BadSystem()); // Depends on 'NonExistent'
} catch (error) {
  console.error(error.message);
  // "System 'BadSystem' depends on 'NonExistent' which does not exist"
}
```

### Circular Dependency Detection

The scheduler detects and prevents circular dependencies:

```typescript
class SystemA extends BaseSystem {
  readonly name = 'SystemA';
  readonly dependencies = ['SystemB'];
}

class SystemB extends BaseSystem {
  readonly name = 'SystemB';
  readonly dependencies = ['SystemA']; // Circular!
}

const scheduler = new SystemScheduler();

scheduler.addSystem(new SystemA());

try {
  scheduler.addSystem(new SystemB()); // Will throw
} catch (error) {
  console.error(error.message);
  // "Circular dependency detected involving system 'SystemB'"
}
```

## Advanced Usage

### Complex Dependency Chains

```typescript
// Complex dependency scenario
class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';
}

class AISystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'AISystem';
  readonly dependencies = ['InputSystem'];
}

class PhysicsSystem extends BaseSystem {
  readonly priority = 3;
  readonly name = 'PhysicsSystem';
  readonly dependencies = ['InputSystem', 'AISystem'];
}

class CollisionSystem extends BaseSystem {
  readonly priority = 4;
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem'];
}

class AudioSystem extends BaseSystem {
  readonly priority = 2; // Lower priority than CollisionSystem
  readonly name = 'AudioSystem';
  readonly dependencies = ['CollisionSystem']; // But must wait for collision
}

class RenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'RenderSystem';
  readonly dependencies = ['PhysicsSystem', 'CollisionSystem'];
}

// Execution order:
// 1. InputSystem (priority 1, no deps)
// 2. AISystem (priority 2, depends on Input)
// 3. PhysicsSystem (priority 3, depends on Input + AI)
// 4. CollisionSystem (priority 4, depends on Physics)
// 5. AudioSystem (priority 2, but depends on Collision)
// 6. RenderSystem (priority 100, depends on Physics + Collision)
```

### Dynamic System Management

```typescript
class DynamicGameManager {
  private scheduler = new SystemScheduler();
  private world = new World();

  startGame(): void {
    // Core systems always present
    this.scheduler.addSystem(new InputSystem());
    this.scheduler.addSystem(new MovementSystem());
    this.scheduler.addSystem(new RenderSystem());

    this.scheduler.initializeSystems(this.world);
  }

  enableMultiplayer(): void {
    // Add networking systems
    this.scheduler.addSystem(new NetworkSystem());
    this.scheduler.addSystem(new SyncSystem());

    // Re-initialize new systems
    const networkSystem = this.scheduler.getSystem('NetworkSystem');
    const syncSystem = this.scheduler.getSystem('SyncSystem');

    if (networkSystem) networkSystem.initialize?.(this.world);
    if (syncSystem) syncSystem.initialize?.(this.world);
  }

  disableMultiplayer(): void {
    // Remove networking systems
    const networkSystem = this.scheduler.getSystem('NetworkSystem');
    const syncSystem = this.scheduler.getSystem('SyncSystem');

    if (networkSystem) networkSystem.shutdown?.(this.world);
    if (syncSystem) syncSystem.shutdown?.(this.world);

    this.scheduler.removeSystem('NetworkSystem');
    this.scheduler.removeSystem('SyncSystem');
  }

  update(deltaTime: number): void {
    this.scheduler.update(this.world, deltaTime);
  }
}
```

### Performance Monitoring

```typescript
class MonitoredSystemScheduler extends SystemScheduler {
  private systemTimes = new Map<string, number>();

  update(world: World, deltaTime: number): void {
    const executionOrder = this.getExecutionOrder();

    for (const system of executionOrder) {
      const startTime = performance.now();

      try {
        system.update(world, deltaTime);
      } catch (error) {
        console.error(`Error in system '${system.name}':`, error);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      this.systemTimes.set(system.name, executionTime);

      // Warn about slow systems
      if (executionTime > 16) { // More than 1 frame at 60fps
        console.warn(`System '${system.name}' took ${executionTime.toFixed(2)}ms`);
      }
    }
  }

  getPerformanceStats(): Map<string, number> {
    return new Map(this.systemTimes);
  }

  getSlowSystems(threshold = 5): string[] {
    return Array.from(this.systemTimes.entries())
      .filter(([_, time]) => time > threshold)
      .map(([name, _]) => name);
  }
}
```

## Error Handling

### System-Level Error Isolation

```typescript
class RobustSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'RobustSystem';

  update(world: World, deltaTime: number): void {
    // If this system throws an error, other systems continue running
    throw new Error('This system failed!');
  }
}

const scheduler = new SystemScheduler();
scheduler.addSystem(new RobustSystem());
scheduler.addSystem(new MovementSystem()); // Still runs even if RobustSystem fails

scheduler.update(world, deltaTime);
// Output: "Error in system 'RobustSystem': This system failed!"
// MovementSystem still executes normally
```

### Initialization Error Handling

```typescript
class FailingInitSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'FailingInitSystem';

  initialize(world: World): void {
    throw new Error('Failed to initialize!');
  }

  update(world: World, deltaTime: number): void {
    // This will still be called despite initialization failure
    console.log('System running despite init failure');
  }
}

const scheduler = new SystemScheduler();
scheduler.addSystem(new FailingInitSystem());
scheduler.initializeSystems(world);
// Output: "Error initializing system 'FailingInitSystem': Failed to initialize!"

scheduler.update(world, deltaTime);
// Output: "System running despite init failure"
```

## Performance Characteristics

### Time Complexity

- **addSystem()**: O(n log n) where n is number of systems (due to dependency resolution)
- **removeSystem()**: O(n log n) (recomputes execution order)
- **update()**: O(n) where n is number of systems
- **Dependency Resolution**: O(n + d) where d is number of dependencies

### Memory Usage

- **Per System**: ~100 bytes overhead for dependency tracking
- **Dependency Graph**: O(n + d) memory where n = systems, d = dependencies
- **Execution Order Cache**: O(n) memory

### Scalability

The SystemScheduler efficiently handles:
- **100+ systems** with complex dependency chains
- **Deep dependency trees** (10+ levels)
- **Dynamic system addition/removal** during runtime
- **Error recovery** without stopping execution

## Common Patterns

### System Groups

```typescript
// Organize systems into logical groups
function addPhysicsSystems(scheduler: SystemScheduler): void {
  scheduler.addSystem(new MovementSystem());
  scheduler.addSystem(new CollisionSystem());
  scheduler.addSystem(new PhysicsIntegrationSystem());
}

function addRenderingSystems(scheduler: SystemScheduler): void {
  scheduler.addSystem(new SpriteSystem());
  scheduler.addSystem(new ParticleSystem());
  scheduler.addSystem(new CameraSystem());
  scheduler.addSystem(new RenderSystem());
}

function addGameplaySystems(scheduler: SystemScheduler): void {
  scheduler.addSystem(new HealthSystem());
  scheduler.addSystem(new ScoreSystem());
  scheduler.addSystem(new GameStateSystem());
}
```

### Conditional System Loading

```typescript
class ConfigurableGame {
  private scheduler = new SystemScheduler();

  constructor(config: GameConfig) {
    // Always add core systems
    this.scheduler.addSystem(new InputSystem());
    this.scheduler.addSystem(new MovementSystem());

    // Conditional systems
    if (config.enablePhysics) {
      this.scheduler.addSystem(new PhysicsSystem());
      this.scheduler.addSystem(new CollisionSystem());
    }

    if (config.enableAudio) {
      this.scheduler.addSystem(new AudioSystem());
    }

    if (config.enableNetworking) {
      this.scheduler.addSystem(new NetworkSystem());
    }

    // Rendering always last
    this.scheduler.addSystem(new RenderSystem());
  }
}
```

## See Also

- **[System API](./system.md)** - Creating and implementing systems
- **[World API](./world.md)** - System management through World
- **[Architecture Guide](../../guides/systems-and-scheduling.md)** - System design patterns
- **[Performance Guide](../../guides/performance-optimization.md)** - System optimization
- **[Event System](../events/event-bus.md)** - Inter-system communication