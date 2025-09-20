import { describe, expect, test } from 'bun:test';
import { DirtyTracker } from './DirtyTracker';

describe('DirtyTracker', () => {
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
});
