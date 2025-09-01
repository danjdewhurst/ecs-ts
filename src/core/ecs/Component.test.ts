import { describe, expect, test } from 'bun:test';
import { type Component, ComponentStorage } from './Component.ts';

interface TestComponent extends Component {
    readonly type: 'test';
    value: number;
}

describe('ComponentStorage', () => {
    test('should add and retrieve components', () => {
        const storage = new ComponentStorage<TestComponent>();
        const component: TestComponent = { type: 'test', value: 42 };

        storage.add(1, component);

        const retrieved = storage.get(1);
        expect(retrieved).toEqual(component);
        expect(storage.has(1)).toBe(true);
        expect(storage.size()).toBe(1);
    });

    test('should track entity set correctly', () => {
        const storage = new ComponentStorage<TestComponent>();
        const component1: TestComponent = { type: 'test', value: 1 };
        const component2: TestComponent = { type: 'test', value: 2 };

        storage.add(10, component1);
        storage.add(20, component2);

        const entities = storage.getEntities();
        expect(entities.has(10)).toBe(true);
        expect(entities.has(20)).toBe(true);
        expect(entities.size).toBe(2);
    });

    test('should remove components', () => {
        const storage = new ComponentStorage<TestComponent>();
        const component: TestComponent = { type: 'test', value: 42 };

        storage.add(1, component);
        expect(storage.has(1)).toBe(true);

        const removed = storage.remove(1);
        expect(removed).toBe(true);
        expect(storage.has(1)).toBe(false);
        expect(storage.get(1)).toBeUndefined();
        expect(storage.size()).toBe(0);
    });

    test('should return false when removing non-existent component', () => {
        const storage = new ComponentStorage<TestComponent>();

        const removed = storage.remove(999);
        expect(removed).toBe(false);
    });

    test('should get all components', () => {
        const storage = new ComponentStorage<TestComponent>();
        const component1: TestComponent = { type: 'test', value: 1 };
        const component2: TestComponent = { type: 'test', value: 2 };

        storage.add(10, component1);
        storage.add(20, component2);

        const allComponents = storage.getAllComponents();
        expect(allComponents.size).toBe(2);
        expect(allComponents.get(10)).toEqual(component1);
        expect(allComponents.get(20)).toEqual(component2);
    });

    test('should clear all components', () => {
        const storage = new ComponentStorage<TestComponent>();
        const component: TestComponent = { type: 'test', value: 42 };

        storage.add(1, component);
        storage.add(2, component);
        expect(storage.size()).toBe(2);

        storage.clear();
        expect(storage.size()).toBe(0);
        expect(storage.getEntities().size).toBe(0);
        expect(storage.getAllComponents().size).toBe(0);
    });

    test('should handle overwriting components', () => {
        const storage = new ComponentStorage<TestComponent>();
        const component1: TestComponent = { type: 'test', value: 1 };
        const component2: TestComponent = { type: 'test', value: 2 };

        storage.add(1, component1);
        storage.add(1, component2);

        expect(storage.get(1)).toEqual(component2);
        expect(storage.size()).toBe(1);
        expect(storage.getEntities().size).toBe(1);
    });
});
