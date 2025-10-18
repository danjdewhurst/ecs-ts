/**
 * Core asset management types and interfaces for the ECS engine.
 * Provides type-safe asset loading, caching, and lifecycle management.
 */

/**
 * Asset loading states
 */
export enum AssetState {
    /** Asset is queued for loading but hasn't started */
    PENDING = 'pending',
    /** Asset is currently being loaded */
    LOADING = 'loading',
    /** Asset has been successfully loaded */
    LOADED = 'loaded',
    /** Asset loading failed */
    FAILED = 'failed',
    /** Asset is being reloaded (hot-reload) */
    RELOADING = 'reloading',
    /** Asset has been unloaded from memory */
    UNLOADED = 'unloaded',
}

/**
 * Asset metadata interface
 */
export interface AssetMetadata {
    /** Unique identifier for the asset */
    readonly id: string;

    /** Asset file path or URL */
    readonly path: string;

    /** Asset type (e.g., 'texture', 'audio', 'json', 'text') */
    readonly type: string;

    /** MIME type of the asset */
    readonly mimeType?: string;

    /** File size in bytes */
    readonly size?: number;

    /** Last modification timestamp */
    readonly lastModified?: number;

    /** Asset version for cache busting */
    readonly version?: string;

    /** Custom tags for categorization */
    readonly tags?: string[];

    /** Asset dependencies (other asset IDs) */
    readonly dependencies?: string[];

    /** Custom metadata */
    readonly custom?: Record<string, unknown>;
}

/**
 * Asset loading options
 */
export interface AssetLoadOptions {
    /** Force reload even if cached */
    forceReload?: boolean;

    /** Timeout in milliseconds */
    timeout?: number;

    /** Retry attempts on failure */
    retries?: number;

    /** Priority for load queue (higher = sooner) */
    priority?: number;

    /** Custom metadata to attach */
    metadata?: Partial<AssetMetadata>;

    /** Progress callback */
    onProgress?: (progress: AssetLoadProgress) => void;

    /** Cache the loaded asset */
    cache?: boolean;
}

/**
 * Asset loading progress
 */
export interface AssetLoadProgress {
    /** Asset being loaded */
    readonly assetId: string;

    /** Current loading state */
    readonly state: AssetState;

    /** Bytes loaded */
    readonly loaded: number;

    /** Total bytes (if known) */
    readonly total?: number;

    /** Progress percentage (0-100) */
    readonly progress: number;
}

/**
 * Asset loading result
 */
export interface AssetLoadResult<T> {
    /** Whether the load was successful */
    readonly success: boolean;

    /** The loaded asset data (if successful) */
    readonly data?: T;

    /** Asset metadata */
    readonly metadata: AssetMetadata;

    /** Error message (if failed) */
    readonly error?: string;

    /** Load duration in milliseconds */
    readonly duration: number;

    /** Whether this was loaded from cache */
    readonly fromCache: boolean;
}

/**
 * Asset loader interface - implement this for custom asset types
 */
export interface AssetLoader<T = unknown> {
    /** Supported asset types (file extensions or MIME types) */
    readonly supportedTypes: string[];

    /**
     * Load an asset from a path
     */
    load(path: string, options?: AssetLoadOptions): Promise<T>;

    /**
     * Check if this loader can handle a given path/type
     */
    canLoad(path: string, type?: string): boolean;

    /**
     * Validate loaded asset data
     */
    validate?(data: T): boolean;

    /**
     * Unload/cleanup asset data
     */
    unload?(data: T): void | Promise<void>;
}

/**
 * Asset reference for tracking usage
 */
export interface AssetReference<T = unknown> {
    /** Asset ID */
    readonly id: string;

    /** Reference count */
    readonly refCount: number;

    /** Get the asset data */
    get(): T | undefined;

    /** Increment reference count */
    acquire(): void;

    /** Decrement reference count */
    release(): void;

    /** Check if asset is loaded */
    isLoaded(): boolean;

    /** Get current state */
    getState(): AssetState;
}

/**
 * Asset cache entry
 */
export interface AssetCacheEntry<T = unknown> {
    /** Cached asset data */
    data: T;

    /** Asset metadata */
    metadata: AssetMetadata;

    /** Reference count */
    refCount: number;

    /** Current state */
    state: AssetState;

    /** Last access timestamp */
    lastAccessed: number;

    /** Size in memory (bytes) */
    memorySize?: number;
}

/**
 * Asset manager configuration
 */
export interface AssetManagerConfig {
    /** Maximum cache size in bytes (0 = unlimited) */
    maxCacheSize?: number;

    /** Enable automatic garbage collection */
    autoGC?: boolean;

    /** GC interval in milliseconds */
    gcInterval?: number;

    /** Minimum reference count for GC */
    gcMinRefCount?: number;

    /** Enable hot-reloading support */
    hotReload?: boolean;

    /** Hot-reload polling interval in milliseconds */
    hotReloadInterval?: number;

    /** Base path for relative asset paths */
    basePath?: string;

    /** Default asset load timeout */
    defaultTimeout?: number;

    /** Enable asset preloading */
    preloadEnabled?: boolean;
}

/**
 * Asset manager statistics
 */
export interface AssetManagerStats {
    /** Total assets loaded */
    totalAssets: number;

    /** Currently loaded assets */
    loadedAssets: number;

    /** Assets in loading state */
    loadingAssets: number;

    /** Failed asset loads */
    failedAssets: number;

    /** Total cache size in bytes */
    cacheSize: number;

    /** Cache hit rate (0-1) */
    cacheHitRate: number;

    /** Assets by type */
    assetsByType: Record<string, number>;

    /** Assets by state */
    assetsByState: Record<AssetState, number>;
}

/**
 * Asset dependency graph node
 */
export interface AssetDependencyNode {
    /** Asset ID */
    id: string;

    /** Direct dependencies */
    dependencies: string[];

    /** Assets that depend on this one */
    dependents: string[];
}

/**
 * Hot-reload event
 */
export interface HotReloadEvent {
    /** Asset ID that changed */
    assetId: string;

    /** Asset path */
    path: string;

    /** Old metadata */
    oldMetadata: AssetMetadata;

    /** New metadata */
    newMetadata: AssetMetadata;

    /** Timestamp of the change */
    timestamp: number;
}

/**
 * Asset error types
 */
export enum AssetErrorCode {
    NOT_FOUND = 'NOT_FOUND',
    LOAD_FAILED = 'LOAD_FAILED',
    INVALID_FORMAT = 'INVALID_FORMAT',
    TIMEOUT = 'TIMEOUT',
    UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
    DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
    CACHE_FULL = 'CACHE_FULL',
    ALREADY_LOADING = 'ALREADY_LOADING',
}

/**
 * Asset loading error
 */
export class AssetError extends Error {
    constructor(
        message: string,
        public readonly code: AssetErrorCode,
        public readonly assetId?: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'AssetError';
    }
}

/**
 * Asset batch loading options
 */
export interface BatchLoadOptions extends AssetLoadOptions {
    /** Continue loading on individual failures */
    continueOnError?: boolean;

    /** Load assets in parallel (default: true) */
    parallel?: boolean;

    /** Maximum concurrent loads */
    maxConcurrent?: number;
}

/**
 * Batch load result
 */
export interface BatchLoadResult<T = unknown> {
    /** Successfully loaded assets */
    readonly loaded: Map<string, AssetLoadResult<T>>;

    /** Failed asset loads */
    readonly failed: Map<string, AssetError>;

    /** Overall success (all loaded successfully) */
    readonly success: boolean;

    /** Total load duration */
    readonly duration: number;
}
