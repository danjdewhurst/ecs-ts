/**
 * Text file loader for loading plain text and text-based formats
 */

import type { AssetLoadOptions } from '../types.ts';
import { AssetError, AssetErrorCode } from '../types.ts';
import { BaseAssetLoader } from './BaseAssetLoader.ts';

/**
 * Loader for text-based assets
 */
export class TextLoader extends BaseAssetLoader<string> {
    readonly supportedTypes = ['txt', 'text', 'md', 'csv', 'log'];

    async load(path: string, options?: AssetLoadOptions): Promise<string> {
        return this.loadWithTimeout(
            async () =>
                this.loadWithRetry(
                    async () => this.loadText(path),
                    options?.retries
                ),
            options?.timeout
        );
    }

    private async loadText(path: string): Promise<string> {
        try {
            const file = Bun.file(path);
            const exists = await file.exists();

            if (!exists) {
                throw new AssetError(
                    `File not found: ${path}`,
                    AssetErrorCode.NOT_FOUND
                );
            }

            return await file.text();
        } catch (error) {
            if (error instanceof AssetError) {
                throw error;
            }
            throw new AssetError(
                `Failed to load text file: ${error instanceof Error ? error.message : String(error)}`,
                AssetErrorCode.LOAD_FAILED,
                undefined,
                error
            );
        }
    }

    override validate(data: string): boolean {
        return typeof data === 'string';
    }
}
