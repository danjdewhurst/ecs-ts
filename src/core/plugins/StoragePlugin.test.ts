import { beforeEach, describe, expect, test } from 'bun:test';
import { World } from '../ecs/World.ts';
import {
    BaseStoragePlugin,
    type LoadOptions,
    type StorageMetadata,
    type StorageOperation,
    type StorageOptions,
    type StoragePluginConfig,
    type StorageStats,
} from './StoragePlugin.ts';

describe('StoragePlugin', () => {
    let world: World;

    beforeEach(() => {
        world = new World();
    });

    describe('BaseStoragePlugin', () => {
        class TestStoragePlugin extends BaseStoragePlugin {
            readonly name = 'test-storage';
            readonly version = '1.0.0';

            private storage = new Map<
                string,
                { data: string; metadata: StorageMetadata }
            >();

            constructor(config?: Partial<StoragePluginConfig>) {
                super({
                    backend: 'memory',
                    ...config,
                });
            }

            async initialize(_world: World): Promise<void> {
                // Test implementation
            }

            async save(
                key: string,
                data: unknown,
                options?: StorageOptions
            ): Promise<void> {
                this.validateKey(key);
                const serialized = this.serialize(data);
                this.storage.set(key, {
                    data: serialized,
                    metadata: {
                        size: serialized.length,
                        createdAt: Date.now(),
                        modifiedAt: Date.now(),
                        compressed: false,
                        encrypted: false,
                        metadata: options?.metadata,
                    },
                });
            }

            async load<T = unknown>(
                key: string,
                options?: LoadOptions
            ): Promise<T | undefined> {
                this.validateKey(key);
                const item = this.storage.get(key);
                if (!item) {
                    return options?.defaultValue as T | undefined;
                }
                return this.deserialize<T>(item.data);
            }

            async delete(key: string): Promise<boolean> {
                this.validateKey(key);
                return this.storage.delete(key);
            }

            async exists(key: string): Promise<boolean> {
                this.validateKey(key);
                return this.storage.has(key);
            }

            async listKeys(prefix?: string): Promise<string[]> {
                const keys = Array.from(this.storage.keys());
                return prefix
                    ? keys.filter((key) => key.startsWith(prefix))
                    : keys;
            }

            async clear(): Promise<void> {
                this.storage.clear();
            }

            async getMetadata(
                key: string
            ): Promise<StorageMetadata | undefined> {
                this.validateKey(key);
                const item = this.storage.get(key);
                return item?.metadata;
            }

            async transaction(operations: StorageOperation[]): Promise<void> {
                for (const op of operations) {
                    if (op.type === 'save') {
                        await this.save(op.key, op.data, op.options);
                    } else if (op.type === 'delete') {
                        await this.delete(op.key);
                    }
                }
            }

            async getStats(): Promise<StorageStats> {
                return {
                    itemCount: this.storage.size,
                    totalSize: Array.from(this.storage.values()).reduce(
                        (sum, item) => sum + item.data.length,
                        0
                    ),
                    backendType: this.config.backend,
                    isHealthy: true,
                    performance: {
                        avgReadTime: 1,
                        avgWriteTime: 1,
                        operationCount: 0,
                    },
                };
            }

            // Helper to inject invalid data for testing
            injectInvalidData(key: string): void {
                this.storage.set(key, {
                    data: 'invalid json {{{',
                    metadata: {
                        size: 15,
                        createdAt: Date.now(),
                        modifiedAt: Date.now(),
                        compressed: false,
                        encrypted: false,
                    },
                });
            }
        }

        describe('constructor and configuration', () => {
            test('should initialize with default configuration', () => {
                const plugin = new TestStoragePlugin();
                expect(plugin.name).toBe('test-storage');
                expect(plugin.version).toBe('1.0.0');
            });

            test('should initialize with custom configuration', () => {
                const plugin = new TestStoragePlugin({
                    backend: 'file',
                    connectionString: '/path/to/storage',
                    maxSize: 1024 * 1024 * 50,
                    defaultTtl: 3600000,
                    enableCompression: true,
                    enableEncryption: true,
                    encryptionKey: 'test-key',
                    cleanupInterval: 1800000,
                    poolSize: 20,
                });

                expect(plugin.name).toBe('test-storage');
            });

            test('should apply default values for missing config options', () => {
                const plugin = new TestStoragePlugin({
                    backend: 'memory',
                });

                expect(plugin.name).toBe('test-storage');
            });
        });

        describe('shutdown method', () => {
            test('should call shutdown and return resolved promise', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const result = plugin.shutdown
                    ? await plugin.shutdown()
                    : Promise.resolve();

                expect(result).toBeUndefined();
            });

            test('should handle shutdown when not implemented', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                if (plugin.shutdown) {
                    await expect(plugin.shutdown()).resolves.toBeUndefined();
                }
            });
        });

        describe('key validation', () => {
            test('should accept valid keys', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await expect(
                    plugin.save('validKey', 'data')
                ).resolves.toBeUndefined();
                await expect(
                    plugin.save('valid_key_123', 'data')
                ).resolves.toBeUndefined();
                await expect(
                    plugin.save('valid.key', 'data')
                ).resolves.toBeUndefined();
                await expect(
                    plugin.save('valid:key', 'data')
                ).resolves.toBeUndefined();
                await expect(
                    plugin.save('valid-key', 'data')
                ).resolves.toBeUndefined();
                await expect(
                    plugin.save('valid/key', 'data')
                ).resolves.toBeUndefined();
            });

            test('should reject empty key', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await expect(plugin.save('', 'data')).rejects.toThrow(
                    'Key must be a non-empty string'
                );
            });

            test('should reject non-string key', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await expect(
                    plugin.save(null as unknown as string, 'data')
                ).rejects.toThrow('Key must be a non-empty string');

                await expect(
                    plugin.save(undefined as unknown as string, 'data')
                ).rejects.toThrow('Key must be a non-empty string');

                await expect(
                    plugin.save(123 as unknown as string, 'data')
                ).rejects.toThrow('Key must be a non-empty string');
            });

            test('should reject key longer than 250 characters', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const longKey = 'a'.repeat(251);
                await expect(plugin.save(longKey, 'data')).rejects.toThrow(
                    'Key must be 250 characters or less'
                );
            });

            test('should accept key with exactly 250 characters', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const maxKey = 'a'.repeat(250);
                await expect(
                    plugin.save(maxKey, 'data')
                ).resolves.toBeUndefined();
            });

            test('should reject key with invalid characters', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await expect(
                    plugin.save('key with spaces', 'data')
                ).rejects.toThrow(
                    'Key can only contain alphanumeric characters, underscores, dots, hyphens, colons, slashes, and forward slashes'
                );

                await expect(
                    plugin.save('key@invalid', 'data')
                ).rejects.toThrow(
                    'Key can only contain alphanumeric characters'
                );

                await expect(
                    plugin.save('key#invalid', 'data')
                ).rejects.toThrow(
                    'Key can only contain alphanumeric characters'
                );

                await expect(
                    plugin.save('key$invalid', 'data')
                ).rejects.toThrow(
                    'Key can only contain alphanumeric characters'
                );

                await expect(
                    plugin.save('key%invalid', 'data')
                ).rejects.toThrow(
                    'Key can only contain alphanumeric characters'
                );
            });
        });

        describe('serialization', () => {
            test('should serialize simple data types', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('string', 'test string');
                await plugin.save('number', 42);
                await plugin.save('boolean', true);
                await plugin.save('null', null);

                expect(await plugin.load<string>('string')).toBe('test string');
                expect(await plugin.load<number>('number')).toBe(42);
                expect(await plugin.load<boolean>('boolean')).toBe(true);
                expect(await plugin.load('null')).toBeNull();
            });

            test('should serialize complex data types', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const complexData = {
                    nested: {
                        array: [1, 2, 3],
                        object: { a: 'b', c: 'd' },
                    },
                    date: new Date().toISOString(),
                    mixed: [true, 'string', 123, null, { key: 'value' }],
                };

                await plugin.save('complex', complexData);
                const loaded = await plugin.load('complex');

                expect(loaded).toEqual(complexData);
            });

            test('should handle serialization errors gracefully', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const circularRef: { self?: unknown } = {};
                circularRef.self = circularRef;

                await expect(
                    plugin.save('circular', circularRef)
                ).rejects.toThrow('Failed to serialize data');
            });

            test('should include error message in serialization failure', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const bigInt = { value: BigInt(9007199254740991) };

                try {
                    await plugin.save('bigint', bigInt);
                    expect.unreachable('Should have thrown an error');
                } catch (error) {
                    expect(error).toBeInstanceOf(Error);
                    const err = error as Error;
                    expect(err.message).toContain('Failed to serialize data');
                }
            });
        });

        describe('deserialization', () => {
            test('should deserialize valid JSON data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const testData = { message: 'Hello', count: 42 };
                await plugin.save('test', testData);

                const loaded = await plugin.load('test');
                expect(loaded).toEqual(testData);
            });

            test('should handle deserialization errors gracefully', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                plugin.injectInvalidData('invalid');

                await expect(plugin.load('invalid')).rejects.toThrow(
                    'Failed to deserialize data'
                );
            });

            test('should include error message in deserialization failure', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                plugin.injectInvalidData('corrupted');

                try {
                    await plugin.load('corrupted');
                    expect.unreachable('Should have thrown an error');
                } catch (error) {
                    expect(error).toBeInstanceOf(Error);
                    const err = error as Error;
                    expect(err.message).toContain('Failed to deserialize data');
                }
            });

            test('should return default value when key not found', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const result = await plugin.load('nonexistent', {
                    defaultValue: 'default',
                });

                expect(result).toBe('default');
            });

            test('should return undefined when key not found and no default', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const result = await plugin.load('nonexistent');

                expect(result).toBeUndefined();
            });
        });

        describe('storage operations', () => {
            test('should save and retrieve data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const testData = { message: 'test' };
                await plugin.save('key1', testData);

                const loaded = await plugin.load('key1');
                expect(loaded).toEqual(testData);
            });

            test('should check if key exists', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('exists', 'data');

                expect(await plugin.exists('exists')).toBe(true);
                expect(await plugin.exists('not-exists')).toBe(false);
            });

            test('should delete data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('to-delete', 'data');
                expect(await plugin.exists('to-delete')).toBe(true);

                const deleted = await plugin.delete('to-delete');
                expect(deleted).toBe(true);
                expect(await plugin.exists('to-delete')).toBe(false);
            });

            test('should return false when deleting non-existent key', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const deleted = await plugin.delete('not-exists');
                expect(deleted).toBe(false);
            });

            test('should list all keys', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('key1', 'data1');
                await plugin.save('key2', 'data2');
                await plugin.save('key3', 'data3');

                const keys = await plugin.listKeys();
                expect(keys).toHaveLength(3);
                expect(keys).toContain('key1');
                expect(keys).toContain('key2');
                expect(keys).toContain('key3');
            });

            test('should list keys with prefix filter', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('user:1', 'user1');
                await plugin.save('user:2', 'user2');
                await plugin.save('config:1', 'config1');

                const userKeys = await plugin.listKeys('user:');
                expect(userKeys).toHaveLength(2);
                expect(userKeys).toContain('user:1');
                expect(userKeys).toContain('user:2');
            });

            test('should clear all data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('key1', 'data1');
                await plugin.save('key2', 'data2');

                await plugin.clear();

                const keys = await plugin.listKeys();
                expect(keys).toHaveLength(0);
            });

            test('should get metadata for stored data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const customMetadata = { author: 'test', version: 1 };
                await plugin.save('with-metadata', 'data', {
                    metadata: customMetadata,
                });

                const metadata = await plugin.getMetadata('with-metadata');
                expect(metadata).toBeDefined();
                expect(metadata?.size).toBeGreaterThan(0);
                expect(metadata?.createdAt).toBeDefined();
                expect(metadata?.modifiedAt).toBeDefined();
                expect(metadata?.compressed).toBe(false);
                expect(metadata?.encrypted).toBe(false);
                expect(metadata?.metadata).toEqual(customMetadata);
            });

            test('should return undefined metadata for non-existent key', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const metadata = await plugin.getMetadata('not-exists');
                expect(metadata).toBeUndefined();
            });
        });

        describe('transactions', () => {
            test('should execute transaction with multiple save operations', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const operations: StorageOperation[] = [
                    { type: 'save', key: 'tx1', data: 'value1' },
                    { type: 'save', key: 'tx2', data: 'value2' },
                    { type: 'save', key: 'tx3', data: 'value3' },
                ];

                await plugin.transaction(operations);

                expect(await plugin.load<string>('tx1')).toBe('value1');
                expect(await plugin.load<string>('tx2')).toBe('value2');
                expect(await plugin.load<string>('tx3')).toBe('value3');
            });

            test('should execute transaction with mixed operations', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('existing', 'old-value');

                const operations: StorageOperation[] = [
                    { type: 'save', key: 'new-key', data: 'new-value' },
                    { type: 'delete', key: 'existing' },
                ];

                await plugin.transaction(operations);

                expect(await plugin.load<string>('new-key')).toBe('new-value');
                expect(await plugin.exists('existing')).toBe(false);
            });

            test('should handle empty transaction', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await expect(plugin.transaction([])).resolves.toBeUndefined();
            });
        });

        describe('statistics', () => {
            test('should provide accurate storage statistics', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('stat1', 'data');
                await plugin.save('stat2', 'more data');

                const stats = await plugin.getStats();

                expect(stats.itemCount).toBe(2);
                expect(stats.totalSize).toBeGreaterThan(0);
                expect(stats.backendType).toBe('memory');
                expect(stats.isHealthy).toBe(true);
                expect(stats.performance.avgReadTime).toBeDefined();
                expect(stats.performance.avgWriteTime).toBeDefined();
                expect(stats.performance.operationCount).toBeDefined();
            });

            test('should update statistics after operations', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                let stats = await plugin.getStats();
                expect(stats.itemCount).toBe(0);
                expect(stats.totalSize).toBe(0);

                await plugin.save('test', 'data');

                stats = await plugin.getStats();
                expect(stats.itemCount).toBe(1);
                expect(stats.totalSize).toBeGreaterThan(0);
            });
        });

        describe('edge cases', () => {
            test('should handle saving with options', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const options: StorageOptions = {
                    ttl: 3600000,
                    compression: 5,
                    encrypt: true,
                    metadata: { custom: 'value' },
                    overwrite: true,
                };

                await expect(
                    plugin.save('with-options', 'data', options)
                ).resolves.toBeUndefined();
            });

            test('should handle loading with options', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                await plugin.save('test', 'data');

                const loadOptions: LoadOptions = {
                    decrypt: true,
                    updateAccessTime: true,
                };

                const result = await plugin.load('test', loadOptions);
                expect(result).toBe('data');
            });

            test('should handle unicode characters in data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const unicodeData = {
                    emoji: '🎮🎯🎲',
                    chinese: '你好世界',
                    arabic: 'مرحبا بالعالم',
                    mixed: 'Hello 世界 🌍',
                };

                await plugin.save('unicode', unicodeData);
                const loaded = await plugin.load('unicode');

                expect(loaded).toEqual(unicodeData);
            });

            test('should handle very large data', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const largeData = {
                    items: Array.from({ length: 1000 }, (_, i) => ({
                        id: i,
                        name: `Item ${i}`,
                        data: `Data for item ${i}`,
                    })),
                };

                await plugin.save('large', largeData);
                const loaded = await plugin.load('large');

                expect(loaded).toEqual(largeData);
            });

            test('should handle deeply nested objects', async () => {
                const plugin = new TestStoragePlugin();
                await plugin.initialize(world);

                const deepData: {
                    level: number;
                    next?: unknown;
                } = { level: 1 };
                let current = deepData;

                for (let i = 2; i <= 10; i++) {
                    current.next = { level: i };
                    current = current.next as typeof deepData;
                }

                await plugin.save('deep', deepData);
                const loaded = await plugin.load('deep');

                expect(loaded).toEqual(deepData);
            });
        });
    });
});
