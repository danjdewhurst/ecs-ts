import { describe, expect, test } from 'bun:test';
import {
    AddComponentCommand,
    CommandBuffer,
    CreateEntityCommand,
    DestroyEntityCommand,
    RemoveComponentCommand,
    World,
} from '../src';
import type { Component } from '../src/core/ecs/Component';

// Test components
interface PositionComponent extends Component {
    type: 'position';
    x: number;
    y: number;
}

interface VelocityComponent extends Component {
    type: 'velocity';
    dx: number;
    dy: number;
}

interface HealthComponent extends Component {
    type: 'health';
    value: number;
}

describe('Command Buffer System', () => {
    describe('CreateEntityCommand', () => {
        test('should create an entity', () => {
            const world = new World();
            const command = new CreateEntityCommand();

            const result = command.execute(world);

            expect(result.success).toBe(true);
            expect(typeof result.data).toBe('number');
            expect(world.getEntityCount()).toBe(1);
        });

        test('should store entity ID after creation', () => {
            const world = new World();
            const command = new CreateEntityCommand();

            command.execute(world);
            const entityId = command.getEntityId();

            expect(entityId).toBeDefined();
            expect(typeof entityId).toBe('number');
        });

        test('should support undo by destroying created entity', () => {
            const world = new World();
            const command = new CreateEntityCommand();

            command.execute(world);
            expect(world.getEntityCount()).toBe(1);

            const undoResult = command.undo(world);
            expect(undoResult.success).toBe(true);
            expect(world.getEntityCount()).toBe(0);
        });

        test('should fail undo if entity was not created', () => {
            const world = new World();
            const command = new CreateEntityCommand();

            const undoResult = command.undo(world);
            expect(undoResult.success).toBe(false);
            expect(undoResult.error).toBeDefined();
        });

        test('should provide descriptive command description', () => {
            const world = new World();
            const command = new CreateEntityCommand();

            expect(command.describe()).toContain('CreateEntity');

            command.execute(world);
            expect(command.describe()).toContain('id:');
        });
    });

    describe('DestroyEntityCommand', () => {
        test('should destroy an entity', () => {
            const world = new World();
            const entityId = world.createEntity();

            const command = new DestroyEntityCommand(entityId);
            const result = command.execute(world);

            expect(result.success).toBe(true);
            expect(world.getEntityCount()).toBe(0);
        });

        test('should save components for undo', () => {
            const world = new World();
            const entityId = world.createEntity();
            world.addComponent(entityId, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);

            const command = new DestroyEntityCommand(entityId);
            command.execute(world);

            const undoResult = command.undo(world);
            expect(undoResult.success).toBe(true);
            expect(world.getEntityCount()).toBe(1);

            // Verify component was restored
            const newEntityId = undoResult.data as number;
            const position = world.getComponent<PositionComponent>(
                newEntityId,
                'position'
            );
            expect(position).toBeDefined();
            expect(position?.x).toBe(10);
            expect(position?.y).toBe(20);
        });

        test('should provide descriptive command description', () => {
            const command = new DestroyEntityCommand(42);
            expect(command.describe()).toContain('DestroyEntity');
            expect(command.describe()).toContain('42');
        });
    });

    describe('AddComponentCommand', () => {
        test('should add component to entity', () => {
            const world = new World();
            const entityId = world.createEntity();

            const component: PositionComponent = {
                type: 'position',
                x: 100,
                y: 200,
            };
            const command = new AddComponentCommand(entityId, component);
            const result = command.execute(world);

            expect(result.success).toBe(true);
            expect(world.hasComponent(entityId, 'position')).toBe(true);

            const retrieved = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            expect(retrieved?.x).toBe(100);
            expect(retrieved?.y).toBe(200);
        });

        test('should support undo by removing component', () => {
            const world = new World();
            const entityId = world.createEntity();

            const component: PositionComponent = {
                type: 'position',
                x: 100,
                y: 200,
            };
            const command = new AddComponentCommand(entityId, component);
            command.execute(world);

            const undoResult = command.undo(world);
            expect(undoResult.success).toBe(true);
            expect(world.hasComponent(entityId, 'position')).toBe(false);
        });

        test('should fail if entity does not exist', () => {
            const world = new World();

            const component: PositionComponent = {
                type: 'position',
                x: 100,
                y: 200,
            };
            const command = new AddComponentCommand(999, component);
            const result = command.execute(world);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should provide descriptive command description', () => {
            const component: PositionComponent = {
                type: 'position',
                x: 100,
                y: 200,
            };
            const command = new AddComponentCommand(42, component);

            expect(command.describe()).toContain('AddComponent');
            expect(command.describe()).toContain('42');
            expect(command.describe()).toContain('position');
        });
    });

    describe('RemoveComponentCommand', () => {
        test('should remove component from entity', () => {
            const world = new World();
            const entityId = world.createEntity();
            world.addComponent(entityId, {
                type: 'position',
                x: 100,
                y: 200,
            } as PositionComponent);

            const command = new RemoveComponentCommand(entityId, 'position');
            const result = command.execute(world);

            expect(result.success).toBe(true);
            expect(world.hasComponent(entityId, 'position')).toBe(false);
        });

        test('should save component for undo', () => {
            const world = new World();
            const entityId = world.createEntity();
            world.addComponent(entityId, {
                type: 'position',
                x: 100,
                y: 200,
            } as PositionComponent);

            const command = new RemoveComponentCommand(entityId, 'position');
            command.execute(world);

            const undoResult = command.undo(world);
            expect(undoResult.success).toBe(true);
            expect(world.hasComponent(entityId, 'position')).toBe(true);

            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            expect(position?.x).toBe(100);
            expect(position?.y).toBe(200);
        });

        test('should fail if component does not exist', () => {
            const world = new World();
            const entityId = world.createEntity();

            const command = new RemoveComponentCommand(entityId, 'position');
            const result = command.execute(world);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should provide descriptive command description', () => {
            const command = new RemoveComponentCommand(42, 'position');

            expect(command.describe()).toContain('RemoveComponent');
            expect(command.describe()).toContain('42');
            expect(command.describe()).toContain('position');
        });
    });

    describe('CommandBuffer', () => {
        test('should queue commands without executing them', () => {
            const world = new World();
            const buffer = new CommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());

            expect(buffer.getQueuedCount()).toBe(2);
            expect(world.getEntityCount()).toBe(0);
        });

        test('should execute all queued commands', () => {
            const world = new World();
            const buffer = new CommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());

            const stats = buffer.execute(world);

            expect(stats.totalCommands).toBe(3);
            expect(stats.successfulCommands).toBe(3);
            expect(stats.failedCommands).toBe(0);
            expect(world.getEntityCount()).toBe(3);
        });

        test('should clear queue after execution', () => {
            const world = new World();
            const buffer = new CommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.execute(world);

            expect(buffer.getQueuedCount()).toBe(0);
            expect(buffer.hasCommands()).toBe(false);
        });

        test('should track execution statistics', () => {
            const world = new World();
            const buffer = new CommandBuffer();

            // Add mix of valid and invalid commands
            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new AddComponentCommand(999, {
                type: 'position',
                x: 0,
                y: 0,
            } as PositionComponent)); // Will fail - entity doesn't exist

            const stats = buffer.execute(world);

            expect(stats.totalCommands).toBe(2);
            expect(stats.successfulCommands).toBe(1);
            expect(stats.failedCommands).toBe(1);
            expect(stats.failures).toHaveLength(1);
            expect(stats.executionTime).toBeGreaterThanOrEqual(0);
        });

        test('should support undo when enabled', () => {
            const world = new World();
            const buffer = new CommandBuffer({ enableUndo: true });

            const createCmd = new CreateEntityCommand();
            buffer.enqueue(createCmd);
            buffer.execute(world);

            expect(world.getEntityCount()).toBe(1);
            expect(buffer.hasHistory()).toBe(true);

            const undoStats = buffer.undo(world);
            expect(undoStats.successfulCommands).toBe(1);
            expect(world.getEntityCount()).toBe(0);
        });

        test('should not support undo when disabled', () => {
            const world = new World();
            const buffer = new CommandBuffer({ enableUndo: false });

            buffer.enqueue(new CreateEntityCommand());
            buffer.execute(world);

            const undoStats = buffer.undo(world);
            expect(undoStats.totalCommands).toBe(0);
            expect(undoStats.failures).toHaveLength(1);
        });

        test('should support command replay', () => {
            const world = new World();
            const buffer = new CommandBuffer({ enableUndo: true });

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());
            buffer.execute(world);

            expect(world.getEntityCount()).toBe(2);

            // Undo all
            buffer.undo(world);
            expect(world.getEntityCount()).toBe(0);

            // Replay
            const replayStats = buffer.replay(world);
            expect(replayStats.successfulCommands).toBe(2);
            expect(world.getEntityCount()).toBe(2);
        });

        test('should clear command queue manually', () => {
            const buffer = new CommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());
            expect(buffer.getQueuedCount()).toBe(2);

            buffer.clear();
            expect(buffer.getQueuedCount()).toBe(0);
        });

        test('should clear command history', () => {
            const world = new World();
            const buffer = new CommandBuffer({ enableUndo: true });

            buffer.enqueue(new CreateEntityCommand());
            buffer.execute(world);

            expect(buffer.hasHistory()).toBe(true);

            buffer.clearHistory();
            expect(buffer.hasHistory()).toBe(false);
        });

        test('should provide command descriptions for debugging', () => {
            const buffer = new CommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());

            const descriptions = buffer.describeQueue();
            expect(descriptions).toHaveLength(2);
            expect(descriptions[0]).toContain('CreateEntity');
        });
    });

    describe('World Integration', () => {
        test('should provide access to main command buffer', () => {
            const world = new World();
            const buffer = world.getCommandBuffer();

            expect(buffer).toBeInstanceOf(CommandBuffer);
        });

        test('should allow creating independent command buffers', () => {
            const world = new World();
            const buffer1 = world.createCommandBuffer();
            const buffer2 = world.createCommandBuffer({ enableUndo: true });

            expect(buffer1).toBeInstanceOf(CommandBuffer);
            expect(buffer2).toBeInstanceOf(CommandBuffer);
            expect(buffer1).not.toBe(buffer2);
            expect(buffer1).not.toBe(world.getCommandBuffer());
        });

        test('should execute main command buffer manually', () => {
            const world = new World();
            const buffer = world.getCommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());

            const stats = world.executeCommands();

            expect(stats.successfulCommands).toBe(2);
            expect(world.getEntityCount()).toBe(2);
        });

        test('should auto-execute commands during update cycle', () => {
            const world = new World();
            const buffer = world.getCommandBuffer();

            buffer.enqueue(new CreateEntityCommand());
            buffer.enqueue(new CreateEntityCommand());

            // Commands should execute during update
            world.update(0.016);

            expect(world.getEntityCount()).toBe(2);
            expect(buffer.hasCommands()).toBe(false);
        });

        test('should allow disabling auto-execution', () => {
            const world = new World();
            world.setAutoExecuteCommands(false);

            const buffer = world.getCommandBuffer();
            buffer.enqueue(new CreateEntityCommand());

            world.update(0.016);

            // Commands should not execute
            expect(world.getEntityCount()).toBe(0);
            expect(buffer.hasCommands()).toBe(true);
        });

        test('should check auto-execution status', () => {
            const world = new World();

            expect(world.isAutoExecuteCommandsEnabled()).toBe(true);

            world.setAutoExecuteCommands(false);
            expect(world.isAutoExecuteCommandsEnabled()).toBe(false);
        });
    });

    describe('Complex Scenarios', () => {
        test('should handle batch entity creation with components', () => {
            const world = new World();
            const buffer = world.getCommandBuffer();

            // Create 100 entities with components
            for (let i = 0; i < 100; i++) {
                const createCmd = new CreateEntityCommand();
                buffer.enqueue(createCmd);

                // Note: We can't chain commands that depend on results in a single batch
                // This is a known limitation - entity IDs are not available until execution
            }

            const stats = buffer.execute(world);

            expect(stats.successfulCommands).toBe(100);
            expect(world.getEntityCount()).toBe(100);
        });

        test('should handle entity lifecycle within single buffer', () => {
            const world = new World();
            const entityId = world.createEntity();

            const buffer = world.getCommandBuffer();

            // Add component
            buffer.enqueue(
                new AddComponentCommand(entityId, {
                    type: 'position',
                    x: 10,
                    y: 20,
                } as PositionComponent)
            );

            // Add another component
            buffer.enqueue(
                new AddComponentCommand(entityId, {
                    type: 'velocity',
                    dx: 1,
                    dy: 2,
                } as VelocityComponent)
            );

            // Remove first component
            buffer.enqueue(new RemoveComponentCommand(entityId, 'position'));

            // Execute all commands
            const stats = buffer.execute(world);

            expect(stats.successfulCommands).toBe(3);
            expect(world.hasComponent(entityId, 'position')).toBe(false);
            expect(world.hasComponent(entityId, 'velocity')).toBe(true);
        });

        test('should handle failures gracefully and continue execution', () => {
            const world = new World();
            const buffer = world.getCommandBuffer();

            buffer.enqueue(new CreateEntityCommand()); // Success
            buffer.enqueue(
                new AddComponentCommand(999, {
                    type: 'position',
                    x: 0,
                    y: 0,
                } as PositionComponent)
            ); // Fail
            buffer.enqueue(new CreateEntityCommand()); // Success

            const stats = buffer.execute(world);

            expect(stats.totalCommands).toBe(3);
            expect(stats.successfulCommands).toBe(2);
            expect(stats.failedCommands).toBe(1);
            expect(world.getEntityCount()).toBe(2);
        });

        test('should support multiple independent command buffers', () => {
            const world = new World();

            const buffer1 = world.createCommandBuffer();
            const buffer2 = world.createCommandBuffer();

            buffer1.enqueue(new CreateEntityCommand());
            buffer1.enqueue(new CreateEntityCommand());

            buffer2.enqueue(new CreateEntityCommand());

            buffer1.execute(world);
            expect(world.getEntityCount()).toBe(2);

            buffer2.execute(world);
            expect(world.getEntityCount()).toBe(3);
        });
    });

    describe('Performance', () => {
        test('should efficiently handle large command batches', () => {
            const world = new World();
            const buffer = world.getCommandBuffer();

            const commandCount = 10000;
            for (let i = 0; i < commandCount; i++) {
                buffer.enqueue(new CreateEntityCommand());
            }

            const startTime = performance.now();
            const stats = buffer.execute(world);
            const duration = performance.now() - startTime;

            expect(stats.successfulCommands).toBe(commandCount);
            expect(world.getEntityCount()).toBe(commandCount);
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
        });
    });
});
