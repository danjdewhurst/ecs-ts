import { describe, expect, test } from 'bun:test';
import { EntityManager } from './EntityManager.ts';

describe('EntityManager', () => {
    test('should instantiate with correct initial state', () => {
        // Arrange & Act
        const manager = new EntityManager();

        // Assert
        expect(manager.getEntityCount()).toBe(0);
        expect(manager.getLivingEntities().size).toBe(0);
        expect(manager.isEntityAlive(0)).toBe(false);
        expect(manager.isEntityAlive(1)).toBe(false);
    });

    test('should create unique entity IDs', () => {
        const manager = new EntityManager();
        const entity1 = manager.createEntity();
        const entity2 = manager.createEntity();

        expect(entity1).toBe(1);
        expect(entity2).toBe(2);
        expect(entity1).not.toBe(entity2);
    });

    test('should track living entities', () => {
        const manager = new EntityManager();
        const entity = manager.createEntity();

        expect(manager.isEntityAlive(entity)).toBe(true);
        expect(manager.getEntityCount()).toBe(1);
        expect(manager.getLivingEntities().has(entity)).toBe(true);
    });

    test('should destroy entities and recycle IDs', () => {
        const manager = new EntityManager();
        const entity1 = manager.createEntity();
        const entity2 = manager.createEntity();

        manager.destroyEntity(entity1);

        expect(manager.isEntityAlive(entity1)).toBe(false);
        expect(manager.isEntityAlive(entity2)).toBe(true);
        expect(manager.getEntityCount()).toBe(1);

        // Next entity should reuse the destroyed ID
        const entity3 = manager.createEntity();
        expect(entity3).toBe(entity1);
    });

    test('should handle destroying non-existent entities gracefully', () => {
        const manager = new EntityManager();

        // Should not throw
        manager.destroyEntity(999);
        expect(manager.getEntityCount()).toBe(0);
    });

    test('should return correct living entities set', () => {
        const manager = new EntityManager();
        const entity1 = manager.createEntity();
        const entity2 = manager.createEntity();
        const entity3 = manager.createEntity();

        manager.destroyEntity(entity2);

        const livingEntities = manager.getLivingEntities();
        expect(livingEntities.has(entity1)).toBe(true);
        expect(livingEntities.has(entity2)).toBe(false);
        expect(livingEntities.has(entity3)).toBe(true);
        expect(livingEntities.size).toBe(2);
    });

    test('should return isolated copy of living entities set', () => {
        // Arrange
        const manager = new EntityManager();
        const entity1 = manager.createEntity();
        const entity2 = manager.createEntity();

        // Act
        const livingEntities1 = manager.getLivingEntities();
        livingEntities1.add(999); // Modify the returned set
        livingEntities1.delete(entity1);

        // Assert
        const livingEntities2 = manager.getLivingEntities();
        expect(livingEntities2.has(entity1)).toBe(true);
        expect(livingEntities2.has(entity2)).toBe(true);
        expect(livingEntities2.has(999)).toBe(false);
        expect(manager.isEntityAlive(entity1)).toBe(true);
        expect(manager.isEntityAlive(999)).toBe(false);
    });

    test('should handle multiple recycled IDs in LIFO order', () => {
        // Arrange
        const manager = new EntityManager();
        const entity1 = manager.createEntity(); // ID 1
        const entity2 = manager.createEntity(); // ID 2
        const entity3 = manager.createEntity(); // ID 3

        // Act
        manager.destroyEntity(entity1); // Recycle ID 1
        manager.destroyEntity(entity2); // Recycle ID 2
        manager.destroyEntity(entity3); // Recycle ID 3

        const recycled1 = manager.createEntity(); // Should get ID 3 (LIFO)
        const recycled2 = manager.createEntity(); // Should get ID 2
        const recycled3 = manager.createEntity(); // Should get ID 1

        // Assert
        expect(recycled1).toBe(entity3);
        expect(recycled2).toBe(entity2);
        expect(recycled3).toBe(entity1);
        expect(manager.getEntityCount()).toBe(3);
    });

    test('should handle destroying same entity multiple times', () => {
        // Arrange
        const manager = new EntityManager();
        const entity = manager.createEntity();

        // Act
        manager.destroyEntity(entity);
        manager.destroyEntity(entity); // Destroy again

        // Assert
        expect(manager.isEntityAlive(entity)).toBe(false);
        expect(manager.getEntityCount()).toBe(0);

        // Recycled ID should only appear once
        const newEntity1 = manager.createEntity();
        const newEntity2 = manager.createEntity();

        expect(newEntity1).toBe(entity);
        expect(newEntity2).not.toBe(entity);
        expect(manager.getEntityCount()).toBe(2);
    });

    test('should check non-existent entity is not alive', () => {
        // Arrange
        const manager = new EntityManager();

        // Act & Assert
        expect(manager.isEntityAlive(999)).toBe(false);
        expect(manager.isEntityAlive(0)).toBe(false);
        expect(manager.isEntityAlive(-1)).toBe(false);
    });

    test('should handle zero entity count correctly', () => {
        // Arrange
        const manager = new EntityManager();

        // Act & Assert
        expect(manager.getEntityCount()).toBe(0);
        expect(manager.getLivingEntities().size).toBe(0);
    });

    test('should maintain correct count through create and destroy cycles', () => {
        // Arrange
        const manager = new EntityManager();

        // Act & Assert - Create cycle
        manager.createEntity();
        expect(manager.getEntityCount()).toBe(1);

        manager.createEntity();
        expect(manager.getEntityCount()).toBe(2);

        manager.createEntity();
        expect(manager.getEntityCount()).toBe(3);

        // Destroy cycle
        manager.destroyEntity(1);
        expect(manager.getEntityCount()).toBe(2);

        manager.destroyEntity(2);
        expect(manager.getEntityCount()).toBe(1);

        manager.destroyEntity(3);
        expect(manager.getEntityCount()).toBe(0);

        // Recreate cycle (using recycled IDs)
        manager.createEntity();
        expect(manager.getEntityCount()).toBe(1);

        manager.createEntity();
        expect(manager.getEntityCount()).toBe(2);
    });

    test('should handle large number of entities', () => {
        // Arrange
        const manager = new EntityManager();
        const entityCount = 1000;
        const entities: number[] = [];

        // Act - Create many entities
        for (let i = 0; i < entityCount; i++) {
            entities.push(manager.createEntity());
        }

        // Assert
        expect(manager.getEntityCount()).toBe(entityCount);
        expect(entities.length).toBe(entityCount);
        expect(new Set(entities).size).toBe(entityCount); // All unique IDs

        // Destroy half
        for (let i = 0; i < entityCount / 2; i++) {
            manager.destroyEntity(entities[i]!);
        }

        expect(manager.getEntityCount()).toBe(entityCount / 2);

        // Recreate destroyed entities
        const recycledEntities: number[] = [];
        for (let i = 0; i < entityCount / 2; i++) {
            recycledEntities.push(manager.createEntity());
        }

        expect(manager.getEntityCount()).toBe(entityCount);
        // Recycled IDs should match destroyed IDs (in reverse order due to LIFO)
        expect(new Set(recycledEntities).size).toBe(entityCount / 2);
    });

    test('should handle concurrent entity operations correctly', () => {
        // Arrange
        const manager = new EntityManager();
        const entity1 = manager.createEntity();
        const entity2 = manager.createEntity();
        const entity3 = manager.createEntity();

        // Act - Interleaved operations
        manager.destroyEntity(entity2);
        const entity4 = manager.createEntity(); // Should reuse entity2's ID
        manager.destroyEntity(entity1);
        const entity5 = manager.createEntity(); // Should reuse entity1's ID

        // Assert
        expect(entity4).toBe(entity2);
        expect(entity5).toBe(entity1);
        expect(manager.isEntityAlive(entity1)).toBe(true); // Reused
        expect(manager.isEntityAlive(entity2)).toBe(true); // Reused
        expect(manager.isEntityAlive(entity3)).toBe(true);
        expect(manager.getEntityCount()).toBe(3);
    });

    test('should handle edge case with entity ID 1', () => {
        // Arrange
        const manager = new EntityManager();

        // Act
        const firstEntity = manager.createEntity();

        // Assert
        expect(firstEntity).toBe(1);
        expect(manager.isEntityAlive(1)).toBe(true);

        // Destroy and recreate
        manager.destroyEntity(1);
        expect(manager.isEntityAlive(1)).toBe(false);

        const recycledEntity = manager.createEntity();
        expect(recycledEntity).toBe(1);
        expect(manager.isEntityAlive(1)).toBe(true);
    });

    test('should maintain entity ID sequence when no recycling', () => {
        // Arrange
        const manager = new EntityManager();

        // Act - Create entities without destroying any
        const entities = [
            manager.createEntity(),
            manager.createEntity(),
            manager.createEntity(),
            manager.createEntity(),
            manager.createEntity(),
        ];

        // Assert - IDs should be sequential
        expect(entities).toEqual([1, 2, 3, 4, 5]);
        expect(manager.getEntityCount()).toBe(5);
    });
});
