/**
 * AssetManager - central manager for all asset loading, caching, and lifecycle
 */

import { Asset } from './Asset.ts';
import { AssetReference } from './AssetReference.ts';
import { BinaryLoader, JSONLoader, TextLoader } from './loaders/index.ts';
import type {
    AssetCacheEntry,
    AssetDependencyNode,
    AssetLoader,
    AssetLoadOptions,
    AssetLoadResult,
    AssetManagerConfig,
    AssetManagerStats,
    AssetMetadata,
    BatchLoadOptions,
    BatchLoadResult,
    AssetError as IAssetError,
} from './types.ts';
import { AssetError, AssetErrorCode, AssetState } from './types.ts';

/**
 * Central asset management system
 */
export class AssetManager {
    private readonly _config: Required<AssetManagerConfig>;
    private readonly _cache = new Map<string, AssetCacheEntry>();
    private readonly _references = new Map<string, AssetReference>();
    private readonly _loaders = new Map<string, AssetLoader>();
    private readonly _dependencies = new Map<string, AssetDependencyNode>();
    private readonly _loadingPromises = new Map<string, Promise<unknown>>();
    private readonly _hotReloadWatchers = new Map<
        string,
        { path: string; lastModified: number }
    >();

    private _gcTimer: Timer | null = null;
    private _hotReloadTimer: Timer | null = null;
    private _cacheHits = 0;
    private _cacheMisses = 0;

    constructor(config: AssetManagerConfig = {}) {
        this._config = {
            maxCacheSize: config.maxCacheSize ?? 0, // 0 = unlimited
            autoGC: config.autoGC ?? true,
            gcInterval: config.gcInterval ?? 60000, // 1 minute
            gcMinRefCount: config.gcMinRefCount ?? 0,
            hotReload: config.hotReload ?? false,
            hotReloadInterval: config.hotReloadInterval ?? 1000, // 1 second
            basePath: config.basePath ?? '',
            defaultTimeout: config.defaultTimeout ?? 30000, // 30 seconds
            preloadEnabled: config.preloadEnabled ?? true,
        };

        // Register default loaders
        this.registerLoader(new TextLoader());
        this.registerLoader(new JSONLoader());
        this.registerLoader(new BinaryLoader());

        // Start automatic garbage collection
        if (this._config.autoGC) {
            this.startGC();
        }

        // Start hot-reload monitoring
        if (this._config.hotReload) {
            this.startHotReload();
        }
    }

    /**
     * Register a custom asset loader
     */
    registerLoader<T>(loader: AssetLoader<T>): void {
        for (const type of loader.supportedTypes) {
            this._loaders.set(type, loader as AssetLoader);
        }
    }

    /**
     * Unregister an asset loader by type
     */
    unregisterLoader(type: string): void {
        this._loaders.delete(type);
    }

    /**
     * Load an asset
     */
    async load<T = unknown>(
        path: string,
        options: AssetLoadOptions = {}
    ): Promise<AssetLoadResult<T>> {
        const startTime = Date.now();
        const assetId = this.getAssetId(path, options);
        const fullPath = this.resolvePath(path);

        try {
            // Check cache first
            if (!options.forceReload && options.cache !== false) {
                const cached = this.getCached<T>(assetId);
                if (cached) {
                    this._cacheHits++;
                    return {
                        success: true,
                        data: cached.data,
                        metadata: cached.metadata,
                        duration: Date.now() - startTime,
                        fromCache: true,
                    };
                }
            }

            this._cacheMisses++;

            // Check if already loading
            if (this._loadingPromises.has(assetId)) {
                const data = (await this._loadingPromises.get(assetId)) as T;
                const cached = this.getCached<T>(assetId);
                if (!cached) {
                    throw new AssetError(
                        'Asset loaded but not cached',
                        AssetErrorCode.LOAD_FAILED,
                        assetId
                    );
                }
                return {
                    success: true,
                    data,
                    metadata: cached.metadata,
                    duration: Date.now() - startTime,
                    fromCache: false,
                };
            }

            // Find appropriate loader
            const loader = this.findLoader(fullPath, options.metadata?.type);
            if (!loader) {
                throw new AssetError(
                    `No loader found for asset: ${path}`,
                    AssetErrorCode.UNSUPPORTED_TYPE,
                    assetId
                );
            }

            // Create metadata
            const metadata: AssetMetadata = {
                id: assetId,
                path: fullPath,
                type: options.metadata?.type ?? this.getFileExtension(fullPath),
                ...options.metadata,
            };

            // Create asset
            const asset = new Asset<T>(metadata);

            // Load dependencies first
            if (metadata.dependencies && metadata.dependencies.length > 0) {
                await this.loadDependencies(metadata.dependencies, options);
            }

            // Start loading
            asset.markLoading();

            const loadPromise = this.performLoad<T>(
                loader as AssetLoader<T>,
                fullPath,
                options
            );
            this._loadingPromises.set(assetId, loadPromise);

            try {
                const data = await loadPromise;

                // Update asset
                asset.markLoaded(data);

                // Cache the asset
                if (options.cache !== false) {
                    this.cacheAsset(assetId, asset);
                }

                // Set up hot-reload monitoring
                if (this._config.hotReload) {
                    this.watchForChanges(assetId, fullPath);
                }

                return {
                    success: true,
                    data,
                    metadata: asset.metadata,
                    duration: Date.now() - startTime,
                    fromCache: false,
                };
            } finally {
                this._loadingPromises.delete(assetId);
            }
        } catch (error) {
            const assetError =
                error instanceof AssetError
                    ? error
                    : new AssetError(
                          `Failed to load asset: ${error instanceof Error ? error.message : String(error)}`,
                          AssetErrorCode.LOAD_FAILED,
                          assetId,
                          error
                      );

            return {
                success: false,
                metadata: {
                    id: assetId,
                    path: fullPath,
                    type:
                        options.metadata?.type ??
                        this.getFileExtension(fullPath),
                },
                error: assetError.message,
                duration: Date.now() - startTime,
                fromCache: false,
            };
        }
    }

    /**
     * Load multiple assets in batch
     */
    async loadBatch<T = unknown>(
        paths: string[],
        options: BatchLoadOptions = {}
    ): Promise<BatchLoadResult<T>> {
        const startTime = Date.now();
        const loaded = new Map<string, AssetLoadResult<T>>();
        const failed = new Map<string, IAssetError>();

        const loadAsset = async (path: string) => {
            try {
                const result = await this.load<T>(path, options);
                if (result.success) {
                    loaded.set(path, result);
                } else {
                    failed.set(
                        path,
                        new AssetError(
                            result.error ?? 'Unknown error',
                            AssetErrorCode.LOAD_FAILED
                        )
                    );
                }
            } catch (error) {
                failed.set(
                    path,
                    error instanceof AssetError
                        ? error
                        : new AssetError(
                              error instanceof Error
                                  ? error.message
                                  : String(error),
                              AssetErrorCode.LOAD_FAILED
                          )
                );
            }
        };

        if (options.parallel !== false) {
            // Parallel loading with optional concurrency limit
            const maxConcurrent = options.maxConcurrent ?? paths.length;
            const chunks: string[][] = [];

            for (let i = 0; i < paths.length; i += maxConcurrent) {
                chunks.push(paths.slice(i, i + maxConcurrent));
            }

            for (const chunk of chunks) {
                await Promise.all(chunk.map(loadAsset));

                if (!options.continueOnError && failed.size > 0) {
                    break;
                }
            }
        } else {
            // Sequential loading
            for (const path of paths) {
                await loadAsset(path);

                if (!options.continueOnError && failed.size > 0) {
                    break;
                }
            }
        }

        return {
            loaded,
            failed,
            success: failed.size === 0,
            duration: Date.now() - startTime,
        };
    }

    /**
     * Get a reference to an asset
     */
    getReference<T = unknown>(assetId: string): AssetReference<T> | undefined {
        const cached = this._cache.get(assetId);
        if (!cached) return undefined;

        let reference = this._references.get(assetId) as
            | AssetReference<T>
            | undefined;

        if (!reference) {
            const asset = new Asset<T>(cached.metadata);
            asset.markLoaded(cached.data as T);

            reference = new AssetReference<T>(asset, (ref) => {
                this.onReferenceReleased(ref);
            });

            this._references.set(assetId, reference as AssetReference);
        }

        return reference;
    }

    /**
     * Unload an asset from cache
     */
    async unload(assetId: string): Promise<boolean> {
        const cached = this._cache.get(assetId);
        if (!cached) return false;

        // Call loader's unload method if available
        const loader = this.findLoader(
            cached.metadata.path,
            cached.metadata.type
        );
        if (loader?.unload) {
            await loader.unload(cached.data);
        }

        // Remove from cache
        this._cache.delete(assetId);
        this._references.delete(assetId);
        this._dependencies.delete(assetId);
        this._hotReloadWatchers.delete(assetId);

        return true;
    }

    /**
     * Clear all cached assets
     */
    async clear(): Promise<void> {
        const assetIds = Array.from(this._cache.keys());
        await Promise.all(assetIds.map((id) => this.unload(id)));
    }

    /**
     * Get asset manager statistics
     */
    getStats(): AssetManagerStats {
        const assetsByType: Record<string, number> = {};
        const assetsByState: Record<AssetState, number> = {
            [AssetState.PENDING]: 0,
            [AssetState.LOADING]: 0,
            [AssetState.LOADED]: 0,
            [AssetState.FAILED]: 0,
            [AssetState.RELOADING]: 0,
            [AssetState.UNLOADED]: 0,
        };

        let totalCacheSize = 0;

        for (const entry of this._cache.values()) {
            const type = entry.metadata.type;
            assetsByType[type] = (assetsByType[type] ?? 0) + 1;
            assetsByState[entry.state] = (assetsByState[entry.state] ?? 0) + 1;
            totalCacheSize += entry.memorySize ?? 0;
        }

        const totalRequests = this._cacheHits + this._cacheMisses;
        const cacheHitRate =
            totalRequests > 0 ? this._cacheHits / totalRequests : 0;

        return {
            totalAssets: this._cache.size,
            loadedAssets: assetsByState[AssetState.LOADED],
            loadingAssets:
                assetsByState[AssetState.LOADING] +
                assetsByState[AssetState.RELOADING],
            failedAssets: assetsByState[AssetState.FAILED],
            cacheSize: totalCacheSize,
            cacheHitRate,
            assetsByType,
            assetsByState,
        };
    }

    /**
     * Run garbage collection manually
     */
    gc(): number {
        let collected = 0;
        const toRemove: string[] = [];

        for (const [id, entry] of this._cache.entries()) {
            if (entry.refCount <= this._config.gcMinRefCount) {
                toRemove.push(id);
                collected++;
            }
        }

        for (const id of toRemove) {
            this.unload(id);
        }

        return collected;
    }

    /**
     * Shut down the asset manager
     */
    shutdown(): void {
        this.stopGC();
        this.stopHotReload();
        this.clear();
    }

    // Private helper methods

    private performLoad<T>(
        loader: AssetLoader<T>,
        path: string,
        options: AssetLoadOptions
    ): Promise<T> {
        const timeout = options.timeout ?? this._config.defaultTimeout;
        const retries = options.retries ?? 0;

        return loader.load(path, { ...options, timeout, retries });
    }

    private async loadDependencies(
        dependencies: string[],
        options: AssetLoadOptions
    ): Promise<void> {
        const results = await Promise.allSettled(
            dependencies.map((dep) => this.load(dep, options))
        );

        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
            throw new AssetError(
                `Failed to load ${failed.length} dependencies`,
                AssetErrorCode.DEPENDENCY_FAILED
            );
        }
    }

    private getCached<T>(assetId: string): AssetCacheEntry<T> | undefined {
        const cached = this._cache.get(assetId);
        if (!cached) return undefined;

        // Update last accessed time
        cached.lastAccessed = Date.now();

        return cached as AssetCacheEntry<T>;
    }

    private cacheAsset<T>(assetId: string, asset: Asset<T>): void {
        const entry: AssetCacheEntry<T> = {
            data: asset.data!,
            metadata: asset.metadata,
            refCount: 0,
            state: asset.state,
            lastAccessed: Date.now(),
        };

        this._cache.set(assetId, entry as AssetCacheEntry);

        // Check cache size limits
        if (this._config.maxCacheSize > 0) {
            this.enforceCacheLimit();
        }
    }

    private enforceCacheLimit(): void {
        let totalSize = 0;
        for (const entry of this._cache.values()) {
            totalSize += entry.memorySize ?? 0;
        }

        if (totalSize <= this._config.maxCacheSize) return;

        // Remove least recently used assets
        const entries = Array.from(this._cache.entries()).sort(
            (a, b) => a[1].lastAccessed - b[1].lastAccessed
        );

        for (const [id] of entries) {
            this.unload(id);
            totalSize = 0;
            for (const entry of this._cache.values()) {
                totalSize += entry.memorySize ?? 0;
            }
            if (totalSize <= this._config.maxCacheSize) break;
        }
    }

    private findLoader(path: string, type?: string): AssetLoader | undefined {
        const extension = this.getFileExtension(path);

        // Try by explicit type first
        if (type && this._loaders.has(type)) {
            return this._loaders.get(type);
        }

        // Try by file extension
        if (this._loaders.has(extension)) {
            return this._loaders.get(extension);
        }

        // Try each loader's canLoad method
        for (const loader of this._loaders.values()) {
            if (loader.canLoad(path, type)) {
                return loader;
            }
        }

        return undefined;
    }

    private getAssetId(path: string, options: AssetLoadOptions): string {
        const fullPath = this.resolvePath(path);
        const version = options.metadata?.version ?? '';
        return version ? `${fullPath}@${version}` : fullPath;
    }

    private resolvePath(path: string): string {
        if (path.startsWith('/') || path.includes('://')) {
            return path;
        }
        return this._config.basePath
            ? `${this._config.basePath}/${path}`
            : path;
    }

    private getFileExtension(path: string): string {
        const lastDot = path.lastIndexOf('.');
        if (lastDot === -1) return '';
        return path.slice(lastDot + 1).toLowerCase();
    }

    private onReferenceReleased<T>(ref: AssetReference<T>): void {
        const cached = this._cache.get(ref.id);
        if (cached) {
            cached.refCount = ref.refCount;
        }
    }

    private watchForChanges(assetId: string, path: string): void {
        this._hotReloadWatchers.set(assetId, {
            path,
            lastModified: Date.now(),
        });
    }

    private async checkForChanges(): Promise<void> {
        for (const [assetId, watcher] of this._hotReloadWatchers.entries()) {
            try {
                const file = Bun.file(watcher.path);
                const exists = await file.exists();

                if (!exists) {
                    continue;
                }

                const stat = await file.stat();
                if (stat && stat.mtime.getTime() > watcher.lastModified) {
                    // File changed - reload it
                    await this.reload(assetId);
                    watcher.lastModified = stat.mtime.getTime();
                }
            } catch {
                // Ignore errors in hot-reload checking
            }
        }
    }

    private async reload(assetId: string): Promise<void> {
        const cached = this._cache.get(assetId);
        if (!cached) return;

        await this.load(cached.metadata.path, {
            forceReload: true,
            metadata: cached.metadata,
        });
    }

    private startGC(): void {
        if (this._gcTimer) return;

        this._gcTimer = setInterval(() => {
            this.gc();
        }, this._config.gcInterval);
    }

    private stopGC(): void {
        if (this._gcTimer) {
            clearInterval(this._gcTimer);
            this._gcTimer = null;
        }
    }

    private startHotReload(): void {
        if (this._hotReloadTimer) return;

        this._hotReloadTimer = setInterval(() => {
            this.checkForChanges();
        }, this._config.hotReloadInterval);
    }

    private stopHotReload(): void {
        if (this._hotReloadTimer) {
            clearInterval(this._hotReloadTimer);
            this._hotReloadTimer = null;
        }
    }
}
