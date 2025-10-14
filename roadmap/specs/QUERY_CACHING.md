# Technical Spec: Query Caching & Optimization

**Status:** Basic Queries Exist, Caching Needed
**Priority:** High (1.1 Release)
**Estimated Effort:** 2-3 weeks
**Dependencies:** Change Detection (for invalidation)

---

## Overview

Optimize the query system by implementing persistent cached queries that automatically invalidate when entities or components change. This eliminates the need to rebuild query results every frame and provides incremental updates for better performance.

## Current State

### What Exists
- ✅ `Query<T>` class in `src/core/ecs/Query.ts`
- ✅ `query()` method on World
- ✅ `queryMultiple()` for multi-component queries
- ✅ Archetype-based O(1) lookup
- ✅ Filter predicates for value-based queries
- ✅ Query methods: `forEach()`, `filter()`, `getEntities()`

### The Problem

**Current Implementation:**
```typescript
// In World.ts
query<T extends Component>(componentType: string): Query<T> {
    const storage = this.componentStorages.get(componentType);
    return new Query(
        storage?.getEntities() ?? new Set(),
        this,
        componentType
    );
}
```

**Issues:**
1. New `Query` object created every call
2. Result set copied from storage every time
3. No caching of filtered results
4. Systems re-query every frame even if nothing changed
5. No incremental updates

**Performance Impact:**
- System with 1000 entities querying every frame = 1000 Set copies/second
- Complex filtered queries recalculate every time
- GC pressure from temporary Query objects

---

## Design Goals

1. **Persistent Queries**: Create once, reuse many times
2. **Automatic Invalidation**: Queries update when data changes
3. **Incremental Updates**: Only process changed entities
4. **Zero-Copy**: Return references, not copies when possible
5. **Backward Compatible**: Existing code continues to work
6. **Type-Safe**: Maintain full TypeScript type safety

---

## Technical Design

### 1. Cached Query System

**Location:** `src/core/ecs/CachedQuery.ts`

```typescript
interface QueryDescriptor {
    componentTypes: string[];
    filter?: QueryFilter;
    id: string; // Unique query identifier
}

interface QueryFilter {
    predicate: (entityId: number, world: World) => boolean;
    // For debugging/serialization
    description?: string;
}

class CachedQuery<T extends Component = Component> {
    private readonly descriptor: QueryDescriptor;
    private cachedResults: Set<number>;
    private dirty = true;
    private version = 0;

    constructor(
        descriptor: QueryDescriptor,
        private world: World,
        private queryManager: QueryManager
    ) {
        this.descriptor = descriptor;
        this.cachedResults = new Set();
    }

    /**
     * Get entities matching this query.
     * Returns cached results if valid, rebuilds if dirty.
     */
    getEntities(): readonly number[] {
        if (this.dirty) {
            this.rebuild();
        }
        return Array.from(this.cachedResults);
    }

    /**
     * Get entities as a Set (zero-copy).
     */
    getEntitiesSet(): ReadonlySet<number> {
        if (this.dirty) {
            this.rebuild();
        }
        return this.cachedResults;
    }

    /**
     * Iterate entities without creating array.
     */
    forEach(callback: (entityId: number) => void): void {
        if (this.dirty) {
            this.rebuild();
        }
        for (const entityId of this.cachedResults) {
            callback(entityId);
        }
    }

    /**
     * Get components with entities.
     */
    getComponents(): Array<{ entityId: number; component: T }> {
        const results: Array<{ entityId: number; component: T }> = [];
        this.forEach(entityId => {
            const component = this.world.getComponent<T>(
                entityId,
                this.descriptor.componentTypes[0] ?? ''
            );
            if (component) {
                results.push({ entityId, component });
            }
        });
        return results;
    }

    /**
     * Create a derived query with additional filter.
     */
    filter(predicate: (entityId: number) => boolean): CachedQuery<T> {
        const newDescriptor: QueryDescriptor = {
            ...this.descriptor,
            filter: {
                predicate: (entityId, world) => {
                    // Combine existing filter with new one
                    const baseMatch = this.descriptor.filter?.predicate(entityId, world) ?? true;
                    return baseMatch && predicate(entityId);
                }
            },
            id: `${this.descriptor.id}_filtered_${this.version++}`
        };
        return new CachedQuery<T>(newDescriptor, this.world, this.queryManager);
    }

    /**
     * Get query metadata for debugging.
     */
    getMetadata(): QueryMetadata {
        return {
            id: this.descriptor.id,
            componentTypes: this.descriptor.componentTypes,
            entityCount: this.cachedResults.size,
            isDirty: this.dirty,
            version: this.version
        };
    }

    /**
     * Mark query as dirty, needs rebuild.
     */
    invalidate(): void {
        this.dirty = true;
    }

    /**
     * Incrementally update query with entity changes.
     */
    onEntityChanged(entityId: number, changeType: 'added' | 'removed' | 'modified'): void {
        switch (changeType) {
            case 'added':
            case 'modified':
                // Check if entity matches query
                if (this.matchesQuery(entityId)) {
                    this.cachedResults.add(entityId);
                } else {
                    this.cachedResults.delete(entityId);
                }
                break;
            case 'removed':
                this.cachedResults.delete(entityId);
                break;
        }
        this.version++;
    }

    private rebuild(): void {
        this.cachedResults.clear();

        // Get base entities from archetype system
        const baseEntities = this.world.queryMultiple(this.descriptor.componentTypes);

        // Apply filter if present
        if (this.descriptor.filter) {
            for (const entityId of baseEntities) {
                if (this.descriptor.filter.predicate(entityId, this.world)) {
                    this.cachedResults.add(entityId);
                }
            }
        } else {
            for (const entityId of baseEntities) {
                this.cachedResults.add(entityId);
            }
        }

        this.dirty = false;
        this.version++;
    }

    private matchesQuery(entityId: number): boolean {
        // Check component requirements
        for (const componentType of this.descriptor.componentTypes) {
            if (!this.world.hasComponent(entityId, componentType)) {
                return false;
            }
        }

        // Check filter if present
        if (this.descriptor.filter) {
            return this.descriptor.filter.predicate(entityId, this.world);
        }

        return true;
    }

    /**
     * Count entities without materializing array.
     */
    count(): number {
        if (this.dirty) {
            this.rebuild();
        }
        return this.cachedResults.size;
    }

    /**
     * Check if query has any results.
     */
    isEmpty(): boolean {
        return this.count() === 0;
    }
}

interface QueryMetadata {
    id: string;
    componentTypes: string[];
    entityCount: number;
    isDirty: boolean;
    version: number;
}
```

### 2. Query Manager

**Location:** `src/core/ecs/QueryManager.ts`

```typescript
class QueryManager {
    private queries = new Map<string, CachedQuery>();
    private queryIdCounter = 0;

    constructor(private world: World) {}

    /**
     * Create or retrieve a cached query.
     */
    query<T extends Component>(
        componentType: string | string[],
        filter?: QueryFilter
    ): CachedQuery<T> {
        const componentTypes = Array.isArray(componentType)
            ? componentType
            : [componentType];

        const descriptor = this.createDescriptor(componentTypes, filter);

        let query = this.queries.get(descriptor.id);
        if (!query) {
            query = new CachedQuery<T>(descriptor, this.world, this);
            this.queries.set(descriptor.id, query);
        }

        return query as CachedQuery<T>;
    }

    /**
     * Create a one-time query (not cached).
     * Useful for rare queries.
     */
    queryOnce<T extends Component>(
        componentType: string | string[]
    ): readonly number[] {
        const componentTypes = Array.isArray(componentType)
            ? componentType
            : [componentType];
        return this.world.queryMultiple(componentTypes);
    }

    /**
     * Invalidate queries that depend on a component type.
     */
    invalidateQueriesWithComponent(componentType: string): void {
        for (const query of this.queries.values()) {
            const metadata = query.getMetadata();
            if (metadata.componentTypes.includes(componentType)) {
                query.invalidate();
            }
        }
    }

    /**
     * Notify queries of entity changes for incremental updates.
     */
    notifyEntityChanged(
        entityId: number,
        componentType: string,
        changeType: 'added' | 'removed' | 'modified'
    ): void {
        for (const query of this.queries.values()) {
            const metadata = query.getMetadata();
            if (metadata.componentTypes.includes(componentType)) {
                query.onEntityChanged(entityId, changeType);
            }
        }
    }

    /**
     * Clear all cached queries.
     */
    clearCache(): void {
        this.queries.clear();
    }

    /**
     * Get query statistics for debugging.
     */
    getStats(): QueryManagerStats {
        const stats: QueryManagerStats = {
            totalQueries: this.queries.size,
            dirtyQueries: 0,
            totalEntities: 0,
            queriesByComponent: new Map()
        };

        for (const query of this.queries.values()) {
            const metadata = query.getMetadata();
            if (metadata.isDirty) {
                stats.dirtyQueries++;
            }
            stats.totalEntities += metadata.entityCount;

            for (const componentType of metadata.componentTypes) {
                const count = stats.queriesByComponent.get(componentType) ?? 0;
                stats.queriesByComponent.set(componentType, count + 1);
            }
        }

        return stats;
    }

    private createDescriptor(
        componentTypes: string[],
        filter?: QueryFilter
    ): QueryDescriptor {
        // Create stable ID for caching
        const sortedTypes = [...componentTypes].sort();
        const filterId = filter?.description ??
                        (filter ? `filter_${this.queryIdCounter++}` : 'nofilter');
        const id = `${sortedTypes.join('|')}:${filterId}`;

        return {
            componentTypes: sortedTypes,
            filter,
            id
        };
    }
}

interface QueryManagerStats {
    totalQueries: number;
    dirtyQueries: number;
    totalEntities: number;
    queriesByComponent: Map<string, number>;
}
```

### 3. World Integration

**Location:** Update `src/core/ecs/World.ts`

```typescript
class World {
    // ... existing fields ...
    private queryManager = new QueryManager(this);

    /**
     * Create a cached query (recommended).
     */
    createQuery<T extends Component>(
        componentType: string | string[]
    ): CachedQuery<T> {
        return this.queryManager.query<T>(componentType);
    }

    /**
     * Create a cached query with filter.
     */
    createFilteredQuery<T extends Component>(
        componentType: string | string[],
        predicate: (entityId: number, world: World) => boolean,
        description?: string
    ): CachedQuery<T> {
        return this.queryManager.query<T>(componentType, {
            predicate,
            description
        });
    }

    /**
     * One-time query (legacy, not cached).
     */
    query<T extends Component>(componentType: string): Query<T> {
        // Keep for backward compatibility
        const storage = this.componentStorages.get(componentType);
        return new Query(
            storage?.getEntities() ?? new Set(),
            this,
            componentType
        );
    }

    /**
     * Query multiple components once (legacy, not cached).
     */
    queryMultiple(componentTypes: string[]): number[] {
        // Keep for backward compatibility
        if (componentTypes.length === 0) {
            return [];
        }
        if (componentTypes.length === 1) {
            const storage = this.componentStorages.get(componentTypes[0] ?? '');
            return storage ? Array.from(storage.getEntities()) : [];
        }
        return this.archetypeManager.queryEntities(componentTypes);
    }

    /**
     * Get query manager for advanced usage.
     */
    getQueryManager(): QueryManager {
        return this.queryManager;
    }

    // Update component modification methods to invalidate queries
    addComponent<T extends Component>(entityId: number, component: T): void {
        if (!this.entityManager.isEntityAlive(entityId)) {
            throw new Error(`Entity ${entityId} does not exist`);
        }

        const storage = this.getOrCreateStorage<T>(component.type);
        storage.add(entityId, component);
        this.updateArchetype(entityId);

        // Notify query manager
        this.queryManager.notifyEntityChanged(entityId, component.type, 'added');

        // Mark dirty
        this.dirtyTracker.markDirty(entityId, component.type);
    }

    removeComponent(entityId: number, componentType: string): boolean {
        const storage = this.componentStorages.get(componentType);
        if (!storage) {
            return false;
        }

        const removed = storage.remove(entityId);
        if (removed) {
            this.updateArchetype(entityId);

            // Notify query manager
            this.queryManager.notifyEntityChanged(entityId, componentType, 'removed');

            // Mark dirty
            this.dirtyTracker.markDirty(entityId, componentType);
        }
        return removed;
    }

    destroyEntity(entityId: number): void {
        // Get all component types for this entity
        const componentTypes = this.getComponentTypes().filter(type =>
            this.hasComponent(entityId, type)
        );

        // Notify query manager before removal
        for (const componentType of componentTypes) {
            this.queryManager.notifyEntityChanged(entityId, componentType, 'removed');
        }

        // ... rest of existing destroy logic ...
    }
}
```

### 4. System Query API

**Recommended pattern for systems:**

```typescript
class MySystem extends BaseSystem {
    readonly name = 'MySystem';
    readonly priority = 1;

    // Store query as instance variable
    private entityQuery?: CachedQuery<PositionComponent>;

    initialize(world: World): void {
        // Create query once during initialization
        this.entityQuery = world.createQuery<PositionComponent>('position');
    }

    update(world: World, deltaTime: number): void {
        // Query is cached and auto-updates
        this.entityQuery?.forEach(entityId => {
            const pos = world.getComponent<PositionComponent>(entityId, 'position');
            if (pos) {
                // Update logic...
            }
        });
    }
}
```

---

## API Examples

### Basic Cached Query

```typescript
const world = new World();

// Create query once
const positionQuery = world.createQuery<PositionComponent>('position');

// Use many times
for (let i = 0; i < 1000; i++) {
    positionQuery.forEach(entityId => {
        // Process entities
    });
}
// Query results are cached, only rebuilt when components change
```

### Multi-Component Query

```typescript
// Query entities with multiple components
const query = world.createQuery<PositionComponent>(['position', 'velocity']);

query.forEach(entityId => {
    const pos = world.getComponent<PositionComponent>(entityId, 'position');
    const vel = world.getComponent<VelocityComponent>(entityId, 'velocity');
    // ...
});
```

### Filtered Query

```typescript
// Query with filter
const movingEntities = world.createFilteredQuery<PositionComponent>(
    ['position', 'velocity'],
    (entityId, world) => {
        const vel = world.getComponent<VelocityComponent>(entityId, 'velocity');
        return vel && (vel.dx !== 0 || vel.dy !== 0);
    },
    'moving-entities' // Description for debugging
);

// Filter is cached too!
movingEntities.forEach(entityId => {
    // Only entities with non-zero velocity
});
```

### Query Metadata & Debugging

```typescript
const query = world.createQuery('position');

// Get metadata
const meta = query.getMetadata();
console.log(`Query has ${meta.entityCount} entities`);
console.log(`Query is ${meta.isDirty ? 'dirty' : 'clean'}`);

// Get query stats
const stats = world.getQueryManager().getStats();
console.log(`Total queries: ${stats.totalQueries}`);
console.log(`Dirty queries: ${stats.dirtyQueries}`);
```

### System Pattern

```typescript
class RenderSystem extends BaseSystem {
    readonly name = 'RenderSystem';
    private renderableQuery?: CachedQuery;

    initialize(world: World): void {
        // Create filtered query for renderable entities
        this.renderableQuery = world.createFilteredQuery(
            ['position', 'sprite'],
            (entityId, world) => {
                const sprite = world.getComponent<SpriteComponent>(entityId, 'sprite');
                return sprite?.visible ?? false;
            },
            'visible-sprites'
        );
    }

    update(world: World, deltaTime: number): void {
        // Zero overhead if nothing changed
        this.renderableQuery?.forEach(entityId => {
            // Render entity
        });
    }
}
```

---

## Implementation Plan

### Phase 1: Core CachedQuery (Week 1)
1. Implement `CachedQuery` class
2. Implement `QueryManager` class
3. Add basic caching with invalidation
4. Write unit tests

**Files to Create:**
- `src/core/ecs/CachedQuery.ts`
- `src/core/ecs/QueryManager.ts`
- `src/core/ecs/CachedQuery.test.ts`
- `src/core/ecs/QueryManager.test.ts`

### Phase 2: World Integration (Week 2)
1. Add QueryManager to World
2. Integrate with component add/remove/destroy
3. Add `createQuery()` methods
4. Update existing `query()` for backward compatibility
5. Write integration tests

**Files to Modify:**
- `src/core/ecs/World.ts`
- `src/core/ecs/World.test.ts`

### Phase 3: Incremental Updates (Week 2-3)
1. Implement `onEntityChanged()` for incremental updates
2. Hook into dirty tracking system
3. Optimize invalidation strategies
4. Performance benchmarking

**Files to Modify:**
- `src/core/ecs/CachedQuery.ts`
- `src/core/ecs/QueryManager.ts`

### Phase 4: Documentation & Examples (Week 3)
1. Update API documentation
2. Create query optimization guide
3. Update system examples
4. Migration guide

**Files to Create/Modify:**
- `examples/query-optimization-example.ts`
- Update existing examples
- Documentation

---

## Performance Benchmarks

### Target Performance

| Scenario | Current | Target | Improvement |
|----------|---------|--------|-------------|
| Create query | ~50μs | ~50μs | Same |
| Query 1000 entities (cached) | ~500μs | ~5μs | 100x |
| Query with filter (cached) | ~1ms | ~10μs | 100x |
| Add component (invalidate) | ~10μs | ~15μs | -50% overhead |
| Incremental update | N/A | ~1μs | New feature |

### Memory Usage

- Query cache overhead: ~1KB per query
- Typical game (50 unique queries): ~50KB
- Acceptable for the performance gain

---

## Testing Requirements

### Unit Tests
- CachedQuery creation and invalidation
- QueryManager caching logic
- Query descriptor generation
- Incremental entity updates

### Integration Tests
- Query results match non-cached queries
- Queries invalidate correctly
- Filtered queries work correctly
- Performance benchmarks

### Edge Cases
- Empty queries
- Query with no matching entities
- Rapid component add/remove
- Query during entity destruction

---

## Success Criteria

- ✅ Cached queries implemented
- ✅ Automatic invalidation working
- ✅ Incremental updates working
- ✅ Performance benchmarks met (>50x improvement)
- ✅ Backward compatibility maintained
- ✅ All tests passing (>90% coverage)
- ✅ Documentation complete
- ✅ Migration guide written
