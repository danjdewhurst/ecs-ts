/**
 * JSON file loader for loading JSON-based assets
 */

import type { AssetLoadOptions } from '../types.ts';
import { AssetError, AssetErrorCode } from '../types.ts';
import { BaseAssetLoader } from './BaseAssetLoader.ts';

/**
 * Loader for JSON assets
 */
export class JSONLoader<T = unknown> extends BaseAssetLoader<T> {
    readonly supportedTypes = ['json'];

    async load(path: string, options?: AssetLoadOptions): Promise<T> {
        return this.loadWithTimeout(
            async () =>
                this.loadWithRetry(
                    async () => this.loadJSON(path),
                    options?.retries
                ),
            options?.timeout
        );
    }

    private async loadJSON(path: string): Promise<T> {
        try {
            const file = Bun.file(path);
            const exists = await file.exists();

            if (!exists) {
                throw new AssetError(
                    `File not found: ${path}`,
                    AssetErrorCode.NOT_FOUND
                );
            }

            const data = await file.json();
            return data as T;
        } catch (error) {
            if (error instanceof AssetError) {
                throw error;
            }

            // Check if it's a JSON parse error
            if (error instanceof SyntaxError) {
                throw new AssetError(
                    `Invalid JSON format: ${error.message}`,
                    AssetErrorCode.INVALID_FORMAT,
                    undefined,
                    error
                );
            }

            throw new AssetError(
                `Failed to load JSON file: ${error instanceof Error ? error.message : String(error)}`,
                AssetErrorCode.LOAD_FAILED,
                undefined,
                error
            );
        }
    }

    override validate(data: T): boolean {
        return data !== null && data !== undefined;
    }
}
