import { describe, expect, test } from 'bun:test';
import { type Component, ComponentStorage } from './Component.ts';

interface TestComponent extends Component {
    readonly type: 'test';
    value: number;
}

interface AnotherComponent extends Component {
    readonly type: 'another';
    data: string;
}

describe('ComponentStorage', () => {
    test('should construct ComponentStorage instance', () => {
        // Arrange & Act
        const storage = new ComponentStorage<TestComponent>();

        // Assert - verify constructor creates proper instance
        expect(storage).toBeInstanceOf(ComponentStorage);
        expect(storage.size()).toBe(0);
        expect(storage.getEntities().size).toBe(0);
        expect(storage.getAllComponents().size).toBe(0);
    });

    test('should instantiate with empty storage', () => {
        // Arrange & Act
        const storage = new ComponentStorage<TestComponent>();

        // Assert
        expect(storage.size()).toBe(0);
        expect(storage.getEntities().size).toBe(0);
        expect(storage.getAllComponents().size).toBe(0);
    });

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

    test('should return undefined when getting non-existent component', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();

        // Act
        const result = storage.get(999);

        // Assert
        expect(result).toBeUndefined();
    });

    test('should return false when checking for non-existent component', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();

        // Act
        const result = storage.has(999);

        // Assert
        expect(result).toBe(false);
    });

    test('should return empty set when no entities exist', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();

        // Act
        const entities = storage.getEntities();

        // Assert
        expect(entities.size).toBe(0);
    });

    test('should return empty map when no components exist', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();

        // Act
        const components = storage.getAllComponents();

        // Assert
        expect(components.size).toBe(0);
    });

    test('should return 0 size for empty storage', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();

        // Act
        const size = storage.size();

        // Assert
        expect(size).toBe(0);
    });

    test('should return independent copy of entity set', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();
        const component: TestComponent = { type: 'test', value: 42 };
        storage.add(1, component);

        // Act
        const entities1 = storage.getEntities();
        const entities2 = storage.getEntities();
        entities1.add(999);

        // Assert
        expect(entities1.has(999)).toBe(true);
        expect(entities2.has(999)).toBe(false);
        expect(storage.getEntities().has(999)).toBe(false);
    });

    test('should return independent copy of components map', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();
        const component: TestComponent = { type: 'test', value: 42 };
        storage.add(1, component);

        // Act
        const components1 = storage.getAllComponents();
        const components2 = storage.getAllComponents();
        const newComponent: TestComponent = { type: 'test', value: 999 };
        components1.set(999, newComponent);

        // Assert
        expect(components1.has(999)).toBe(true);
        expect(components2.has(999)).toBe(false);
        expect(storage.getAllComponents().has(999)).toBe(false);
    });

    test('should properly remove entity from entity set on remove', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();
        const component: TestComponent = { type: 'test', value: 42 };
        storage.add(1, component);

        // Act
        const entities1 = storage.getEntities();
        storage.remove(1);
        const entities2 = storage.getEntities();

        // Assert
        expect(entities1.has(1)).toBe(true);
        expect(entities2.has(1)).toBe(false);
    });

    test('should handle multiple additions and removals correctly', () => {
        // Arrange
        const storage = new ComponentStorage<TestComponent>();
        const component1: TestComponent = { type: 'test', value: 1 };
        const component2: TestComponent = { type: 'test', value: 2 };
        const component3: TestComponent = { type: 'test', value: 3 };

        // Act
        storage.add(1, component1);
        storage.add(2, component2);
        storage.add(3, component3);
        storage.remove(2);

        // Assert
        expect(storage.size()).toBe(2);
        expect(storage.has(1)).toBe(true);
        expect(storage.has(2)).toBe(false);
        expect(storage.has(3)).toBe(true);
        expect(storage.getEntities().size).toBe(2);
        expect(storage.getAllComponents().size).toBe(2);
    });

    test('should work with different component types', () => {
        // Arrange
        const storage = new ComponentStorage<AnotherComponent>();
        const component: AnotherComponent = {
            type: 'another',
            data: 'test-data',
        };

        // Act
        storage.add(1, component);

        // Assert
        expect(storage.get(1)).toEqual(component);
        expect(storage.has(1)).toBe(true);
        expect(storage.size()).toBe(1);
    });

    test('should maintain isolation between different storage instances', () => {
        // Arrange
        const storage1 = new ComponentStorage<TestComponent>();
        const storage2 = new ComponentStorage<TestComponent>();
        const component1: TestComponent = { type: 'test', value: 1 };
        const component2: TestComponent = { type: 'test', value: 2 };

        // Act
        storage1.add(1, component1);
        storage2.add(1, component2);

        // Assert
        expect(storage1.get(1)?.value).toBe(1);
        expect(storage2.get(1)?.value).toBe(2);
        expect(storage1.size()).toBe(1);
        expect(storage2.size()).toBe(1);
    });
});
