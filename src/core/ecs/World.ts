import {
    EventBus,
    type EventComponent,
    type GameEvent,
} from '../events/index.ts';
import { DirtyTracker } from '../performance/index.ts';
import {
    type DeserializationOptions,
    type DeserializationResult,
    type SerializationOptions,
    type SerializationResult,
    WorldSerializer,
    type WorldSnapshot,
} from '../serialization/index.ts';
import { ArchetypeManager } from './ArchetypeManager.ts';
import { type Component, ComponentStorage } from './Component.ts';
import { EntityManager } from './EntityManager.ts';
import { Query } from './Query.ts';
import type { System } from './System.ts';
import { SystemScheduler } from './SystemScheduler.ts';

export class World {
    private entityManager = new EntityManager();
    // biome-ignore lint/suspicious/noExplicitAny: ComponentStorage needs to handle heterogeneous component types
    private componentStorages = new Map<string, ComponentStorage<any>>();
    private archetypeManager = new ArchetypeManager();
    private systemScheduler = new SystemScheduler();
    private systemsInitialized = false;
    private eventBus = new EventBus();
    private dirtyTracker = new DirtyTracker();
    private worldSerializer = new WorldSerializer();

    createEntity(): number {
        return this.entityManager.createEntity();
    }

    destroyEntity(entityId: number): void {
        // Remove from all component storages
        for (const [_type, storage] of this.componentStorages) {
            storage.remove(entityId);
        }

        // Remove from archetype manager
        this.archetypeManager.removeEntity(entityId);

        // Clean up dirty tracking for this entity
        this.dirtyTracker.clearDirtyEntity(entityId);

        // Finally remove from entity manager
        this.entityManager.destroyEntity(entityId);
    }

    addComponent<T extends Component>(entityId: number, component: T): void {
        if (!this.entityManager.isEntityAlive(entityId)) {
            throw new Error(`Entity ${entityId} does not exist`);
        }

        const storage = this.getOrCreateStorage<T>(component.type);
        storage.add(entityId, component);
        this.updateArchetype(entityId);

        // Mark the entity as dirty for this component type
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
            // Mark the entity as dirty for this component type
            this.dirtyTracker.markDirty(entityId, componentType);
        }
        return removed;
    }

    getComponent<T extends Component>(
        entityId: number,
        componentType: string
    ): T | undefined {
        const storage = this.componentStorages.get(componentType);
        return storage?.get(entityId);
    }

    hasComponent(entityId: number, componentType: string): boolean {
        const storage = this.componentStorages.get(componentType);
        return storage?.has(entityId) ?? false;
    }

    query<T extends Component>(componentType: string): Query<T> {
        const storage = this.componentStorages.get(componentType);
        return new Query(
            storage?.getEntities() ?? new Set(),
            this,
            componentType
        );
    }

    queryMultiple(componentTypes: string[]): number[] {
        if (componentTypes.length === 0) {
            return [];
        }
        if (componentTypes.length === 1) {
            const storage = this.componentStorages.get(componentTypes[0] ?? '');
            return storage ? Array.from(storage.getEntities()) : [];
        }
        return this.archetypeManager.queryEntities(componentTypes);
    }

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

        // First flush any queued events from EventComponents
        this.flushComponentEvents();

        // Process queued events before systems update
        this.eventBus.processEvents();

        // Run systems in dependency order
        this.systemScheduler.update(this, deltaTime);

        // Process any events generated during system updates
        this.eventBus.processEvents();

        // Clear dirty tracking after systems have run
        this.dirtyTracker.clearDirty();
    }

    shutdown(): void {
        this.systemScheduler.shutdownSystems(this);
        this.systemsInitialized = false;
    }

    getEntityCount(): number {
        return this.entityManager.getEntityCount();
    }

    getComponentTypes(): string[] {
        return Array.from(this.componentStorages.keys());
    }

    getArchetypeStats(): Array<{ archetype: string; entityCount: number }> {
        return this.archetypeManager.getArchetypeStats();
    }

    // Event system methods
    emitEvent(event: GameEvent): void {
        this.eventBus.emit(event);
    }

    subscribeToEvent(
        eventType: string,
        listener: (event: GameEvent) => void
    ): () => void {
        return this.eventBus.subscribe(eventType, listener);
    }

    getEventBus(): EventBus {
        return this.eventBus;
    }

    // Dirty tracking methods for performance optimization
    getDirtyEntities(componentType: string): Set<number> {
        return this.dirtyTracker.getDirtyEntities(componentType);
    }

    getAllDirtyEntities(): Set<number> {
        return this.dirtyTracker.getAllDirtyEntities();
    }

    isEntityDirty(entityId: number): boolean {
        return this.dirtyTracker.isEntityDirty(entityId);
    }

    isComponentDirty(entityId: number, componentType: string): boolean {
        return this.dirtyTracker.isComponentDirty(entityId, componentType);
    }

    getDirtyTrackingStats(): {
        totalDirtyEntities: number;
        dirtyComponentTypes: number;
        averageDirtyPerType: number;
    } {
        return this.dirtyTracker.getStats();
    }

    markComponentDirty(entityId: number, componentType: string): void {
        this.dirtyTracker.markDirty(entityId, componentType);
    }

    /**
     * Get a visual representation of system execution order and dependencies
     */
    getSystemDependencyGraph(): SystemDependencyGraph {
        return {
            systems: this.getSystems().map((s) => ({
                name: s.name,
                priority: s.priority,
                dependencies: s.dependencies ?? [],
                dependents: this.getSystemDependents(s.name),
            })),
            executionOrder: this.getSystemExecutionOrder().map((s) => s.name),
        };
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
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get all systems that depend on the given system
     */
    private getSystemDependents(systemName: string): string[] {
        return this.getSystems()
            .filter((s) => s.dependencies?.includes(systemName))
            .map((s) => s.name);
    }

    // Serialization methods

    /**
     * Create a snapshot of the current world state.
     * The snapshot can be serialized to disk or network.
     *
     * @param options - Serialization options including filters
     * @returns Serialization result with snapshot data
     *
     * @example
     * ```typescript
     * const result = world.createSnapshot({
     *   filter: {
     *     excludeComponentTypes: ['debug', 'temporary']
     *   },
     *   metadata: { saveGame: 'slot1', playerLevel: 42 }
     * });
     *
     * if (result.success && result.snapshot) {
     *   // Serialize and save the snapshot
     *   const format = new JSONFormat();
     *   const data = format.serialize(result.snapshot);
     *   await Bun.write('save.json', data);
     * }
     * ```
     */
    createSnapshot(options?: SerializationOptions): SerializationResult {
        return this.worldSerializer.createSnapshot(this, options);
    }

    /**
     * Load a snapshot into this world.
     * Can clear existing state or merge with current state.
     *
     * @param snapshot - The snapshot to load
     * @param options - Deserialization options
     * @returns Deserialization result with statistics
     *
     * @example
     * ```typescript
     * // Load from file
     * const data = await Bun.file('save.json').arrayBuffer();
     * const format = new JSONFormat();
     * const snapshot = format.deserialize(new Uint8Array(data));
     *
     * // Load into world
     * const result = world.loadSnapshot(snapshot, {
     *   clearExisting: true,
     *   validateVersion: true
     * });
     *
     * console.log(`Loaded ${result.entitiesLoaded} entities`);
     * ```
     */
    loadSnapshot(
        snapshot: WorldSnapshot,
        options?: DeserializationOptions
    ): DeserializationResult {
        return this.worldSerializer.loadSnapshot(this, snapshot, options);
    }

    /**
     * Save the world state to a file using the specified format.
     * Convenience method that combines snapshot creation and serialization.
     *
     * @param filepath - Path to save the file
     * @param format - Serialization format to use
     * @param options - Serialization options
     * @returns Promise that resolves to serialization result
     *
     * @example
     * ```typescript
     * import { JSONFormat } from '../serialization';
     *
     * const result = await world.save('game.json', new JSONFormat(), {
     *   prettyPrint: true
     * });
     *
     * if (result.success) {
     *   console.log('Game saved successfully');
     * }
     * ```
     */
    async save(
        filepath: string,
        format: import('../serialization/types.ts').SerializationFormat,
        options?: SerializationOptions
    ): Promise<SerializationResult> {
        const result = this.createSnapshot(options);

        if (result.success && result.snapshot) {
            try {
                const data = format.serialize(result.snapshot, options);
                await Bun.write(filepath, data);
            } catch (error) {
                return {
                    success: false,
                    error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
                    warnings: result.warnings,
                    duration: result.duration,
                };
            }
        }

        return result;
    }

    /**
     * Load the world state from a file using the specified format.
     * Convenience method that combines deserialization and snapshot loading.
     *
     * @param filepath - Path to load the file from
     * @param format - Serialization format to use
     * @param options - Deserialization options
     * @returns Promise that resolves to deserialization result
     *
     * @example
     * ```typescript
     * import { JSONFormat } from '../serialization';
     *
     * const result = await world.load('game.json', new JSONFormat(), {
     *   clearExisting: true
     * });
     *
     * if (result.success) {
     *   console.log(`Loaded ${result.entitiesLoaded} entities`);
     * }
     * ```
     */
    async load(
        filepath: string,
        format: import('../serialization/types.ts').SerializationFormat,
        options?: DeserializationOptions
    ): Promise<DeserializationResult> {
        try {
            const file = Bun.file(filepath);
            if (!(await file.exists())) {
                return {
                    success: false,
                    entitiesLoaded: 0,
                    componentsLoaded: 0,
                    entityIdMappings: new Map(),
                    error: `File not found: ${filepath}`,
                    warnings: [],
                    duration: 0,
                };
            }

            const data = await file.arrayBuffer();
            const snapshot = format.deserialize(new Uint8Array(data), options);

            return this.loadSnapshot(snapshot, options);
        } catch (error) {
            return {
                success: false,
                entitiesLoaded: 0,
                componentsLoaded: 0,
                entityIdMappings: new Map(),
                error: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
                warnings: [],
                duration: 0,
            };
        }
    }

    private flushComponentEvents(): void {
        const eventStorage = this.componentStorages.get('event') as
            | ComponentStorage<EventComponent>
            | undefined;
        if (!eventStorage) {
            return;
        }

        for (const entityId of eventStorage.getEntities()) {
            const eventComponent = eventStorage.get(entityId);
            if (eventComponent?.hasPendingEvents()) {
                const events = eventComponent.flushEvents();
                for (const event of events) {
                    this.eventBus.emit({
                        ...event,
                        source: `entity:${entityId}`,
                    });
                }
            }
        }
    }

    private getOrCreateStorage<T extends Component>(
        componentType: string
    ): ComponentStorage<T> {
        let storage = this.componentStorages.get(componentType);
        if (!storage) {
            storage = new ComponentStorage<T>();
            this.componentStorages.set(componentType, storage);
        }
        return storage;
    }

    private updateArchetype(entityId: number): void {
        const componentTypes: string[] = [];
        for (const [type, storage] of this.componentStorages) {
            if (storage.has(entityId)) {
                componentTypes.push(type);
            }
        }
        this.archetypeManager.updateEntityArchetype(entityId, componentTypes);
    }
}

export interface SystemDependencyGraph {
    systems: Array<{
        name: string;
        priority: number;
        dependencies: string[];
        dependents: string[];
    }>;
    executionOrder: string[];
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}
