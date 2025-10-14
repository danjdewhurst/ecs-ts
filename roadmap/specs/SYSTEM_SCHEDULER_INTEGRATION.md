# Technical Spec: SystemScheduler Integration

**Status:** Designed But Not Implemented
**Priority:** High (1.1 Release)
**Estimated Effort:** 1-2 weeks
**Dependencies:** None

---

## Overview

Integrate the existing `SystemScheduler` class into the `World` class to replace simple priority-based sorting with dependency-aware scheduling. This enables proper system ordering, cycle detection, and sets the foundation for parallel system execution.

## Current State

### What Exists
- ✅ `SystemScheduler` class fully implemented in `src/core/ecs/SystemScheduler.ts`
- ✅ Dependency graph building
- ✅ Topological sorting
- ✅ Circular dependency detection
- ✅ Priority-based sorting within dependency levels
- ✅ System lifecycle methods (initialize/shutdown)
- ✅ Comprehensive tests in `SystemScheduler.test.ts`

### What's Being Used
- ⚠️ `World` class uses simple array sorting by priority
- ⚠️ No dependency validation
- ⚠️ No circular dependency detection
- ⚠️ System initialization/shutdown not managed

### The Problem

**Current World Implementation:**
```typescript
// src/core/ecs/World.ts:103-106
addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
}
```

This doesn't respect system dependencies at all. If SystemA depends on SystemB, but SystemA has higher priority, it will run first incorrectly.

---

## Design Goals

1. **Zero Breaking Changes**: Existing code continues to work
2. **Automatic Migration**: Systems without dependencies work as before
3. **Better Error Messages**: Clear errors for circular dependencies
4. **Enable Parallelism**: Foundation for future parallel execution
5. **Maintain Performance**: No noticeable overhead for scheduling

---

## Technical Design

### 1. World Class Integration

**Location:** `src/core/ecs/World.ts`

**Current Structure:**
```typescript
class World {
    private systems: System[] = [];
    // ...

    addSystem(system: System): void {
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    update(deltaTime: number): void {
        // Process events...
        for (const system of this.systems) {
            system.update(this, deltaTime);
        }
        // ...
    }
}
```

**New Structure:**
```typescript
class World {
    private systemScheduler = new SystemScheduler();
    private systemsInitialized = false;
    // ...

    addSystem(system: System): void {
        this.systemScheduler.addSystem(system);

        // If world is already running, initialize the system immediately
        if (this.systemsInitialized) {
            system.initialize?.(this);
        }
    }

    removeSystem(systemName: string): boolean {
        const system = this.systemScheduler.getSystem(systemName);
        if (system) {
            system.shutdown?.(this);
        }
        return this.systemScheduler.removeSystem(systemName);
    }

    getSystem(systemName: string): System | undefined {
        return this.systemScheduler.getSystem(systemName);
    }

    getSystems(): readonly System[] {
        return this.systemScheduler.getSystems();
    }

    getSystemExecutionOrder(): readonly System[] {
        return this.systemScheduler.getExecutionOrder();
    }

    update(deltaTime: number): void {
        // Initialize systems on first update
        if (!this.systemsInitialized) {
            this.systemScheduler.initializeSystems(this);
            this.systemsInitialized = true;
        }

        // Process events...
        this.flushComponentEvents();
        this.eventBus.processEvents();

        // Run systems in dependency order
        this.systemScheduler.update(this, deltaTime);

        // Process events generated during system updates
        this.eventBus.processEvents();

        // Clear dirty tracking after systems have run
        this.dirtyTracker.clearDirty();
    }

    shutdown(): void {
        this.systemScheduler.shutdownSystems(this);
        this.systemsInitialized = false;
    }
}
```

### 2. Backward Compatibility

**Challenge:** Existing systems might not define dependencies, relying solely on priority.

**Solution:** Hybrid approach
```typescript
// In SystemScheduler.ts - update topological sort
private topologicalSort(): System[] {
    // ... existing dependency sorting ...

    // Group systems by dependency level
    const levels = this.computeDependencyLevels();
    const levelGroups = new Map<number, System[]>();

    for (const system of sorted) {
        const level = levels.get(system.name) ?? 0;
        if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
        }
        levelGroups.get(level)?.push(system);
    }

    // Sort each level by priority (maintains existing behavior)
    const result: System[] = [];
    for (const level of Array.from(levelGroups.keys()).sort()) {
        const levelSystems = levelGroups.get(level);
        if (!levelSystems) continue;

        // Sort by priority within the same dependency level
        levelSystems.sort((a, b) => a.priority - b.priority);
        result.push(...levelSystems);
    }

    return result;
}
```

This ensures:
- Systems with dependencies are ordered correctly
- Systems at the same dependency level are ordered by priority
- Existing systems without dependencies work exactly as before

### 3. Enhanced Error Reporting

**Current Error:**
```typescript
throw new Error(`Circular dependency detected involving system '${systemName}'`);
```

**Enhanced Error:**
```typescript
private detectCycle(systemName: string, path: string[]): void {
    if (path.includes(systemName)) {
        const cycle = [...path, systemName].join(' -> ');
        throw new Error(
            `Circular dependency detected in system execution order:\n` +
            `  ${cycle}\n\n` +
            `Systems involved:\n` +
            path.map(name => {
                const sys = this.systems.find(s => s.name === name);
                return `  - ${name} (priority: ${sys?.priority ?? '?'}, ` +
                       `depends on: [${sys?.dependencies?.join(', ') ?? 'none'}])`;
            }).join('\n') +
            `\n\nTo fix this, remove one of the dependencies to break the cycle.`
        );
    }
}
```

### 4. System Introspection API

Add debugging and visualization helpers:

```typescript
class World {
    // ... existing methods ...

    /**
     * Get a visual representation of system execution order
     */
    getSystemDependencyGraph(): SystemDependencyGraph {
        return {
            systems: this.getSystems().map(s => ({
                name: s.name,
                priority: s.priority,
                dependencies: s.dependencies ?? [],
                dependents: this.getSystemDependents(s.name)
            })),
            executionOrder: this.getSystemExecutionOrder().map(s => s.name)
        };
    }

    /**
     * Get all systems that depend on the given system
     */
    private getSystemDependents(systemName: string): string[] {
        return this.getSystems()
            .filter(s => s.dependencies?.includes(systemName))
            .map(s => s.name);
    }

    /**
     * Validate system dependencies without adding to world
     */
    validateSystemDependencies(systems: System[]): ValidationResult {
        const tempScheduler = new SystemScheduler();
        try {
            for (const system of systems) {
                tempScheduler.addSystem(system);
            }
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

interface SystemDependencyGraph {
    systems: Array<{
        name: string;
        priority: number;
        dependencies: string[];
        dependents: string[];
    }>;
    executionOrder: string[];
}

interface ValidationResult {
    valid: boolean;
    error?: string;
}
```

---

## API Examples

### Basic Usage (No Changes Required)

```typescript
// Existing code works exactly the same
const world = new World();
world.addSystem(new RenderSystem());
world.addSystem(new PhysicsSystem());
world.update(1/60);
```

### Using Dependencies

```typescript
class PhysicsSystem extends BaseSystem {
    readonly name = 'PhysicsSystem';
    readonly priority = 1;
    // No dependencies
}

class CollisionSystem extends BaseSystem {
    readonly name = 'CollisionSystem';
    readonly priority = 2;
    readonly dependencies = ['PhysicsSystem']; // Runs after physics
}

class DamageSystem extends BaseSystem {
    readonly name = 'DamageSystem';
    readonly priority = 1; // Higher priority but runs after collision
    readonly dependencies = ['CollisionSystem'];
}

const world = new World();
world.addSystem(new DamageSystem());    // Added first
world.addSystem(new PhysicsSystem());   // Added second
world.addSystem(new CollisionSystem()); // Added third

// Execution order: PhysicsSystem -> CollisionSystem -> DamageSystem
// (regardless of add order or priority, dependencies are respected)
```

### Error Handling

```typescript
class SystemA extends BaseSystem {
    readonly name = 'SystemA';
    readonly dependencies = ['SystemB'];
}

class SystemB extends BaseSystem {
    readonly name = 'SystemB';
    readonly dependencies = ['SystemA']; // Circular!
}

try {
    world.addSystem(new SystemA());
    world.addSystem(new SystemB()); // Throws here
} catch (error) {
    console.error(error.message);
    // Circular dependency detected in system execution order:
    //   SystemA -> SystemB -> SystemA
    //
    // Systems involved:
    //   - SystemA (priority: 0, depends on: [SystemB])
    //   - SystemB (priority: 0, depends on: [SystemA])
    //
    // To fix this, remove one of the dependencies to break the cycle.
}
```

### System Introspection

```typescript
// Get execution order
const order = world.getSystemExecutionOrder();
console.log('Systems will run in this order:');
order.forEach((system, i) => {
    console.log(`${i + 1}. ${system.name}`);
});

// Get dependency graph
const graph = world.getSystemDependencyGraph();
console.log('System Dependency Graph:', JSON.stringify(graph, null, 2));

// Validate before adding
const validation = world.validateSystemDependencies([
    new SystemA(),
    new SystemB(),
    new SystemC()
]);

if (!validation.valid) {
    console.error('Cannot add systems:', validation.error);
}
```

### System Lifecycle

```typescript
class DatabaseSystem extends BaseSystem {
    readonly name = 'DatabaseSystem';
    private db?: Database;

    initialize(world: World): void {
        this.db = new Database('game.db');
        console.log('Database connection opened');
    }

    update(world: World, deltaTime: number): void {
        // Use this.db
    }

    shutdown(world: World): void {
        this.db?.close();
        console.log('Database connection closed');
    }
}

const world = new World();
world.addSystem(new DatabaseSystem());

// initialize() called on first update
world.update(0);

// shutdown() called when world is done
world.shutdown();
```

---

## Implementation Plan

### Phase 1: Core Integration (Week 1, Days 1-3)

1. **Update World class**
   - Replace `systems` array with `systemScheduler`
   - Update `addSystem()` to use scheduler
   - Update `removeSystem()` to use scheduler
   - Update `update()` to use `scheduler.update()`
   - Add `shutdown()` method
   - Maintain backward compatibility

2. **Update World tests**
   - Test system execution order with dependencies
   - Test circular dependency detection
   - Test priority within dependency levels
   - Test system lifecycle (initialize/shutdown)
   - Test backward compatibility

**Files to Modify:**
- `src/core/ecs/World.ts`
- `src/core/ecs/World.test.ts`

### Phase 2: Enhanced Features (Week 1, Days 4-5)

1. **Add introspection API**
   - `getSystemDependencyGraph()`
   - `validateSystemDependencies()`
   - Enhanced error messages

2. **Update SystemScheduler if needed**
   - Improve error messages
   - Add cycle path detection
   - Performance optimizations

**Files to Modify:**
- `src/core/ecs/World.ts`
- `src/core/ecs/SystemScheduler.ts`

### Phase 3: Documentation & Examples (Week 2)

1. **Update documentation**
   - API documentation for new methods
   - Migration guide for existing users
   - Best practices for system dependencies

2. **Create examples**
   - System dependency example
   - Complex execution order example
   - Error handling example

3. **Update existing examples**
   - Add dependencies where appropriate
   - Show best practices

**Files to Create/Modify:**
- `examples/system-dependencies-example.ts`
- `README.md`
- API documentation
- Migration guide

### Phase 4: Testing & Polish (Week 2)

1. **Integration testing**
   - Test with real-world system graphs
   - Performance benchmarking
   - Stress testing (many systems)

2. **Edge case handling**
   - Empty world
   - Single system
   - Many systems with complex dependencies
   - Dynamic system add/remove

**Files to Update:**
- Add more test cases
- Performance benchmarks

---

## Testing Requirements

### Unit Tests (Already Exist for SystemScheduler)
- ✅ System addition/removal
- ✅ Dependency resolution
- ✅ Circular dependency detection
- ✅ Priority sorting within levels
- ✅ Initialize/shutdown ordering

### New Integration Tests (World)
- World with SystemScheduler integration
- System execution order matches dependencies
- System initialization on first update
- System shutdown on world shutdown
- Dynamic system add during gameplay
- System removal during gameplay
- Empty world edge cases

### Backward Compatibility Tests
- Systems without dependencies work
- Priority-only ordering maintained
- Existing examples still work

---

## Performance Considerations

### Scheduling Overhead

**Current:** O(n log n) sort on every `addSystem()`
**New:** O(n + e) topological sort where n=systems, e=dependencies

For typical games (<100 systems), overhead is negligible:
- Schedule computation: ~1ms
- Runtime overhead: 0ms (same loop iteration)

### Optimization

Cache execution order and only recompute when systems change:

```typescript
private executionOrderDirty = true;
private cachedExecutionOrder: System[] = [];

addSystem(system: System): void {
    this.systems.push(system);
    this.executionOrderDirty = true;
}

getExecutionOrder(): readonly System[] {
    if (this.executionOrderDirty) {
        this.computeExecutionOrder();
        this.executionOrderDirty = false;
    }
    return this.cachedExecutionOrder;
}
```

---

## Migration Path

### For Existing Users

**No changes required.** Systems without dependencies work exactly as before.

**Optional migration:** Add dependencies for better ordering

```typescript
// Before (relies on priority)
class PhysicsSystem extends BaseSystem {
    readonly priority = 1;
}

class CollisionSystem extends BaseSystem {
    readonly priority = 2; // Ensure runs after physics
}

// After (explicit dependencies)
class PhysicsSystem extends BaseSystem {
    readonly priority = 1;
}

class CollisionSystem extends BaseSystem {
    readonly priority = 1; // Priority doesn't matter now
    readonly dependencies = ['PhysicsSystem']; // Explicit
}
```

### Breaking Changes

**None.** This is a fully backward-compatible change.

---

## Documentation Requirements

1. **API Reference**
   - Document new World methods
   - Update System interface docs

2. **User Guide**
   - How to use system dependencies
   - When to use dependencies vs priority
   - Best practices

3. **Migration Guide**
   - How to migrate to dependency-based scheduling
   - Examples of before/after

4. **Examples**
   - Basic system dependencies
   - Complex execution order
   - Error handling

---

## Future Enhancements

Once SystemScheduler is integrated, it enables:

1. **Parallel Execution**
   - Systems at same dependency level can run in parallel
   - Read/write access annotations
   - Automatic parallelization

2. **Dynamic Scheduling**
   - Enable/disable systems at runtime
   - Conditional system execution
   - System groups/tags

3. **Performance Profiling**
   - Per-system timing
   - Dependency bottleneck detection
   - System performance visualization

4. **Hot Reloading**
   - Replace system implementations at runtime
   - Maintain execution order
   - Debug/development workflow

---

## Success Criteria

- ✅ SystemScheduler integrated into World
- ✅ All existing tests pass
- ✅ New integration tests pass
- ✅ No breaking changes
- ✅ System dependencies work correctly
- ✅ Circular dependencies detected with clear errors
- ✅ System lifecycle (initialize/shutdown) managed
- ✅ Documentation updated
- ✅ Examples created
- ✅ Performance benchmarks met (<5% overhead)

---

## Risk Assessment

**Low Risk** - This is a straightforward integration with minimal changes:
- SystemScheduler is already fully tested
- Changes are isolated to World class
- Backward compatibility maintained
- Can be completed in 1-2 weeks

**Main Risks:**
1. Subtle bugs in execution order - *Mitigated by comprehensive tests*
2. Performance regression - *Mitigated by benchmarking*
3. Breaking changes - *Mitigated by careful API design*
