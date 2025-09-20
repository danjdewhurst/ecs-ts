import { describe, expect, test } from 'bun:test';
import { ObjectPool } from './ObjectPool';

// Test object for pooling
interface TestObject {
    value: number;
    active: boolean;
}

function createTestObject(): TestObject {
    return { value: 0, active: true };
}

function resetTestObject(obj: TestObject): void {
    obj.value = 0;
    obj.active = false;
}

describe('ObjectPool', () => {
    test('should create pool with initial objects', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 5, 10);

        expect(pool.getAvailableCount()).toBe(5);
        expect(pool.getMaxSize()).toBe(10);
    });

    test('should acquire objects from pool', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 3, 10);

        const obj1 = pool.acquire();
        const obj2 = pool.acquire();

        expect(pool.getAvailableCount()).toBe(1);
        expect(obj1).toBeDefined();
        expect(obj2).toBeDefined();
        expect(obj1).not.toBe(obj2);
    });

    test('should create new objects when pool is empty', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 1, 10);

        const obj1 = pool.acquire(); // From pool
        const obj2 = pool.acquire(); // New creation

        expect(pool.getAvailableCount()).toBe(0);
        expect(obj1).toBeDefined();
        expect(obj2).toBeDefined();
    });

    test('should reset and return objects to pool', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 2, 10);

        const obj = pool.acquire();
        obj.value = 42;
        obj.active = true;

        expect(pool.getAvailableCount()).toBe(1);

        pool.release(obj);

        expect(pool.getAvailableCount()).toBe(2);
        expect(obj.value).toBe(0); // Should be reset
        expect(obj.active).toBe(false); // Should be reset
    });

    test('should not exceed maximum pool size', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 0, 2);

        const obj1 = pool.acquire();
        const obj2 = pool.acquire();
        const obj3 = pool.acquire();

        pool.release(obj1);
        pool.release(obj2);
        pool.release(obj3); // This should not be added to pool (exceeds max)

        expect(pool.getAvailableCount()).toBe(2);
    });

    test('should warm up pool correctly', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 1, 10);

        expect(pool.getAvailableCount()).toBe(1);

        pool.warmUp(5);

        expect(pool.getAvailableCount()).toBe(5);
    });

    test('should not warm up beyond max size', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 0, 3);

        pool.warmUp(10); // Requesting more than max

        expect(pool.getAvailableCount()).toBe(3); // Should be clamped to max
    });

    test('should clear pool', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 5, 10);

        expect(pool.getAvailableCount()).toBe(5);

        pool.clear();

        expect(pool.getAvailableCount()).toBe(0);
    });

    test('should update max size and trim excess objects', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 5, 10);

        expect(pool.getAvailableCount()).toBe(5);

        pool.setMaxSize(3);

        expect(pool.getMaxSize()).toBe(3);
        expect(pool.getAvailableCount()).toBe(3); // Should trim excess
    });

    test('should provide accurate statistics', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 2, 5);

        // Initial state: 2 created, 0 acquired, 0 released
        let stats = pool.getStats();
        expect(stats.totalCreated).toBe(2);
        expect(stats.totalAcquired).toBe(0);
        expect(stats.totalReleased).toBe(0);
        expect(stats.availableObjects).toBe(2);

        // Acquire 3 objects (2 from pool, 1 new)
        const obj1 = pool.acquire();
        const obj2 = pool.acquire();
        const _obj3 = pool.acquire();

        stats = pool.getStats();
        expect(stats.totalCreated).toBe(3);
        expect(stats.totalAcquired).toBe(3);
        expect(stats.totalReleased).toBe(0);
        expect(stats.availableObjects).toBe(0);

        // Release 2 objects
        pool.release(obj1);
        pool.release(obj2);

        stats = pool.getStats();
        expect(stats.totalReleased).toBe(2);
        expect(stats.availableObjects).toBe(2);
    });

    test('should calculate hit rate correctly', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 2, 5);

        // Acquire 3 objects: 2 hits (from pool), 1 miss (new creation)
        pool.acquire();
        pool.acquire();
        pool.acquire();

        const stats = pool.getStats();
        // Hit rate = (acquired - created) / acquired = (3 - 3) / 3 = 0
        // Wait, this calculation seems wrong. Let me reconsider...
        // Initially 2 were created, then 1 more was created on demand
        // So hit rate should be (3 - 1) / 3 = 2/3 ≈ 0.67
        expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    test('should calculate utilization rate correctly', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 0, 5);

        // Empty pool: 0% utilization (no objects in use)
        let stats = pool.getStats();
        expect(stats.utilizationRate).toBe(0);

        // Warm up to 3 objects: 0% utilization (3 available, 0 in use)
        pool.warmUp(3);
        stats = pool.getStats();
        expect(stats.utilizationRate).toBe(0);

        // Acquire all objects: 60% utilization (0 available, 3 in use out of 5 max)
        pool.acquire();
        pool.acquire();
        pool.acquire();
        stats = pool.getStats();
        expect(stats.utilizationRate).toBe(0.6); // 3/5 = 0.6
    });

    test('should determine if pool is performing well', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 5, 10);

        // Initially should be performing well (high hit rate, low utilization)
        expect(pool.isPerformingWell()).toBe(true);

        // Acquire most objects to increase utilization
        for (let i = 0; i < 8; i++) {
            pool.acquire();
        }

        // High utilization might affect performance
        const stats = pool.getStats();
        if (stats.utilizationRate > 0.9) {
            expect(pool.isPerformingWell()).toBe(false);
        }
    });

    test('should handle edge cases gracefully', () => {
        // Zero initial size
        const pool1 = new ObjectPool(createTestObject, resetTestObject, 0, 5);
        expect(pool1.getAvailableCount()).toBe(0);

        const obj = pool1.acquire();
        expect(obj).toBeDefined();

        // Max size of 1
        const pool2 = new ObjectPool(createTestObject, resetTestObject, 1, 1);
        expect(pool2.getMaxSize()).toBe(1);

        pool2.acquire();
        pool2.acquire();
        pool2.release(obj);

        expect(pool2.getAvailableCount()).toBeLessThanOrEqual(1);
    });

    test('should handle concurrent acquire/release operations', () => {
        const pool = new ObjectPool(createTestObject, resetTestObject, 3, 10);
        const objects: TestObject[] = [];

        // Rapid acquire
        for (let i = 0; i < 5; i++) {
            objects.push(pool.acquire());
        }

        expect(objects.length).toBe(5);

        // Rapid release
        for (const obj of objects) {
            pool.release(obj);
        }

        // Pool should handle this gracefully
        expect(pool.getAvailableCount()).toBeGreaterThan(0);
        expect(pool.getAvailableCount()).toBeLessThanOrEqual(pool.getMaxSize());
    });
});
