# EntityManager API Reference

The EntityManager handles entity lifecycle management with efficient ID allocation, recycling, and tracking. It's optimized for high-performance games that create and destroy many entities.

## Overview

The EntityManager provides:

- **ID Generation**: Unique entity identifier allocation
- **ID Recycling**: Memory-efficient reuse of destroyed entity IDs
- **Lifecycle Tracking**: Maintains set of living entities
- **Bulk Operations**: Efficient queries for entity status

Entity IDs start from 1 and are recycled when entities are destroyed, ensuring optimal memory usage in long-running games.

## Quick Example

```typescript
import { EntityManager } from '@danjdewhurst/ecs-ts';

const entityManager = new EntityManager();

// Create entities
const player = entityManager.createEntity();    // 1
const enemy = entityManager.createEntity();     // 2
const bullet = entityManager.createEntity();    // 3

// Destroy and recycle
entityManager.destroyEntity(enemy);             // ID 2 goes into recycling
const newEntity = entityManager.createEntity(); // Reuses ID 2

console.log(entityManager.getEntityCount());    // 3 (player, bullet, newEntity)
```

## Constructor

### EntityManager()

Creates a new EntityManager with empty state.

```typescript
const entityManager = new EntityManager();
```

**Initial State:**
- Next ID starts at 1
- No recycled IDs
- Empty living entities set

## Entity Lifecycle

### createEntity()

Creates a new entity and returns its unique identifier.

```typescript
createEntity(): number
```

**Returns:** `number` - Unique entity ID

**Example:**
```typescript
const entityManager = new EntityManager();

const entity1 = entityManager.createEntity();  // Returns 1
const entity2 = entityManager.createEntity();  // Returns 2
const entity3 = entityManager.createEntity();  // Returns 3

console.log(`Created entities: ${entity1}, ${entity2}, ${entity3}`);
// Output: "Created entities: 1, 2, 3"
```

**ID Allocation Strategy:**
1. **Recycled IDs First**: Uses destroyed entity IDs when available
2. **Sequential Allocation**: Generates new IDs incrementally when no recycled IDs exist
3. **LIFO Recycling**: Most recently destroyed ID is reused first (stack behavior)

**Example with Recycling:**
```typescript
const a = entityManager.createEntity();  // 1
const b = entityManager.createEntity();  // 2
const c = entityManager.createEntity();  // 3

entityManager.destroyEntity(b);          // ID 2 → recycling stack
entityManager.destroyEntity(c);          // ID 3 → recycling stack

const d = entityManager.createEntity();  // Reuses 3 (LIFO)
const e = entityManager.createEntity();  // Reuses 2
const f = entityManager.createEntity();  // New ID: 4
```

**Performance Notes:**
- O(1) amortized time complexity
- Memory efficient with ID recycling
- No gaps in active entity IDs over long runtime

### destroyEntity(entityId)

Destroys an entity and makes its ID available for recycling.

```typescript
destroyEntity(entityId: number): void
```

**Parameters:**
- `entityId: number` - Entity ID to destroy

**Example:**
```typescript
const entity = entityManager.createEntity();
console.log(entityManager.isEntityAlive(entity)); // true

entityManager.destroyEntity(entity);
console.log(entityManager.isEntityAlive(entity)); // false
```

**Behavior:**
- Removes entity from living entities set
- Adds ID to recycling stack for reuse
- Safe to call on already destroyed entities (no-op)
- Safe to call on invalid entity IDs (no-op)

**Performance Notes:**
- O(1) operation
- Memory usage decreases immediately
- ID becomes available for immediate reuse

## Entity Status

### isEntityAlive(entityId)

Checks if an entity ID is currently alive.

```typescript
isEntityAlive(entityId: number): boolean
```

**Parameters:**
- `entityId: number` - Entity ID to check

**Returns:** `boolean` - `true` if entity exists and is alive

**Example:**
```typescript
const entity = entityManager.createEntity();

console.log(entityManager.isEntityAlive(entity));  // true
console.log(entityManager.isEntityAlive(999));     // false (never created)

entityManager.destroyEntity(entity);
console.log(entityManager.isEntityAlive(entity));  // false (destroyed)
```

**Use Cases:**
- Validating entity references before operations
- System logic for entity existence checks
- Debugging entity lifecycle issues

**Performance Notes:**
- O(1) lookup using Set data structure
- Extremely fast for frequent entity validation

### getLivingEntities()

Returns a new Set containing all living entity IDs.

```typescript
getLivingEntities(): Set<number>
```

**Returns:** `Set<number>` - New Set containing living entity IDs

**Example:**
```typescript
const entity1 = entityManager.createEntity();
const entity2 = entityManager.createEntity();
const entity3 = entityManager.createEntity();

entityManager.destroyEntity(entity2);

const living = entityManager.getLivingEntities();
console.log(Array.from(living)); // [1, 3]

// Returned set is a copy - safe to modify
living.add(999);
console.log(entityManager.isEntityAlive(999)); // false (original unchanged)
```

**Important Notes:**
- Returns a **copy** of the internal set for safety
- Modifications to returned set don't affect EntityManager
- Snapshot of living entities at time of call

**Use Cases:**
- Bulk entity processing
- Debugging and introspection
- Save/load game state
- Entity migration between worlds

### getEntityCount()

Returns the number of currently living entities.

```typescript
getEntityCount(): number
```

**Returns:** `number` - Count of living entities

**Example:**
```typescript
console.log(entityManager.getEntityCount()); // 0

const entity1 = entityManager.createEntity();
const entity2 = entityManager.createEntity();
console.log(entityManager.getEntityCount()); // 2

entityManager.destroyEntity(entity1);
console.log(entityManager.getEntityCount()); // 1
```

**Use Cases:**
- Performance monitoring
- Memory usage tracking
- Game statistics
- Debug displays

## Memory Management

### ID Recycling Strategy

The EntityManager implements a sophisticated ID recycling strategy:

```typescript
// Example demonstrating recycling behavior
const entityManager = new EntityManager();

// Create initial entities
const entities = [];
for (let i = 0; i < 5; i++) {
  entities.push(entityManager.createEntity());
}
console.log(entities); // [1, 2, 3, 4, 5]

// Destroy some entities (IDs go to recycling stack)
entityManager.destroyEntity(3); // Stack: [3]
entityManager.destroyEntity(5); // Stack: [3, 5]
entityManager.destroyEntity(2); // Stack: [3, 5, 2]

// Create new entities (reuses recycled IDs in LIFO order)
const newEntity1 = entityManager.createEntity(); // Reuses 2
const newEntity2 = entityManager.createEntity(); // Reuses 5
const newEntity3 = entityManager.createEntity(); // Reuses 3
const newEntity4 = entityManager.createEntity(); // New ID: 6

console.log([newEntity1, newEntity2, newEntity3, newEntity4]); // [2, 5, 3, 6]
```

**Benefits:**
- **Memory Efficiency**: No entity ID inflation over time
- **Cache Locality**: Recently used IDs are reused first
- **Predictable Performance**: O(1) allocation regardless of game duration

### Long-Running Game Optimization

```typescript
class GameWorld {
  private entityManager = new EntityManager();
  private maxEntities = 10000;

  createBullet(): number {
    // Bullets are frequently created/destroyed
    // ID recycling prevents ID growth
    return this.entityManager.createEntity();
  }

  update(): void {
    // Clean up old bullets - IDs get recycled immediately
    this.oldBullets.forEach(bullet => {
      this.entityManager.destroyEntity(bullet);
    });

    // Entity count stays bounded despite millions of bullets over time
    console.log(`Living entities: ${this.entityManager.getEntityCount()}/${this.maxEntities}`);
  }
}
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `createEntity()` | O(1) amortized | Array pop for recycled IDs |
| `destroyEntity()` | O(1) | Set deletion + array push |
| `isEntityAlive()` | O(1) | Set lookup |
| `getLivingEntities()` | O(n) | Set copy where n = living entities |
| `getEntityCount()` | O(1) | Set size property |

### Memory Usage

- **Per Entity**: ~8 bytes (Set entry + possible recycling stack entry)
- **Base Overhead**: ~100 bytes (Set structure + recycling array)
- **Growth**: Linear with peak living entities, not total created

### Scalability Benchmarks

Typical performance on modern hardware:

- **Creation Rate**: 1M+ entities/second
- **Destruction Rate**: 1M+ entities/second
- **Lookup Rate**: 10M+ lookups/second
- **Memory Overhead**: <1KB for 10,000 active entities

## Common Patterns

### Bulk Entity Operations

```typescript
class BulkEntityProcessor {
  private entityManager = new EntityManager();

  createEntityBatch(count: number): number[] {
    const entities: number[] = [];
    for (let i = 0; i < count; i++) {
      entities.push(this.entityManager.createEntity());
    }
    return entities;
  }

  destroyEntityBatch(entities: number[]): void {
    entities.forEach(id => this.entityManager.destroyEntity(id));
  }

  validateEntities(entities: number[]): number[] {
    return entities.filter(id => this.entityManager.isEntityAlive(id));
  }
}
```

### Entity Pool Management

```typescript
class EntityPool {
  private entityManager = new EntityManager();
  private pooledEntities: number[] = [];
  private maxPoolSize = 1000;

  acquire(): number {
    if (this.pooledEntities.length > 0) {
      return this.pooledEntities.pop()!;
    }
    return this.entityManager.createEntity();
  }

  release(entityId: number): void {
    if (this.pooledEntities.length < this.maxPoolSize) {
      this.pooledEntities.push(entityId);
    } else {
      this.entityManager.destroyEntity(entityId);
    }
  }
}
```

### Safe Entity References

```typescript
class SafeEntityReference {
  constructor(
    private entityManager: EntityManager,
    private entityId: number
  ) {}

  isValid(): boolean {
    return this.entityManager.isEntityAlive(this.entityId);
  }

  getId(): number | null {
    return this.isValid() ? this.entityId : null;
  }

  execute(callback: (id: number) => void): boolean {
    if (this.isValid()) {
      callback(this.entityId);
      return true;
    }
    return false;
  }
}

// Usage
const player = entityManager.createEntity();
const playerRef = new SafeEntityReference(entityManager, player);

// Safe execution
playerRef.execute(id => {
  console.log(`Processing player ${id}`);
});
```

## Integration with World

The EntityManager is typically used internally by the World class:

```typescript
import { World } from '@danjdewhurst/ecs-ts';

const world = new World();

// World uses EntityManager internally
const entity = world.createEntity();       // Delegates to EntityManager
world.destroyEntity(entity);               // Delegates to EntityManager
console.log(world.getEntityCount());       // Delegates to EntityManager

// Direct access not typically needed, but available if required
```

## Debugging and Introspection

### Entity Lifecycle Debugging

```typescript
class DebuggingEntityManager extends EntityManager {
  createEntity(): number {
    const id = super.createEntity();
    console.log(`Created entity ${id}, total: ${this.getEntityCount()}`);
    return id;
  }

  destroyEntity(entityId: number): void {
    const wasAlive = this.isEntityAlive(entityId);
    super.destroyEntity(entityId);

    if (wasAlive) {
      console.log(`Destroyed entity ${entityId}, remaining: ${this.getEntityCount()}`);
    } else {
      console.warn(`Attempted to destroy non-existent entity ${entityId}`);
    }
  }
}
```

### Memory Usage Monitoring

```typescript
function analyzeEntityMemory(entityManager: EntityManager): void {
  const count = entityManager.getEntityCount();
  const estimated = count * 8; // Rough estimate

  console.log(`Living entities: ${count}`);
  console.log(`Estimated memory: ${estimated} bytes`);
  console.log(`Living entities:`, Array.from(entityManager.getLivingEntities()));
}
```

## Error Handling

The EntityManager is designed to be robust:

```typescript
const entityManager = new EntityManager();

// Safe operations that don't throw
entityManager.destroyEntity(999);           // No error (non-existent entity)
entityManager.destroyEntity(-1);            // No error (invalid ID)
console.log(entityManager.isEntityAlive(0)); // false (ID 0 never created)

// All operations are safe for any number input
const results = [-1, 0, 1, 999, NaN, Infinity].map(id => ({
  id,
  alive: entityManager.isEntityAlive(id)
}));
console.log(results);
```

## See Also

- **[World API](./world.md)** - Higher-level entity management through World
- **[Component Storage](./component.md)** - How components are associated with entities
- **[System Architecture](./system.md)** - How systems process entities
- **[Performance Guide](../../guides/performance-optimization.md)** - Optimizing entity usage
- **[Memory Management](../../advanced/memory-management.md)** - Advanced memory strategies