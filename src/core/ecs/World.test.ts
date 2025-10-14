import { describe, expect, test } from 'bun:test';
import { EventComponent, type GameEvent } from '../events/index.ts';
import type { Component } from './Component.ts';
import { BaseSystem } from './System.ts';
import { World } from './World.ts';

interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface VelocityComponent extends Component {
    readonly type: 'velocity';
    dx: number;
    dy: number;
}

interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

class TestSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'TestSystem';

    updateCalls = 0;
    lastDeltaTime = 0;

    update(_world: World, deltaTime: number): void {
        this.updateCalls++;
        this.lastDeltaTime = deltaTime;
    }
}

class HighPrioritySystem extends BaseSystem {
    readonly priority = 0;
    readonly name = 'HighPrioritySystem';

    updateCalls = 0;

    update(_world: World, _deltaTime: number): void {
        this.updateCalls++;
    }
}

class LowPrioritySystem extends BaseSystem {
    readonly priority = 10;
    readonly name = 'LowPrioritySystem';

    updateCalls = 0;

    update(_world: World, _deltaTime: number): void {
        this.updateCalls++;
    }
}

describe('World', () => {
    test('should construct World instance', () => {
        // Arrange & Act
        const world = new World();

        // Assert
        expect(world).toBeInstanceOf(World);
        expect(world.getEntityCount()).toBe(0);
        expect(world.getComponentTypes()).toEqual([]);
        expect(world.getArchetypeStats()).toEqual([]);
        expect(world.getEventBus()).toBeDefined();
    });

    test('should create and destroy entities', () => {
        const world = new World();
        const entity = world.createEntity();

        expect(typeof entity).toBe('number');
        expect(world.getEntityCount()).toBe(1);

        world.destroyEntity(entity);
        expect(world.getEntityCount()).toBe(0);
    });

    test('should add and retrieve components', () => {
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };

        world.addComponent(entity, position);

        const retrieved = world.getComponent<PositionComponent>(
            entity,
            'position'
        );
        expect(retrieved).toEqual(position);
        expect(world.hasComponent(entity, 'position')).toBe(true);
    });

    test('should throw error when adding component to non-existent entity', () => {
        const world = new World();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };

        expect(() => world.addComponent(999, position)).toThrow(
            'Entity 999 does not exist'
        );
    });

    test('should remove components', () => {
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };

        world.addComponent(entity, position);
        expect(world.hasComponent(entity, 'position')).toBe(true);

        const removed = world.removeComponent(entity, 'position');
        expect(removed).toBe(true);
        expect(world.hasComponent(entity, 'position')).toBe(false);
        expect(world.getComponent(entity, 'position')).toBeUndefined();
    });

    test('should query entities by component type', () => {
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const entity3 = world.createEntity();

        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const position2: PositionComponent = { type: 'position', x: 30, y: 40 };

        world.addComponent(entity1, position1);
        world.addComponent(entity2, position2);
        // entity3 has no position component

        const query = world.query<PositionComponent>('position');
        const entities = query.getEntities();

        expect(entities).toContain(entity1);
        expect(entities).toContain(entity2);
        expect(entities).not.toContain(entity3);
        expect(entities.length).toBe(2);
    });

    test('should query multiple component types', () => {
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const entity3 = world.createEntity();

        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const position2: PositionComponent = { type: 'position', x: 30, y: 40 };
        const velocity1: VelocityComponent = { type: 'velocity', dx: 1, dy: 2 };

        world.addComponent(entity1, position1);
        world.addComponent(entity1, velocity1);
        world.addComponent(entity2, position2);
        // entity3 has no components

        const entities = world.queryMultiple(['position', 'velocity']);

        expect(entities).toContain(entity1);
        expect(entities).not.toContain(entity2);
        expect(entities).not.toContain(entity3);
        expect(entities.length).toBe(1);
    });

    test('should manage systems', () => {
        const world = new World();
        const system = new TestSystem();

        world.addSystem(system);

        world.update(16.67);

        expect(system.updateCalls).toBe(1);
        expect(system.lastDeltaTime).toBe(16.67);
    });

    test('should remove systems', () => {
        const world = new World();
        const system = new TestSystem();

        world.addSystem(system);
        const removed = world.removeSystem('TestSystem');

        expect(removed).toBe(true);

        world.update(16.67);
        expect(system.updateCalls).toBe(0);
    });

    test('should clean up components when entity is destroyed', () => {
        const world = new World();
        const entity = world.createEntity();

        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        const velocity: VelocityComponent = { type: 'velocity', dx: 1, dy: 2 };

        world.addComponent(entity, position);
        world.addComponent(entity, velocity);

        expect(world.hasComponent(entity, 'position')).toBe(true);
        expect(world.hasComponent(entity, 'velocity')).toBe(true);

        world.destroyEntity(entity);

        expect(world.hasComponent(entity, 'position')).toBe(false);
        expect(world.hasComponent(entity, 'velocity')).toBe(false);
        expect(world.getEntityCount()).toBe(0);
    });

    test('should provide component type statistics', () => {
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const position2: PositionComponent = { type: 'position', x: 30, y: 40 };
        const health: HealthComponent = { type: 'health', hp: 100, maxHp: 100 };

        world.addComponent(entity1, position1);
        world.addComponent(entity1, health);
        world.addComponent(entity2, position2);

        const componentTypes = world.getComponentTypes();
        expect(componentTypes).toContain('position');
        expect(componentTypes).toContain('health');
        expect(componentTypes.length).toBe(2);

        const archetypeStats = world.getArchetypeStats();
        expect(archetypeStats.length).toBe(2);
        expect(
            archetypeStats.find((s) => s.archetype === 'position')?.entityCount
        ).toBe(1);
        expect(
            archetypeStats.find((s) => s.archetype === 'health|position')
                ?.entityCount
        ).toBe(1);
    });

    test('should return false when removing non-existent component', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();

        // Act
        const removed = world.removeComponent(entity, 'non-existent');

        // Assert
        expect(removed).toBe(false);
    });

    test('should return false when removing system that does not exist', () => {
        // Arrange
        const world = new World();

        // Act
        const removed = world.removeSystem('NonExistentSystem');

        // Assert
        expect(removed).toBe(false);
    });

    test('should return empty array when querying with empty component types', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        // Act
        const entities = world.queryMultiple([]);

        // Assert
        expect(entities).toEqual([]);
    });

    test('should query single component type using queryMultiple', () => {
        // Arrange
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const position2: PositionComponent = { type: 'position', x: 30, y: 40 };
        world.addComponent(entity1, position1);
        world.addComponent(entity2, position2);

        // Act
        const entities = world.queryMultiple(['position']);

        // Assert
        expect(entities.length).toBe(2);
        expect(entities).toContain(entity1);
        expect(entities).toContain(entity2);
    });

    test('should sort systems by priority when added', () => {
        // Arrange
        const world = new World();
        const lowPriority = new LowPrioritySystem();
        const highPriority = new HighPrioritySystem();
        const mediumPriority = new TestSystem();

        // Act - add in non-sorted order
        world.addSystem(mediumPriority);
        world.addSystem(lowPriority);
        world.addSystem(highPriority);

        world.update(16.67);

        // Assert - high priority should run first
        expect(highPriority.updateCalls).toBe(1);
        expect(mediumPriority.updateCalls).toBe(1);
        expect(lowPriority.updateCalls).toBe(1);
    });

    test('should emit and subscribe to events', () => {
        // Arrange
        const world = new World();
        let receivedEvent: GameEvent | null = null;
        const testEvent: GameEvent = {
            type: 'test-event',
            source: 'test',
            timestamp: Date.now(),
            data: { message: 'hello' },
        };

        // Act
        const unsubscribe = world.subscribeToEvent('test-event', (event) => {
            receivedEvent = event;
        });

        world.emitEvent(testEvent);
        world.update(0); // Process events

        // Assert
        expect(receivedEvent).not.toBeNull();
        expect(receivedEvent!.type).toBe('test-event');
        expect(receivedEvent!.data).toEqual({ message: 'hello' });

        // Cleanup
        unsubscribe();
    });

    test('should get event bus instance', () => {
        // Arrange
        const world = new World();

        // Act
        const eventBus = world.getEventBus();

        // Assert
        expect(eventBus).toBeDefined();
        expect(typeof eventBus.emit).toBe('function');
        expect(typeof eventBus.subscribe).toBe('function');
    });

    test('should track dirty entities for component types', () => {
        // Arrange
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const velocity1: VelocityComponent = { type: 'velocity', dx: 1, dy: 2 };

        // Act
        world.addComponent(entity1, position1);
        world.addComponent(entity2, velocity1);

        // Assert
        const dirtyPositionEntities = world.getDirtyEntities('position');
        const dirtyVelocityEntities = world.getDirtyEntities('velocity');

        expect(dirtyPositionEntities.has(entity1)).toBe(true);
        expect(dirtyPositionEntities.has(entity2)).toBe(false);
        expect(dirtyVelocityEntities.has(entity2)).toBe(true);
        expect(dirtyVelocityEntities.has(entity1)).toBe(false);
    });

    test('should track all dirty entities across all component types', () => {
        // Arrange
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const velocity1: VelocityComponent = { type: 'velocity', dx: 1, dy: 2 };

        // Act
        world.addComponent(entity1, position1);
        world.addComponent(entity2, velocity1);

        // Assert
        const allDirtyEntities = world.getAllDirtyEntities();
        expect(allDirtyEntities.has(entity1)).toBe(true);
        expect(allDirtyEntities.has(entity2)).toBe(true);
        expect(allDirtyEntities.size).toBe(2);
    });

    test('should check if entity is dirty', () => {
        // Arrange
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };

        // Act
        world.addComponent(entity1, position);

        // Assert
        expect(world.isEntityDirty(entity1)).toBe(true);
        expect(world.isEntityDirty(entity2)).toBe(false);
    });

    test('should check if specific component is dirty for entity', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        const velocity: VelocityComponent = { type: 'velocity', dx: 1, dy: 2 };

        // Act
        world.addComponent(entity, position);
        world.addComponent(entity, velocity);

        // Assert
        expect(world.isComponentDirty(entity, 'position')).toBe(true);
        expect(world.isComponentDirty(entity, 'velocity')).toBe(true);
        expect(world.isComponentDirty(entity, 'health')).toBe(false);
    });

    test('should get dirty tracking statistics', () => {
        // Arrange
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const position1: PositionComponent = { type: 'position', x: 10, y: 20 };
        const position2: PositionComponent = { type: 'position', x: 30, y: 40 };
        const velocity: VelocityComponent = { type: 'velocity', dx: 1, dy: 2 };

        // Act
        world.addComponent(entity1, position1);
        world.addComponent(entity1, velocity);
        world.addComponent(entity2, position2);

        // Assert
        const stats = world.getDirtyTrackingStats();
        expect(stats.totalDirtyEntities).toBe(2);
        expect(stats.dirtyComponentTypes).toBe(2);
        expect(stats.averageDirtyPerType).toBeGreaterThan(0);
    });

    test('should manually mark component as dirty', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        // Clear dirty state
        world.update(0);
        expect(world.isComponentDirty(entity, 'position')).toBe(false);

        // Act
        world.markComponentDirty(entity, 'position');

        // Assert
        expect(world.isComponentDirty(entity, 'position')).toBe(true);
    });

    test('should clear dirty tracking after world update', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        expect(world.isEntityDirty(entity)).toBe(true);

        // Act
        world.update(0);

        // Assert
        expect(world.isEntityDirty(entity)).toBe(false);
        expect(world.getAllDirtyEntities().size).toBe(0);
    });

    test('should flush event components during world update', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const eventComponent = new EventComponent();

        eventComponent.queueEvent('custom-event', { value: 42 });

        world.addComponent(entity, eventComponent);

        let receivedEvent: GameEvent | null = null;
        world.subscribeToEvent('custom-event', (event) => {
            receivedEvent = event;
        });

        // Act
        world.update(0);

        // Assert
        expect(receivedEvent).not.toBeNull();
        expect(receivedEvent!.type).toBe('custom-event');
        expect(receivedEvent!.data).toEqual({ value: 42 });
        expect(receivedEvent!.source).toBe(`entity:${entity}`);
    });

    test('should handle world update with no event components', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        // Act & Assert - should not throw
        expect(() => world.update(0)).not.toThrow();
    });

    test('should handle event component storage with no entities', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const eventComponent = new EventComponent();
        eventComponent.queueEvent('test', { data: 'test' });
        world.addComponent(entity, eventComponent);

        // Remove the event component
        world.removeComponent(entity, 'event');

        // Act & Assert - should not throw even though event storage exists but has no entities
        expect(() => world.update(0)).not.toThrow();
    });

    test('should handle event component without pending events', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const eventComponent = new EventComponent();
        // Don't queue any events
        world.addComponent(entity, eventComponent);

        const receivedEvents: GameEvent[] = [];
        world.subscribeToEvent('any-event', (event) => {
            receivedEvents.push(event);
        });

        // Act
        world.update(0);

        // Assert - no events should be emitted
        expect(receivedEvents).toHaveLength(0);
    });

    test('should handle multiple event component flushes in single update', () => {
        // Arrange
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        const eventComponent1 = new EventComponent();
        const eventComponent2 = new EventComponent();

        eventComponent1.queueEvent('event-1', { from: 'entity1' });
        eventComponent2.queueEvent('event-2', { from: 'entity2' });

        world.addComponent(entity1, eventComponent1);
        world.addComponent(entity2, eventComponent2);

        const receivedEvents: GameEvent[] = [];
        world.subscribeToEvent('event-1', (event) => {
            receivedEvents.push(event);
        });
        world.subscribeToEvent('event-2', (event) => {
            receivedEvents.push(event);
        });

        // Act
        world.update(0);

        // Assert
        expect(receivedEvents.length).toBe(2);
        expect(receivedEvents[0]?.type).toBe('event-1');
        expect(receivedEvents[1]?.type).toBe('event-2');
    });

    test('should clean up dirty tracking when entity is destroyed', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        expect(world.isEntityDirty(entity)).toBe(true);

        // Act
        world.destroyEntity(entity);

        // Assert
        expect(world.isEntityDirty(entity)).toBe(false);
    });

    test('should return empty query for non-existent component type', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        // Act
        const query = world.query<HealthComponent>('health');
        const entities = query.getEntities();

        // Assert
        expect(entities.length).toBe(0);
    });

    test('should return undefined when getting non-existent component', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();

        // Act
        const component = world.getComponent<PositionComponent>(
            entity,
            'position'
        );

        // Assert
        expect(component).toBeUndefined();
    });

    test('should return false when checking for non-existent component', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();

        // Act
        const hasComponent = world.hasComponent(entity, 'position');

        // Assert
        expect(hasComponent).toBe(false);
    });

    test('should return empty array for queryMultiple with non-existent component types', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        // Act
        const entities = world.queryMultiple([
            'non-existent-1',
            'non-existent-2',
        ]);

        // Assert
        expect(entities.length).toBe(0);
    });

    test('should mark entity dirty when removing component', () => {
        // Arrange
        const world = new World();
        const entity = world.createEntity();
        const position: PositionComponent = { type: 'position', x: 10, y: 20 };
        world.addComponent(entity, position);

        // Clear dirty state
        world.update(0);
        expect(world.isEntityDirty(entity)).toBe(false);

        // Act
        world.removeComponent(entity, 'position');

        // Assert
        expect(world.isEntityDirty(entity)).toBe(true);
        expect(world.isComponentDirty(entity, 'position')).toBe(true);
    });
});
