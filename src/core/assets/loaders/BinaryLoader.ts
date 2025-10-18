/**
 * Binary file loader for loading binary assets
 */

import type { AssetLoadOptions } from '../types.ts';
import { AssetError, AssetErrorCode } from '../types.ts';
import { BaseAssetLoader } from './BaseAssetLoader.ts';

/**
 * Loader for binary assets (images, audio, etc.)
 */
export class BinaryLoader extends BaseAssetLoader<ArrayBuffer> {
    readonly supportedTypes = [
        'bin',
        'dat',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'mp3',
        'wav',
        'ogg',
        'mp4',
        'webm',
    ];

    async load(path: string, options?: AssetLoadOptions): Promise<ArrayBuffer> {
        return this.loadWithTimeout(
            async () =>
                this.loadWithRetry(
                    async () => this.loadBinary(path),
                    options?.retries
                ),
            options?.timeout
        );
    }

    private async loadBinary(path: string): Promise<ArrayBuffer> {
        try {
            const file = Bun.file(path);
            const exists = await file.exists();

            if (!exists) {
                throw new AssetError(
                    `File not found: ${path}`,
                    AssetErrorCode.NOT_FOUND
                );
            }

            return await file.arrayBuffer();
        } catch (error) {
            if (error instanceof AssetError) {
                throw error;
            }
            throw new AssetError(
                `Failed to load binary file: ${error instanceof Error ? error.message : String(error)}`,
                AssetErrorCode.LOAD_FAILED,
                undefined,
                error
            );
        }
    }

    override validate(data: ArrayBuffer): boolean {
        return data instanceof ArrayBuffer && data.byteLength > 0;
    }
}
