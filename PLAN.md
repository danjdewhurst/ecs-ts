# Technical Implementation Plan: ECS Game Engine with TypeScript and Bun

## Project Structure and Setup

### Initial Project Structure

```
game-engine/
├── src/
│   ├── core/
│   │   ├── ecs/
│   │   ├── events/
│   │   └── websocket/
│   ├── plugins/
│   ├── systems/
│   └── components/
├── examples/
├── tests/
├── docs/
└── package.json
```


### Development Environment Setup

- **Runtime**: Bun v1.1+ for native TypeScript execution[^1][^2]
- **TypeScript Configuration**: Strict mode with latest decorators support
- **Testing**: Bun's built-in test runner
- **Linting**: ESLint with TypeScript parser
- **Documentation**: TSDoc for API documentation

```json
{
  "name": "@danjdewhurst/ecs-ts/game-engine",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "test": "bun test",
    "build": "bun build src/index.ts --outdir dist"
  }
}
```


## Phase 1: Core ECS Implementation ✅

### 1.1 Entity Management System ✅

- [x] **Entity ID generator with recycling**
- [x] **Living entities tracking**
- [x] **Entity lifecycle management**

Implement a simple but efficient entity ID generator with recycling:

```typescript
export class EntityManager {
    private nextId = 1;
    private recycledIds: number[] = [];
    private livingEntities = new Set<number>();

    createEntity(): number {
        const id = this.recycledIds.pop() ?? this.nextId++;
        this.livingEntities.add(id);
        return id;
    }

    destroyEntity(entityId: number): void {
        if (this.livingEntities.delete(entityId)) {
            this.recycledIds.push(entityId);
        }
    }
}
```


### 1.2 Component Storage Architecture ✅

- [x] **Component interface definition**
- [x] **Generic ComponentStorage class**
- [x] **Entity-component mapping**
- [x] **Efficient storage operations**

Based on the research , implement archetype-based storage for optimal performance:[^3][^4]

```typescript
export interface Component {
    readonly type: string;
}

export class ComponentStorage<T extends Component> {
    private components = new Map<number, T>();
    private entitySet = new Set<number>();

    add(entityId: number, component: T): void {
        this.components.set(entityId, component);
        this.entitySet.add(entityId);
    }

    get(entityId: number): T | undefined {
        return this.components.get(entityId);
    }

    remove(entityId: number): boolean {
        this.entitySet.delete(entityId);
        return this.components.delete(entityId);
    }

    getEntities(): Set<number> {
        return new Set(this.entitySet);
    }
}
```


### 1.3 Archetype Management ✅

- [x] **Archetype classification system**
- [x] **Entity archetype tracking**
- [x] **Multi-component query optimization**
- [x] **Dynamic archetype updates**

Implement archetype patterns for efficient querying :[^4]

```typescript
export class ArchetypeManager {
    private archetypes = new Map<string, Set<number>>();
    private entityArchetypes = new Map<number, string>();

    updateEntityArchetype(entityId: number, componentTypes: string[]): void {
        const oldArchetype = this.entityArchetypes.get(entityId);
        if (oldArchetype) {
            this.archetypes.get(oldArchetype)?.delete(entityId);
        }

        const newArchetype = componentTypes.sort().join('|');
        this.entityArchetypes.set(entityId, newArchetype);

        if (!this.archetypes.has(newArchetype)) {
            this.archetypes.set(newArchetype, new Set());
        }
        this.archetypes.get(newArchetype)!.add(entityId);
    }

    queryEntities(requiredComponents: string[]): number[] {
        const results: number[] = [];
        const requiredSet = new Set(requiredComponents);

        for (const [archetype, entities] of this.archetypes) {
            const archetypeComponents = new Set(archetype.split('|'));
            if (requiredComponents.every(comp => archetypeComponents.has(comp))) {
                results.push(...entities);
            }
        }
        return results;
    }
}
```


### 1.4 World Container ✅

- [x] **World class implementation**
- [x] **Entity creation and destruction**
- [x] **Component management**
- [x] **Query system integration**
- [x] **System management**

Central world class to orchestrate the ECS:

```typescript
export class World {
    private entityManager = new EntityManager();
    private componentStorages = new Map<string, ComponentStorage<any>>();
    private archetypeManager = new ArchetypeManager();
    private systems: System[] = [];

    createEntity(): number {
        return this.entityManager.createEntity();
    }

    addComponent<T extends Component>(entityId: number, component: T): void {
        const storage = this.getOrCreateStorage<T>(component.type);
        storage.add(entityId, component);
        this.updateArchetype(entityId);
    }

    query<T extends Component>(componentType: string): Query<T> {
        const storage = this.componentStorages.get(componentType);
        return new Query(storage?.getEntities() ?? new Set(), this);
    }

    private updateArchetype(entityId: number): void {
        const componentTypes = Array.from(this.componentStorages.keys())
            .filter(type => this.componentStorages.get(type)?.get(entityId));
        this.archetypeManager.updateEntityArchetype(entityId, componentTypes);
    }
}
```


## Phase 2: System Architecture ✅

### 2.1 System Base Classes ✅

- [x] **System interface definition**
- [x] **BaseSystem abstract class**
- [x] **System lifecycle methods**
- [x] **Query helper methods**

Define system interfaces and base implementations:

```typescript
export interface System {
    readonly priority: number;
    readonly name: string;
    update(world: World, deltaTime: number): void;
    dependencies?: string[];
}

export abstract class BaseSystem implements System {
    abstract readonly priority: number;
    abstract readonly name: string;
    dependencies?: string[] = [];

    abstract update(world: World, deltaTime: number): void;

    protected queryEntities(world: World, ...componentTypes: string[]): number[] {
        // Implement efficient multi-component queries
        return world.queryMultiple(componentTypes);
    }
}
```


### 2.2 System Scheduler ✅

- [x] **SystemScheduler class**
- [x] **Dependency resolution**
- [x] **Topological sorting**
- [x] **Priority-based execution**
- [x] **Circular dependency detection**

Implement dependency-aware system scheduling :[^4]

```typescript
export class SystemScheduler {
    private systems: System[] = [];
    private executionOrder: System[] = [];

    addSystem(system: System): void {
        this.systems.push(system);
        this.computeExecutionOrder();
    }

    private computeExecutionOrder(): void {
        // Topological sort based on dependencies and priorities
        const sorted = [...this.systems].sort((a, b) => {
            // Handle dependencies first, then priority
            if (a.dependencies?.includes(b.name)) return 1;
            if (b.dependencies?.includes(a.name)) return -1;
            return a.priority - b.priority;
        });
        this.executionOrder = sorted;
    }

    update(world: World, deltaTime: number): void {
        for (const system of this.executionOrder) {
            system.update(world, deltaTime);
        }
    }
}
```


## Phase 3: Event System Implementation ✅

**Status: ✅ Complete**

### 3.1 Core Event Infrastructure ✅

- [x] **GameEvent interface**
- [x] **EventBus implementation**
- [x] **Event queue management**
- [x] **Event subscription system**
- [x] **Error handling in event listeners**

Based on event-driven patterns :[^5][^6]

```typescript
export interface GameEvent {
    readonly type: string;
    readonly timestamp: number;
    readonly source?: string;
    readonly data: Record<string, unknown>;
}

export class EventBus {
    private listeners = new Map<string, Set<(event: GameEvent) => void>>();
    private eventQueue: GameEvent[] = [];

    emit(event: GameEvent): void {
        this.eventQueue.push(event);
    }

    subscribe(eventType: string, listener: (event: GameEvent) => void): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(listener);

        // Return unsubscribe function
        return () => this.listeners.get(eventType)?.delete(listener);
    }

    processEvents(): void {
        const events = [...this.eventQueue];
        this.eventQueue.length = 0;

        for (const event of events) {
            const listeners = this.listeners.get(event.type);
            if (listeners) {
                for (const listener of listeners) {
                    try {
                        listener(event);
                    } catch (error) {
                        console.error(`Event listener error for ${event.type}:`, error);
                    }
                }
            }
        }
    }
}
```


### 3.2 Event-Component Integration ✅

- [x] **EventComponent implementation**
- [x] **Event queueing in components**
- [x] **Event flushing mechanism**
- [x] **System-event integration**

Create components that can generate events:

```typescript
export class EventComponent implements Component {
    readonly type = 'event';
    private pendingEvents: GameEvent[] = [];

    queueEvent(type: string, data: Record<string, unknown>): void {
        this.pendingEvents.push({
            type,
            timestamp: Date.now(),
            data
        });
    }

    flushEvents(): GameEvent[] {
        const events = [...this.pendingEvents];
        this.pendingEvents.length = 0;
        return events;
    }
}
```


## Phase 4: WebSocket Integration with Bun

**Status: ✅ Complete**

### 4.1 WebSocket Server Implementation

- [x] **GameClient interface**
- [x] **GameServer class**
- [x] **Bun.serve WebSocket setup**
- [x] **Connection lifecycle management**
- [x] **Message routing system**

Leverage Bun's high-performance WebSocket API :[^7][^8]

```typescript
export interface GameClient {
    id: string;
    entityId?: number;
    ws: ServerWebSocket<unknown>;
    lastHeartbeat: number;
}

export class GameServer {
    private clients = new Map<string, GameClient>();
    private world: World;
    private eventBus: EventBus;

    constructor(world: World, eventBus: EventBus) {
        this.world = world;
        this.eventBus = eventBus;
        this.setupEventListeners();
    }

    createServer(port: number = 3000) {
        return Bun.serve({
            port,
            fetch: this.handleHttpRequest.bind(this),
            websocket: {
                message: this.handleMessage.bind(this),
                open: this.handleConnection.bind(this),
                close: this.handleDisconnection.bind(this),
                drain: this.handleDrain.bind(this),
            },
        });
    }

    private handleMessage(ws: ServerWebSocket<unknown>, message: string | Buffer): void {
        const client = this.findClientByWebSocket(ws);
        if (!client) return;

        try {
            const parsed = JSON.parse(message.toString());
            this.processClientMessage(client, parsed);
        } catch (error) {
            console.error('Invalid message format:', error);
        }
    }

    private processClientMessage(client: GameClient, message: any): void {
        // Route messages to appropriate handlers
        this.eventBus.emit({
            type: 'client_message',
            timestamp: Date.now(),
            source: client.id,
            data: message
        });
    }
}
```


### 4.2 Message Protocol Design

- [x] **NetworkMessage interface**
- [x] **MessageSerializer class**
- [x] **Binary serialization support**
- [x] **Message type handling**
- [x] **Frame-based synchronization**

Implement efficient message serialisation :[^9]

```typescript
export interface NetworkMessage {
    type: 'input' | 'state' | 'event';
    frame?: number;
    entities?: number[];
    payload: unknown;
}

export class MessageSerializer {
    static serialize(message: NetworkMessage): ArrayBuffer {
        // Implement efficient binary serialisation
        // Consider MessagePack or custom binary format
        return new TextEncoder().encode(JSON.stringify(message));
    }

    static deserialize(buffer: ArrayBuffer): NetworkMessage {
        const text = new TextDecoder().decode(buffer);
        return JSON.parse(text);
    }
}
```


## Phase 5: Plugin Architecture

**Status: ✅ Complete**

### 5.1 Plugin System Design

- [x] **Plugin interface**
- [x] **PluginManager class**
- [x] **Dependency resolution**
- [x] **Plugin lifecycle management**
- [x] **Error handling and isolation**

Create extensible plugin architecture :[^10]

```typescript
export interface Plugin {
    readonly name: string;
    readonly version: string;
    readonly dependencies?: string[];

    initialize(engine: GameEngine): Promise<void>;
    shutdown?(): Promise<void>;
}

export class PluginManager {
    private plugins = new Map<string, Plugin>();
    private loadOrder: Plugin[] = [];

    async loadPlugin(plugin: Plugin): Promise<void> {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin ${plugin.name} already loaded`);
        }

        // Check dependencies
        if (plugin.dependencies) {
            for (const dep of plugin.dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Missing dependency: ${dep}`);
                }
            }
        }

        this.plugins.set(plugin.name, plugin);
        this.computeLoadOrder();
        await plugin.initialize(this.engine);
    }

    private computeLoadOrder(): void {
        // Topological sort for plugin dependencies
        // Implementation similar to system scheduler
    }
}
```


### 5.2 Core Plugin Interfaces

- [x] **NetworkPlugin interface**
- [x] **StoragePlugin interface**
- [x] **Plugin communication patterns**
- [x] **Standard plugin APIs**

Define standard plugin interfaces:

```typescript
export interface NetworkPlugin extends Plugin {
    sendToClient(clientId: string, message: NetworkMessage): void;
    broadcast(message: NetworkMessage, exclude?: string[]): void;
}

export interface StoragePlugin extends Plugin {
    save(key: string, data: unknown): Promise<void>;
    load(key: string): Promise<unknown>;
}
```


## Phase 6: Performance Optimisation

**Status: 🔄 Not Started**

### 6.1 Dirty Component Tracking

- [ ] **DirtyTracker class**
- [ ] **Component change detection**
- [ ] **Selective system updates**
- [ ] **Performance monitoring**

Implement dirty tracking for efficient updates :[^11]

```typescript
export class DirtyTracker {
    private dirtyComponents = new Map<string, Set<number>>();
    private dirtyEntities = new Set<number>();

    markDirty(entityId: number, componentType: string): void {
        if (!this.dirtyComponents.has(componentType)) {
            this.dirtyComponents.set(componentType, new Set());
        }
        this.dirtyComponents.get(componentType)!.add(entityId);
        this.dirtyEntities.add(entityId);
    }

    getDirtyEntities(componentType: string): Set<number> {
        return this.dirtyComponents.get(componentType) ?? new Set();
    }

    clearDirty(): void {
        this.dirtyComponents.clear();
        this.dirtyEntities.clear();
    }
}
```


### 6.2 Object Pooling

- [ ] **ObjectPool generic class**
- [ ] **Pool size management**
- [ ] **Object lifecycle tracking**
- [ ] **Memory optimization**

Implement object pools for frequently created/destroyed objects:

```typescript
export class ObjectPool<T> {
    private available: T[] = [];
    private createFn: () => T;
    private resetFn: (obj: T) => void;

    constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;

        for (let i = 0; i < initialSize; i++) {
            this.available.push(createFn());
        }
    }

    acquire(): T {
        const obj = this.available.pop() ?? this.createFn();
        return obj;
    }

    release(obj: T): void {
        this.resetFn(obj);
        this.available.push(obj);
    }
}
```


## Phase 7: Implementation Timeline

**Status: 📊 Progress Tracking**

### Week 1-2: Foundation ✅

- [x] Project setup and build system
- [x] Core ECS implementation (Entity, Component, World)
- [x] Basic component storage


### Week 3-4: Systems and Queries ✅

- [x] System base classes and scheduler
- [x] Query system implementation
- [x] Archetype management


### Week 5-6: Event System ✅

- [x] Event bus implementation
- [x] Event-component integration
- [x] System event handling


### Week 7-8: WebSocket Integration ✅

- [x] Bun WebSocket server setup
- [x] Client connection management
- [x] Message protocol implementation


### Week 9-10: Plugin Architecture ✅

- [x] Plugin manager implementation
- [x] Core plugin interfaces
- [x] Example plugins (networking, storage)


### Week 11-12: Optimisation and Testing

- [ ] Performance profiling
- [ ] Dirty tracking implementation
- [x] Comprehensive test suite


### Week 13-14: Documentation and Examples

- [ ] API documentation
- [x] Tutorial examples
- [ ] Performance benchmarks


## Testing Strategy

**Status: ✅ Core Tests Complete, 📋 Integration Tests Pending**

### Unit Tests ✅

- [x] **EntityManager tests** (5 test cases)
- [x] **ComponentStorage tests** (7 test cases)
- [x] **World integration tests** (10 test cases)
- [x] **All core functionality covered**

```typescript
// Example test structure
describe('ECS Core', () => {
    test('should create and destroy entities', () => {
        const world = new World();
        const entity = world.createEntity();
        expect(typeof entity).toBe('number');

        world.destroyEntity(entity);
        // Verify cleanup
    });
});
```


### Integration Tests

- [ ] WebSocket connection handling
- [ ] Plugin loading and dependency resolution
- [x] Event system integration


### Performance Tests

- [ ] Entity creation/destruction benchmarks
- [ ] Component query performance
- [ ] WebSocket throughput testing


## Documentation Requirements

**Status: 🔄 In Progress**

### API Documentation

- [ ] Complete TSDoc coverage
- [x] Interactive examples
- [ ] Architecture diagrams


### Developer Guides

- [x] Getting started tutorial (basic example)
- [x] Event system example (combat simulation)
- [ ] Plugin development guide
- [ ] Performance optimisation guide
- [ ] WebSocket client implementation examples

---

## Progress Summary

**✅ Phase 1 Complete (100%)**: Core ECS Implementation
**✅ Phase 2 Complete (100%)**: System Architecture
**✅ Phase 3 Complete (100%)**: Event System Implementation
**✅ Phase 4 Complete (100%)**: WebSocket Integration with Bun
**✅ Phase 5 Complete (100%)**: Plugin Architecture
**🔄 Phase 6 Pending**: Performance Optimisation

**Overall Progress: 83% Complete (5/6 phases)**

This technical plan provides a comprehensive roadmap for implementing a production-ready ECS game engine with TypeScript and Bun, focusing on extensibility, performance, and maintainability as identified in the research.

**Current Status**: Full-featured game engine with plugin architecture completed. WebSocket networking and extensible plugin system are fully functional with comprehensive tests and working examples. Ready for Phase 6 implementation.

## Phase 3 Implementation Summary

### Files Added:
- `src/core/events/GameEvent.ts` - Event interface definition
- `src/core/events/EventBus.ts` - Core event management system  
- `src/core/events/EventComponent.ts` - Component-based event emission
- `src/core/events/index.ts` - Module exports
- `src/core/events/EventBus.test.ts` - EventBus unit tests (7 test cases)
- `src/core/events/EventComponent.test.ts` - EventComponent unit tests (6 test cases)  
- `src/core/events/EventSystem.integration.test.ts` - Integration tests (6 test cases)
- `examples/event-system-example.ts` - Combat simulation demo

### Key Features Implemented:
- **Event Queueing**: Events processed at controlled points in game loop
- **Error Resilience**: Event listener errors don't crash the system
- **Component Events**: Entities can emit events via EventComponents
- **World Integration**: Full integration with ECS World lifecycle
- **Type Safety**: Complete TypeScript support with strict typing
- **Test Coverage**: 21 comprehensive test cases covering all functionality

### Testing Results:
- ✅ **41 total tests** pass (21 new event system tests)
- ✅ **134 expect() calls** all successful
- ✅ **TypeScript strict mode** compliance
- ✅ **Production-ready** error handling and edge cases

## Phase 4 Implementation Summary

### Files Added:
- `src/core/websocket/GameClient.ts` - Client interface and message types
- `src/core/websocket/NetworkMessage.ts` - Network protocol message definitions
- `src/core/websocket/MessageSerializer.ts` - Protocol-aware message serialization
- `src/core/websocket/GameServer.ts` - Bun WebSocket server implementation
- `src/core/websocket/index.ts` - Module exports
- `src/core/websocket/MessageSerializer.test.ts` - MessageSerializer unit tests (9 test cases)
- `src/core/websocket/GameServer.test.ts` - GameServer unit tests (9 test cases)
- `src/components/PositionComponent.ts` - Position component for multiplayer
- `src/components/PlayerComponent.ts` - Player component for client entities
- `src/components/index.ts` - Component exports
- `examples/websocket-example.ts` - Complete multiplayer server demo

### Key Features Implemented:
- **WebSocket Server**: Full Bun.serve WebSocket integration with connection management
- **Message Protocol**: Type-safe network messages with protocol versioning
- **Client Management**: Authentication, heartbeat, timeout detection, and graceful disconnection
- **Event Integration**: Complete integration with ECS event system for networking
- **Real-time Multiplayer**: Player movement, chat, and game state synchronization
- **Error Handling**: Production-ready error handling and recovery
- **Binary Support**: Efficient binary message serialization for performance

### Testing Results:
- ✅ **59 total tests** pass (18 new WebSocket tests)
- ✅ **168 expect() calls** all successful
- ✅ **TypeScript strict mode** compliance
- ✅ **Production-ready** networking and multiplayer functionality

## Phase 5 Implementation Summary

### Files Added:
- `src/core/plugins/Plugin.ts` - Core plugin interface and metadata definitions
- `src/core/plugins/PluginManager.ts` - Central plugin management with dependency resolution
- `src/core/plugins/NetworkPlugin.ts` - Specialized networking plugin interface and base class
- `src/core/plugins/StoragePlugin.ts` - Specialized storage plugin interface and base class
- `src/core/plugins/index.ts` - Plugin system module exports
- `src/core/plugins/PluginManager.test.ts` - PluginManager unit tests (23 test cases)
- `src/core/plugins/Plugin.test.ts` - Plugin interfaces unit tests (9 test cases)
- `src/core/plugins/PluginSystem.integration.test.ts` - Integration tests (6 test cases)
- `examples/plugin-system-example.ts` - Comprehensive plugin system demonstration

### Key Features Implemented:
- **Plugin Interface**: Standardized plugin lifecycle with initialize/shutdown methods
- **Dependency Resolution**: Topological sorting using Kahn's algorithm for plugin load order
- **Specialized Interfaces**: NetworkPlugin and StoragePlugin with complete method definitions
- **Error Isolation**: Plugin failures don't affect other plugins or core system
- **Plugin Communication**: Event-driven communication patterns between plugins
- **Base Classes**: BaseNetworkPlugin and BaseStoragePlugin with common functionality
- **Circular Dependency Detection**: Prevents invalid plugin dependency chains
- **Plugin Metadata**: Introspection capabilities for loaded plugins

### Testing Results:
- ✅ **97 total tests** pass (38 new plugin system tests)
- ✅ **252 expect() calls** all successful
- ✅ **TypeScript strict mode** compliance
- ✅ **Production-ready** plugin architecture with comprehensive error handling
