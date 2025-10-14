# Technical Spec: Serialization & Persistence

**Status:** Interface Defined, Core Implementation Needed
**Priority:** Critical (1.0 Release)
**Estimated Effort:** 3-4 weeks
**Dependencies:** None

---

## Overview

Build a comprehensive serialization and persistence system that allows saving/loading complete game state, with support for versioning, selective serialization, and multiple storage backends.

## Current State

### What Exists
- ✅ `StoragePlugin` interface defined in `src/core/plugins/StoragePlugin.ts`
- ✅ `BaseStoragePlugin` abstract class with utility methods
- ✅ Example implementation: `SQLitePersistenceSystem` in `examples/sqlite-persistence-example.ts`
- ✅ Network message serialization in `src/core/websocket/MessageSerializer.ts`

### What's Missing
- ❌ Built-in `World` serialization/deserialization
- ❌ Component registry with type information
- ❌ Versioned format handling
- ❌ Selective serialization (filters)
- ❌ Snapshot system for replay/undo
- ❌ Integration of `StoragePlugin` into core `World`

---

## Design Goals

1. **Zero-Copy Where Possible**: Minimize data copying during serialization
2. **Type-Safe**: Leverage TypeScript for component schema validation
3. **Versioned**: Support loading old save files with migration
4. **Flexible**: Support multiple backends (file, SQLite, Redis, memory)
5. **Selective**: Allow filtering which entities/components to save
6. **Efficient**: Fast save/load for large game worlds

---

## Technical Design

### 1. Component Registry

**Location:** `src/core/ecs/ComponentRegistry.ts`

```typescript
interface ComponentSchema {
    type: string;
    version: number;
    factory: (data: unknown) => Component;
    validator?: (data: unknown) => boolean;
    migrator?: (data: unknown, fromVersion: number) => unknown;
}

class ComponentRegistry {
    private schemas = new Map<string, ComponentSchema>();

    registerComponent(schema: ComponentSchema): void;
    getSchema(type: string): ComponentSchema | undefined;
    validateComponent(type: string, data: unknown): boolean;
    migrateComponent(type: string, data: unknown, fromVersion: number): unknown;
}
```

**Why:** Need runtime component type information for serialization and versioning.

### 2. World Serialization

**Location:** `src/core/ecs/WorldSerializer.ts`

```typescript
interface SerializedWorld {
    version: number;
    timestamp: number;
    metadata: {
        entityCount: number;
        componentTypes: string[];
        customData?: Record<string, unknown>;
    };
    entities: SerializedEntity[];
}

interface SerializedEntity {
    id: number;
    archetype: string; // For fast restoration
    components: Array<{
        type: string;
        version: number;
        data: unknown;
    }>;
}

interface SerializationOptions {
    // Filter which entities to save
    entityFilter?: (entityId: number, world: World) => boolean;

    // Filter which components to save
    componentFilter?: (componentType: string) => boolean;

    // Include metadata
    includeMetadata?: boolean;

    // Pretty print JSON (larger but readable)
    prettyPrint?: boolean;

    // Compression level (if backend supports it)
    compression?: number;
}

class WorldSerializer {
    constructor(private registry: ComponentRegistry);

    serialize(world: World, options?: SerializationOptions): SerializedWorld;
    deserialize(data: SerializedWorld, world: World): void;

    // Binary format for performance
    serializeBinary(world: World, options?: SerializationOptions): ArrayBuffer;
    deserializeBinary(buffer: ArrayBuffer, world: World): void;

    // Snapshot system
    createSnapshot(world: World, label?: string): Snapshot;
    restoreSnapshot(snapshot: Snapshot, world: World): void;
}
```

**Key Features:**
- Preserve entity IDs where possible
- Handle ID conflicts on load
- Validate component versions
- Run migrations automatically
- Support incremental serialization (dirty tracking)

### 3. Storage Backend Integration

**Location:** `src/core/ecs/WorldStorage.ts`

```typescript
class WorldStorage {
    constructor(
        private world: World,
        private serializer: WorldSerializer,
        private backend: StoragePlugin
    );

    async save(key: string, options?: SerializationOptions): Promise<void>;
    async load(key: string): Promise<boolean>;
    async delete(key: string): Promise<boolean>;
    async exists(key: string): Promise<boolean>;
    async listSaves(prefix?: string): Promise<string[]>;

    // Auto-save support
    enableAutoSave(interval: number, key: string): void;
    disableAutoSave(): void;

    // Snapshot management
    async saveSnapshot(label: string): Promise<string>;
    async loadSnapshot(snapshotId: string): Promise<boolean>;
    async listSnapshots(): Promise<SnapshotMetadata[]>;
}
```

**Why:** Provides high-level API for users while leveraging `StoragePlugin` abstraction.

### 4. Built-in Storage Implementations

**File Storage:** `src/core/storage/FileStoragePlugin.ts`
```typescript
class FileStoragePlugin extends BaseStoragePlugin {
    readonly name = 'FileStoragePlugin';
    readonly version = '1.0.0';

    constructor(config: {
        baseDir: string;
        fileExtension?: string;
    });

    // Implements all BaseStoragePlugin methods
}
```

**Memory Storage:** `src/core/storage/MemoryStoragePlugin.ts`
```typescript
class MemoryStoragePlugin extends BaseStoragePlugin {
    readonly name = 'MemoryStoragePlugin';
    readonly version = '1.0.0';

    // In-memory storage for testing
    // Volatile, data lost on restart
}
```

**SQLite Storage:** `src/core/storage/SQLiteStoragePlugin.ts`
```typescript
class SQLiteStoragePlugin extends BaseStoragePlugin {
    readonly name = 'SQLiteStoragePlugin';
    readonly version = '1.0.0';

    constructor(config: {
        dbPath: string;
        poolSize?: number;
    });

    // Leverages Bun's built-in SQLite
    // Transaction support for atomicity
}
```

### 5. Snapshot System

**Location:** `src/core/ecs/SnapshotManager.ts`

```typescript
interface Snapshot {
    id: string;
    label?: string;
    timestamp: number;
    data: SerializedWorld;
}

interface SnapshotMetadata {
    id: string;
    label?: string;
    timestamp: number;
    entityCount: number;
    sizeBytes: number;
}

class SnapshotManager {
    private snapshots = new Map<string, Snapshot>();
    private maxSnapshots = 100; // LRU eviction

    createSnapshot(world: World, label?: string): Snapshot;
    restoreSnapshot(snapshotId: string, world: World): void;
    deleteSnapshot(snapshotId: string): boolean;
    listSnapshots(): SnapshotMetadata[];

    // Diff between snapshots for delta compression
    diffSnapshots(from: string, to: string): SnapshotDiff;
    applyDiff(snapshot: Snapshot, diff: SnapshotDiff): Snapshot;
}
```

**Use Cases:**
- Undo/redo functionality
- Replay systems
- Time travel debugging
- Checkpoint/restore for AI training

---

## API Examples

### Basic Save/Load

```typescript
import { World, ComponentRegistry, WorldSerializer, WorldStorage, FileStoragePlugin } from '@danjdewhurst/ecs-ts';

// Setup
const world = new World();
const registry = new ComponentRegistry();
const serializer = new WorldSerializer(registry);
const backend = new FileStoragePlugin({ baseDir: './saves' });
const storage = new WorldStorage(world, serializer, backend);

// Register component schemas
registry.registerComponent({
    type: 'position',
    version: 1,
    factory: (data) => data as PositionComponent,
    validator: (data) => {
        const d = data as any;
        return typeof d.x === 'number' && typeof d.y === 'number';
    }
});

// Save game
await storage.save('save-slot-1');

// Load game
const loaded = await storage.load('save-slot-1');
if (loaded) {
    console.log('Game loaded successfully');
}
```

### Selective Serialization

```typescript
// Save only player entities
await storage.save('player-only', {
    entityFilter: (entityId, world) => {
        return world.hasComponent(entityId, 'player');
    },
    componentFilter: (type) => {
        // Don't save temporary effects
        return type !== 'particle-effect';
    }
});
```

### Auto-Save

```typescript
// Auto-save every 5 minutes
storage.enableAutoSave(5 * 60 * 1000, 'autosave');

// Disable when done
storage.disableAutoSave();
```

### Snapshots

```typescript
// Create snapshot
const snapshot = snapshotManager.createSnapshot(world, 'Before Boss Fight');

// Player dies, restore
snapshotManager.restoreSnapshot(snapshot.id, world);

// List all snapshots
const snapshots = snapshotManager.listSnapshots();
```

### Component Versioning & Migration

```typescript
registry.registerComponent({
    type: 'health',
    version: 2,
    factory: (data) => data as HealthComponent,
    migrator: (data, fromVersion) => {
        if (fromVersion === 1) {
            // V1 had only 'hp', V2 adds 'maxHp'
            const v1 = data as { hp: number };
            return { hp: v1.hp, maxHp: 100 };
        }
        return data;
    }
});
```

---

## Implementation Plan

### Phase 1: Component Registry (Week 1)
1. Create `ComponentRegistry` class
2. Add registration API
3. Implement validation
4. Build migration system
5. Write tests

**Files to Create:**
- `src/core/ecs/ComponentRegistry.ts`
- `src/core/ecs/ComponentRegistry.test.ts`

### Phase 2: World Serialization (Week 1-2)
1. Define serialization format
2. Implement `WorldSerializer` class
3. Build JSON serialization
4. Build binary serialization
5. Add filtering support
6. Write comprehensive tests

**Files to Create:**
- `src/core/ecs/WorldSerializer.ts`
- `src/core/ecs/WorldSerializer.test.ts`

### Phase 3: Storage Backend Integration (Week 2)
1. Create `WorldStorage` class
2. Implement save/load methods
3. Add auto-save support
4. Build storage backend implementations
5. Write integration tests

**Files to Create:**
- `src/core/ecs/WorldStorage.ts`
- `src/core/ecs/WorldStorage.test.ts`
- `src/core/storage/FileStoragePlugin.ts`
- `src/core/storage/MemoryStoragePlugin.ts`
- `src/core/storage/SQLiteStoragePlugin.ts`
- `src/core/storage/index.ts`

### Phase 4: Snapshot System (Week 3)
1. Create `SnapshotManager` class
2. Implement snapshot CRUD
3. Build diff system
4. Add LRU eviction
5. Write tests

**Files to Create:**
- `src/core/ecs/SnapshotManager.ts`
- `src/core/ecs/SnapshotManager.test.ts`

### Phase 5: Integration & Polish (Week 4)
1. Integrate into `World` class
2. Update examples
3. Write comprehensive documentation
4. Performance testing
5. Edge case handling

**Files to Update:**
- `src/core/ecs/World.ts`
- `src/index.ts`
- `examples/`
- `README.md`

---

## Testing Requirements

### Unit Tests
- Component registry validation
- Component migration
- World serialization (empty, small, large)
- Binary format correctness
- Storage backend operations
- Snapshot creation/restoration

### Integration Tests
- Save → Load → Verify world state
- Versioned component migration
- Auto-save functionality
- Concurrent save operations
- Large world performance

### Edge Cases
- Empty world
- World with no components
- Circular references in components
- Invalid component data
- Version mismatch handling
- Storage backend failures

---

## Performance Considerations

1. **Lazy Serialization**: Only serialize dirty entities when using incremental saves
2. **Streaming**: For large worlds, stream data instead of loading entirely into memory
3. **Compression**: Use gzip/brotli for file storage, especially for large worlds
4. **Binary Format**: Prefer binary for performance-critical applications
5. **Pooling**: Reuse buffers during serialization to reduce GC pressure

### Benchmarks

Target performance (1000 entities, 5 components each):
- JSON serialization: < 50ms
- Binary serialization: < 20ms
- JSON deserialization: < 100ms
- Binary deserialization: < 50ms
- File save: < 200ms
- File load: < 300ms

---

## Migration Path

### For Existing Users

1. No breaking changes to existing APIs
2. `StoragePlugin` interface remains unchanged
3. Optional feature - users can continue without it
4. Provide migration guide from manual serialization

### Example Migration

**Before:**
```typescript
// Manual serialization
const data = JSON.stringify({
    entities: world.getEntityCount(),
    // ... manual data extraction
});
```

**After:**
```typescript
// Built-in serialization
const storage = new WorldStorage(world, serializer, backend);
await storage.save('game-state');
```

---

## Documentation Requirements

1. **API Reference**: Complete API docs for all classes
2. **User Guide**: How to use serialization system
3. **Backend Guide**: How to implement custom storage backends
4. **Migration Guide**: Versioning and migration strategies
5. **Examples**: Multiple example implementations
6. **Performance Guide**: Optimization tips

---

## Future Enhancements

1. **Delta Compression**: Only save changed entities
2. **Streaming**: Stream large saves instead of batch
3. **Cloud Storage**: Built-in cloud backend (S3, Firebase, etc.)
4. **Encryption**: Optional encryption for save files
5. **Multi-Save**: Support multiple concurrent worlds
6. **Replay Recording**: Record input sequence for replay
7. **Schema Evolution**: Automatic schema migration tools

---

## Success Criteria

- ✅ Can save/load complete world state
- ✅ Component versioning works with migrations
- ✅ At least 3 storage backends implemented
- ✅ Snapshot system working
- ✅ Performance benchmarks met
- ✅ Comprehensive test coverage (>90%)
- ✅ Documentation complete
- ✅ No breaking changes to existing APIs
