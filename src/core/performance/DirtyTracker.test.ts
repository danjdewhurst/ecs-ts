import { describe, expect, test } from 'bun:test';
import { DirtyTracker } from './DirtyTracker';

describe('DirtyTracker', () => {
    test('should initialize with empty state', () => {
        // Arrange & Act
        const tracker = new DirtyTracker();

        // Assert
        expect(tracker.getAllDirtyEntities().size).toBe(0);
        expect(tracker.getDirtyEntities('any').size).toBe(0);
        expect(tracker.isEntityDirty(1)).toBe(false);
        const stats = tracker.getStats();
        expect(stats.totalDirtyEntities).toBe(0);
        expect(stats.dirtyComponentTypes).toBe(0);
        expect(stats.averageDirtyPerType).toBe(0);
    });

    test('should mark entities as dirty for specific component types', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'position');
        tracker.markDirty(1, 'velocity');

        expect(tracker.getDirtyEntities('position').has(1)).toBe(true);
        expect(tracker.getDirtyEntities('position').has(2)).toBe(true);
        expect(tracker.getDirtyEntities('velocity').has(1)).toBe(true);
        expect(tracker.getDirtyEntities('velocity').has(2)).toBe(false);
    });

    test('should track all dirty entities regardless of component type', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'velocity');
        tracker.markDirty(3, 'health');

        const allDirty = tracker.getAllDirtyEntities();
        expect(allDirty.has(1)).toBe(true);
        expect(allDirty.has(2)).toBe(true);
        expect(allDirty.has(3)).toBe(true);
        expect(allDirty.size).toBe(3);
    });

    test('should check if specific entity is dirty', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');

        expect(tracker.isEntityDirty(1)).toBe(true);
        expect(tracker.isEntityDirty(2)).toBe(false);
    });

    test('should check if specific component is dirty for entity', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(1, 'velocity');

        expect(tracker.isComponentDirty(1, 'position')).toBe(true);
        expect(tracker.isComponentDirty(1, 'velocity')).toBe(true);
        expect(tracker.isComponentDirty(1, 'health')).toBe(false);
        expect(tracker.isComponentDirty(2, 'position')).toBe(false);
    });

    test('should clear all dirty state', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'velocity');

        expect(tracker.getAllDirtyEntities().size).toBe(2);

        tracker.clearDirty();

        expect(tracker.getAllDirtyEntities().size).toBe(0);
        expect(tracker.getDirtyEntities('position').size).toBe(0);
        expect(tracker.getDirtyEntities('velocity').size).toBe(0);
    });

    test('should clear dirty state for specific component type', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(1, 'velocity');
        tracker.markDirty(2, 'position');

        tracker.clearDirtyComponent('position');

        expect(tracker.getDirtyEntities('position').size).toBe(0);
        expect(tracker.getDirtyEntities('velocity').size).toBe(1);
        expect(tracker.isEntityDirty(1)).toBe(true); // Still has velocity dirty
        expect(tracker.isEntityDirty(2)).toBe(false); // Only had position
    });

    test('should clear dirty state for specific entity', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(1, 'velocity');
        tracker.markDirty(2, 'position');

        tracker.clearDirtyEntity(1);

        expect(tracker.isEntityDirty(1)).toBe(false);
        expect(tracker.isEntityDirty(2)).toBe(true);
        expect(tracker.getDirtyEntities('position').has(1)).toBe(false);
        expect(tracker.getDirtyEntities('position').has(2)).toBe(true);
        expect(tracker.getDirtyEntities('velocity').has(1)).toBe(false);
    });

    test('should provide accurate statistics', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'position');
        tracker.markDirty(1, 'velocity');
        tracker.markDirty(3, 'health');

        const stats = tracker.getStats();

        expect(stats.totalDirtyEntities).toBe(3);
        expect(stats.dirtyComponentTypes).toBe(3);
        expect(stats.averageDirtyPerType).toBe(4 / 3); // 4 total dirty components across 3 types
    });

    test('should handle empty state correctly', () => {
        const tracker = new DirtyTracker();

        expect(tracker.getAllDirtyEntities().size).toBe(0);
        expect(tracker.getDirtyEntities('position').size).toBe(0);
        expect(tracker.isEntityDirty(1)).toBe(false);
        expect(tracker.isComponentDirty(1, 'position')).toBe(false);

        const stats = tracker.getStats();
        expect(stats.totalDirtyEntities).toBe(0);
        expect(stats.dirtyComponentTypes).toBe(0);
        expect(stats.averageDirtyPerType).toBe(0);
    });

    test('should handle multiple marks on same entity/component', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');
        tracker.markDirty(1, 'position'); // Mark again
        tracker.markDirty(1, 'position'); // Mark again

        expect(tracker.getDirtyEntities('position').size).toBe(1);
        expect(tracker.getAllDirtyEntities().size).toBe(1);
    });

    test('should return independent copies of dirty entity sets', () => {
        const tracker = new DirtyTracker();

        tracker.markDirty(1, 'position');

        const dirtySet1 = tracker.getDirtyEntities('position');
        const dirtySet2 = tracker.getDirtyEntities('position');

        // Modifying one set shouldn't affect the other
        dirtySet1.add(999);

        expect(dirtySet2.has(999)).toBe(false);
        expect(tracker.getDirtyEntities('position').has(999)).toBe(false);
    });

    test('should handle clearing non-existent component type', () => {
        // Arrange
        const tracker = new DirtyTracker();
        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'velocity');

        // Act - Clear a component type that was never marked dirty
        tracker.clearDirtyComponent('nonexistent');

        // Assert - Existing dirty entities should remain unchanged
        expect(tracker.isEntityDirty(1)).toBe(true);
        expect(tracker.isEntityDirty(2)).toBe(true);
        expect(tracker.getDirtyEntities('position').size).toBe(1);
        expect(tracker.getDirtyEntities('velocity').size).toBe(1);
    });

    test('should handle clearing empty component type on empty tracker', () => {
        // Arrange
        const tracker = new DirtyTracker();

        // Act - Clear a component type when tracker is completely empty
        tracker.clearDirtyComponent('position');

        // Assert - Should not throw error and state remains empty
        expect(tracker.getAllDirtyEntities().size).toBe(0);
        expect(tracker.getDirtyEntities('position').size).toBe(0);
        const stats = tracker.getStats();
        expect(stats.totalDirtyEntities).toBe(0);
    });

    test('should handle clearing entity with multiple dirty components correctly', () => {
        // Arrange
        const tracker = new DirtyTracker();
        tracker.markDirty(1, 'position');
        tracker.markDirty(1, 'velocity');
        tracker.markDirty(1, 'health');
        tracker.markDirty(2, 'position');

        // Act - Clear one component type, entity should still be dirty due to others
        tracker.clearDirtyComponent('position');

        // Assert - Entity 1 still dirty due to velocity and health
        expect(tracker.isEntityDirty(1)).toBe(true);
        expect(tracker.isComponentDirty(1, 'position')).toBe(false);
        expect(tracker.isComponentDirty(1, 'velocity')).toBe(true);
        expect(tracker.isComponentDirty(1, 'health')).toBe(true);
        // Entity 2 should no longer be dirty (only had position)
        expect(tracker.isEntityDirty(2)).toBe(false);
    });

    test('should handle getAllDirtyEntities returning independent copy', () => {
        // Arrange
        const tracker = new DirtyTracker();
        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'velocity');

        // Act - Get dirty entities and modify the returned set
        const allDirty1 = tracker.getAllDirtyEntities();
        allDirty1.add(999);
        allDirty1.delete(1);

        // Assert - Original tracker should be unchanged
        const allDirty2 = tracker.getAllDirtyEntities();
        expect(allDirty2.has(1)).toBe(true);
        expect(allDirty2.has(2)).toBe(true);
        expect(allDirty2.has(999)).toBe(false);
        expect(allDirty2.size).toBe(2);
    });

    test('should handle complex scenario with multiple component types and resets', () => {
        // Arrange
        const tracker = new DirtyTracker();
        tracker.markDirty(1, 'position');
        tracker.markDirty(1, 'velocity');
        tracker.markDirty(2, 'position');
        tracker.markDirty(3, 'health');

        // Act & Assert - Clear position, entity 1 should still be dirty (has velocity)
        tracker.clearDirtyComponent('position');
        expect(tracker.isEntityDirty(1)).toBe(true);
        expect(tracker.isEntityDirty(2)).toBe(false);
        expect(tracker.isEntityDirty(3)).toBe(true);

        // Act & Assert - Clear velocity, entity 1 should no longer be dirty
        tracker.clearDirtyComponent('velocity');
        expect(tracker.isEntityDirty(1)).toBe(false);
        expect(tracker.isEntityDirty(3)).toBe(true);

        // Act & Assert - Clear health, no entities should be dirty
        tracker.clearDirtyComponent('health');
        expect(tracker.getAllDirtyEntities().size).toBe(0);
    });

    test('should handle clearing entity that does not exist', () => {
        // Arrange
        const tracker = new DirtyTracker();
        tracker.markDirty(1, 'position');

        // Act - Clear entity that was never marked dirty
        tracker.clearDirtyEntity(999);

        // Assert - Should not affect existing dirty entities
        expect(tracker.isEntityDirty(1)).toBe(true);
        expect(tracker.getAllDirtyEntities().size).toBe(1);
    });

    test('should calculate statistics with varying component counts per type', () => {
        // Arrange
        const tracker = new DirtyTracker();

        // Create varied distribution of dirty components
        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'position');
        tracker.markDirty(3, 'position');
        tracker.markDirty(1, 'velocity'); // Only 1 entity with velocity
        tracker.markDirty(1, 'health');
        tracker.markDirty(2, 'health');

        // Act
        const stats = tracker.getStats();

        // Assert
        expect(stats.totalDirtyEntities).toBe(3); // entities 1, 2, 3
        expect(stats.dirtyComponentTypes).toBe(3); // position, velocity, health
        // 3 position + 1 velocity + 2 health = 6 total dirty components
        // 6 / 3 types = 2 average
        expect(stats.averageDirtyPerType).toBe(2);
    });

    test('should calculate statistics with single component type', () => {
        // Arrange
        const tracker = new DirtyTracker();
        tracker.markDirty(1, 'position');
        tracker.markDirty(2, 'position');

        // Act
        const stats = tracker.getStats();

        // Assert
        expect(stats.totalDirtyEntities).toBe(2);
        expect(stats.dirtyComponentTypes).toBe(1);
        expect(stats.averageDirtyPerType).toBe(2); // 2 dirty components / 1 type
    });
});
