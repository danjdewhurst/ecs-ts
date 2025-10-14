# World API Reference

The World class is the central coordinator of the ECS engine. It manages entities, components, systems, and provides the main game loop functionality.

## Overview

The World acts as a container and orchestrator for all ECS operations:

- **Entity Management**: Create, destroy, and track entity lifecycles
- **Component Storage**: Add, remove, and query components efficiently
- **System Coordination**: Manage system execution order and dependencies
- **Event Communication**: Facilitate decoupled inter-system communication
- **Performance Optimization**: Built-in dirty tracking and archetype management

## Quick Example

```typescript
import { World, BaseSystem, type Component } from '@danjdewhurst/ecs-ts';

const world = new World();

// Create entities and add components
const player = world.createEntity();
world.addComponent(player, { type: 'position', x: 0, y: 0 });

// Add systems
world.addSystem(new MovementSystem());

// Game loop
world.update(deltaTime);
```

## Constructor

### World()

Creates a new World instance with initialized internal managers.

```typescript
const world = new World();
```

**Returns:** `World` - A new World instance ready for use.

**Performance Notes:**
- Initializes archetype manager for optimal component storage
- Sets up event bus for inter-system communication
- Prepares dirty tracking for performance optimization

## Entity Management

### createEntity()

Creates a new entity and returns its unique identifier.

```typescript
createEntity(): number
```

**Returns:** `number` - Unique entity ID (starting from 0, with ID recycling)

**Example:**
```typescript
const player = world.createEntity();    // Returns 0
const enemy = world.createEntity();     // Returns 1
const bullet = world.createEntity();    // Returns 2

console.log(`Created entities: ${player}, ${enemy}, ${bullet}`);
// Output: "Created entities: 0, 1, 2"
```

**Performance Notes:**
- O(1) operation with ID recycling
- Entity IDs are reused when entities are destroyed
- Efficient memory management for long-running games

### destroyEntity(entityId)

Destroys an entity and removes all its components.

```typescript
destroyEntity(entityId: number): void
```

**Parameters:**
- `entityId: number` - The entity ID to destroy

**Example:**
```typescript
const entity = world.createEntity();
world.addComponent(entity, { type: 'position', x: 10, y: 20 });

world.destroyEntity(entity);
// Entity and all its components are now removed
```

**Behavior:**
- Removes entity from all component storages
- Updates archetype manager
- Clears dirty tracking for the entity
- Entity ID becomes available for recycling

**Performance Notes:**
- O(n) where n is the number of component types on the entity
- Automatically manages memory cleanup
- Safe to call on already destroyed entities (no-op)

### getEntityCount()

Returns the current number of alive entities.

```typescript
getEntityCount(): number
```

**Returns:** `number` - Count of currently alive entities

**Example:**
```typescript
console.log(`Entities: ${world.getEntityCount()}`); // "Entities: 0"

const entity1 = world.createEntity();
const entity2 = world.createEntity();
console.log(`Entities: ${world.getEntityCount()}`); // "Entities: 2"

world.destroyEntity(entity1);
console.log(`Entities: ${world.getEntityCount()}`); // "Entities: 1"
```

## Component Management

### addComponent<T>(entityId, component)

Adds a component to an entity.

```typescript
addComponent<T extends Component>(entityId: number, component: T): void
```

**Parameters:**
- `entityId: number` - Target entity ID
- `component: T` - Component data to add

**Example:**
```typescript
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

const entity = world.createEntity();
world.addComponent(entity, {
  type: 'position',
  x: 100,
  y: 200
} as PositionComponent);
```

**Throws:**
- `Error` - If entity doesn't exist

**Behavior:**
- Creates component storage if it doesn't exist
- Updates entity's archetype for query optimization
- Marks entity as dirty for the component type

**Performance Notes:**
- O(1) component addition
- Automatic archetype optimization for queries
- Type-safe with TypeScript generics

### removeComponent(entityId, componentType)

Removes a component from an entity.

```typescript
removeComponent(entityId: number, componentType: string): boolean
```

**Parameters:**
- `entityId: number` - Target entity ID
- `componentType: string` - Component type to remove

**Returns:** `boolean` - `true` if component was removed, `false` if not found

**Example:**
```typescript
const entity = world.createEntity();
world.addComponent(entity, { type: 'position', x: 0, y: 0 });

const removed = world.removeComponent(entity, 'position');
console.log(removed); // true

const removedAgain = world.removeComponent(entity, 'position');
console.log(removedAgain); // false
```

**Behavior:**
- Updates entity's archetype when component is removed
- Marks entity as dirty for the component type
- Safe to call on non-existent components

### getComponent<T>(entityId, componentType)

Retrieves a component from an entity.

```typescript
getComponent<T extends Component>(entityId: number, componentType: string): T | undefined
```

**Parameters:**
- `entityId: number` - Target entity ID
- `componentType: string` - Component type to retrieve

**Returns:** `T | undefined` - Component data or `undefined` if not found

**Example:**
```typescript
interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

const entity = world.createEntity();
world.addComponent(entity, { type: 'health', current: 100, maximum: 100 });

const health = world.getComponent<HealthComponent>(entity, 'health');
if (health) {
  console.log(`Health: ${health.current}/${health.maximum}`);
}
```

**Performance Notes:**
- O(1) component access
- Returns direct reference to component data (modify in-place)
- Type-safe with generics

### hasComponent(entityId, componentType)

Checks if an entity has a specific component.

```typescript
hasComponent(entityId: number, componentType: string): boolean
```

**Parameters:**
- `entityId: number` - Target entity ID
- `componentType: string` - Component type to check

**Returns:** `boolean` - `true` if entity has the component

**Example:**
```typescript
const entity = world.createEntity();
world.addComponent(entity, { type: 'position', x: 0, y: 0 });

if (world.hasComponent(entity, 'position')) {
  console.log('Entity has position component');
}

if (!world.hasComponent(entity, 'velocity')) {
  console.log('Entity needs velocity component');
}
```

**Performance Notes:**
- O(1) operation
- Useful for conditional logic in systems

## Querying

### query<T>(componentType)

Creates a query for entities with a specific component type.

```typescript
query<T extends Component>(componentType: string): Query<T>
```

**Parameters:**
- `componentType: string` - Component type to query

**Returns:** `Query<T>` - Query object for iteration and filtering

**Example:**
```typescript
// Basic iteration
const healthQuery = world.query<HealthComponent>('health');
healthQuery.forEach((entityId, health) => {
  if (health.current <= 0) {
    world.destroyEntity(entityId);
  }
});

// Get entity list
const entities = healthQuery.getEntities();
console.log(`Entities with health: [${entities.join(', ')}]`);

// Conditional filtering
const damagedEntities = world.query<HealthComponent>('health')
  .filter((health) => health.current < health.maximum);
```

**Performance Notes:**
- O(1) to create query (archetype optimization)
- O(n) iteration where n is entities with the component
- Queries are lightweight and can be created frequently

### queryMultiple(componentTypes)

Finds entities that have all specified component types.

```typescript
queryMultiple(componentTypes: string[]): number[]
```

**Parameters:**
- `componentTypes: string[]` - Array of component types (all required)

**Returns:** `number[]` - Array of entity IDs matching all component types

**Example:**
```typescript
// Find entities with both position and velocity
const movingEntities = world.queryMultiple(['position', 'velocity']);

// Find entities with position, velocity, and health
const livingMovingEntities = world.queryMultiple(['position', 'velocity', 'health']);

// Process each entity
for (const entityId of movingEntities) {
  const position = world.getComponent<PositionComponent>(entityId, 'position');
  const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

  if (position && velocity) {
    position.x += velocity.dx;
    position.y += velocity.dy;
  }
}
```

**Special Cases:**
- Empty array `[]` returns empty array
- Single component type optimized to direct storage access
- Multiple types use archetype-based intersection

**Performance Notes:**
- O(1) for archetype lookup + O(n) for result iteration
- Extremely efficient for multi-component queries
- Results are computed fresh each call (no caching overhead)

## System Management

### addSystem(system)

Adds a system to the world and sorts by priority.

```typescript
addSystem(system: System): void
```

**Parameters:**
- `system: System` - System instance to add

**Example:**
```typescript
class MovementSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'MovementSystem';

  update(world: World, deltaTime: number): void {
    // System logic here
  }
}

world.addSystem(new MovementSystem());
world.addSystem(new RenderSystem()); // Added and auto-sorted by priority
```

**Behavior:**
- Systems are automatically sorted by priority (lowest first)
- Systems with the same priority maintain insertion order
- System's `initialize()` method called during first update if present

### removeSystem(systemName)

Removes a system by name.

```typescript
removeSystem(systemName: string): boolean
```

**Parameters:**
- `systemName: string` - Name of system to remove

**Returns:** `boolean` - `true` if system was found and removed

**Example:**
```typescript
world.addSystem(new MovementSystem()); // name: 'MovementSystem'

const removed = world.removeSystem('MovementSystem');
console.log(removed); // true

const removedAgain = world.removeSystem('MovementSystem');
console.log(removedAgain); // false (already removed)
```

**Behavior:**
- System's `shutdown()` method called if present
- Safe to call with non-existent system names

### update(deltaTime)

Executes one frame of the game loop.

```typescript
update(deltaTime: number): void
```

**Parameters:**
- `deltaTime: number` - Time elapsed since last update (in seconds)

**Example:**
```typescript
let lastTime = performance.now();

function gameLoop() {
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  world.update(deltaTime);

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

**Update Sequence:**
1. Flush component events to event bus
2. Process queued events
3. Execute systems in priority order
4. Process events generated during system updates
5. Clear dirty tracking for next frame

**Performance Notes:**
- Systems run in priority order for predictable behavior
- Event processing happens before and after system updates
- Automatic dirty tracking cleanup

## Event System

### emitEvent(event)

Emits an event that will be processed during the next update cycle.

```typescript
emitEvent(event: GameEvent): void
```

**Parameters:**
- `event: GameEvent` - Event object to emit

**Example:**
```typescript
// Emit a custom game event
world.emitEvent({
  type: 'player-died',
  data: {
    playerId: playerEntity,
    score: currentScore,
    position: playerPosition
  },
  timestamp: Date.now()
});

// Emit a simple event
world.emitEvent({
  type: 'level-complete',
  data: { level: 1 },
  timestamp: Date.now()
});
```

**Behavior:**
- Events are queued and processed during `world.update()`
- Events emitted during system updates are processed after all systems run
- Safe to emit events from within event handlers

### subscribeToEvent(eventType, listener)

Subscribes to events of a specific type.

```typescript
subscribeToEvent(eventType: string, listener: (event: GameEvent) => void): () => void
```

**Parameters:**
- `eventType: string` - Type of event to listen for
- `listener: (event: GameEvent) => void` - Callback function

**Returns:** `() => void` - Unsubscribe function

**Example:**
```typescript
// Subscribe to player death events
const unsubscribe = world.subscribeToEvent('player-died', (event) => {
  console.log(`Player ${event.data.playerId} died with score ${event.data.score}`);

  // Trigger game over sequence
  world.emitEvent({
    type: 'game-over',
    data: { finalScore: event.data.score },
    timestamp: Date.now()
  });
});

// Later, unsubscribe
unsubscribe();
```

**Error Handling:**
- Listener exceptions are caught and logged, but don't stop other listeners
- Failed listeners don't affect event processing

### getEventBus()

Returns the internal event bus for advanced usage.

```typescript
getEventBus(): EventBus
```

**Returns:** `EventBus` - Direct access to the event bus

**Example:**
```typescript
const eventBus = world.getEventBus();

// Check for queued events
if (eventBus.hasQueuedEvents()) {
  console.log('Events pending processing');
}

// Clear event queue (advanced usage)
eventBus.clearQueue();
```

**Use Cases:**
- Advanced event debugging
- Custom event processing logic
- Integration with external event systems

## Performance & Introspection

### getComponentTypes()

Returns array of all registered component types.

```typescript
getComponentTypes(): string[]
```

**Returns:** `string[]` - Array of component type names

**Example:**
```typescript
console.log('Registered components:', world.getComponentTypes());
// Output: ["position", "velocity", "health", "sprite"]
```

### getArchetypeStats()

Returns statistics about entity archetypes for performance analysis.

```typescript
getArchetypeStats(): Array<{ archetype: string; entityCount: number }>
```

**Returns:** Array of archetype information

**Example:**
```typescript
const stats = world.getArchetypeStats();
stats.forEach(({ archetype, entityCount }) => {
  console.log(`${archetype}: ${entityCount} entities`);
});

// Output:
// "position,velocity": 5 entities
// "position,health": 3 entities
// "position,velocity,health": 12 entities
```

**Use Cases:**
- Performance optimization insights
- Understanding entity composition patterns
- Memory usage analysis

## Dirty Tracking (Performance Optimization)

### getDirtyEntities(componentType)

Returns entities that have been modified for a specific component type.

```typescript
getDirtyEntities(componentType: string): Set<number>
```

**Parameters:**
- `componentType: string` - Component type to check

**Returns:** `Set<number>` - Set of entity IDs marked as dirty

**Example:**
```typescript
// In a system that only needs to process changed entities
class RenderSystem extends BaseSystem {
  update(world: World): void {
    const dirtyEntities = world.getDirtyEntities('position');

    for (const entityId of dirtyEntities) {
      // Only re-render entities whose position changed
      this.renderEntity(world, entityId);
    }
  }
}
```

### getAllDirtyEntities()

Returns all entities that have been modified this frame.

```typescript
getAllDirtyEntities(): Set<number>
```

**Returns:** `Set<number>` - Set of all dirty entity IDs

### isEntityDirty(entityId)

Checks if a specific entity has been modified.

```typescript
isEntityDirty(entityId: number): boolean
```

**Parameters:**
- `entityId: number` - Entity ID to check

**Returns:** `boolean` - `true` if entity has been modified

### isComponentDirty(entityId, componentType)

Checks if a specific component on an entity has been modified.

```typescript
isComponentDirty(entityId: number, componentType: string): boolean
```

**Parameters:**
- `entityId: number` - Entity ID to check
- `componentType: string` - Component type to check

**Returns:** `boolean` - `true` if component has been modified

### markComponentDirty(entityId, componentType)

Manually marks a component as dirty.

```typescript
markComponentDirty(entityId: number, componentType: string): void
```

**Parameters:**
- `entityId: number` - Entity ID to mark
- `componentType: string` - Component type to mark

**Example:**
```typescript
// Manual dirty marking for external changes
const position = world.getComponent<PositionComponent>(entity, 'position');
if (position) {
  position.x = newX; // Direct modification
  position.y = newY;

  // Manually mark as dirty since we bypassed addComponent
  world.markComponentDirty(entity, 'position');
}
```

### getDirtyTrackingStats()

Returns statistics about dirty tracking performance.

```typescript
getDirtyTrackingStats(): {
  totalDirtyEntities: number;
  dirtyComponentTypes: number;
  averageDirtyPerType: number;
}
```

**Returns:** Object with dirty tracking statistics

**Example:**
```typescript
const stats = world.getDirtyTrackingStats();
console.log(`Dirty entities: ${stats.totalDirtyEntities}`);
console.log(`Dirty component types: ${stats.dirtyComponentTypes}`);
console.log(`Average dirty per type: ${stats.averageDirtyPerType.toFixed(2)}`);
```

## Performance Characteristics

### Time Complexity

- **Entity Creation/Destruction**: O(1) amortized
- **Component Add/Remove/Get**: O(1)
- **Single Component Query**: O(1) setup + O(n) iteration
- **Multi-Component Query**: O(1) archetype lookup + O(n) iteration
- **System Update**: O(s) where s is number of systems

### Memory Usage

- **Entities**: Minimal overhead (ID recycling)
- **Components**: Packed storage by type (cache-friendly)
- **Archetypes**: Automatic optimization based on component combinations
- **Events**: Temporary queue cleared each frame

### Scalability

The World is designed to handle:
- **100,000+ entities** efficiently
- **Hundreds of component types** with minimal overhead
- **Complex archetype combinations** with sub-microsecond queries
- **Real-time performance** at 60+ FPS

## Common Patterns

### Component Composition

```typescript
// Create a player entity with multiple components
function createPlayer(world: World, x: number, y: number): number {
  const player = world.createEntity();

  world.addComponent(player, { type: 'position', x, y });
  world.addComponent(player, { type: 'velocity', dx: 0, dy: 0 });
  world.addComponent(player, { type: 'health', current: 100, maximum: 100 });
  world.addComponent(player, { type: 'input', keys: new Set() });
  world.addComponent(player, { type: 'sprite', image: 'player.png' });

  return player;
}
```

### System Coordination

```typescript
// Systems communicating via events
class CollisionSystem extends BaseSystem {
  update(world: World): void {
    // Detect collision
    if (playerCollidesWithEnemy) {
      world.emitEvent({
        type: 'player-hit',
        data: { damage: 10, entityId: player },
        timestamp: Date.now()
      });
    }
  }
}

class HealthSystem extends BaseSystem {
  initialize(world: World): void {
    world.subscribeToEvent('player-hit', (event) => {
      const health = world.getComponent<HealthComponent>(event.data.entityId, 'health');
      if (health) {
        health.current -= event.data.damage;
      }
    });
  }
}
```

### Performance Optimization

```typescript
// Selective system updates using dirty tracking
class ExpensiveRenderSystem extends BaseSystem {
  update(world: World): void {
    // Only process entities that changed position or sprite
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
}
```

## See Also

- **[Entity Manager](./entity-manager.md)** - Entity lifecycle management
- **[Component Storage](./component.md)** - Component interfaces and storage
- **[System Architecture](./system.md)** - Creating and managing systems
- **[Query System](./query.md)** - Advanced entity querying
- **[Event System](../events/event-bus.md)** - Inter-system communication
- **[Performance Guide](../../guides/performance-optimization.md)** - Optimization strategies