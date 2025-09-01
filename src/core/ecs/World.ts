import { EntityManager } from './EntityManager.ts';
import { ComponentStorage, type Component } from './Component.ts';
import { ArchetypeManager } from './ArchetypeManager.ts';
import { Query } from './Query.ts';
import type { System } from './System.ts';

export class World {
    private entityManager = new EntityManager();
    private componentStorages = new Map<string, ComponentStorage<any>>();
    private archetypeManager = new ArchetypeManager();
    private systems: System[] = [];

    createEntity(): number {
        return this.entityManager.createEntity();
    }

    destroyEntity(entityId: number): void {
        // Remove from all component storages
        for (const [type, storage] of this.componentStorages) {
            storage.remove(entityId);
        }
        
        // Remove from archetype manager
        this.archetypeManager.removeEntity(entityId);
        
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
    }

    removeComponent(entityId: number, componentType: string): boolean {
        const storage = this.componentStorages.get(componentType);
        if (!storage) {
            return false;
        }

        const removed = storage.remove(entityId);
        if (removed) {
            this.updateArchetype(entityId);
        }
        return removed;
    }

    getComponent<T extends Component>(entityId: number, componentType: string): T | undefined {
        const storage = this.componentStorages.get(componentType);
        return storage?.get(entityId);
    }

    hasComponent(entityId: number, componentType: string): boolean {
        const storage = this.componentStorages.get(componentType);
        return storage?.has(entityId) ?? false;
    }

    query<T extends Component>(componentType: string): Query<T> {
        const storage = this.componentStorages.get(componentType);
        return new Query(storage?.getEntities() ?? new Set(), this, componentType);
    }

    queryMultiple(componentTypes: string[]): number[] {
        if (componentTypes.length === 0) {
            return [];
        }
        if (componentTypes.length === 1) {
            const storage = this.componentStorages.get(componentTypes[0]!);
            return storage ? Array.from(storage.getEntities()) : [];
        }
        return this.archetypeManager.queryEntities(componentTypes);
    }

    addSystem(system: System): void {
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
    }

    removeSystem(systemName: string): boolean {
        const index = this.systems.findIndex(system => system.name === systemName);
        if (index !== -1) {
            this.systems.splice(index, 1);
            return true;
        }
        return false;
    }

    update(deltaTime: number): void {
        for (const system of this.systems) {
            system.update(this, deltaTime);
        }
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

    private getOrCreateStorage<T extends Component>(componentType: string): ComponentStorage<T> {
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