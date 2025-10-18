import type { System } from '../ecs/System';
import type { World } from '../ecs/World';
import { TransformHierarchy } from './TransformHierarchy';

export interface TransformSystemConfig {
    priority?: number;
    updateOnlyDirty?: boolean;
}

export class TransformSystem implements System {
    readonly name = 'TransformSystem';
    readonly priority: number;
    private hierarchy: TransformHierarchy;
    private updateOnlyDirty: boolean;

    constructor(world: World, config: TransformSystemConfig = {}) {
        this.priority = config.priority ?? 0;
        this.updateOnlyDirty = config.updateOnlyDirty ?? true;
        this.hierarchy = new TransformHierarchy(world);
    }

    getHierarchy(): TransformHierarchy {
        return this.hierarchy;
    }

    update(_world: World, _deltaTime: number): void {
        this.hierarchy.updateWorldTransforms();
    }

    shutdown(): void {
        this.hierarchy.clear();
    }
}
