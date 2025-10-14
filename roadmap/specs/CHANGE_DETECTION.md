# Technical Spec: Change Detection Enhancements

**Status:** Dirty Tracking Exists, Needs Extensions
**Priority:** High (1.2 Release)
**Estimated Effort:** 2-3 weeks
**Dependencies:** None

---

## Overview

Enhance the existing `DirtyTracker` system with callbacks, observers, field-level tracking, and change history to enable reactive programming patterns and more efficient change-based systems.

## Current State

### What Exists
- ✅ `DirtyTracker` class in `src/core/performance/DirtyTracker.ts`
- ✅ Component-level dirty tracking
- ✅ Automatic marking on component add/remove
- ✅ `getDirtyEntities()` query method
- ✅ `isEntityDirty()` and `isComponentDirty()` checks
- ✅ Automatic clearing after update cycle

### What's Missing
- ❌ Change callbacks/observers
- ❌ Field-level granular tracking
- ❌ Change history/replay
- ❌ "Changed components" query helpers
- ❌ Change batching and debouncing
- ❌ Integration with query invalidation

---

## Design Goals

1. **Reactive Systems**: Enable observer pattern for component changes
2. **Granular Tracking**: Track changes at field level, not just component level
3. **Change History**: Support undo/redo and time-travel debugging
4. **Performance**: Minimal overhead when features aren't used
5. **Type-Safe**: Full TypeScript support for change events
6. **Backward Compatible**: Existing code continues to work

---

## Technical Design

### 1. Change Event System

**Location:** `src/core/ecs/ChangeEvent.ts`

```typescript
interface ComponentChange<T extends Component = Component> {
    entityId: number;
    componentType: string;
    changeType: 'added' | 'removed' | 'modified';
    timestamp: number;
    oldValue?: T;
    newValue?: T;
    changedFields?: Set<keyof T>;
}

interface FieldChange<T extends Component = Component> {
    entityId: number;
    componentType: string;
    field: keyof T;
    oldValue: unknown;
    newValue: unknown;
    timestamp: number;
}

type ChangeListener<T extends Component = Component> = (
    change: ComponentChange<T>
) => void;

type FieldChangeListener<T extends Component = Component> = (
    change: FieldChange<T>
) => void;

interface ChangeEventOptions {
    // Include old value in change event (costs memory)
    includeOldValue?: boolean;

    // Include new value in change event
    includeNewValue?: boolean;

    // Track field-level changes (more granular)
    trackFields?: boolean;

    // Batch changes and fire once per frame
    batched?: boolean;

    // Only fire if specific fields changed
    fields?: string[];
}
```

### 2. Enhanced DirtyTracker

**Location:** Update `src/core/performance/DirtyTracker.ts`

```typescript
class DirtyTracker {
    // Existing fields
    private dirtyComponents = new Map<string, Set<number>>();
    private dirtyEntities = new Set<number>();

    // New fields for change tracking
    private listeners = new Map<string, Set<ChangeListener>>();
    private fieldListeners = new Map<string, Set<FieldChangeListener>>();
    private changeHistory: ComponentChange[] = [];
    private maxHistorySize = 1000;
    private changeBuffer: ComponentChange[] = [];
    private batchedMode = false;

    // Existing methods remain unchanged...

    /**
     * Subscribe to component changes.
     */
    subscribe<T extends Component>(
        componentType: string,
        listener: ChangeListener<T>,
        options?: ChangeEventOptions
    ): () => void {
        let listeners = this.listeners.get(componentType);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(componentType, listeners);
        }

        const wrappedListener = this.wrapListener(listener, options);
        listeners.add(wrappedListener as ChangeListener);

        // Return unsubscribe function
        return () => {
            listeners?.delete(wrappedListener as ChangeListener);
        };
    }

    /**
     * Subscribe to field-level changes.
     */
    subscribeToField<T extends Component>(
        componentType: string,
        field: keyof T,
        listener: FieldChangeListener<T>
    ): () => void {
        const key = `${componentType}.${String(field)}`;
        let listeners = this.fieldListeners.get(key);
        if (!listeners) {
            listeners = new Set();
            this.fieldListeners.set(key, listeners);
        }

        listeners.add(listener as FieldChangeListener);

        return () => {
            listeners?.delete(listener as FieldChangeListener);
        };
    }

    /**
     * Record a component change and notify listeners.
     */
    recordChange<T extends Component>(
        entityId: number,
        componentType: string,
        changeType: 'added' | 'removed' | 'modified',
        oldValue?: T,
        newValue?: T,
        changedFields?: Set<keyof T>
    ): void {
        const change: ComponentChange<T> = {
            entityId,
            componentType,
            changeType,
            timestamp: Date.now(),
            oldValue,
            newValue,
            changedFields
        };

        // Add to history
        this.addToHistory(change);

        // Notify listeners
        if (this.batchedMode) {
            this.changeBuffer.push(change);
        } else {
            this.notifyListeners(change);
        }

        // Mark as dirty
        this.markDirty(entityId, componentType);
    }

    /**
     * Enable batched change notifications.
     */
    enableBatching(): void {
        this.batchedMode = true;
    }

    /**
     * Disable batching and flush pending changes.
     */
    disableBatching(): void {
        this.batchedMode = false;
        this.flushChanges();
    }

    /**
     * Flush batched changes.
     */
    flushChanges(): void {
        if (this.changeBuffer.length === 0) return;

        for (const change of this.changeBuffer) {
            this.notifyListeners(change);
        }
        this.changeBuffer = [];
    }

    /**
     * Get change history.
     */
    getHistory(filter?: {
        entityId?: number;
        componentType?: string;
        since?: number;
    }): ComponentChange[] {
        let history = this.changeHistory;

        if (filter) {
            history = history.filter(change => {
                if (filter.entityId !== undefined && change.entityId !== filter.entityId) {
                    return false;
                }
                if (filter.componentType && change.componentType !== filter.componentType) {
                    return false;
                }
                if (filter.since !== undefined && change.timestamp < filter.since) {
                    return false;
                }
                return true;
            });
        }

        return history;
    }

    /**
     * Clear change history.
     */
    clearHistory(): void {
        this.changeHistory = [];
    }

    /**
     * Set maximum history size.
     */
    setMaxHistorySize(size: number): void {
        this.maxHistorySize = size;
        if (this.changeHistory.length > size) {
            this.changeHistory = this.changeHistory.slice(-size);
        }
    }

    private notifyListeners<T extends Component>(change: ComponentChange<T>): void {
        const listeners = this.listeners.get(change.componentType);
        if (!listeners) return;

        for (const listener of listeners) {
            try {
                listener(change);
            } catch (error) {
                console.error('Error in change listener:', error);
            }
        }

        // Notify field listeners if fields changed
        if (change.changedFields && change.changeType === 'modified') {
            for (const field of change.changedFields) {
                const key = `${change.componentType}.${String(field)}`;
                const fieldListeners = this.fieldListeners.get(key);
                if (!fieldListeners) continue;

                const fieldChange: FieldChange<T> = {
                    entityId: change.entityId,
                    componentType: change.componentType,
                    field,
                    oldValue: change.oldValue?.[field],
                    newValue: change.newValue?.[field],
                    timestamp: change.timestamp
                };

                for (const listener of fieldListeners) {
                    try {
                        listener(fieldChange);
                    } catch (error) {
                        console.error('Error in field change listener:', error);
                    }
                }
            }
        }
    }

    private addToHistory(change: ComponentChange): void {
        this.changeHistory.push(change);

        // Enforce max size (FIFO)
        if (this.changeHistory.length > this.maxHistorySize) {
            this.changeHistory.shift();
        }
    }

    private wrapListener<T extends Component>(
        listener: ChangeListener<T>,
        options?: ChangeEventOptions
    ): ChangeListener<T> {
        if (!options) return listener;

        return (change: ComponentChange<T>) => {
            // Filter by fields if specified
            if (options.fields && change.changedFields) {
                const hasRelevantChange = options.fields.some(field =>
                    change.changedFields?.has(field as keyof T)
                );
                if (!hasRelevantChange) return;
            }

            // Strip values if not requested
            const filteredChange = { ...change };
            if (!options.includeOldValue) {
                delete filteredChange.oldValue;
            }
            if (!options.includeNewValue) {
                delete filteredChange.newValue;
            }

            listener(filteredChange);
        };
    }
}
```

### 3. Component Proxy for Field Tracking

**Location:** `src/core/ecs/ComponentProxy.ts`

```typescript
/**
 * Creates a proxy around a component to track field-level changes.
 */
function createComponentProxy<T extends Component>(
    component: T,
    entityId: number,
    tracker: DirtyTracker
): T {
    const changedFields = new Set<keyof T>();

    return new Proxy(component, {
        set(target, prop: keyof T, value): boolean {
            const oldValue = target[prop];

            // Only track if value actually changed
            if (oldValue !== value) {
                changedFields.add(prop);
                target[prop] = value;

                // Record change with field-level detail
                tracker.recordChange(
                    entityId,
                    component.type,
                    'modified',
                    { ...target, [prop]: oldValue } as T,
                    target,
                    new Set([prop])
                );

                return true;
            }

            return true;
        },

        get(target, prop: keyof T) {
            return target[prop];
        }
    });
}
```

### 4. World Integration

**Location:** Update `src/core/ecs/World.ts`

```typescript
class World {
    // ... existing fields ...

    /**
     * Subscribe to component changes.
     */
    onComponentChange<T extends Component>(
        componentType: string,
        listener: ChangeListener<T>,
        options?: ChangeEventOptions
    ): () => void {
        return this.dirtyTracker.subscribe(componentType, listener, options);
    }

    /**
     * Subscribe to field changes.
     */
    onFieldChange<T extends Component>(
        componentType: string,
        field: keyof T,
        listener: FieldChangeListener<T>
    ): () => void {
        return this.dirtyTracker.subscribeToField(componentType, field, listener);
    }

    /**
     * Get change history.
     */
    getChangeHistory(filter?: {
        entityId?: number;
        componentType?: string;
        since?: number;
    }): ComponentChange[] {
        return this.dirtyTracker.getHistory(filter);
    }

    /**
     * Get a component with field-level tracking.
     */
    getTrackedComponent<T extends Component>(
        entityId: number,
        componentType: string
    ): T | undefined {
        const component = this.getComponent<T>(entityId, componentType);
        if (!component) return undefined;

        return createComponentProxy(component, entityId, this.dirtyTracker);
    }

    // Update addComponent to record changes
    addComponent<T extends Component>(entityId: number, component: T): void {
        if (!this.entityManager.isEntityAlive(entityId)) {
            throw new Error(`Entity ${entityId} does not exist`);
        }

        const storage = this.getOrCreateStorage<T>(component.type);
        storage.add(entityId, component);
        this.updateArchetype(entityId);

        // Record change
        this.dirtyTracker.recordChange(
            entityId,
            component.type,
            'added',
            undefined,
            component
        );

        // Notify query manager (if exists)
        this.queryManager?.notifyEntityChanged(entityId, component.type, 'added');
    }

    // Update removeComponent to record changes
    removeComponent(entityId: number, componentType: string): boolean {
        const storage = this.componentStorages.get(componentType);
        if (!storage) {
            return false;
        }

        const oldComponent = storage.get(entityId);
        const removed = storage.remove(entityId);

        if (removed) {
            this.updateArchetype(entityId);

            // Record change
            this.dirtyTracker.recordChange(
                entityId,
                componentType,
                'removed',
                oldComponent,
                undefined
            );

            // Notify query manager (if exists)
            this.queryManager?.notifyEntityChanged(entityId, componentType, 'removed');
        }

        return removed;
    }
}
```

### 5. Change-Based System Pattern

**Location:** `src/core/ecs/ChangeBasedSystem.ts`

```typescript
/**
 * Base class for systems that only process changed entities.
 */
abstract class ChangeBasedSystem extends BaseSystem {
    private unsubscribe?: () => void;

    abstract readonly componentTypes: string[];

    initialize(world: World): void {
        // Subscribe to changes for all required components
        const listeners: Array<() => void> = [];

        for (const componentType of this.componentTypes) {
            const unsub = world.onComponentChange(
                componentType,
                (change) => this.onComponentChanged(world, change)
            );
            listeners.push(unsub);
        }

        // Combined unsubscribe
        this.unsubscribe = () => {
            for (const unsub of listeners) {
                unsub();
            }
        };
    }

    shutdown(world: World): void {
        this.unsubscribe?.();
    }

    // Override update to do nothing (change-based)
    update(world: World, deltaTime: number): void {
        // Changes are processed in callbacks
    }

    // Subclasses implement this instead of update
    abstract onComponentChanged(
        world: World,
        change: ComponentChange
    ): void;
}
```

---

## API Examples

### Basic Change Subscription

```typescript
const world = new World();

// Subscribe to all position changes
const unsubscribe = world.onComponentChange<PositionComponent>(
    'position',
    (change) => {
        console.log(`Entity ${change.entityId} position changed`);
        console.log(`Old:`, change.oldValue);
        console.log(`New:`, change.newValue);
    },
    {
        includeOldValue: true,
        includeNewValue: true
    }
);

// Later, unsubscribe
unsubscribe();
```

### Field-Level Tracking

```typescript
// Only notify when health.hp changes
world.onFieldChange<HealthComponent>(
    'health',
    'hp',
    (change) => {
        console.log(`Entity ${change.entityId} HP: ${change.oldValue} -> ${change.newValue}`);

        if (change.newValue === 0) {
            console.log('Entity died!');
        }
    }
);
```

### Tracked Component (Automatic Field Detection)

```typescript
// Get component with automatic change tracking
const pos = world.getTrackedComponent<PositionComponent>(entity, 'position');

if (pos) {
    pos.x = 100; // Automatically tracked!
    pos.y = 200; // Change event fired with changedFields: ['x', 'y']
}
```

### Change History

```typescript
// Get all changes for an entity
const history = world.getChangeHistory({
    entityId: myEntity,
    since: Date.now() - 5000 // Last 5 seconds
});

console.log(`Entity had ${history.length} changes in last 5 seconds`);
```

### Change-Based System

```typescript
class DamageFlashSystem extends ChangeBasedSystem {
    readonly name = 'DamageFlashSystem';
    readonly componentTypes = ['health'];

    onComponentChanged(world: World, change: ComponentChange): void {
        if (change.changeType !== 'modified') return;

        const oldHealth = change.oldValue as HealthComponent;
        const newHealth = change.newValue as HealthComponent;

        // Check if HP decreased
        if (oldHealth && newHealth && newHealth.hp < oldHealth.hp) {
            // Flash entity red
            this.flashRed(change.entityId);
        }
    }

    private flashRed(entityId: number): void {
        // Visual feedback for damage
    }
}
```

### Reactive Query Invalidation

```typescript
// Automatically invalidate query when components change
world.onComponentChange('position', (change) => {
    // Could invalidate spatial partitioning here
    spatialGrid.invalidate(change.entityId);
});
```

### Batched Changes

```typescript
// Batch changes for better performance
world.dirtyTracker.enableBatching();

// Make many changes
for (let i = 0; i < 1000; i++) {
    world.addComponent(entities[i], { type: 'position', x: i, y: i });
}

// Flush all at once
world.dirtyTracker.disableBatching(); // Automatically flushes
```

---

## Implementation Plan

### Phase 1: Change Event Infrastructure (Week 1)
1. Define change event types
2. Update `DirtyTracker` with listener support
3. Implement subscription API
4. Add change recording
5. Write unit tests

**Files to Modify:**
- `src/core/performance/DirtyTracker.ts`
- `src/core/performance/DirtyTracker.test.ts`

**Files to Create:**
- `src/core/ecs/ChangeEvent.ts`

### Phase 2: Field-Level Tracking (Week 2)
1. Implement component proxy
2. Add field-level listeners
3. Integrate with World
4. Write tests

**Files to Create:**
- `src/core/ecs/ComponentProxy.ts`
- `src/core/ecs/ComponentProxy.test.ts`

### Phase 3: Change History (Week 2)
1. Implement change history storage
2. Add history query API
3. Add size limits and eviction
4. Write tests

**Files to Modify:**
- `src/core/performance/DirtyTracker.ts`

### Phase 4: World Integration (Week 3)
1. Add change subscription methods to World
2. Update component add/remove to record changes
3. Add batching support
4. Write integration tests

**Files to Modify:**
- `src/core/ecs/World.ts`
- `src/core/ecs/World.test.ts`

### Phase 5: System Patterns (Week 3)
1. Create `ChangeBasedSystem` base class
2. Create example implementations
3. Documentation

**Files to Create:**
- `src/core/ecs/ChangeBasedSystem.ts`
- `examples/change-detection-example.ts`

---

## Performance Considerations

### Overhead
- No listeners: Zero overhead (existing behavior)
- With listeners: ~5μs per change
- Field tracking proxy: ~10μs per field access
- History tracking: ~1KB per 100 changes

### Optimization Strategies
1. **Lazy Proxy Creation**: Only create proxies when requested
2. **Batching**: Batch changes for bulk operations
3. **Selective Tracking**: Only track components that need it
4. **History Limits**: Enforce max history size to prevent memory leaks

---

## Testing Requirements

### Unit Tests
- Change event creation
- Listener subscription/unsubscription
- Field-level change detection
- Change history storage and queries
- Batching behavior

### Integration Tests
- World component add/remove recording
- Listener notification
- Field proxy tracking
- System integration

### Performance Tests
- Overhead benchmarks
- Memory usage
- Listener scalability

---

## Success Criteria

- ✅ Change listeners implemented
- ✅ Field-level tracking working
- ✅ Change history functional
- ✅ Backward compatibility maintained
- ✅ Performance overhead <10% when not used
- ✅ All tests passing (>90% coverage)
- ✅ Documentation complete
- ✅ Example systems created
