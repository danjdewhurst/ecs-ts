import {
    EventBus,
    type EventComponent,
    type GameEvent,
} from '../events/index.ts';
import { DirtyTracker } from '../performance/index.ts';
import { ArchetypeManager } from './ArchetypeManager.ts';
import { type Component, ComponentStorage } from './Component.ts';
import { EntityManager } from './EntityManager.ts';
import { Query } from './Query.ts';
import type { System } from './System.ts';

export class World {
    private entityManager = new EntityManager();
    // biome-ignore lint/suspicious/noExplicitAny: ComponentStorage needs to handle heterogeneous component types
    private componentStorages = new Map<string, ComponentStorage<any>>();
    private archetypeManager = new ArchetypeManager();
    private systems: System[] = [];
    private eventBus = new EventBus();
    private dirtyTracker = new DirtyTracker();

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
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    removeSystem(systemName: string): boolean {
        const index = this.systems.findIndex(
            (system) => system.name === systemName
        );
        if (index !== -1) {
            this.systems.splice(index, 1);
            return true;
        }
        return false;
    }

    update(deltaTime: number): void {
        // First flush any queued events from EventComponents
        this.flushComponentEvents();

        // Process queued events before systems update
        this.eventBus.processEvents();

        // Run systems
        for (const system of this.systems) {
            system.update(this, deltaTime);
        }

        // Process any events generated during system updates
        this.eventBus.processEvents();

        // Clear dirty tracking after systems have run
        this.dirtyTracker.clearDirty();
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
