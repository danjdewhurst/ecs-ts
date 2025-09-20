import { describe, expect, test } from 'bun:test';
import type { Component } from '../ecs/Component';
import { BaseSystem } from '../ecs/System';
import { World } from '../ecs/World';
import { ObjectPool } from './ObjectPool';

// Test components
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

// Test system that uses dirty tracking
class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';
    private processedEntities: number[] = [];

    update(world: World, deltaTime: number): void {
        this.processedEntities = [];

        // Get only dirty position entities for optimization
        const dirtyPositions = world.getDirtyEntities('position');

        for (const entityId of dirtyPositions) {
            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            const velocity = world.getComponent<VelocityComponent>(
                entityId,
                'velocity'
            );

            if (position && velocity) {
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;
                this.processedEntities.push(entityId);
            }
        }
    }

    getProcessedEntities(): number[] {
        return [...this.processedEntities];
    }
}

// Helper function to create components with object pool
function createPositionPool(): ObjectPool<PositionComponent> {
    return new ObjectPool<PositionComponent>(
        () => ({ type: 'position', x: 0, y: 0 }),
        (obj) => {
            obj.x = 0;
            obj.y = 0;
        },
        10,
        50
    );
}

describe('Performance Integration Tests', () => {
    test('should track dirty entities when components are added', () => {
        const world = new World();
        const entity = world.createEntity();

        // Initially no dirty entities
        expect(world.getAllDirtyEntities().size).toBe(0);

        // Add component should mark entity as dirty
        world.addComponent(entity, { type: 'position', x: 10, y: 20 });

        expect(world.isEntityDirty(entity)).toBe(true);
        expect(world.isComponentDirty(entity, 'position')).toBe(true);
        expect(world.getDirtyEntities('position').has(entity)).toBe(true);
    });

    test('should track dirty entities when components are removed', () => {
        const world = new World();
        const entity = world.createEntity();

        world.addComponent(entity, { type: 'position', x: 10, y: 20 });

        // Clear dirty state to start fresh
        world.update(0); // This should clear dirty tracking

        expect(world.isEntityDirty(entity)).toBe(false);

        // Remove component should mark entity as dirty
        world.removeComponent(entity, 'position');

        expect(world.isEntityDirty(entity)).toBe(true);
        expect(world.isComponentDirty(entity, 'position')).toBe(true);
    });

    test('should clear dirty tracking after world update', () => {
        const world = new World();
        const entity = world.createEntity();

        world.addComponent(entity, { type: 'position', x: 10, y: 20 });

        expect(world.isEntityDirty(entity)).toBe(true);

        // Update should clear dirty tracking
        world.update(0);

        expect(world.isEntityDirty(entity)).toBe(false);
        expect(world.getAllDirtyEntities().size).toBe(0);
    });

    test('should allow systems to process only dirty entities', () => {
        const world = new World();
        const movementSystem = new MovementSystem();

        world.addSystem(movementSystem);

        // Create entities
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const entity3 = world.createEntity();

        // Add components to all entities
        world.addComponent(entity1, { type: 'position', x: 0, y: 0 });
        world.addComponent(entity1, { type: 'velocity', dx: 1, dy: 1 });

        world.addComponent(entity2, { type: 'position', x: 10, y: 10 });
        world.addComponent(entity2, { type: 'velocity', dx: 2, dy: 2 });

        world.addComponent(entity3, { type: 'position', x: 20, y: 20 });
        world.addComponent(entity3, { type: 'velocity', dx: 3, dy: 3 });

        // First update - all entities should be processed (all are dirty)
        world.update(1.0);

        let processed = movementSystem.getProcessedEntities();
        expect(processed).toContain(entity1);
        expect(processed).toContain(entity2);
        expect(processed).toContain(entity3);

        // Second update - no entities should be processed (none are dirty)
        world.update(1.0);

        processed = movementSystem.getProcessedEntities();
        expect(processed).toHaveLength(0);

        // Mark one entity as dirty and update again
        world.markComponentDirty(entity2, 'position');
        world.update(1.0);

        processed = movementSystem.getProcessedEntities();
        expect(processed).toHaveLength(1);
        expect(processed).toContain(entity2);
    });

    test('should clean up dirty tracking when entities are destroyed', () => {
        const world = new World();
        const entity = world.createEntity();

        world.addComponent(entity, { type: 'position', x: 10, y: 20 });

        expect(world.isEntityDirty(entity)).toBe(true);

        // Destroy entity should clean up dirty tracking
        world.destroyEntity(entity);

        expect(world.isEntityDirty(entity)).toBe(false);
        expect(world.getAllDirtyEntities().size).toBe(0);
    });

    test('should provide accurate dirty tracking statistics', () => {
        const world = new World();

        // Create entities with different components
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const entity3 = world.createEntity();

        world.addComponent(entity1, { type: 'position', x: 0, y: 0 });
        world.addComponent(entity1, { type: 'velocity', dx: 1, dy: 1 });

        world.addComponent(entity2, { type: 'position', x: 10, y: 10 });
        world.addComponent(entity2, { type: 'health', current: 100, max: 100 });

        world.addComponent(entity3, { type: 'velocity', dx: 2, dy: 2 });

        const stats = world.getDirtyTrackingStats();

        expect(stats.totalDirtyEntities).toBe(3);
        expect(stats.dirtyComponentTypes).toBe(3); // position, velocity, health
        expect(stats.averageDirtyPerType).toBeGreaterThan(1);
    });

    test('should integrate object pooling with ECS workflow', () => {
        const positionPool = createPositionPool();
        const world = new World();

        // Simulate rapid entity creation and destruction with pooled components
        const entities: number[] = [];

        // Create entities using pooled components
        for (let i = 0; i < 20; i++) {
            const entity = world.createEntity();
            const position = positionPool.acquire();

            position.x = i * 10;
            position.y = i * 5;

            world.addComponent(entity, position);
            entities.push(entity);
        }

        expect(positionPool.getAvailableCount()).toBeLessThan(10); // Some objects in use

        // Destroy half the entities and return components to pool
        for (let i = 0; i < 10; i++) {
            const entity = entities[i] as number; // We know this exists since we created 20 entities
            const position = world.getComponent<PositionComponent>(
                entity,
                'position'
            );

            if (position) {
                positionPool.release(position);
            }

            world.destroyEntity(entity);
        }

        expect(positionPool.getAvailableCount()).toBeGreaterThan(5); // Components returned to pool

        // Verify pool statistics
        const stats = positionPool.getStats();
        expect(stats.totalCreated).toBeGreaterThanOrEqual(20);
        expect(stats.totalAcquired).toBe(20);
        expect(stats.totalReleased).toBe(10);
    });

    test('should handle complex dirty tracking scenarios', () => {
        const world = new World();

        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        // Add multiple components to same entity
        world.addComponent(entity1, { type: 'position', x: 0, y: 0 });
        world.addComponent(entity1, { type: 'velocity', dx: 1, dy: 1 });
        world.addComponent(entity1, { type: 'health', current: 100, max: 100 });

        // Add single component to another entity
        world.addComponent(entity2, { type: 'position', x: 10, y: 10 });

        // Check initial dirty state
        expect(world.isEntityDirty(entity1)).toBe(true);
        expect(world.isEntityDirty(entity2)).toBe(true);
        expect(world.getDirtyEntities('position').size).toBe(2);
        expect(world.getDirtyEntities('velocity').size).toBe(1);
        expect(world.getDirtyEntities('health').size).toBe(1);

        // Update should clear all dirty tracking
        world.update(0);

        expect(world.getAllDirtyEntities().size).toBe(0);

        // Remove one component from entity1
        world.removeComponent(entity1, 'velocity');

        // Only entity1 should be dirty, and only for velocity component
        expect(world.isEntityDirty(entity1)).toBe(true);
        expect(world.isEntityDirty(entity2)).toBe(false);
        expect(world.isComponentDirty(entity1, 'velocity')).toBe(true);
        expect(world.isComponentDirty(entity1, 'position')).toBe(false);
    });

    test('should maintain performance under heavy dirty tracking load', () => {
        const world = new World();
        const entityCount = 1000;
        const entities: number[] = [];

        // Create many entities and mark them dirty
        const startTime = performance.now();

        for (let i = 0; i < entityCount; i++) {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: i, y: i });
            entities.push(entity);
        }

        const createTime = performance.now() - startTime;

        // Update to clear dirty tracking
        const updateStartTime = performance.now();
        world.update(0);
        const updateTime = performance.now() - updateStartTime;

        // Verify performance is reasonable (should complete in reasonable time)
        expect(createTime).toBeLessThan(1000); // Less than 1 second for 1000 entities
        expect(updateTime).toBeLessThan(100); // Less than 100ms for update

        // Verify state is correct
        expect(world.getAllDirtyEntities().size).toBe(0);
        expect(world.getEntityCount()).toBe(entityCount);
    });
});
