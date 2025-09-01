import { describe, expect, test } from 'bun:test';
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

describe('World', () => {
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
});
