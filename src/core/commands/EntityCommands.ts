import type { Component } from '../ecs/Component.ts';
import type { World } from '../ecs/World.ts';
import type { Command, CommandResult } from './Command.ts';

/**
 * Command to create a new entity.
 * Stores the created entity ID for potential undo operations.
 */
export class CreateEntityCommand implements Command {
    private createdEntityId?: number;

    execute(world: World): CommandResult {
        try {
            this.createdEntityId = world.createEntity();
            return {
                success: true,
                data: this.createdEntityId,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    undo(world: World): CommandResult {
        if (this.createdEntityId === undefined) {
            return {
                success: false,
                error: 'No entity was created to undo',
            };
        }

        try {
            world.destroyEntity(this.createdEntityId);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    describe(): string {
        return this.createdEntityId !== undefined
            ? `CreateEntity (id: ${this.createdEntityId})`
            : 'CreateEntity (not executed)';
    }

    /**
     * Get the ID of the created entity
     */
    getEntityId(): number | undefined {
        return this.createdEntityId;
    }
}

/**
 * Command to destroy an entity.
 * Stores the entity's components for potential undo operations.
 */
export class DestroyEntityCommand implements Command {
    private savedComponents?: Map<string, Component>;

    constructor(private readonly entityId: number) {}

    execute(world: World): CommandResult {
        try {
            // Save components for potential undo
            this.savedComponents = new Map();
            for (const componentType of world.getComponentTypes()) {
                const component = world.getComponent(
                    this.entityId,
                    componentType
                );
                if (component) {
                    this.savedComponents.set(componentType, component);
                }
            }

            world.destroyEntity(this.entityId);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    undo(world: World): CommandResult {
        if (!this.savedComponents) {
            return {
                success: false,
                error: 'No components saved to restore',
            };
        }

        try {
            // Note: This is a simplified undo that doesn't restore the exact entity ID
            // A more sophisticated implementation would need entity ID recycling support
            const newEntityId = world.createEntity();
            for (const [_type, component] of this.savedComponents) {
                world.addComponent(newEntityId, component);
            }
            return {
                success: true,
                data: newEntityId,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    describe(): string {
        return `DestroyEntity (id: ${this.entityId})`;
    }

    getEntityId(): number {
        return this.entityId;
    }
}

/**
 * Command to add a component to an entity.
 */
export class AddComponentCommand<T extends Component> implements Command {
    constructor(
        private readonly entityId: number,
        private readonly component: T
    ) {}

    execute(world: World): CommandResult {
        try {
            world.addComponent(this.entityId, this.component);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    undo(world: World): CommandResult {
        try {
            world.removeComponent(this.entityId, this.component.type);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    describe(): string {
        return `AddComponent (entity: ${this.entityId}, type: ${this.component.type})`;
    }

    getEntityId(): number {
        return this.entityId;
    }

    getComponent(): T {
        return this.component;
    }
}

/**
 * Command to remove a component from an entity.
 * Stores the removed component for potential undo operations.
 */
export class RemoveComponentCommand implements Command {
    private savedComponent?: Component;

    constructor(
        private readonly entityId: number,
        private readonly componentType: string
    ) {}

    execute(world: World): CommandResult {
        try {
            // Save component for potential undo
            this.savedComponent = world.getComponent(
                this.entityId,
                this.componentType
            );

            const removed = world.removeComponent(
                this.entityId,
                this.componentType
            );
            return {
                success: removed,
                error: removed ? undefined : 'Component not found',
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    undo(world: World): CommandResult {
        if (!this.savedComponent) {
            return {
                success: false,
                error: 'No component saved to restore',
            };
        }

        try {
            world.addComponent(this.entityId, this.savedComponent);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    describe(): string {
        return `RemoveComponent (entity: ${this.entityId}, type: ${this.componentType})`;
    }

    getEntityId(): number {
        return this.entityId;
    }

    getComponentType(): string {
        return this.componentType;
    }
}
