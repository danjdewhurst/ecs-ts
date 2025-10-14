# DirtyTracker

The `DirtyTracker` manages component change detection for performance optimization in the ECS system. It tracks which entities have been modified, allowing systems to process only changed entities rather than iterating over all entities every frame.

## Overview

DirtyTracker provides:
- **Selective Updates**: Only process entities that have actually changed
- **Component-Level Tracking**: Track changes per component type
- **Performance Optimization**: Reduce unnecessary computations
- **Memory Efficiency**: Minimal overhead for tracking changes

## Quick Example

```typescript
import { DirtyTracker } from '@danjdewhurst/ecs-ts';

const tracker = new DirtyTracker();

// Mark entities as dirty when components change
tracker.markDirty(entityId, 'position');
tracker.markDirty(entityId, 'velocity');

// In systems, process only dirty entities
class MovementSystem extends BaseSystem {
  update(world: World): void {
    const dirtyPositions = tracker.getDirtyEntities('position');

    for (const entityId of dirtyPositions) {
      const position = world.getComponent(entityId, 'position');
      const velocity = world.getComponent(entityId, 'velocity');

      // Update position
      position.x += velocity.x;
      position.y += velocity.y;
    }

    // Clear tracking after processing
    tracker.clearDirtyComponent('position');
  }
}
```

## API Reference

### markDirty

```typescript
markDirty(entityId: number, componentType: string): void
```

Marks an entity's component as dirty (modified).

#### Parameters
- `entityId: number` - The entity that was modified
- `componentType: string` - The type of component that was modified

#### Example
```typescript
// Player moved
tracker.markDirty(playerId, 'position');

// Health changed
tracker.markDirty(enemyId, 'health');

// Multiple components changed
tracker.markDirty(bulletId, 'position');
tracker.markDirty(bulletId, 'velocity');
```

### getDirtyEntities

```typescript
getDirtyEntities(componentType: string): Set<number>
```

Gets all dirty entities for a specific component type.

#### Parameters
- `componentType: string` - The component type to check

#### Returns
`Set<number>` - Set of entity IDs that have dirty components of this type

#### Example
```typescript
// Get all entities with dirty position components
const dirtyPositions = tracker.getDirtyEntities('position');

// Process each dirty entity
for (const entityId of dirtyPositions) {
  updatePosition(entityId);
}

// Get entities with dirty health for UI updates
const dirtyHealth = tracker.getDirtyEntities('health');
for (const entityId of dirtyHealth) {
  updateHealthBar(entityId);
}
```

### getAllDirtyEntities

```typescript
getAllDirtyEntities(): Set<number>
```

Gets all dirty entities regardless of component type.

#### Returns
`Set<number>` - Set of all entity IDs that have any dirty components

#### Example
```typescript
// Get all entities that changed this frame
const allDirty = tracker.getAllDirtyEntities();

// Useful for broad operations like networking or serialization
for (const entityId of allDirty) {
  queueNetworkUpdate(entityId);
}

// Or for debugging
console.log(`${allDirty.size} entities changed this frame`);
```

### isEntityDirty

```typescript
isEntityDirty(entityId: number): boolean
```

Checks if a specific entity is dirty.

#### Parameters
- `entityId: number` - The entity to check

#### Returns
`boolean` - True if the entity has any dirty components

#### Example
```typescript
// Check before expensive operations
if (tracker.isEntityDirty(playerId)) {
  recalculatePlayerStats(playerId);
  updatePlayerUI(playerId);
}

// Conditional network updates
if (tracker.isEntityDirty(enemyId)) {
  broadcastEnemyUpdate(enemyId);
}
```

### isComponentDirty

```typescript
isComponentDirty(entityId: number, componentType: string): boolean
```

Checks if a specific entity has a dirty component of the given type.

#### Parameters
- `entityId: number` - The entity to check
- `componentType: string` - The component type to check

#### Returns
`boolean` - True if the entity has a dirty component of this type

#### Example
```typescript
// Specific component checks
if (tracker.isComponentDirty(playerId, 'health')) {
  updateHealthDisplay(playerId);
}

if (tracker.isComponentDirty(vehicleId, 'velocity')) {
  updateEngineSound(vehicleId);
}

// Avoid unnecessary work
if (!tracker.isComponentDirty(entityId, 'position')) {
  return; // Skip expensive position-based calculations
}
```

## Cleanup Operations

### clearDirty

```typescript
clearDirty(): void
```

Clears all dirty tracking state. Should be called after processing all dirty entities.

#### Example
```typescript
class GameLoop {
  update(): void {
    // Update all systems
    this.systemScheduler.update(this.world, this.deltaTime);

    // Clear all dirty state after frame processing
    this.dirtyTracker.clearDirty();
  }
}
```

### clearDirtyComponent

```typescript
clearDirtyComponent(componentType: string): void
```

Clears dirty state for a specific component type only.

#### Parameters
- `componentType: string` - The component type to clear

#### Example
```typescript
class RenderSystem extends BaseSystem {
  update(world: World): void {
    const dirtySprites = tracker.getDirtyEntities('sprite');

    for (const entityId of dirtySprites) {
      this.updateSpriteRender(entityId);
    }

    // Clear only sprite dirty state
    tracker.clearDirtyComponent('sprite');

    // Other component dirty states remain for other systems
  }
}
```

### clearDirtyEntity

```typescript
clearDirtyEntity(entityId: number): void
```

Clears dirty state for a specific entity across all component types.

#### Parameters
- `entityId: number` - The entity to clear

#### Example
```typescript
// Entity was processed completely
tracker.clearDirtyEntity(playerId);

// Or when entity is destroyed
world.onEntityDestroyed((entityId) => {
  tracker.clearDirtyEntity(entityId);
});
```

## Performance Statistics

### getStats

```typescript
getStats(): {
  totalDirtyEntities: number;
  dirtyComponentTypes: number;
  averageDirtyPerType: number;
}
```

Gets statistics about the current dirty state.

#### Returns
Object containing dirty tracking statistics

#### Example
```typescript
const stats = tracker.getStats();

console.log(`Dirty entities: ${stats.totalDirtyEntities}`);
console.log(`Dirty component types: ${stats.dirtyComponentTypes}`);
console.log(`Average dirty per type: ${stats.averageDirtyPerType.toFixed(2)}`);

// Performance monitoring
if (stats.totalDirtyEntities > 1000) {
  console.warn('High number of dirty entities may impact performance');
}
```

## Usage Patterns

### System Integration

```typescript
class PhysicsSystem extends BaseSystem {
  readonly name = 'PhysicsSystem';
  readonly priority = 1;

  constructor(private tracker: DirtyTracker) {
    super();
  }

  update(world: World, deltaTime: number): void {
    // Only process entities with dirty physics components
    const dirtyBodies = this.tracker.getDirtyEntities('rigidbody');

    for (const entityId of dirtyBodies) {
      const body = world.getComponent(entityId, 'rigidbody');
      const transform = world.getComponent(entityId, 'transform');

      // Apply physics
      this.updatePhysics(body, transform, deltaTime);

      // Mark transform as dirty if physics changed it
      if (this.physicsChangedTransform(body)) {
        this.tracker.markDirty(entityId, 'transform');
      }
    }

    // Clear physics dirty state
    this.tracker.clearDirtyComponent('rigidbody');
  }
}
```

### Cascading Updates

```typescript
class TransformSystem extends BaseSystem {
  update(world: World): void {
    const dirtyTransforms = this.tracker.getDirtyEntities('transform');

    for (const entityId of dirtyTransforms) {
      const transform = world.getComponent(entityId, 'transform');

      // Update world matrix
      this.updateWorldMatrix(transform);

      // Mark dependent components as dirty
      if (world.hasComponent(entityId, 'sprite')) {
        this.tracker.markDirty(entityId, 'sprite');
      }

      if (world.hasComponent(entityId, 'collider')) {
        this.tracker.markDirty(entityId, 'collider');
      }
    }

    this.tracker.clearDirtyComponent('transform');
  }
}
```

### Conditional Processing

```typescript
class AISystem extends BaseSystem {
  update(world: World): void {
    const aiEntities = world.getEntitiesWithComponent('ai');

    for (const entityId of aiEntities) {
      // Only recalculate AI if relevant components changed
      const needsUpdate =
        this.tracker.isComponentDirty(entityId, 'position') ||
        this.tracker.isComponentDirty(entityId, 'health') ||
        this.tracker.isComponentDirty(entityId, 'target');

      if (needsUpdate) {
        this.updateAI(entityId, world);
        this.tracker.markDirty(entityId, 'ai');
      }
    }

    // Clear AI tracking
    this.tracker.clearDirtyComponent('ai');
  }
}
```

### Network Synchronization

```typescript
class NetworkSystem extends BaseSystem {
  private lastSyncTime = 0;
  private syncInterval = 50; // 20fps sync rate

  update(world: World, deltaTime: number): void {
    this.lastSyncTime += deltaTime;

    if (this.lastSyncTime >= this.syncInterval) {
      this.syncChangesToClients(world);
      this.lastSyncTime = 0;
    }
  }

  private syncChangesToClients(world: World): void {
    const allDirty = this.tracker.getAllDirtyEntities();

    if (allDirty.size === 0) return; // Nothing to sync

    const updates: NetworkUpdate[] = [];

    for (const entityId of allDirty) {
      const update: NetworkUpdate = {
        entityId,
        components: {}
      };

      // Only include dirty components in the update
      for (const componentType of ['position', 'health', 'sprite']) {
        if (this.tracker.isComponentDirty(entityId, componentType)) {
          const component = world.getComponent(entityId, componentType);
          if (component) {
            update.components[componentType] = component;
          }
        }
      }

      updates.push(update);
    }

    // Send to clients
    this.broadcastUpdates(updates);

    // Clear dirty state after sync
    this.tracker.clearDirty();
  }
}
```

## Performance Optimization

### Batched Marking

```typescript
class BatchedDirtyTracker extends DirtyTracker {
  private pendingMarks: Array<{ entityId: number; componentType: string }> = [];
  private batchTimer: Timer | null = null;

  markDirty(entityId: number, componentType: string): void {
    this.pendingMarks.push({ entityId, componentType });

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), 0);
    }
  }

  private flushBatch(): void {
    for (const { entityId, componentType } of this.pendingMarks) {
      super.markDirty(entityId, componentType);
    }

    this.pendingMarks = [];
    this.batchTimer = null;
  }
}
```

### Memory-Efficient Tracking

```typescript
class CompactDirtyTracker {
  private dirtyBitmap = new Map<string, Uint32Array>();
  private maxEntityId = 0;

  markDirty(entityId: number, componentType: string): void {
    if (entityId > this.maxEntityId) {
      this.expandBitmaps(entityId);
    }

    if (!this.dirtyBitmap.has(componentType)) {
      this.dirtyBitmap.set(componentType, new Uint32Array(Math.ceil(this.maxEntityId / 32)));
    }

    const bitmap = this.dirtyBitmap.get(componentType)!;
    const wordIndex = Math.floor(entityId / 32);
    const bitIndex = entityId % 32;

    bitmap[wordIndex] |= (1 << bitIndex);
  }

  getDirtyEntities(componentType: string): Set<number> {
    const dirtySet = new Set<number>();
    const bitmap = this.dirtyBitmap.get(componentType);

    if (!bitmap) return dirtySet;

    for (let wordIndex = 0; wordIndex < bitmap.length; wordIndex++) {
      const word = bitmap[wordIndex];
      if (word === 0) continue;

      for (let bitIndex = 0; bitIndex < 32; bitIndex++) {
        if (word & (1 << bitIndex)) {
          dirtySet.add(wordIndex * 32 + bitIndex);
        }
      }
    }

    return dirtySet;
  }
}
```

## Testing

### Mock DirtyTracker

```typescript
class MockDirtyTracker extends DirtyTracker {
  private markHistory: Array<{ entityId: number; componentType: string; timestamp: number }> = [];

  markDirty(entityId: number, componentType: string): void {
    super.markDirty(entityId, componentType);
    this.markHistory.push({ entityId, componentType, timestamp: Date.now() });
  }

  getMarkHistory(): Array<{ entityId: number; componentType: string; timestamp: number }> {
    return [...this.markHistory];
  }

  clearHistory(): void {
    this.markHistory = [];
  }
}
```

### DirtyTracker Testing

```typescript
describe('DirtyTracker', () => {
  let tracker: DirtyTracker;

  beforeEach(() => {
    tracker = new DirtyTracker();
  });

  test('should track dirty entities by component type', () => {
    tracker.markDirty(1, 'position');
    tracker.markDirty(2, 'position');
    tracker.markDirty(1, 'health');

    const dirtyPositions = tracker.getDirtyEntities('position');
    const dirtyHealth = tracker.getDirtyEntities('health');

    expect(dirtyPositions.has(1)).toBe(true);
    expect(dirtyPositions.has(2)).toBe(true);
    expect(dirtyHealth.has(1)).toBe(true);
    expect(dirtyHealth.has(2)).toBe(false);
  });

  test('should clear dirty state correctly', () => {
    tracker.markDirty(1, 'position');
    tracker.markDirty(1, 'health');

    expect(tracker.isEntityDirty(1)).toBe(true);

    tracker.clearDirtyComponent('position');
    expect(tracker.isComponentDirty(1, 'position')).toBe(false);
    expect(tracker.isComponentDirty(1, 'health')).toBe(true);
    expect(tracker.isEntityDirty(1)).toBe(true);

    tracker.clearDirtyComponent('health');
    expect(tracker.isEntityDirty(1)).toBe(false);
  });

  test('should provide accurate statistics', () => {
    tracker.markDirty(1, 'position');
    tracker.markDirty(2, 'position');
    tracker.markDirty(1, 'health');

    const stats = tracker.getStats();
    expect(stats.totalDirtyEntities).toBe(2);
    expect(stats.dirtyComponentTypes).toBe(2);
    expect(stats.averageDirtyPerType).toBe(1.5); // (2 + 1) / 2
  });
});
```

## Performance Notes

- **Memory Usage**: Minimal overhead - uses Sets for efficient storage
- **Time Complexity**: O(1) for marking dirty, O(n) for getting dirty entities where n = number of dirty entities
- **Cache Efficiency**: Accessing only dirty entities improves CPU cache performance
- **Network Optimization**: Only sync entities that actually changed
- **Scalability**: Performance remains consistent regardless of total entity count

## Integration with World

```typescript
class World {
  private dirtyTracker = new DirtyTracker();

  addComponent<T extends Component>(entityId: number, component: T): void {
    // Add component logic...

    // Mark as dirty when component is added
    this.dirtyTracker.markDirty(entityId, component.type);
  }

  updateComponent<T extends Component>(entityId: number, componentType: string, updates: Partial<T>): void {
    // Update component logic...

    // Mark as dirty when component is updated
    this.dirtyTracker.markDirty(entityId, componentType);
  }

  getDirtyTracker(): DirtyTracker {
    return this.dirtyTracker;
  }

  update(deltaTime: number): void {
    // Update systems
    this.systemScheduler.update(this, deltaTime);

    // Clear dirty tracking after frame
    this.dirtyTracker.clearDirty();
  }
}
```

## See Also

- [ObjectPool](./object-pool.md) - Memory optimization through object reuse
- [System](../core/system.md) - System implementation patterns
- [World](../core/world.md) - ECS World integration