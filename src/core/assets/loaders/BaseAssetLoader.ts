/**
 * Base asset loader implementation with common functionality
 */

import type { AssetLoader, AssetLoadOptions } from '../types.ts';
import { AssetError, AssetErrorCode } from '../types.ts';

/**
 * Abstract base class for asset loaders
 */
export abstract class BaseAssetLoader<T> implements AssetLoader<T> {
    abstract readonly supportedTypes: string[];

    /**
     * Load an asset from a path
     */
    abstract load(path: string, options?: AssetLoadOptions): Promise<T>;

    /**
     * Check if this loader can handle a given path/type
     */
    canLoad(path: string, type?: string): boolean {
        // Check by file extension
        const extension = this.getExtension(path);
        if (extension && this.supportedTypes.includes(extension)) {
            return true;
        }

        // Check by explicit type
        if (type && this.supportedTypes.includes(type)) {
            return true;
        }

        return false;
    }

    /**
     * Validate loaded asset data (optional - override in subclasses)
     */
    validate?(data: T): boolean;

    /**
     * Unload/cleanup asset data (optional - override in subclasses)
     */
    unload?(data: T): void | Promise<void>;

    /**
     * Get file extension from path
     */
    protected getExtension(path: string): string {
        const lastDot = path.lastIndexOf('.');
        if (lastDot === -1) return '';
        return path.slice(lastDot + 1).toLowerCase();
    }

    /**
     * Load a file with timeout support
     */
    protected async loadWithTimeout<R>(
        loader: () => Promise<R>,
        timeout?: number
    ): Promise<R> {
        if (!timeout) {
            return loader();
        }

        return Promise.race([
            loader(),
            new Promise<R>((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            new AssetError(
                                `Load timeout after ${timeout}ms`,
                                AssetErrorCode.TIMEOUT
                            )
                        ),
                    timeout
                )
            ),
        ]);
    }

    /**
     * Retry a load operation
     */
    protected async loadWithRetry<R>(
        loader: () => Promise<R>,
        retries = 0
    ): Promise<R> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await loader();
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));
                if (attempt < retries) {
                    // Exponential backoff
                    await new Promise((resolve) =>
                        setTimeout(resolve, 2 ** attempt * 100)
                    );
                }
            }
        }

        throw lastError;
    }
}
