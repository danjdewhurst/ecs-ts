import { describe, expect, test } from 'bun:test';
import { EntityManager } from './EntityManager.ts';

describe('EntityManager', () => {
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
});
