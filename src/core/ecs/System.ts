import type { Component } from './Component.ts';
import type { World } from './World.ts';

export interface System {
    readonly priority: number;
    readonly name: string;
    readonly dependencies?: string[];
    update(world: World, deltaTime: number): void;
    initialize?(world: World): void;
    shutdown?(world: World): void;
}

export abstract class BaseSystem implements System {
    abstract readonly priority: number;
    abstract readonly name: string;
    dependencies?: string[] = [];

    abstract update(world: World, deltaTime: number): void;

    initialize?(_world: World): void {
        // Override in subclasses if needed
    }

    shutdown?(_world: World): void {
        // Override in subclasses if needed
    }

    protected queryEntities(
        world: World,
        ...componentTypes: string[]
    ): number[] {
        return world.queryMultiple(componentTypes);
    }

    protected queryWithComponents<T extends Component>(
        world: World,
        componentType: string,
        callback: (entityId: number, component: T) => void
    ): void {
        const query = world.query<T>(componentType);
        query.forEach(callback);
    }
}
