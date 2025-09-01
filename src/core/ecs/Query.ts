import type { Component } from './Component.ts';
import type { World } from './World.ts';

export class Query<T extends Component> {
    private entities: Set<number>;
    private world: World;
    private componentType: string;

    constructor(entities: Set<number>, world: World, componentType: string) {
        this.entities = entities;
        this.world = world;
        this.componentType = componentType;
    }

    getEntities(): number[] {
        return Array.from(this.entities);
    }

    getComponents(): Array<{ entityId: number; component: T }> {
        const results: Array<{ entityId: number; component: T }> = [];
        for (const entityId of this.entities) {
            const component = this.world.getComponent<T>(
                entityId,
                this.componentType
            );
            if (component) {
                results.push({ entityId, component });
            }
        }
        return results;
    }

    forEach(callback: (entityId: number, component: T) => void): void {
        for (const entityId of this.entities) {
            const component = this.world.getComponent<T>(
                entityId,
                this.componentType
            );
            if (component) {
                callback(entityId, component);
            }
        }
    }

    filter(predicate: (entityId: number, component: T) => boolean): Query<T> {
        const filteredEntities = new Set<number>();
        for (const entityId of this.entities) {
            const component = this.world.getComponent<T>(
                entityId,
                this.componentType
            );
            if (component && predicate(entityId, component)) {
                filteredEntities.add(entityId);
            }
        }
        return new Query(filteredEntities, this.world, this.componentType);
    }

    count(): number {
        return this.entities.size;
    }

    isEmpty(): boolean {
        return this.entities.size === 0;
    }
}
