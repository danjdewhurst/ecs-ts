/**
 * Asset Management module for ECS Game Engine
 *
 * Provides comprehensive asset loading, caching, and lifecycle management with:
 * - Type-safe async asset loading
 * - Reference counting for automatic cleanup
 * - Hot-reloading support for development
 * - Asset dependency tracking
 * - Multiple built-in loaders (Text, JSON, Binary)
 * - Extensible loader system
 * - Memory management with automatic garbage collection
 *
 * @example
 * ```typescript
 * import { AssetManager } from './assets';
 *
 * const assetManager = new AssetManager({
 *   maxCacheSize: 100 * 1024 * 1024, // 100MB
 *   hotReload: true,
 * });
 *
 * // Load assets
 * const result = await assetManager.load<GameConfig>('config.json');
 * if (result.success) {
 *   console.log('Config loaded:', result.data);
 * }
 *
 * // Batch loading
 * const batch = await assetManager.loadBatch([
 *   'texture1.png',
 *   'texture2.png',
 *   'audio.mp3'
 * ]);
 *
 * // Use reference counting
 * const ref = assetManager.getReference<string>('data.txt');
 * if (ref) {
 *   ref.acquire(); // Increment ref count
 *   const data = ref.get();
 *   ref.release(); // Decrement ref count
 * }
 * ```
 */

// Core classes
export { Asset } from './Asset.ts';
export { AssetManager } from './AssetManager.ts';
export { AssetReference, ScopedAssetReference } from './AssetReference.ts';

// Built-in loaders
export {
    BaseAssetLoader,
    BinaryLoader,
    JSONLoader,
    TextLoader,
} from './loaders/index.ts';

// Types and interfaces
export type {
    AssetCacheEntry,
    AssetDependencyNode,
    AssetLoader,
    AssetLoadOptions,
    AssetLoadProgress,
    AssetLoadResult,
    AssetManagerConfig,
    AssetManagerStats,
    AssetMetadata,
    AssetReference as IAssetReference,
    BatchLoadOptions,
    BatchLoadResult,
    HotReloadEvent,
} from './types.ts';
export { AssetError, AssetErrorCode, AssetState } from './types.ts';
