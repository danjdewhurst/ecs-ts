import { beforeEach, describe, expect, test } from 'bun:test';
import { ArchetypeManager } from './ArchetypeManager';

describe('ArchetypeManager', () => {
    let manager: ArchetypeManager;

    beforeEach(() => {
        manager = new ArchetypeManager();
    });

    describe('constructor', () => {
        test('should instantiate with empty state', () => {
            // Arrange & Act
            const newManager = new ArchetypeManager();

            // Assert
            expect(newManager.getArchetypeStats()).toEqual([]);
            expect(newManager.getEntityArchetype(1)).toBeUndefined();
            expect(newManager.queryEntities(['any'])).toEqual([]);
        });
    });

    describe('updateEntityArchetype', () => {
        test('should create new archetype for entity with components', () => {
            // Arrange
            const entityId = 1;
            const components = ['position', 'velocity'];

            // Act
            manager.updateEntityArchetype(entityId, components);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBe('position|velocity');
        });

        test('should sort component types alphabetically in archetype', () => {
            // Arrange
            const entityId = 1;
            const components = ['velocity', 'health', 'position'];

            // Act
            manager.updateEntityArchetype(entityId, components);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBe('health|position|velocity');
        });

        test('should update entity archetype when components change', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.updateEntityArchetype(entityId, ['position', 'velocity']);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBe('position|velocity');
        });

        test('should remove entity from old archetype when updating', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.updateEntityArchetype(entityId, ['velocity']);
            const positionEntities = manager.queryEntities(['position']);

            // Assert
            expect(positionEntities).not.toContain(entityId);
        });

        test('should delete empty archetype after all entities removed', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);
            const statsBeforeUpdate = manager.getArchetypeStats();
            expect(statsBeforeUpdate.length).toBe(1);

            // Act
            manager.updateEntityArchetype(entityId, ['velocity']);
            const statsAfterUpdate = manager.getArchetypeStats();

            // Assert
            expect(
                statsAfterUpdate.find((s) => s.archetype === 'position')
            ).toBeUndefined();
        });

        test('should remove entity from manager when given empty component list', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.updateEntityArchetype(entityId, []);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBeUndefined();
        });

        test('should handle entity with no previous archetype and empty components', () => {
            // Arrange
            const entityId = 1;

            // Act
            manager.updateEntityArchetype(entityId, []);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBeUndefined();
        });

        test('should group multiple entities in same archetype', () => {
            // Arrange
            const entity1 = 1;
            const entity2 = 2;
            const components = ['position', 'velocity'];

            // Act
            manager.updateEntityArchetype(entity1, components);
            manager.updateEntityArchetype(entity2, components);

            // Assert
            const entities = manager.queryEntities(['position', 'velocity']);
            expect(entities).toContain(entity1);
            expect(entities).toContain(entity2);
            expect(entities.length).toBe(2);
        });
    });

    describe('queryEntities', () => {
        test('should return empty array for empty query', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);

            // Act
            const result = manager.queryEntities([]);

            // Assert
            expect(result).toEqual([]);
        });

        test('should return entities matching single component', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position', 'velocity']);
            manager.updateEntityArchetype(3, ['velocity']);

            // Act
            const result = manager.queryEntities(['position']);

            // Assert
            expect(result).toContain(1);
            expect(result).toContain(2);
            expect(result.length).toBe(2);
        });

        test('should return entities matching multiple components', () => {
            // Arrange
            manager.updateEntityArchetype(1, [
                'position',
                'velocity',
                'health',
            ]);
            manager.updateEntityArchetype(2, ['position', 'velocity']);
            manager.updateEntityArchetype(3, ['position']);

            // Act
            const result = manager.queryEntities(['position', 'velocity']);

            // Assert
            expect(result).toContain(1);
            expect(result).toContain(2);
            expect(result.length).toBe(2);
        });

        test('should return empty array when no entities match', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['velocity']);

            // Act
            const result = manager.queryEntities(['health']);

            // Assert
            expect(result).toEqual([]);
        });

        test('should handle query with unsorted component names', () => {
            // Arrange
            manager.updateEntityArchetype(1, [
                'position',
                'velocity',
                'health',
            ]);

            // Act
            const result = manager.queryEntities(['velocity', 'position']);

            // Assert
            expect(result).toContain(1);
        });

        test('should return entities from multiple archetypes', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position', 'velocity']);
            manager.updateEntityArchetype(3, [
                'position',
                'velocity',
                'health',
            ]);

            // Act
            const result = manager.queryEntities(['position']);

            // Assert
            expect(result.length).toBe(3);
            expect(result).toContain(1);
            expect(result).toContain(2);
            expect(result).toContain(3);
        });

        test('should not return entities missing required components', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position', 'velocity']);
            manager.updateEntityArchetype(2, ['position', 'health']);

            // Act
            const result = manager.queryEntities([
                'position',
                'velocity',
                'health',
            ]);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('getEntityArchetype', () => {
        test('should return undefined for entity not in manager', () => {
            // Arrange
            const entityId = 999;

            // Act
            const archetype = manager.getEntityArchetype(entityId);

            // Assert
            expect(archetype).toBeUndefined();
        });

        test('should return correct archetype for entity', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, [
                'health',
                'position',
                'velocity',
            ]);

            // Act
            const archetype = manager.getEntityArchetype(entityId);

            // Assert
            expect(archetype).toBe('health|position|velocity');
        });

        test('should return updated archetype after component changes', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.updateEntityArchetype(entityId, ['velocity']);
            const archetype = manager.getEntityArchetype(entityId);

            // Assert
            expect(archetype).toBe('velocity');
        });
    });

    describe('removeEntity', () => {
        test('should remove entity from manager', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.removeEntity(entityId);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBeUndefined();
        });

        test('should remove entity from archetype queries', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.removeEntity(entityId);
            const result = manager.queryEntities(['position']);

            // Assert
            expect(result).not.toContain(entityId);
        });

        test('should delete empty archetype after last entity removed', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.removeEntity(entityId);
            const stats = manager.getArchetypeStats();

            // Assert
            expect(
                stats.find((s) => s.archetype === 'position')
            ).toBeUndefined();
        });

        test('should not delete archetype if other entities remain', () => {
            // Arrange
            const entity1 = 1;
            const entity2 = 2;
            manager.updateEntityArchetype(entity1, ['position']);
            manager.updateEntityArchetype(entity2, ['position']);

            // Act
            manager.removeEntity(entity1);
            const stats = manager.getArchetypeStats();

            // Assert
            const positionArchetype = stats.find(
                (s) => s.archetype === 'position'
            );
            expect(positionArchetype).toBeDefined();
            expect(positionArchetype?.entityCount).toBe(1);
        });

        test('should handle removing entity not in manager', () => {
            // Arrange
            const entityId = 999;

            // Act & Assert (should not throw)
            expect(() => manager.removeEntity(entityId)).not.toThrow();
        });

        test('should handle removing entity multiple times', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.removeEntity(entityId);
            manager.removeEntity(entityId);

            // Assert (should not throw)
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBeUndefined();
        });
    });

    describe('getArchetypeStats', () => {
        test('should return empty array for empty manager', () => {
            // Act
            const stats = manager.getArchetypeStats();

            // Assert
            expect(stats).toEqual([]);
        });

        test('should return stats for single archetype', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position']);

            // Act
            const stats = manager.getArchetypeStats();

            // Assert
            expect(stats.length).toBe(1);
            expect(stats[0]?.archetype).toBe('position');
            expect(stats[0]?.entityCount).toBe(2);
        });

        test('should return stats for multiple archetypes', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position', 'velocity']);
            manager.updateEntityArchetype(3, ['health']);

            // Act
            const stats = manager.getArchetypeStats();

            // Assert
            expect(stats.length).toBe(3);
            expect(
                stats.find((s) => s.archetype === 'position')?.entityCount
            ).toBe(1);
            expect(
                stats.find((s) => s.archetype === 'position|velocity')
                    ?.entityCount
            ).toBe(1);
            expect(
                stats.find((s) => s.archetype === 'health')?.entityCount
            ).toBe(1);
        });

        test('should update stats when entities change archetypes', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position']);

            // Act
            manager.updateEntityArchetype(1, ['velocity']);
            const stats = manager.getArchetypeStats();

            // Assert
            expect(
                stats.find((s) => s.archetype === 'position')?.entityCount
            ).toBe(1);
            expect(
                stats.find((s) => s.archetype === 'velocity')?.entityCount
            ).toBe(1);
        });

        test('should not include empty archetypes in stats', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.removeEntity(1);

            // Act
            const stats = manager.getArchetypeStats();

            // Assert
            expect(
                stats.find((s) => s.archetype === 'position')
            ).toBeUndefined();
        });
    });

    describe('archetype transitions and edge cases', () => {
        test('should handle rapid archetype changes', () => {
            // Arrange
            const entityId = 1;

            // Act
            manager.updateEntityArchetype(entityId, ['position']);
            manager.updateEntityArchetype(entityId, ['velocity']);
            manager.updateEntityArchetype(entityId, ['health']);
            manager.updateEntityArchetype(entityId, [
                'position',
                'velocity',
                'health',
            ]);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBe('health|position|velocity');
        });

        test('should handle entity transitioning through empty archetype', () => {
            // Arrange
            const entityId = 1;
            manager.updateEntityArchetype(entityId, ['position']);

            // Act
            manager.updateEntityArchetype(entityId, []);
            manager.updateEntityArchetype(entityId, ['velocity']);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBe('velocity');
        });

        test('should maintain archetype integrity with many entities', () => {
            // Arrange
            const entityCount = 100;
            for (let i = 0; i < entityCount; i++) {
                manager.updateEntityArchetype(i, ['position']);
            }

            // Act
            const result = manager.queryEntities(['position']);

            // Assert
            expect(result.length).toBe(entityCount);
        });

        test('should handle complex archetype graph transitions', () => {
            // Arrange
            const entity1 = 1;
            const entity2 = 2;
            const entity3 = 3;

            // Act - Create multiple archetypes with overlapping components
            manager.updateEntityArchetype(entity1, ['position']);
            manager.updateEntityArchetype(entity2, ['position', 'velocity']);
            manager.updateEntityArchetype(entity3, [
                'position',
                'velocity',
                'health',
            ]);

            // Transition entities through different archetypes
            manager.updateEntityArchetype(entity1, ['position', 'velocity']);
            manager.updateEntityArchetype(entity2, [
                'position',
                'velocity',
                'health',
            ]);
            manager.updateEntityArchetype(entity3, ['position']);

            // Assert
            const stats = manager.getArchetypeStats();
            expect(stats.length).toBe(3); // 'position', 'position|velocity', and 'health|position|velocity'
            expect(
                stats.find((s) => s.archetype === 'position')?.entityCount
            ).toBe(1);
            expect(
                stats.find((s) => s.archetype === 'position|velocity')
                    ?.entityCount
            ).toBe(1);
            expect(
                stats.find((s) => s.archetype === 'health|position|velocity')
                    ?.entityCount
            ).toBe(1);
        });

        test('should handle single component archetype', () => {
            // Arrange
            const entityId = 1;

            // Act
            manager.updateEntityArchetype(entityId, ['position']);

            // Assert
            const archetype = manager.getEntityArchetype(entityId);
            expect(archetype).toBe('position');
        });

        test('should maintain entity isolation in different archetypes', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['velocity']);
            manager.updateEntityArchetype(3, ['health']);

            // Act
            const positionEntities = manager.queryEntities(['position']);
            const velocityEntities = manager.queryEntities(['velocity']);
            const healthEntities = manager.queryEntities(['health']);

            // Assert
            expect(positionEntities).toEqual([1]);
            expect(velocityEntities).toEqual([2]);
            expect(healthEntities).toEqual([3]);
        });
    });

    describe('edge cases and code paths', () => {
        test('should exercise every() predicate when all components match', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['a', 'b', 'c', 'd', 'e']);
            manager.updateEntityArchetype(2, ['a', 'b', 'c']);

            // Act - Query that exercises the every() predicate thoroughly
            const result = manager.queryEntities(['a', 'b', 'c']);

            // Assert
            expect(result).toContain(1);
            expect(result).toContain(2);
            expect(result.length).toBe(2);
        });

        test('should exercise every() predicate when components do not match', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['a', 'b']); // Missing 'c'
            manager.updateEntityArchetype(2, ['a', 'c']); // Missing 'b'
            manager.updateEntityArchetype(3, ['b', 'c']); // Missing 'a'

            // Act - Query that exercises the every() predicate with non-matching components
            const result = manager.queryEntities(['a', 'b', 'c']);

            // Assert - No entities should match
            expect(result.length).toBe(0);
        });

        test('should exercise map() function in getArchetypeStats with multiple archetypes', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['velocity']);
            manager.updateEntityArchetype(3, ['health']);
            manager.updateEntityArchetype(4, ['position', 'velocity']);

            // Act
            const stats = manager.getArchetypeStats();

            // Assert - Verify the map function properly transforms each archetype entry
            expect(stats.length).toBe(4);
            stats.forEach((stat) => {
                expect(stat).toHaveProperty('archetype');
                expect(stat).toHaveProperty('entityCount');
                expect(typeof stat.archetype).toBe('string');
                expect(typeof stat.entityCount).toBe('number');
                expect(stat.entityCount).toBeGreaterThan(0);
            });
        });
    });

    describe('memory management', () => {
        test('should clean up archetype when all entities removed via updateEntityArchetype', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position']);

            // Act
            manager.updateEntityArchetype(1, ['velocity']);
            manager.updateEntityArchetype(2, ['velocity']);
            const stats = manager.getArchetypeStats();

            // Assert
            expect(
                stats.find((s) => s.archetype === 'position')
            ).toBeUndefined();
        });

        test('should clean up archetype when all entities removed via removeEntity', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position']);

            // Act
            manager.removeEntity(1);
            manager.removeEntity(2);
            const stats = manager.getArchetypeStats();

            // Assert
            expect(stats.length).toBe(0);
        });

        test('should handle mixed removal methods', () => {
            // Arrange
            manager.updateEntityArchetype(1, ['position']);
            manager.updateEntityArchetype(2, ['position']);
            manager.updateEntityArchetype(3, ['position']);

            // Act
            manager.removeEntity(1);
            manager.updateEntityArchetype(2, []);
            manager.updateEntityArchetype(3, ['velocity']);
            const stats = manager.getArchetypeStats();

            // Assert
            expect(
                stats.find((s) => s.archetype === 'position')
            ).toBeUndefined();
            expect(
                stats.find((s) => s.archetype === 'velocity')?.entityCount
            ).toBe(1);
        });
    });
});
