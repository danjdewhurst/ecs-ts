import { describe, expect, test, beforeEach } from 'bun:test';
import {
    World,
    BinaryFormat,
    JSONFormat,
    WorldSerializer,
    SERIALIZATION_VERSION,
    type Component,
    type SerializationFilter,
    isVersionCompatible,
    createEmptySnapshot,
} from '../src/index.ts';

// Test components
interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

interface NameComponent extends Component {
    readonly type: 'name';
    name: string;
}

interface TemporaryComponent extends Component {
    readonly type: 'temporary';
    ttl: number;
}

describe('Serialization System', () => {
    let world: World;
    let serializer: WorldSerializer;

    beforeEach(() => {
        world = new World();
        serializer = new WorldSerializer();
    });

    describe('WorldSerializer', () => {
        test('should create empty snapshot from empty world', () => {
            const result = serializer.createSnapshot(world);

            expect(result.success).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.snapshot!.version).toBe(SERIALIZATION_VERSION);
            expect(result.snapshot!.entities).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        test('should create snapshot with entities and components', () => {
            // Create test entities
            const entity1 = world.createEntity();
            world.addComponent(entity1, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);
            world.addComponent(entity1, {
                type: 'health',
                hp: 100,
                maxHp: 100,
            } as HealthComponent);

            const entity2 = world.createEntity();
            world.addComponent(entity2, {
                type: 'position',
                x: 5,
                y: 15,
            } as PositionComponent);
            world.addComponent(entity2, {
                type: 'name',
                name: 'TestEntity',
            } as NameComponent);

            // Create snapshot
            const result = serializer.createSnapshot(world);

            expect(result.success).toBe(true);
            expect(result.snapshot!.entities).toHaveLength(2);
            expect(result.snapshot!.stats.entityCount).toBe(2);
            expect(result.snapshot!.stats.componentCount).toBe(4);
            expect(result.snapshot!.componentTypes).toContain('position');
            expect(result.snapshot!.componentTypes).toContain('health');
            expect(result.snapshot!.componentTypes).toContain('name');
        });

        test('should filter entities by ID', () => {
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            world.addComponent(entity1, { type: 'position', x: 1, y: 1 } as PositionComponent);
            world.addComponent(entity2, { type: 'position', x: 2, y: 2 } as PositionComponent);
            world.addComponent(entity3, { type: 'position', x: 3, y: 3 } as PositionComponent);

            const filter: SerializationFilter = {
                includeEntities: [entity1, entity3],
            };

            const result = serializer.createSnapshot(world, { filter });

            expect(result.success).toBe(true);
            expect(result.snapshot!.entities).toHaveLength(2);
            const entityIds = result.snapshot!.entities.map((e) => e.id);
            expect(entityIds).toContain(entity1);
            expect(entityIds).toContain(entity3);
            expect(entityIds).not.toContain(entity2);
        });

        test('should exclude component types', () => {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 10, y: 20 } as PositionComponent);
            world.addComponent(entity, { type: 'health', hp: 100, maxHp: 100 } as HealthComponent);
            world.addComponent(entity, { type: 'temporary', ttl: 5 } as TemporaryComponent);

            const filter: SerializationFilter = {
                excludeComponentTypes: ['temporary'],
            };

            const result = serializer.createSnapshot(world, { filter });

            expect(result.success).toBe(true);
            expect(result.snapshot!.entities).toHaveLength(1);

            const entity1 = result.snapshot!.entities[0];
            expect(entity1?.components).toHaveLength(2);

            const componentTypes = entity1?.components.map((c) => c.type) ?? [];
            expect(componentTypes).toContain('position');
            expect(componentTypes).toContain('health');
            expect(componentTypes).not.toContain('temporary');
        });

        test('should include only specific component types', () => {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 10, y: 20 } as PositionComponent);
            world.addComponent(entity, { type: 'health', hp: 100, maxHp: 100 } as HealthComponent);
            world.addComponent(entity, { type: 'name', name: 'Test' } as NameComponent);

            const filter: SerializationFilter = {
                includeComponentTypes: ['position', 'health'],
            };

            const result = serializer.createSnapshot(world, { filter });

            expect(result.success).toBe(true);
            const entity1 = result.snapshot!.entities[0];
            expect(entity1?.components).toHaveLength(2);

            const componentTypes = entity1?.components.map((c) => c.type) ?? [];
            expect(componentTypes).toContain('position');
            expect(componentTypes).toContain('health');
            expect(componentTypes).not.toContain('name');
        });

        test('should use custom entity predicate', () => {
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            world.addComponent(entity1, { type: 'position', x: 10, y: 20 } as PositionComponent);
            world.addComponent(entity2, { type: 'position', x: 5, y: 15 } as PositionComponent);

            const filter: SerializationFilter = {
                entityPredicate: (id) => id === entity1,
            };

            const result = serializer.createSnapshot(world, { filter });

            expect(result.success).toBe(true);
            expect(result.snapshot!.entities).toHaveLength(1);
            expect(result.snapshot!.entities[0]?.id).toBe(entity1);
        });

        test('should load snapshot into empty world', () => {
            // Create and serialize world
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 10, y: 20 } as PositionComponent);
            world.addComponent(entity, { type: 'health', hp: 100, maxHp: 100 } as HealthComponent);

            const snapshotResult = serializer.createSnapshot(world);
            expect(snapshotResult.success).toBe(true);

            // Create new world and load snapshot
            const newWorld = new World();
            const loadResult = serializer.loadSnapshot(
                newWorld,
                snapshotResult.snapshot!
            );

            expect(loadResult.success).toBe(true);
            expect(loadResult.entitiesLoaded).toBe(1);
            expect(loadResult.componentsLoaded).toBe(2);
            expect(newWorld.getEntityCount()).toBe(1);

            // Verify components were loaded
            const newEntityId = Array.from(
                newWorld.query('position').getEntities()
            )[0];
            expect(newEntityId).toBeDefined();

            const position = newWorld.getComponent<PositionComponent>(
                newEntityId!,
                'position'
            );
            expect(position?.x).toBe(10);
            expect(position?.y).toBe(20);

            const health = newWorld.getComponent<HealthComponent>(
                newEntityId!,
                'health'
            );
            expect(health?.hp).toBe(100);
            expect(health?.maxHp).toBe(100);
        });

        test('should clear existing world when loading with clearExisting option', () => {
            // Add entities to world
            const existingEntity = world.createEntity();
            world.addComponent(existingEntity, {
                type: 'position',
                x: 1,
                y: 1,
            } as PositionComponent);

            expect(world.getEntityCount()).toBe(1);

            // Create snapshot with different data
            const tempWorld = new World();
            const newEntity = tempWorld.createEntity();
            tempWorld.addComponent(newEntity, {
                type: 'health',
                hp: 50,
                maxHp: 50,
            } as HealthComponent);

            const snapshot = serializer.createSnapshot(tempWorld).snapshot!;

            // Load with clearExisting
            const result = serializer.loadSnapshot(world, snapshot, {
                clearExisting: true,
            });

            expect(result.success).toBe(true);
            expect(world.getEntityCount()).toBe(1);

            // Old component should be gone
            expect(world.query('position').getEntities().length).toBe(0);

            // New component should exist
            expect(world.query('health').getEntities().length).toBe(1);
        });

        test('should merge with existing world when not clearing', () => {
            // Add entities to world
            const existingEntity = world.createEntity();
            world.addComponent(existingEntity, {
                type: 'position',
                x: 1,
                y: 1,
            } as PositionComponent);

            // Create snapshot with different data
            const tempWorld = new World();
            const newEntity = tempWorld.createEntity();
            tempWorld.addComponent(newEntity, {
                type: 'health',
                hp: 50,
                maxHp: 50,
            } as HealthComponent);

            const snapshot = serializer.createSnapshot(tempWorld).snapshot!;

            // Load without clearing
            const result = serializer.loadSnapshot(world, snapshot, {
                clearExisting: false,
            });

            expect(result.success).toBe(true);
            expect(world.getEntityCount()).toBe(2);

            // Both components should exist
            expect(world.query('position').getEntities().length).toBe(1);
            expect(world.query('health').getEntities().length).toBe(1);
        });
    });

    describe('JSONFormat', () => {
        test('should serialize and deserialize snapshot', () => {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 10, y: 20 } as PositionComponent);

            const format = new JSONFormat();
            const snapshot = serializer.createSnapshot(world).snapshot!;

            // Serialize
            const data = format.serialize(snapshot);
            expect(data).toBeInstanceOf(Uint8Array);

            // Deserialize
            const deserialized = format.deserialize(data);
            expect(deserialized.version).toBe(snapshot.version);
            expect(deserialized.entities).toHaveLength(1);
            expect(deserialized.entities[0]?.components).toHaveLength(1);
        });

        test('should produce pretty-printed JSON when requested', () => {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 10, y: 20 } as PositionComponent);

            const format = new JSONFormat();
            const snapshot = serializer.createSnapshot(world).snapshot!;

            const prettyData = format.serialize(snapshot, { prettyPrint: true });
            const prettyString = new TextDecoder().decode(prettyData);

            // Pretty JSON should have newlines and indentation
            expect(prettyString).toContain('\n');
            expect(prettyString).toContain('  ');
        });

        test('should validate snapshot structure on deserialization', () => {
            const format = new JSONFormat();

            // Invalid JSON
            const invalidJson = new TextEncoder().encode('not json');
            expect(() => format.deserialize(invalidJson)).toThrow();

            // Invalid structure (missing version)
            const invalidStructure = new TextEncoder().encode(
                JSON.stringify({ entities: [] })
            );
            expect(() => format.deserialize(invalidStructure)).toThrow();
        });

        test('should correctly validate valid snapshots', () => {
            const format = new JSONFormat();
            const snapshot = createEmptySnapshot();
            const data = format.serialize(snapshot);

            expect(format.validate(data)).toBe(true);
        });

        test('should reject invalid data', () => {
            const format = new JSONFormat();
            const invalidData = new Uint8Array([1, 2, 3, 4]);

            expect(format.validate(invalidData)).toBe(false);
        });
    });

    describe('BinaryFormat', () => {
        test('should serialize and deserialize snapshot', () => {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 10, y: 20 } as PositionComponent);

            const format = new BinaryFormat();
            const snapshot = serializer.createSnapshot(world).snapshot!;

            // Serialize
            const data = format.serialize(snapshot);
            expect(data).toBeInstanceOf(Uint8Array);

            // Deserialize
            const deserialized = format.deserialize(data);
            expect(deserialized.version).toBe(snapshot.version);
            expect(deserialized.entities).toHaveLength(1);
        });

        test('should include magic bytes for format identification', () => {
            const format = new BinaryFormat();
            const snapshot = createEmptySnapshot();
            const data = format.serialize(snapshot);

            // Check magic bytes 'ECSB'
            const view = new DataView(data.buffer);
            const magic = view.getUint32(0, false);
            expect(magic).toBe(0x45435342); // 'ECSB' in ASCII
        });

        test('should detect corrupted data via checksum', () => {
            const format = new BinaryFormat();
            const snapshot = createEmptySnapshot();
            const data = format.serialize(snapshot);

            // Corrupt a byte in the middle
            const corrupted = new Uint8Array(data);
            corrupted[20] = (corrupted[20] ?? 0) ^ 0xff;

            // Should throw on deserialization
            expect(() => format.deserialize(corrupted)).toThrow();
        });

        test('should correctly validate binary data', () => {
            const format = new BinaryFormat();
            const snapshot = createEmptySnapshot();
            const data = format.serialize(snapshot);

            expect(format.validate(data)).toBe(true);
        });

        test('should reject invalid binary data', () => {
            const format = new BinaryFormat();
            const invalidData = new Uint8Array([1, 2, 3, 4]);

            expect(format.validate(invalidData)).toBe(false);
        });

        test('should handle version information correctly', () => {
            const format = new BinaryFormat();
            const snapshot = createEmptySnapshot();
            snapshot.version = '2.5.3';

            const data = format.serialize(snapshot);
            const deserialized = format.deserialize(data);

            expect(deserialized.version).toBe('2.5.3');
        });
    });

    describe('World integration', () => {
        test('should save and load using World.save/load methods', async () => {
            const entity = world.createEntity();
            world.addComponent(entity, { type: 'position', x: 42, y: 84 } as PositionComponent);
            world.addComponent(entity, { type: 'name', name: 'TestEntity' } as NameComponent);

            const filepath = './test-save.json';

            // Save
            const saveResult = await world.save(filepath, new JSONFormat(), {
                prettyPrint: true,
            });
            expect(saveResult.success).toBe(true);

            // Load into new world
            const newWorld = new World();
            const loadResult = await newWorld.load(filepath, new JSONFormat(), {
                clearExisting: true,
            });

            expect(loadResult.success).toBe(true);
            expect(loadResult.entitiesLoaded).toBe(1);
            expect(loadResult.componentsLoaded).toBe(2);

            // Verify data
            const loadedEntityId = Array.from(
                newWorld.query('position').getEntities()
            )[0];
            expect(loadedEntityId).toBeDefined();

            const position = newWorld.getComponent<PositionComponent>(
                loadedEntityId!,
                'position'
            );
            expect(position?.x).toBe(42);
            expect(position?.y).toBe(84);

            const name = newWorld.getComponent<NameComponent>(
                loadedEntityId!,
                'name'
            );
            expect(name?.name).toBe('TestEntity');

            // Cleanup
            await Bun.write(filepath, ''); // Clear file
        });

        test('should handle non-existent file gracefully', async () => {
            const result = await world.load(
                './non-existent-file.json',
                new JSONFormat()
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('Version compatibility', () => {
        test('should accept compatible versions', () => {
            expect(isVersionCompatible('1.0.0')).toBe(true);
            expect(isVersionCompatible('1.5.2')).toBe(true);
            expect(isVersionCompatible('1.99.99')).toBe(true);
        });

        test('should reject incompatible major versions', () => {
            expect(isVersionCompatible('0.9.0')).toBe(false);
            expect(isVersionCompatible('2.0.0')).toBe(false);
        });
    });

    describe('Snapshot statistics', () => {
        test('should calculate correct statistics', () => {
            // Create entities with various components
            for (let i = 0; i < 5; i++) {
                const entity = world.createEntity();
                world.addComponent(entity, {
                    type: 'position',
                    x: i,
                    y: i * 2,
                } as PositionComponent);
            }

            for (let i = 0; i < 3; i++) {
                const entity = world.createEntity();
                world.addComponent(entity, {
                    type: 'health',
                    hp: 100,
                    maxHp: 100,
                } as HealthComponent);
            }

            const result = serializer.createSnapshot(world);
            const stats = result.snapshot!.stats;

            expect(stats.entityCount).toBe(8);
            expect(stats.componentCount).toBe(8);
            expect(stats.componentsByType['position']).toBe(5);
            expect(stats.componentsByType['health']).toBe(3);
            expect(stats.estimatedSize).toBeGreaterThan(0);
        });
    });

    describe('Edge cases', () => {
        test('should handle entities with no components', () => {
            world.createEntity();
            world.createEntity();

            const result = serializer.createSnapshot(world);

            expect(result.success).toBe(true);
            expect(result.snapshot!.entities).toHaveLength(0);
        });

        test('should handle empty component data', () => {
            const entity = world.createEntity();
            world.addComponent(entity, {
                type: 'position',
                x: 0,
                y: 0,
            } as PositionComponent);

            const result = serializer.createSnapshot(world);
            expect(result.success).toBe(true);

            const position = result.snapshot!.entities[0]?.components[0]?.data as PositionComponent;
            expect(position.x).toBe(0);
            expect(position.y).toBe(0);
        });

        test('should handle complex nested component data', () => {
            interface ComplexComponent extends Component {
                type: 'complex';
                nested: {
                    array: number[];
                    object: { key: string };
                };
            }

            const entity = world.createEntity();
            world.addComponent(entity, {
                type: 'complex',
                nested: {
                    array: [1, 2, 3],
                    object: { key: 'value' },
                },
            } as ComplexComponent);

            const result = serializer.createSnapshot(world);
            expect(result.success).toBe(true);

            const newWorld = new World();
            const loadResult = serializer.loadSnapshot(
                newWorld,
                result.snapshot!
            );

            expect(loadResult.success).toBe(true);

            const loadedEntityId = Array.from(
                newWorld.query('complex').getEntities()
            )[0];
            const complex = newWorld.getComponent<ComplexComponent>(
                loadedEntityId!,
                'complex'
            );

            expect(complex?.nested.array).toEqual([1, 2, 3]);
            expect(complex?.nested.object.key).toBe('value');
        });
    });
});
