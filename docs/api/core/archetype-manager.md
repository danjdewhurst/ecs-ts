# ArchetypeManager API Reference

The ArchetypeManager provides high-performance entity storage and querying through archetype-based organization. It groups entities by their component combinations for optimal cache locality and query performance.

## Overview

The ArchetypeManager optimizes ECS performance by:

- **Archetype-Based Storage**: Groups entities by component combinations
- **Fast Queries**: O(1) archetype lookup for multi-component queries
- **Cache Locality**: Entities with similar components stored together
- **Automatic Management**: Transparent archetype updates when components change
- **Memory Efficiency**: Automatic cleanup of empty archetypes

An **archetype** represents a unique combination of component types. Entities with the same set of components share the same archetype, enabling extremely efficient bulk operations.

## Core Concepts

### What is an Archetype?

An archetype is a unique signature representing a combination of component types:

```typescript
// These entities have the same archetype: "position|velocity"
const player = world.createEntity();
world.addComponent(player, { type: 'position', x: 0, y: 0 });
world.addComponent(player, { type: 'velocity', dx: 1, dy: 1 });

const enemy = world.createEntity();
world.addComponent(enemy, { type: 'position', x: 100, y: 100 });
world.addComponent(enemy, { type: 'velocity', dx: -1, dy: 0 });

// Different archetype: "position|health"
const npc = world.createEntity();
world.addComponent(npc, { type: 'position', x: 50, y: 50 });
world.addComponent(npc, { type: 'health', current: 100, maximum: 100 });
```

### Archetype String Format

Archetypes are represented as sorted, pipe-separated component type strings:

```typescript
// Component combination ["velocity", "position"] becomes archetype "position|velocity"
// Component combination ["health", "position", "sprite"] becomes "health|position|sprite"
// Always sorted alphabetically for consistency
```

## Quick Example

```typescript
import { ArchetypeManager } from '@danjdewhurst/ecs-ts';

const archetypeManager = new ArchetypeManager();

// Update entity archetype when components change
archetypeManager.updateEntityArchetype(1, ['position', 'velocity']);
archetypeManager.updateEntityArchetype(2, ['position', 'velocity']);
archetypeManager.updateEntityArchetype(3, ['position', 'health']);

// Query entities by component requirements
const movingEntities = archetypeManager.queryEntities(['position', 'velocity']);
console.log(movingEntities); // [1, 2]

// View archetype statistics
const stats = archetypeManager.getArchetypeStats();
console.log(stats);
// [
//   { archetype: "position|velocity", entityCount: 2 },
//   { archetype: "health|position", entityCount: 1 }
// ]
```

## Constructor

### ArchetypeManager()

Creates a new ArchetypeManager with empty state.

```typescript
const archetypeManager = new ArchetypeManager();
```

**Initial State:**
- Empty archetype storage
- No entity-to-archetype mappings

## Entity Management

### updateEntityArchetype(entityId, componentTypes)

Updates an entity's archetype based on its current component types.

```typescript
updateEntityArchetype(entityId: number, componentTypes: string[]): void
```

**Parameters:**
- `entityId: number` - Entity to update
- `componentTypes: string[]` - Current component types for this entity

**Example:**
```typescript
const archetypeManager = new ArchetypeManager();

// Entity starts with no components
archetypeManager.updateEntityArchetype(1, []);

// Add position component
archetypeManager.updateEntityArchetype(1, ['position']);

// Add velocity component (entity moves to "position|velocity" archetype)
archetypeManager.updateEntityArchetype(1, ['position', 'velocity']);

// Remove position (entity moves to "velocity" archetype)
archetypeManager.updateEntityArchetype(1, ['velocity']);

// Remove all components (entity removed from all archetypes)
archetypeManager.updateEntityArchetype(1, []);
```

**Behavior:**
- Removes entity from old archetype (if any)
- Adds entity to new archetype
- Creates new archetype if it doesn't exist
- Automatically cleans up empty archetypes
- Component types are automatically sorted for consistency

**Performance Notes:**
- O(k log k) where k is number of component types (due to sorting)
- Very fast archetype lookup and storage operations
- Automatic memory management for empty archetypes

### removeEntity(entityId)

Removes an entity from its archetype.

```typescript
removeEntity(entityId: number): void
```

**Parameters:**
- `entityId: number` - Entity to remove

**Example:**
```typescript
archetypeManager.updateEntityArchetype(1, ['position', 'velocity']);
archetypeManager.updateEntityArchetype(2, ['position', 'velocity']);

console.log(archetypeManager.queryEntities(['position', 'velocity'])); // [1, 2]

archetypeManager.removeEntity(1);

console.log(archetypeManager.queryEntities(['position', 'velocity'])); // [2]
```

**Behavior:**
- Removes entity from its current archetype
- Cleans up archetype if it becomes empty
- Safe to call on entities not in any archetype
- Safe to call multiple times on same entity

### getEntityArchetype(entityId)

Returns the archetype string for an entity.

```typescript
getEntityArchetype(entityId: number): string | undefined
```

**Parameters:**
- `entityId: number` - Entity to query

**Returns:** `string | undefined` - Archetype string or undefined if entity has no components

**Example:**
```typescript
archetypeManager.updateEntityArchetype(1, ['position', 'velocity', 'health']);

const archetype = archetypeManager.getEntityArchetype(1);
console.log(archetype); // "health|position|velocity"

const missing = archetypeManager.getEntityArchetype(999);
console.log(missing); // undefined
```

## Querying

### queryEntities(requiredComponents)

Finds all entities that have all specified component types.

```typescript
queryEntities(requiredComponents: string[]): number[]
```

**Parameters:**
- `requiredComponents: string[]` - Component types that entities must have

**Returns:** `number[]` - Array of entity IDs matching the requirements

**Example:**
```typescript
// Setup entities with different component combinations
archetypeManager.updateEntityArchetype(1, ['position', 'velocity']);
archetypeManager.updateEntityArchetype(2, ['position', 'velocity', 'health']);
archetypeManager.updateEntityArchetype(3, ['position', 'health']);
archetypeManager.updateEntityArchetype(4, ['velocity']);

// Query examples
const withPosition = archetypeManager.queryEntities(['position']);
console.log(withPosition); // [1, 2, 3]

const withVelocity = archetypeManager.queryEntities(['velocity']);
console.log(withVelocity); // [1, 2, 4]

const movingEntities = archetypeManager.queryEntities(['position', 'velocity']);
console.log(movingEntities); // [1, 2]

const healthyMovingEntities = archetypeManager.queryEntities(['position', 'velocity', 'health']);
console.log(healthyMovingEntities); // [2]

const emptyQuery = archetypeManager.queryEntities([]);
console.log(emptyQuery); // []
```

**Query Logic:**
- Returns entities that have **all** specified components (AND logic)
- Entities can have additional components beyond those required
- Empty component array returns empty result
- Order of required components doesn't matter

**Performance Characteristics:**
- O(a × c) where a = number of archetypes, c = average components per archetype
- Typically very fast due to limited number of unique archetypes
- Much faster than iterating all entities and checking components individually

## Introspection

### getArchetypeStats()

Returns statistics about all current archetypes.

```typescript
getArchetypeStats(): Array<{ archetype: string; entityCount: number }>
```

**Returns:** Array of objects containing archetype information

**Example:**
```typescript
// Setup some entities
archetypeManager.updateEntityArchetype(1, ['position', 'velocity']);
archetypeManager.updateEntityArchetype(2, ['position', 'velocity']);
archetypeManager.updateEntityArchetype(3, ['position', 'health']);
archetypeManager.updateEntityArchetype(4, ['sprite', 'position']);
archetypeManager.updateEntityArchetype(5, ['position']);

const stats = archetypeManager.getArchetypeStats();
console.log(stats);
// [
//   { archetype: "position|velocity", entityCount: 2 },
//   { archetype: "health|position", entityCount: 1 },
//   { archetype: "position|sprite", entityCount: 1 },
//   { archetype: "position", entityCount: 1 }
// ]
```

**Use Cases:**
- Performance analysis and optimization
- Understanding entity composition patterns
- Memory usage estimation
- Debugging archetype-related issues

## Performance Optimization

### Archetype Distribution Analysis

Understanding your archetype distribution helps optimize performance:

```typescript
function analyzeArchetypeDistribution(archetypeManager: ArchetypeManager): void {
  const stats = archetypeManager.getArchetypeStats();

  // Sort by entity count (most populated first)
  stats.sort((a, b) => b.entityCount - a.entityCount);

  console.log('Archetype Distribution:');
  stats.forEach(({ archetype, entityCount }) => {
    const componentCount = archetype.split('|').length;
    console.log(`  ${archetype}: ${entityCount} entities (${componentCount} components)`);
  });

  // Identify potential optimization opportunities
  const singletonArchetypes = stats.filter(s => s.entityCount === 1);
  if (singletonArchetypes.length > 0) {
    console.log(`Warning: ${singletonArchetypes.length} singleton archetypes found`);
    console.log('Consider if these entity compositions are necessary');
  }

  const totalArchetypes = stats.length;
  const totalEntities = stats.reduce((sum, s) => sum + s.entityCount, 0);
  const avgEntitiesPerArchetype = totalEntities / totalArchetypes;

  console.log(`Total: ${totalEntities} entities across ${totalArchetypes} archetypes`);
  console.log(`Average: ${avgEntitiesPerArchetype.toFixed(1)} entities per archetype`);
}
```

### Optimal Component Combinations

Design component combinations for good archetype distribution:

```typescript
// ✅ Good: Common combinations that group entities effectively
interface PlayerArchetype {
  // Common player entities: "health|input|position|sprite|velocity"
  position: PositionComponent;
  velocity: VelocityComponent;
  health: HealthComponent;
  sprite: SpriteComponent;
  input: InputComponent;
}

interface EnemyArchetype {
  // Common enemy entities: "ai|health|position|sprite|velocity"
  position: PositionComponent;
  velocity: VelocityComponent;
  health: HealthComponent;
  sprite: SpriteComponent;
  ai: AIComponent;
}

interface ProjectileArchetype {
  // Simple projectiles: "position|velocity|projectile"
  position: PositionComponent;
  velocity: VelocityComponent;
  projectile: ProjectileComponent;
}

// ❌ Avoid: Too many unique component combinations
// This creates many singleton archetypes with poor cache locality
function createUniqueSnowflakeEntity(id: number): void {
  const components = [`position`, `velocity`, `unique-${id}`];
  archetypeManager.updateEntityArchetype(id, components);
  // Results in archetype "position|unique-1|velocity" with 1 entity
  // Creates poor cache locality and memory fragmentation
}
```

### Query Optimization Patterns

```typescript
class OptimizedSystem extends BaseSystem {
  private cachedMovingEntities: number[] = [];
  private lastEntityCount = 0;

  update(world: World, deltaTime: number): void {
    // Cache query results when entity count is stable
    const currentEntityCount = world.getEntityCount();

    if (currentEntityCount !== this.lastEntityCount) {
      this.cachedMovingEntities = this.queryEntities(world, 'position', 'velocity');
      this.lastEntityCount = currentEntityCount;
    }

    // Use cached results for better performance
    for (const entityId of this.cachedMovingEntities) {
      this.processMovingEntity(world, entityId, deltaTime);
    }
  }

  private processMovingEntity(world: World, entityId: number, deltaTime: number): void {
    // Process entity logic
  }
}
```

## Integration with World

The ArchetypeManager is typically used internally by the World class:

```typescript
// World automatically manages archetypes
const world = new World();

const entity = world.createEntity();
// ArchetypeManager.updateEntityArchetype(entity, [])

world.addComponent(entity, { type: 'position', x: 0, y: 0 });
// ArchetypeManager.updateEntityArchetype(entity, ['position'])

world.addComponent(entity, { type: 'velocity', dx: 1, dy: 1 });
// ArchetypeManager.updateEntityArchetype(entity, ['position', 'velocity'])

const movingEntities = world.queryMultiple(['position', 'velocity']);
// ArchetypeManager.queryEntities(['position', 'velocity'])
```

## Debugging and Monitoring

### Archetype Change Tracking

```typescript
class DebuggingArchetypeManager extends ArchetypeManager {
  updateEntityArchetype(entityId: number, componentTypes: string[]): void {
    const oldArchetype = this.getEntityArchetype(entityId);
    const newArchetype = componentTypes.length > 0 ?
      componentTypes.sort().join('|') : undefined;

    if (oldArchetype !== newArchetype) {
      console.log(`Entity ${entityId}: ${oldArchetype || 'none'} → ${newArchetype || 'none'}`);
    }

    super.updateEntityArchetype(entityId, componentTypes);
  }

  queryEntities(requiredComponents: string[]): number[] {
    const startTime = performance.now();
    const result = super.queryEntities(requiredComponents);
    const endTime = performance.now();

    console.log(`Query [${requiredComponents.join(', ')}]: ${result.length} entities (${(endTime - startTime).toFixed(2)}ms)`);

    return result;
  }
}
```

### Memory Usage Analysis

```typescript
function analyzeArchetypeMemory(archetypeManager: ArchetypeManager): void {
  const stats = archetypeManager.getArchetypeStats();

  let totalEntities = 0;
  let totalArchetypes = stats.length;
  let estimatedMemory = 0;

  stats.forEach(({ archetype, entityCount }) => {
    totalEntities += entityCount;

    // Rough memory estimation
    const componentCount = archetype.split('|').length;
    const archetypeOverhead = 100; // bytes per archetype
    const entitySetOverhead = entityCount * 8; // bytes per entity in Set
    const stringKeyOverhead = archetype.length * 2; // UTF-16 string

    estimatedMemory += archetypeOverhead + entitySetOverhead + stringKeyOverhead;
  });

  console.log('Archetype Memory Analysis:');
  console.log(`  Total entities: ${totalEntities}`);
  console.log(`  Total archetypes: ${totalArchetypes}`);
  console.log(`  Estimated memory: ${estimatedMemory} bytes (${(estimatedMemory / 1024).toFixed(1)} KB)`);
  console.log(`  Average entities per archetype: ${(totalEntities / totalArchetypes).toFixed(1)}`);
  console.log(`  Memory per entity: ${(estimatedMemory / totalEntities).toFixed(1)} bytes`);
}
```

## Error Handling

The ArchetypeManager is designed to be robust and handle edge cases gracefully:

```typescript
const archetypeManager = new ArchetypeManager();

// Safe operations that don't throw
archetypeManager.removeEntity(999);               // Safe (non-existent entity)
archetypeManager.updateEntityArchetype(1, []);    // Safe (empty components)
archetypeManager.queryEntities([]);               // Returns [] (empty query)

// Component types are automatically sorted and normalized
archetypeManager.updateEntityArchetype(1, ['velocity', 'position', 'health']);
archetypeManager.updateEntityArchetype(2, ['health', 'position', 'velocity']);
// Both entities get same archetype: "health|position|velocity"

console.log(archetypeManager.getEntityArchetype(1)); // "health|position|velocity"
console.log(archetypeManager.getEntityArchetype(2)); // "health|position|velocity"
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `updateEntityArchetype()` | O(k log k) | k = number of component types (sorting) |
| `queryEntities()` | O(a × c) | a = archetypes, c = components per archetype |
| `removeEntity()` | O(1) | Direct hash map operations |
| `getEntityArchetype()` | O(1) | Direct hash map lookup |

### Memory Usage

- **Per Archetype**: ~200 bytes overhead + entity set storage
- **Per Entity**: ~16 bytes (entity ID in set + archetype mapping)
- **Total Overhead**: Scales with number of unique archetypes, not total entities

### Scalability Benchmarks

Typical performance on modern hardware:

- **Entity Updates**: 1M+ updates/second
- **Query Performance**: 10M+ entities/second for large archetype queries
- **Memory Efficiency**: <1KB overhead for 1000 entities with 10 archetypes

## Best Practices

### 1. Design for Common Archetypes

```typescript
// ✅ Good: Design components that naturally group together
interface CoreGameplayComponents {
  position: PositionComponent;    // Most entities need position
  velocity: VelocityComponent;    // Many entities move
  sprite: SpriteComponent;        // Most entities are visible
}

// Common archetypes will be:
// "position"                    - Static objects
// "position|sprite"             - Static visible objects
// "position|velocity"           - Moving invisible objects
// "position|velocity|sprite"    - Moving visible objects
```

### 2. Avoid Component Proliferation

```typescript
// ❌ Avoid: Too many optional/situational components
interface BadComponent extends Component {
  readonly type: 'bad';
  hasFeatureA?: boolean;
  hasFeatureB?: boolean;
  hasFeatureC?: boolean;
  // This creates 2^3 = 8 possible archetypes for one entity type!
}

// ✅ Better: Use fewer, more focused components
interface FeatureAComponent extends Component {
  readonly type: 'feature-a';
  // Only entities that actually need feature A get this component
}
```

### 3. Monitor Archetype Distribution

```typescript
// Add to your debug/profiling code
function logArchetypeHealth(world: World): void {
  const stats = world.getArchetypeStats();
  const entityCount = world.getEntityCount();

  if (stats.length > entityCount * 0.5) {
    console.warn(`High archetype fragmentation: ${stats.length} archetypes for ${entityCount} entities`);
  }

  const singletons = stats.filter(s => s.entityCount === 1).length;
  if (singletons > stats.length * 0.3) {
    console.warn(`Many singleton archetypes: ${singletons}/${stats.length} archetypes have only 1 entity`);
  }
}
```

## See Also

- **[World API](./world.md)** - Higher-level archetype management through World
- **[Query System](./query.md)** - Advanced querying techniques and patterns
- **[Component Design](./component.md)** - Designing components for optimal archetypes
- **[Performance Guide](../../guides/performance-optimization.md)** - Archetype optimization strategies
- **[Architecture Deep Dive](../../advanced/architecture-deep-dive.md)** - Internal ECS optimization details