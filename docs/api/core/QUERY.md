# Query API Reference

The Query system provides powerful and efficient ways to find and process entities based on their component composition. It offers type-safe iteration, filtering, and processing of entity collections.

## Overview

The Query system enables:

- **Type-Safe Iteration**: Process components with full TypeScript type safety
- **Efficient Filtering**: Chain filters to narrow down entity sets
- **Flexible Processing**: Multiple ways to access and process query results
- **Performance Optimized**: Built on archetype-based storage for speed
- **Functional Style**: Composable query operations

Queries are lightweight objects that provide views into the entity collection without copying data.

## Query Class

### Query<T>

A typed query for entities with a specific component type.

```typescript
class Query<T extends Component> {
  getEntities(): number[];
  getComponents(): Array<{ entityId: number; component: T }>;
  forEach(callback: (entityId: number, component: T) => void): void;
  filter(predicate: (entityId: number, component: T) => boolean): Query<T>;
  count(): number;
  isEmpty(): boolean;
}
```

## Quick Example

```typescript
import { World, BaseSystem, type Component } from '@danjdewhurst/ecs-ts';

interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

const world = new World();

// Create entities with health
const player = world.createEntity();
world.addComponent(player, { type: 'health', current: 80, maximum: 100 });

const enemy = world.createEntity();
world.addComponent(enemy, { type: 'health', current: 30, maximum: 50 });

// Create and use query
const healthQuery = world.query<HealthComponent>('health');

// Iterate over all health components
healthQuery.forEach((entityId, health) => {
  console.log(`Entity ${entityId}: ${health.current}/${health.maximum} HP`);
});

// Filter for damaged entities
const damagedQuery = healthQuery.filter((entityId, health) =>
  health.current < health.maximum
);

console.log(`${damagedQuery.count()} entities need healing`);
```

## Creating Queries

### world.query<T>(componentType)

Creates a typed query for a specific component type.

```typescript
query<T extends Component>(componentType: string): Query<T>
```

**Parameters:**
- `componentType: string` - Component type to query for

**Returns:** `Query<T>` - Typed query object

**Example:**
```typescript
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

// Create typed query
const positionQuery = world.query<PositionComponent>('position');

// Type-safe access to position components
positionQuery.forEach((entityId, position) => {
  console.log(`Entity ${entityId} at (${position.x}, ${position.y})`);
  // TypeScript knows 'position' is PositionComponent
});
```

### world.queryMultiple(componentTypes)

Finds entities with multiple component types (returns entity IDs only).

```typescript
queryMultiple(componentTypes: string[]): number[]
```

**Parameters:**
- `componentTypes: string[]` - Array of component types (all required)

**Returns:** `number[]` - Array of entity IDs

**Example:**
```typescript
// Find entities with both position and velocity
const movingEntities = world.queryMultiple(['position', 'velocity']);

for (const entityId of movingEntities) {
  const position = world.getComponent<PositionComponent>(entityId, 'position');
  const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

  if (position && velocity) {
    position.x += velocity.dx;
    position.y += velocity.dy;
  }
}
```

## Query Methods

### getEntities()

Returns array of entity IDs in the query.

```typescript
getEntities(): number[]
```

**Returns:** `number[]` - Array of entity IDs

**Example:**
```typescript
const healthQuery = world.query<HealthComponent>('health');
const entityIds = healthQuery.getEntities();

console.log(`Health components on entities: [${entityIds.join(', ')}]`);

// Use with other World methods
for (const entityId of entityIds) {
  if (world.hasComponent(entityId, 'player')) {
    console.log(`Player ${entityId} has health`);
  }
}
```

### getComponents()

Returns array of entity-component pairs.

```typescript
getComponents(): Array<{ entityId: number; component: T }>
```

**Returns:** Array of objects containing entityId and component data

**Example:**
```typescript
const healthQuery = world.query<HealthComponent>('health');
const healthComponents = healthQuery.getComponents();

// Process all health components
for (const { entityId, component } of healthComponents) {
  console.log(`Entity ${entityId}: ${component.current}/${component.maximum} HP`);

  // Modify component directly
  if (component.current <= 0) {
    world.destroyEntity(entityId);
  }
}
```

### forEach(callback)

Iterates over all entities in the query with type-safe component access.

```typescript
forEach(callback: (entityId: number, component: T) => void): void
```

**Parameters:**
- `callback: Function` - Called for each entity with its component

**Example:**
```typescript
class HealthRegenSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'HealthRegenSystem';

  update(world: World, deltaTime: number): void {
    // Type-safe iteration over health components
    world.query<HealthComponent>('health').forEach((entityId, health) => {
      if (health.current < health.maximum) {
        health.current = Math.min(
          health.maximum,
          health.current + 10 * deltaTime // Regen 10 HP per second
        );

        console.log(`Entity ${entityId} regenerated to ${health.current} HP`);
      }
    });
  }
}
```

### filter(predicate)

Creates a new query with entities that match the predicate.

```typescript
filter(predicate: (entityId: number, component: T) => boolean): Query<T>
```

**Parameters:**
- `predicate: Function` - Function that returns true for entities to include

**Returns:** `Query<T>` - New filtered query

**Example:**
```typescript
const healthQuery = world.query<HealthComponent>('health');

// Filter for low health entities
const lowHealthQuery = healthQuery.filter((entityId, health) =>
  health.current < health.maximum * 0.25
);

// Filter for full health entities
const fullHealthQuery = healthQuery.filter((entityId, health) =>
  health.current === health.maximum
);

// Chain filters
const criticalPlayerQuery = healthQuery
  .filter((entityId, health) => health.current <= 10)
  .filter((entityId, health) => world.hasComponent(entityId, 'player'));

console.log(`${criticalPlayerQuery.count()} players in critical condition`);
```

### count()

Returns the number of entities in the query.

```typescript
count(): number
```

**Returns:** `number` - Number of entities

**Example:**
```typescript
const healthQuery = world.query<HealthComponent>('health');
const damagedQuery = healthQuery.filter((entityId, health) =>
  health.current < health.maximum
);

console.log(`${healthQuery.count()} total entities with health`);
console.log(`${damagedQuery.count()} entities need healing`);

// Use in conditional logic
if (damagedQuery.count() > 0) {
  console.log('Some entities need healing!');
}
```

### isEmpty()

Checks if the query has no entities.

```typescript
isEmpty(): boolean
```

**Returns:** `boolean` - True if query contains no entities

**Example:**
```typescript
const enemyQuery = world.query<EnemyComponent>('enemy');

if (enemyQuery.isEmpty()) {
  console.log('No enemies remaining - victory!');
  world.emitEvent({
    type: 'level-complete',
    data: { reason: 'all-enemies-defeated' },
    timestamp: Date.now()
  });
}

// Use with other queries
const deadEnemyQuery = enemyQuery.filter((entityId, enemy) =>
  world.getComponent<HealthComponent>(entityId, 'health')?.current === 0
);

if (!deadEnemyQuery.isEmpty()) {
  console.log('Some enemies are dead and need cleanup');
}
```

## Advanced Query Patterns

### Multi-Component Processing

For entities requiring multiple components, combine queries with World methods:

```typescript
class MovementSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'MovementSystem';

  update(world: World, deltaTime: number): void {
    // Get entities with both position and velocity
    const movingEntities = world.queryMultiple(['position', 'velocity']);

    for (const entityId of movingEntities) {
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

### Conditional Component Access

```typescript
class RenderSystem extends BaseSystem {
  update(world: World): void {
    // Primary query for position
    world.query<PositionComponent>('position').forEach((entityId, position) => {
      // Check for optional sprite component
      const sprite = world.getComponent<SpriteComponent>(entityId, 'sprite');
      const color = world.getComponent<ColorComponent>(entityId, 'color');

      // Render with available components
      this.renderEntity(position, sprite, color);
    });
  }

  private renderEntity(
    position: PositionComponent,
    sprite?: SpriteComponent,
    color?: ColorComponent
  ): void {
    // Render logic handling optional components
  }
}
```

### Query Composition

```typescript
class CombatSystem extends BaseSystem {
  update(world: World): void {
    // Find attackers (entities with weapon and target)
    const weaponQuery = world.query<WeaponComponent>('weapon');

    weaponQuery
      .filter((entityId, weapon) => weapon.cooldown <= 0)
      .filter((entityId, weapon) => world.hasComponent(entityId, 'target'))
      .forEach((entityId, weapon) => {
        const target = world.getComponent<TargetComponent>(entityId, 'target');
        if (target) {
          this.performAttack(world, entityId, weapon, target);
        }
      });
  }

  private performAttack(
    world: World,
    attackerId: number,
    weapon: WeaponComponent,
    target: TargetComponent
  ): void {
    // Combat logic
  }
}
```

### Query Caching

```typescript
class OptimizedSystem extends BaseSystem {
  private cachedQueries = new Map<string, any>();

  protected getCachedQuery<T extends Component>(
    world: World,
    componentType: string
  ): Query<T> {
    if (!this.cachedQueries.has(componentType)) {
      this.cachedQueries.set(componentType, world.query<T>(componentType));
    }
    return this.cachedQueries.get(componentType);
  }

  update(world: World): void {
    // Use cached query (only create once)
    const healthQuery = this.getCachedQuery<HealthComponent>(world, 'health');

    healthQuery.forEach((entityId, health) => {
      // Process health components
    });
  }

  shutdown(): void {
    // Clear cached queries
    this.cachedQueries.clear();
  }
}
```

## System Helper Methods

The BaseSystem class provides convenient query helpers:

### queryEntities(...componentTypes)

Helper method for multi-component queries.

```typescript
protected queryEntities(world: World, ...componentTypes: string[]): number[]
```

**Example:**
```typescript
class MovementSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // Helper method for multi-component query
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      // Process entities with both components
    }
  }
}
```

### queryWithComponents<T>(componentType, callback)

Helper method for type-safe single-component processing.

```typescript
protected queryWithComponents<T extends Component>(
  world: World,
  componentType: string,
  callback: (entityId: number, component: T) => void
): void
```

**Example:**
```typescript
class HealthSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // Helper method for type-safe component processing
    this.queryWithComponents<HealthComponent>(
      world, 'health',
      (entityId, health) => {
        if (health.current <= 0) {
          world.destroyEntity(entityId);
        }
      }
    );
  }
}
```

## Performance Optimization

### Query Performance Characteristics

```typescript
// Performance comparison of different query approaches

class PerformanceTestSystem extends BaseSystem {
  update(world: World): void {
    // ✅ Most efficient: Single component query
    const healthQuery = world.query<HealthComponent>('health');
    // O(1) archetype lookup + O(n) iteration

    // ✅ Efficient: Multi-component archetype query
    const movingEntities = world.queryMultiple(['position', 'velocity']);
    // O(1) archetype lookup + O(n) iteration

    // ⚠️ Less efficient: Filtered query (but still good)
    const damagedEntities = healthQuery.filter((id, health) =>
      health.current < health.maximum
    );
    // O(n) filtering on top of base query

    // ❌ Inefficient: Manual entity iteration
    for (let i = 0; i < world.getEntityCount(); i++) {
      if (world.hasComponent(i, 'health')) {
        // O(n) entity check for each entity
      }
    }
  }
}
```

### Batch Processing

```typescript
class BatchedProcessingSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // Collect all data first
    const entities: number[] = [];
    const positions: PositionComponent[] = [];
    const velocities: VelocityComponent[] = [];

    // Single pass to collect components
    this.queryEntities(world, 'position', 'velocity').forEach(entityId => {
      const pos = world.getComponent<PositionComponent>(entityId, 'position');
      const vel = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (pos && vel) {
        entities.push(entityId);
        positions.push(pos);
        velocities.push(vel);
      }
    });

    // Batch process for better cache locality
    for (let i = 0; i < entities.length; i++) {
      positions[i].x += velocities[i].dx * deltaTime;
      positions[i].y += velocities[i].dy * deltaTime;
    }
  }
}
```

### Query Result Caching

```typescript
class CachedQuerySystem extends BaseSystem {
  private lastEntityCount = 0;
  private cachedMovingEntities: number[] = [];

  update(world: World, deltaTime: number): void {
    const currentEntityCount = world.getEntityCount();

    // Invalidate cache when entity count changes
    if (currentEntityCount !== this.lastEntityCount) {
      this.cachedMovingEntities = this.queryEntities(world, 'position', 'velocity');
      this.lastEntityCount = currentEntityCount;
    }

    // Use cached results
    for (const entityId of this.cachedMovingEntities) {
      this.processMovingEntity(world, entityId, deltaTime);
    }
  }

  private processMovingEntity(world: World, entityId: number, deltaTime: number): void {
    // Process individual entity
  }
}
```

## Error Handling

Queries are designed to be robust and handle edge cases:

```typescript
class RobustQuerySystem extends BaseSystem {
  update(world: World): void {
    // Safe query operations
    const healthQuery = world.query<HealthComponent>('health');

    // Safe iteration (handles destroyed entities gracefully)
    healthQuery.forEach((entityId, health) => {
      // Component is guaranteed to exist during this callback
      health.current = Math.max(0, health.current - 1);

      // Safe to destroy entity during iteration
      if (health.current <= 0) {
        world.destroyEntity(entityId);
      }
    });

    // Safe filtering (handles missing components)
    const validQuery = healthQuery.filter((entityId, health) => {
      // Additional component checks
      return world.hasComponent(entityId, 'position');
    });

    // Safe empty query handling
    if (!validQuery.isEmpty()) {
      console.log(`Processing ${validQuery.count()} valid entities`);
    }
  }
}
```

## Debugging Queries

### Query Inspection

```typescript
function debugQuery<T extends Component>(
  query: Query<T>,
  componentType: string
): void {
  console.log(`Query for '${componentType}':`);
  console.log(`  Entities: ${query.count()}`);
  console.log(`  Empty: ${query.isEmpty()}`);

  if (!query.isEmpty()) {
    const entities = query.getEntities();
    console.log(`  Entity IDs: [${entities.join(', ')}]`);

    // Show first few components as examples
    const components = query.getComponents().slice(0, 3);
    components.forEach(({ entityId, component }) => {
      console.log(`  Entity ${entityId}:`, component);
    });
  }
}

// Usage in system
class DebuggingSystem extends BaseSystem {
  update(world: World): void {
    const healthQuery = world.query<HealthComponent>('health');
    debugQuery(healthQuery, 'health');

    const damagedQuery = healthQuery.filter((id, health) =>
      health.current < health.maximum
    );
    debugQuery(damagedQuery, 'health (damaged)');
  }
}
```

### Performance Monitoring

```typescript
function measureQueryPerformance<T extends Component>(
  query: Query<T>,
  operation: (query: Query<T>) => void,
  name: string
): void {
  const startTime = performance.now();
  operation(query);
  const endTime = performance.now();

  console.log(`Query '${name}': ${(endTime - startTime).toFixed(2)}ms`);
}

// Usage
class ProfiledSystem extends BaseSystem {
  update(world: World): void {
    const healthQuery = world.query<HealthComponent>('health');

    measureQueryPerformance(healthQuery, (query) => {
      query.forEach((entityId, health) => {
        // Processing logic
      });
    }, 'health processing');

    measureQueryPerformance(healthQuery, (query) => {
      const damaged = query.filter((id, health) => health.current < health.maximum);
      return damaged.count();
    }, 'damage filtering');
  }
}
```

## See Also

- **[World API](./world.md)** - Creating queries through the World interface
- **[System API](./system.md)** - Using queries in systems effectively
- **[Archetype Manager](./archetype-manager.md)** - Understanding query performance
- **[Component Design](./component.md)** - Designing components for efficient queries
- **[Performance Guide](../../guides/performance-optimization.md)** - Query optimization strategies