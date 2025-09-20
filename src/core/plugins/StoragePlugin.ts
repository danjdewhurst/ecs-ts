import type { World } from '../ecs/World';
import type { Plugin } from './Plugin.ts';

/**
 * Interface for plugins that provide persistent storage functionality.
 * Extends the base Plugin interface with storage-specific methods.
 */
export interface StoragePlugin extends Plugin {
    /**
     * Save data to storage with the given key.
     *
     * @param key - Unique identifier for the data
     * @param data - The data to store (must be serializable)
     * @param options - Optional storage options
     * @returns Promise that resolves when the data is saved
     * @throws {Error} If the save operation fails
     */
    save(key: string, data: unknown, options?: StorageOptions): Promise<void>;

    /**
     * Load data from storage by key.
     *
     * @param key - Unique identifier for the data
     * @param options - Optional load options
     * @returns Promise that resolves to the stored data, or undefined if not found
     * @throws {Error} If the load operation fails
     */
    load<T = unknown>(
        key: string,
        options?: LoadOptions
    ): Promise<T | undefined>;

    /**
     * Delete data from storage by key.
     *
     * @param key - Unique identifier for the data to delete
     * @returns Promise that resolves to true if data was deleted, false if not found
     * @throws {Error} If the delete operation fails
     */
    delete(key: string): Promise<boolean>;

    /**
     * Check if data exists in storage.
     *
     * @param key - Unique identifier for the data
     * @returns Promise that resolves to true if data exists, false otherwise
     */
    exists(key: string): Promise<boolean>;

    /**
     * List all keys in storage, optionally with a prefix filter.
     *
     * @param prefix - Optional prefix to filter keys
     * @returns Promise that resolves to array of matching keys
     */
    listKeys(prefix?: string): Promise<string[]>;

    /**
     * Clear all data from storage.
     * Use with caution!
     *
     * @returns Promise that resolves when all data is cleared
     */
    clear(): Promise<void>;

    /**
     * Get metadata about stored data.
     *
     * @param key - Unique identifier for the data
     * @returns Promise that resolves to metadata if found, undefined otherwise
     */
    getMetadata(key: string): Promise<StorageMetadata | undefined>;

    /**
     * Save data in a transaction (atomic operation).
     * All operations succeed or all fail.
     *
     * @param operations - Array of storage operations to perform atomically
     * @returns Promise that resolves when transaction completes
     * @throws {Error} If any operation in the transaction fails
     */
    transaction(operations: StorageOperation[]): Promise<void>;

    /**
     * Get storage statistics and health information.
     *
     * @returns Promise that resolves to storage statistics
     */
    getStats(): Promise<StorageStats>;
}

/**
 * Options for save operations.
 */
export interface StorageOptions {
    /** Time-to-live in milliseconds (for cache-based storage) */
    ttl?: number;

    /** Compression level (0-9, if supported by the storage backend) */
    compression?: number;

    /** Whether to encrypt the data (if supported) */
    encrypt?: boolean;

    /** Custom metadata to associate with the stored data */
    metadata?: Record<string, unknown>;

    /** Whether to overwrite existing data (default: true) */
    overwrite?: boolean;
}

/**
 * Options for load operations.
 */
export interface LoadOptions {
    /** Whether to decrypt the data (if encrypted) */
    decrypt?: boolean;

    /** Default value to return if key is not found */
    defaultValue?: unknown;

    /** Whether to update last accessed time */
    updateAccessTime?: boolean;
}

/**
 * Metadata about stored data.
 */
export interface StorageMetadata {
    /** Size of the stored data in bytes */
    size: number;

    /** When the data was created */
    createdAt: number;

    /** When the data was last modified */
    modifiedAt: number;

    /** When the data was last accessed */
    lastAccessedAt?: number;

    /** TTL expiration time, if applicable */
    expiresAt?: number;

    /** Whether the data is compressed */
    compressed: boolean;

    /** Whether the data is encrypted */
    encrypted: boolean;

    /** Custom metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Storage operation for transactions.
 */
export interface StorageOperation {
    type: 'save' | 'delete';
    key: string;
    data?: unknown;
    options?: StorageOptions;
}

/**
 * Storage statistics and health information.
 */
export interface StorageStats {
    /** Total number of items stored */
    itemCount: number;

    /** Total storage size in bytes */
    totalSize: number;

    /** Available storage space in bytes (if applicable) */
    availableSpace?: number;

    /** Storage backend type */
    backendType: string;

    /** Whether the storage is healthy and accessible */
    isHealthy: boolean;

    /** Last error message, if any */
    lastError?: string;

    /** Performance metrics */
    performance: {
        /** Average read time in milliseconds */
        avgReadTime: number;
        /** Average write time in milliseconds */
        avgWriteTime: number;
        /** Number of operations performed */
        operationCount: number;
    };
}

/**
 * Configuration options for storage plugins.
 */
export interface StoragePluginConfig {
    /** Storage backend type */
    backend: 'memory' | 'file' | 'sqlite' | 'redis' | 'custom';

    /** Connection string or file path */
    connectionString?: string;

    /** Maximum storage size in bytes */
    maxSize?: number;

    /** Default TTL for stored items in milliseconds */
    defaultTtl?: number;

    /** Enable compression by default */
    enableCompression?: boolean;

    /** Enable encryption by default */
    enableEncryption?: boolean;

    /** Encryption key for data encryption */
    encryptionKey?: string;

    /** Auto-cleanup interval in milliseconds */
    cleanupInterval?: number;

    /** Connection pool size (for database backends) */
    poolSize?: number;
}

/**
 * Base implementation helper for storage plugins.
 * Provides common functionality that storage plugins can extend.
 */
export abstract class BaseStoragePlugin implements StoragePlugin {
    abstract readonly name: string;
    abstract readonly version: string;
    readonly dependencies?: string[];

    protected config: Required<Omit<StoragePluginConfig, 'encryptionKey'>> & {
        encryptionKey?: string;
    };

    constructor(config: StoragePluginConfig) {
        this.config = {
            backend: config.backend,
            connectionString: config.connectionString ?? '',
            maxSize: config.maxSize ?? 1024 * 1024 * 100, // 100MB default
            defaultTtl: config.defaultTtl ?? 0, // No expiration by default
            enableCompression: config.enableCompression ?? false,
            enableEncryption: config.enableEncryption ?? false,
            encryptionKey: config.encryptionKey,
            cleanupInterval: config.cleanupInterval ?? 3600000, // 1 hour
            poolSize: config.poolSize ?? 10,
        };
    }

    abstract initialize(world: World): Promise<void>;
    shutdown?(): Promise<void> {
        // Default empty implementation
        return Promise.resolve();
    }

    // Storage plugin methods to be implemented by concrete classes
    abstract save(
        key: string,
        data: unknown,
        options?: StorageOptions
    ): Promise<void>;
    abstract load<T = unknown>(
        key: string,
        options?: LoadOptions
    ): Promise<T | undefined>;
    abstract delete(key: string): Promise<boolean>;
    abstract exists(key: string): Promise<boolean>;
    abstract listKeys(prefix?: string): Promise<string[]>;
    abstract clear(): Promise<void>;
    abstract getMetadata(key: string): Promise<StorageMetadata | undefined>;
    abstract transaction(operations: StorageOperation[]): Promise<void>;
    abstract getStats(): Promise<StorageStats>;

    /**
     * Utility method to validate keys.
     */
    protected validateKey(key: string): void {
        if (!key || typeof key !== 'string') {
            throw new Error('Key must be a non-empty string');
        }

        if (key.length > 250) {
            throw new Error('Key must be 250 characters or less');
        }

        if (!/^[a-zA-Z0-9_.:/-]+$/.test(key)) {
            throw new Error(
                'Key can only contain alphanumeric characters, underscores, dots, hyphens, colons, slashes, and forward slashes'
            );
        }
    }

    /**
     * Utility method to serialize data for storage.
     */
    protected serialize(data: unknown): string {
        try {
            return JSON.stringify(data);
        } catch (error) {
            throw new Error(
                `Failed to serialize data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Utility method to deserialize data from storage.
     */
    protected deserialize<T>(data: string): T {
        try {
            return JSON.parse(data) as T;
        } catch (error) {
            throw new Error(
                `Failed to deserialize data: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
