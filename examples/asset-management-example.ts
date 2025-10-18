/**
 * Asset Management Example
 *
 * Demonstrates the comprehensive asset management system including:
 * - Loading various asset types (text, JSON, binary)
 * - Asset caching and reference counting
 * - Batch loading
 * - Custom loaders
 * - Hot-reloading
 * - Resource lifecycle management
 */

import type { AssetLoadOptions } from '../src/core/assets/types.ts';
import {
    AssetManager,
    BaseAssetLoader,
    ScopedAssetReference,
} from '../src/index.ts';

// Example: Custom game config type
interface GameConfig {
    title: string;
    version: string;
    maxPlayers: number;
    settings: {
        difficulty: string;
        enableSound: boolean;
    };
}

// Example: Custom level data type
interface LevelData {
    id: number;
    name: string;
    enemies: Array<{ type: string; count: number }>;
    items: string[];
}

// Example: Custom loader for a proprietary format
class GameDataLoader extends BaseAssetLoader<LevelData> {
    readonly supportedTypes = ['level', 'lvl'];

    async load(path: string, options?: AssetLoadOptions): Promise<LevelData> {
        return this.loadWithTimeout(
            async () =>
                this.loadWithRetry(
                    async () => this.loadLevel(path),
                    options?.retries
                ),
            options?.timeout
        );
    }

    private async loadLevel(path: string): Promise<LevelData> {
        // In a real game, this would parse a custom binary format
        // For this example, we'll just load JSON
        const file = Bun.file(path);
        const data = await file.json();
        return data as LevelData;
    }

    override validate(data: LevelData): boolean {
        return (
            typeof data.id === 'number' &&
            typeof data.name === 'string' &&
            Array.isArray(data.enemies)
        );
    }
}

async function main() {
    console.log('🎮 Asset Management System Demo\n');

    // ========================================
    // 1. Create Asset Manager
    // ========================================
    console.log('1️⃣  Creating Asset Manager...');

    const assetManager = new AssetManager({
        maxCacheSize: 50 * 1024 * 1024, // 50MB cache limit
        autoGC: true, // Automatic garbage collection
        gcInterval: 30000, // Run GC every 30 seconds
        hotReload: false, // Disable hot-reload for this example
        basePath: '/tmp/game-assets', // Base path for relative asset paths
        defaultTimeout: 10000, // 10 second timeout
    });

    // Register custom loader
    assetManager.registerLoader(new GameDataLoader());

    console.log('✅ Asset Manager created\n');

    // ========================================
    // 2. Create Example Assets
    // ========================================
    console.log('2️⃣  Creating example assets...');

    // Create directory
    await Bun.write('/tmp/game-assets/.keep', '');

    // Create game config
    const gameConfig: GameConfig = {
        title: 'Awesome Game',
        version: '1.0.0',
        maxPlayers: 4,
        settings: {
            difficulty: 'normal',
            enableSound: true,
        },
    };
    await Bun.write(
        '/tmp/game-assets/config.json',
        JSON.stringify(gameConfig, null, 2)
    );

    // Create level data
    const level1: LevelData = {
        id: 1,
        name: 'Forest of Doom',
        enemies: [
            { type: 'goblin', count: 5 },
            { type: 'orc', count: 2 },
        ],
        items: ['health_potion', 'sword', 'shield'],
    };
    await Bun.write(
        '/tmp/game-assets/level1.level',
        JSON.stringify(level1, null, 2)
    );

    // Create story text
    const story = `
=== The Legend Begins ===

In the land of Eldoria, a great evil has awakened.
Only the bravest heroes can save the kingdom from destruction.

Your quest begins in the Forest of Doom...
`;
    await Bun.write('/tmp/game-assets/story.txt', story.trim());

    console.log('✅ Example assets created\n');

    // ========================================
    // 3. Load Individual Assets
    // ========================================
    console.log('3️⃣  Loading individual assets...');

    // Load game config
    const configResult = await assetManager.load<GameConfig>('config.json');
    if (configResult.success) {
        console.log(
            `✅ Loaded config: ${configResult.data?.title} v${configResult.data?.version}`
        );
        console.log(`   Load duration: ${configResult.duration}ms`);
        console.log(`   From cache: ${configResult.fromCache}`);
    }

    // Load story text
    const storyResult = await assetManager.load<string>('story.txt');
    if (storyResult.success) {
        console.log(`✅ Loaded story (${storyResult.data?.length} characters)`);
    }

    // Load level data with custom loader
    const levelResult = await assetManager.load<LevelData>('level1.level');
    if (levelResult.success) {
        console.log(`✅ Loaded level: ${levelResult.data?.name}`);
        console.log(`   Enemies: ${levelResult.data?.enemies.length} types`);
        console.log(`   Items: ${levelResult.data?.items.length}`);
    }

    console.log();

    // ========================================
    // 4. Demonstrate Caching
    // ========================================
    console.log('4️⃣  Demonstrating asset caching...');

    // Load the same config again - should come from cache
    const configResult2 = await assetManager.load<GameConfig>('config.json');
    console.log(
        `✅ Second config load - From cache: ${configResult2.fromCache}`
    );
    console.log(
        `   Load duration: ${configResult2.duration}ms (much faster!)\n`
    );

    // ========================================
    // 5. Batch Loading
    // ========================================
    console.log('5️⃣  Batch loading multiple assets...');

    // Create more assets
    await Bun.write('/tmp/game-assets/texture1.txt', 'texture data 1');
    await Bun.write('/tmp/game-assets/texture2.txt', 'texture data 2');
    await Bun.write('/tmp/game-assets/audio.txt', 'audio data');

    const batchResult = await assetManager.loadBatch(
        ['texture1.txt', 'texture2.txt', 'audio.txt'],
        {
            parallel: true,
            maxConcurrent: 2,
            continueOnError: true,
        }
    );

    console.log(`✅ Batch load complete:`);
    console.log(`   Loaded: ${batchResult.loaded.size} assets`);
    console.log(`   Failed: ${batchResult.failed.size} assets`);
    console.log(`   Duration: ${batchResult.duration}ms\n`);

    // ========================================
    // 6. Reference Counting
    // ========================================
    console.log('6️⃣  Demonstrating reference counting...');

    const configRef = assetManager.getReference<GameConfig>('config.json');
    if (configRef) {
        console.log(`Initial ref count: ${configRef.refCount}`);

        configRef.acquire();
        console.log(`After acquire: ${configRef.refCount}`);

        configRef.acquire();
        console.log(`After second acquire: ${configRef.refCount}`);

        configRef.release();
        console.log(`After release: ${configRef.refCount}`);

        configRef.release();
        console.log(`After second release: ${configRef.refCount}`);
    }

    console.log();

    // ========================================
    // 7. Scoped References (RAII pattern)
    // ========================================
    console.log('7️⃣  Using scoped references...');

    const levelRef = assetManager.getReference<LevelData>('level1.level');
    if (levelRef) {
        console.log(`Level ref count before scope: ${levelRef.refCount}`);

        {
            using scopedRef = new ScopedAssetReference(levelRef);
            console.log(`Level ref count in scope: ${levelRef.refCount}`);
            console.log(`Level name: ${scopedRef.get()?.name}`);
        }

        console.log(`Level ref count after scope: ${levelRef.refCount}`);
    }

    console.log();

    // ========================================
    // 8. Asset Manager Statistics
    // ========================================
    console.log('8️⃣  Asset Manager statistics...');

    const stats = assetManager.getStats();
    console.log(`Total assets: ${stats.totalAssets}`);
    console.log(`Loaded assets: ${stats.loadedAssets}`);
    console.log(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    console.log('\nAssets by type:');
    for (const [type, count] of Object.entries(stats.assetsByType)) {
        console.log(`  ${type}: ${count}`);
    }
    console.log('\nAssets by state:');
    for (const [state, count] of Object.entries(stats.assetsByState)) {
        if (count > 0) {
            console.log(`  ${state}: ${count}`);
        }
    }

    console.log();

    // ========================================
    // 9. Force Reload
    // ========================================
    console.log('9️⃣  Demonstrating force reload...');

    // Modify the config file
    const updatedConfig = { ...gameConfig, version: '1.1.0' };
    await Bun.write(
        '/tmp/game-assets/config.json',
        JSON.stringify(updatedConfig, null, 2)
    );

    // Load without force reload - gets cached version
    const cachedConfig = await assetManager.load<GameConfig>('config.json');
    console.log(`Cached version: ${cachedConfig.data?.version}`);

    // Force reload - gets updated version
    const reloadedConfig = await assetManager.load<GameConfig>('config.json', {
        forceReload: true,
    });
    console.log(`Reloaded version: ${reloadedConfig.data?.version}`);

    console.log();

    // ========================================
    // 10. Error Handling
    // ========================================
    console.log('🔟 Demonstrating error handling...');

    const failedResult = await assetManager.load('non-existent-file.txt');
    if (!failedResult.success) {
        console.log(`❌ Expected error: ${failedResult.error}`);
    }

    console.log();

    // ========================================
    // 11. Unload Assets
    // ========================================
    console.log('1️⃣1️⃣  Unloading specific assets...');

    console.log(`Assets before unload: ${assetManager.getStats().totalAssets}`);

    await assetManager.unload('texture1.txt');
    await assetManager.unload('texture2.txt');

    console.log(
        `Assets after unload: ${assetManager.getStats().totalAssets}\n`
    );

    // ========================================
    // 12. Garbage Collection
    // ========================================
    console.log('1️⃣2️⃣  Running garbage collection...');

    const collected = assetManager.gc();
    console.log(`Collected ${collected} assets with no references\n`);

    // ========================================
    // 13. Custom Metadata
    // ========================================
    console.log('1️⃣3️⃣  Loading with custom metadata...');

    const customResult = await assetManager.load('story.txt', {
        metadata: {
            tags: ['story', 'intro', 'chapter-1'],
            version: '1.0.0',
            custom: {
                author: 'Game Studio',
                language: 'en',
            },
        },
    });

    if (customResult.success) {
        console.log(`✅ Loaded with custom metadata:`);
        console.log(`   Tags: ${customResult.metadata.tags?.join(', ')}`);
        console.log(`   Custom data:`, customResult.metadata.custom);
    }

    console.log();

    // ========================================
    // 14. Cleanup
    // ========================================
    console.log('1️⃣4️⃣  Cleaning up...');

    await assetManager.clear();
    assetManager.shutdown();

    console.log('✅ Asset Manager shut down\n');

    // ========================================
    // Summary
    // ========================================
    console.log('📊 Summary');
    console.log('='.repeat(50));
    console.log('✅ Asset loading (individual and batch)');
    console.log('✅ Caching and cache hit tracking');
    console.log('✅ Reference counting for lifecycle management');
    console.log('✅ Scoped references (RAII pattern)');
    console.log('✅ Custom asset loaders');
    console.log('✅ Force reload capability');
    console.log('✅ Error handling');
    console.log('✅ Statistics and monitoring');
    console.log('✅ Garbage collection');
    console.log('✅ Custom metadata support');
    console.log('='.repeat(50));
    console.log('\n🎉 Asset Management Demo Complete!');
}

// Run the example
main().catch(console.error);
