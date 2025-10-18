import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
    Asset,
    AssetError,
    AssetErrorCode,
    AssetManager,
    AssetReference,
    AssetState,
    BinaryLoader,
    JSONLoader,
    ScopedAssetReference,
    TextLoader,
} from '../src/core/assets/index.ts';
import type { AssetLoadOptions } from '../src/core/assets/types.ts';

describe('Asset Management', () => {
    describe('Asset', () => {
        test('should create an asset with metadata', () => {
            const metadata = {
                id: 'test-asset',
                path: '/path/to/asset.txt',
                type: 'text',
            };

            const asset = new Asset(metadata);

            expect(asset.id).toBe('test-asset');
            expect(asset.path).toBe('/path/to/asset.txt');
            expect(asset.type).toBe('text');
            expect(asset.state).toBe(AssetState.PENDING);
        });

        test('should track loading state', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });

            expect(asset.isPending()).toBe(true);

            asset.markLoading();
            expect(asset.isLoading()).toBe(true);
            expect(asset.state).toBe(AssetState.LOADING);

            asset.markLoaded('test data');
            expect(asset.isLoaded()).toBe(true);
            expect(asset.data).toBe('test data');
        });

        test('should track failed state', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });

            asset.markLoading();
            asset.markFailed('Load error');

            expect(asset.isFailed()).toBe(true);
            expect(asset.error).toBe('Load error');
            expect(asset.data).toBeUndefined();
        });

        test('should calculate load duration', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });

            asset.markLoading();
            const duration1 = asset.loadDuration;
            expect(duration1).toBeGreaterThanOrEqual(0);

            asset.markLoaded('data');
            const duration2 = asset.loadDuration;
            expect(duration2).toBeGreaterThanOrEqual(duration1);
        });

        test('should support reloading', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });

            asset.markLoading();
            asset.markLoaded('data1');

            asset.markLoading(true); // Reloading
            expect(asset.state).toBe(AssetState.RELOADING);

            asset.markLoaded('data2');
            expect(asset.data).toBe('data2');
        });
    });

    describe('AssetReference', () => {
        test('should track reference count', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            const ref = new AssetReference(asset);

            expect(ref.refCount).toBe(0);

            ref.acquire();
            expect(ref.refCount).toBe(1);

            ref.acquire();
            expect(ref.refCount).toBe(2);

            ref.release();
            expect(ref.refCount).toBe(1);

            ref.release();
            expect(ref.refCount).toBe(0);
        });

        test('should call onRelease when ref count reaches 0', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            let released = false;
            const ref = new AssetReference(asset, () => {
                released = true;
            });

            ref.acquire();
            expect(released).toBe(false);

            ref.release();
            expect(released).toBe(true);
        });

        test('should provide access to asset data', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            const ref = new AssetReference(asset);

            expect(ref.get()).toBe('test data');
            expect(ref.isLoaded()).toBe(true);
        });

        test('should support force release', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            let released = false;
            const ref = new AssetReference(asset, () => {
                released = true;
            });

            ref.acquire();
            ref.acquire();
            ref.acquire();

            ref.forceRelease();
            expect(ref.refCount).toBe(0);
            expect(released).toBe(true);
        });
    });

    describe('ScopedAssetReference', () => {
        test('should auto-acquire on construction', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            const ref = new AssetReference(asset);
            const scoped = new ScopedAssetReference(ref);

            expect(ref.refCount).toBe(1);
            expect(scoped.get()).toBe('test data');
        });

        test('should auto-release on dispose', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            const ref = new AssetReference(asset);
            const scoped = new ScopedAssetReference(ref);

            expect(ref.refCount).toBe(1);

            scoped.dispose();
            expect(ref.refCount).toBe(0);
        });

        test('should support Symbol.dispose', () => {
            const asset = new Asset({ id: '1', path: '/test', type: 'text' });
            asset.markLoaded('test data');

            const ref = new AssetReference(asset);

            {
                using scoped = new ScopedAssetReference(ref);
                expect(ref.refCount).toBe(1);
            }

            // After scope, should be released
            expect(ref.refCount).toBe(0);
        });
    });

    describe('Loaders', () => {
        describe('TextLoader', () => {
            test('should support text file extensions', () => {
                const loader = new TextLoader();

                expect(loader.canLoad('file.txt')).toBe(true);
                expect(loader.canLoad('file.md')).toBe(true);
                expect(loader.canLoad('file.csv')).toBe(true);
                expect(loader.canLoad('file.json')).toBe(false);
            });

            test('should load text files', async () => {
                const loader = new TextLoader();
                const testFile = '/tmp/test-text.txt';
                const testContent = 'Hello, World!';

                await Bun.write(testFile, testContent);

                const result = await loader.load(testFile);
                expect(result).toBe(testContent);
            });

            test('should throw error for non-existent files', async () => {
                const loader = new TextLoader();

                try {
                    await loader.load('/tmp/non-existent-file.txt');
                    expect(true).toBe(false); // Should not reach here
                } catch (error) {
                    expect(error).toBeInstanceOf(AssetError);
                    expect((error as AssetError).code).toBe(AssetErrorCode.NOT_FOUND);
                }
            });
        });

        describe('JSONLoader', () => {
            test('should support JSON extension', () => {
                const loader = new JSONLoader();

                expect(loader.canLoad('file.json')).toBe(true);
                expect(loader.canLoad('file.txt')).toBe(false);
            });

            test('should load JSON files', async () => {
                const loader = new JSONLoader();
                const testFile = '/tmp/test-json.json';
                const testData = { name: 'test', value: 123 };

                await Bun.write(testFile, JSON.stringify(testData));

                const result = await loader.load(testFile);
                expect(result).toEqual(testData);
            });

            test('should throw error for invalid JSON', async () => {
                const loader = new JSONLoader();
                const testFile = '/tmp/invalid-json.json';

                await Bun.write(testFile, 'not valid json {');

                try {
                    await loader.load(testFile);
                    expect(true).toBe(false); // Should not reach here
                } catch (error) {
                    expect(error).toBeInstanceOf(AssetError);
                    expect((error as AssetError).code).toBe(AssetErrorCode.INVALID_FORMAT);
                }
            });
        });

        describe('BinaryLoader', () => {
            test('should support binary file extensions', () => {
                const loader = new BinaryLoader();

                expect(loader.canLoad('file.bin')).toBe(true);
                expect(loader.canLoad('file.png')).toBe(true);
                expect(loader.canLoad('file.mp3')).toBe(true);
                expect(loader.canLoad('file.txt')).toBe(false);
            });

            test('should load binary files', async () => {
                const loader = new BinaryLoader();
                const testFile = '/tmp/test-binary.bin';
                const testData = new Uint8Array([1, 2, 3, 4, 5]);

                await Bun.write(testFile, testData);

                const result = await loader.load(testFile);
                expect(result).toBeInstanceOf(ArrayBuffer);
                expect(new Uint8Array(result)).toEqual(testData);
            });
        });
    });

    describe('AssetManager', () => {
        let manager: AssetManager;

        beforeEach(() => {
            manager = new AssetManager({
                autoGC: false,
                hotReload: false,
            });
        });

        afterEach(async () => {
            await manager.clear();
            manager.shutdown();
        });

        test('should create asset manager with default config', () => {
            const manager = new AssetManager();
            expect(manager).toBeDefined();
            manager.shutdown();
        });

        test('should load a text asset', async () => {
            const testFile = '/tmp/test-load.txt';
            const testContent = 'Test content';

            await Bun.write(testFile, testContent);

            const result = await manager.load<string>(testFile);

            expect(result.success).toBe(true);
            expect(result.data).toBe(testContent);
            expect(result.fromCache).toBe(false);
        });

        test('should load a JSON asset', async () => {
            const testFile = '/tmp/test-load.json';
            const testData = { name: 'test', value: 123 };

            await Bun.write(testFile, JSON.stringify(testData));

            const result = await manager.load(testFile);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(testData);
        });

        test('should cache loaded assets', async () => {
            const testFile = '/tmp/test-cache.txt';
            const testContent = 'Cached content';

            await Bun.write(testFile, testContent);

            const result1 = await manager.load<string>(testFile);
            expect(result1.fromCache).toBe(false);

            const result2 = await manager.load<string>(testFile);
            expect(result2.fromCache).toBe(true);
            expect(result2.data).toBe(testContent);
        });

        test('should force reload assets', async () => {
            const testFile = '/tmp/test-force-reload.txt';
            await Bun.write(testFile, 'Version 1');

            const result1 = await manager.load<string>(testFile);
            expect(result1.data).toBe('Version 1');

            await Bun.write(testFile, 'Version 2');

            const result2 = await manager.load<string>(testFile, { forceReload: true });
            expect(result2.data).toBe('Version 2');
            expect(result2.fromCache).toBe(false);
        });

        test('should handle loading errors', async () => {
            const result = await manager.load('/tmp/non-existent.txt');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should batch load assets', async () => {
            const files = ['/tmp/batch1.txt', '/tmp/batch2.txt', '/tmp/batch3.txt'];

            for (const [i, file] of files.entries()) {
                await Bun.write(file, `Content ${i}`);
            }

            const result = await manager.loadBatch(files);

            expect(result.success).toBe(true);
            expect(result.loaded.size).toBe(3);
            expect(result.failed.size).toBe(0);
        });

        test('should handle batch load failures', async () => {
            const files = ['/tmp/batch-ok.txt', '/tmp/non-existent.txt'];

            await Bun.write(files[0]!, 'OK');

            const result = await manager.loadBatch(files, { continueOnError: true });

            expect(result.success).toBe(false);
            expect(result.loaded.size).toBe(1);
            expect(result.failed.size).toBe(1);
        });

        test('should provide asset references', async () => {
            const testFile = '/tmp/test-ref.txt';
            await Bun.write(testFile, 'Reference test');

            await manager.load<string>(testFile);

            const ref = manager.getReference<string>(testFile);
            expect(ref).toBeDefined();
            expect(ref?.get()).toBe('Reference test');
        });

        test('should unload assets', async () => {
            const testFile = '/tmp/test-unload.txt';
            await Bun.write(testFile, 'Unload test');

            await manager.load(testFile);

            const stats1 = manager.getStats();
            expect(stats1.totalAssets).toBe(1);

            await manager.unload(testFile);

            const stats2 = manager.getStats();
            expect(stats2.totalAssets).toBe(0);
        });

        test('should clear all assets', async () => {
            const files = ['/tmp/clear1.txt', '/tmp/clear2.txt'];

            for (const file of files) {
                await Bun.write(file, 'Clear test');
                await manager.load(file);
            }

            const stats1 = manager.getStats();
            expect(stats1.totalAssets).toBe(2);

            await manager.clear();

            const stats2 = manager.getStats();
            expect(stats2.totalAssets).toBe(0);
        });

        test('should track statistics', async () => {
            const testFile = '/tmp/test-stats.json';
            await Bun.write(testFile, '{"test": true}');

            await manager.load(testFile);

            const stats = manager.getStats();

            expect(stats.totalAssets).toBe(1);
            expect(stats.loadedAssets).toBe(1);
            expect(stats.assetsByType.json).toBe(1);
            expect(stats.assetsByState[AssetState.LOADED]).toBe(1);
        });

        test('should calculate cache hit rate', async () => {
            const testFile = '/tmp/test-hit-rate.txt';
            await Bun.write(testFile, 'Cache hit test');

            // First load - cache miss
            await manager.load(testFile);

            // Second load - cache hit
            await manager.load(testFile);

            const stats = manager.getStats();
            expect(stats.cacheHitRate).toBe(0.5); // 1 hit out of 2 requests
        });

        test('should run garbage collection', async () => {
            const manager = new AssetManager({
                autoGC: false,
                gcMinRefCount: 0,
            });

            const testFile = '/tmp/test-gc.txt';
            await Bun.write(testFile, 'GC test');

            await manager.load(testFile);

            const stats1 = manager.getStats();
            expect(stats1.totalAssets).toBe(1);

            const collected = manager.gc();
            expect(collected).toBe(1);

            const stats2 = manager.getStats();
            expect(stats2.totalAssets).toBe(0);

            manager.shutdown();
        });

        test('should handle concurrent loads', async () => {
            const testFile = '/tmp/test-concurrent.txt';
            await Bun.write(testFile, 'Concurrent test');

            // Start multiple loads simultaneously
            const promises = [
                manager.load(testFile),
                manager.load(testFile),
                manager.load(testFile),
            ];

            const results = await Promise.all(promises);

            // All should succeed
            for (const result of results) {
                expect(result.success).toBe(true);
                expect(result.data).toBe('Concurrent test');
            }
        });

        test('should support custom loaders', async () => {
            class CustomLoader extends TextLoader {
                override readonly supportedTypes = ['custom'];

                override async load(path: string): Promise<string> {
                    return 'CUSTOM: ' + (await super.load(path));
                }
            }

            manager.registerLoader(new CustomLoader());

            const testFile = '/tmp/test.custom';
            await Bun.write(testFile, 'test content');

            const result = await manager.load<string>(testFile);
            expect(result.success).toBe(true);
            expect(result.data).toBe('CUSTOM: test content');
        });

        test('should support timeout option', async () => {
            const testFile = '/tmp/test-timeout.txt';
            await Bun.write(testFile, 'timeout test');

            const result = await manager.load(testFile, { timeout: 5000 });
            expect(result.success).toBe(true);
        });

        test('should support priority in options', async () => {
            const testFile = '/tmp/test-priority.txt';
            await Bun.write(testFile, 'priority test');

            const result = await manager.load(testFile, { priority: 10 });
            expect(result.success).toBe(true);
        });

        test('should load with custom metadata', async () => {
            const testFile = '/tmp/test-metadata.txt';
            await Bun.write(testFile, 'metadata test');

            const result = await manager.load(testFile, {
                metadata: {
                    tags: ['test', 'metadata'],
                    version: '1.0.0',
                },
            });

            expect(result.success).toBe(true);
            expect(result.metadata.tags).toEqual(['test', 'metadata']);
            expect(result.metadata.version).toBe('1.0.0');
        });

        test('should handle batch load with maxConcurrent', async () => {
            const files = ['/tmp/conc1.txt', '/tmp/conc2.txt', '/tmp/conc3.txt'];

            for (const [i, file] of files.entries()) {
                await Bun.write(file, `Concurrent ${i}`);
            }

            const result = await manager.loadBatch(files, {
                maxConcurrent: 2,
            });

            expect(result.success).toBe(true);
            expect(result.loaded.size).toBe(3);
        });

        test('should support base path configuration', async () => {
            const manager = new AssetManager({
                basePath: '/tmp',
                autoGC: false,
            });

            await Bun.write('/tmp/relative.txt', 'relative path test');

            const result = await manager.load<string>('relative.txt');
            expect(result.success).toBe(true);
            expect(result.data).toBe('relative path test');

            manager.shutdown();
        });
    });

    describe('AssetError', () => {
        test('should create asset error with code', () => {
            const error = new AssetError(
                'Test error',
                AssetErrorCode.LOAD_FAILED,
                'asset-123'
            );

            expect(error.message).toBe('Test error');
            expect(error.code).toBe(AssetErrorCode.LOAD_FAILED);
            expect(error.assetId).toBe('asset-123');
            expect(error.name).toBe('AssetError');
        });

        test('should support error details', () => {
            const details = { reason: 'network timeout' };
            const error = new AssetError(
                'Load failed',
                AssetErrorCode.TIMEOUT,
                'asset-123',
                details
            );

            expect(error.details).toEqual(details);
        });
    });

    describe('Integration Tests', () => {
        test('should handle complex asset loading workflow', async () => {
            const manager = new AssetManager({
                maxCacheSize: 1024 * 1024,
                autoGC: true,
                hotReload: false,
            });

            // Create test files
            const configFile = '/tmp/game-config.json';
            const textFile = '/tmp/story.txt';
            const dataFile = '/tmp/level.bin';

            await Bun.write(configFile, JSON.stringify({ level: 1, difficulty: 'hard' }));
            await Bun.write(textFile, 'Once upon a time...');
            await Bun.write(dataFile, new Uint8Array([1, 2, 3, 4, 5]));

            // Load multiple assets
            const [config, story, level] = await Promise.all([
                manager.load(configFile),
                manager.load(textFile),
                manager.load(dataFile),
            ]);

            expect(config.success).toBe(true);
            expect(story.success).toBe(true);
            expect(level.success).toBe(true);

            // Get references
            const configRef = manager.getReference(configFile);
            expect(configRef).toBeDefined();

            configRef?.acquire();
            expect(configRef?.refCount).toBe(1);

            // Check stats
            const stats = manager.getStats();
            expect(stats.totalAssets).toBe(3);
            expect(stats.loadedAssets).toBe(3);

            // Cleanup
            configRef?.release();
            await manager.clear();
            manager.shutdown();
        });
    });
});
