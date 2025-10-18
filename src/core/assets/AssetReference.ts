/**
 * AssetReference - provides reference counting for automatic asset lifecycle management
 */

import type { Asset } from './Asset.ts';
import type { AssetState, AssetReference as IAssetReference } from './types.ts';

/**
 * Reference-counted wrapper for assets
 * Automatically manages asset lifecycle based on usage
 */
export class AssetReference<T = unknown> implements IAssetReference<T> {
    private _refCount = 0;
    private readonly _asset: Asset<T>;
    private readonly _onRelease?: (ref: AssetReference<T>) => void;

    constructor(asset: Asset<T>, onRelease?: (ref: AssetReference<T>) => void) {
        this._asset = asset;
        this._onRelease = onRelease;
    }

    /**
     * Get the asset ID
     */
    get id(): string {
        return this._asset.id;
    }

    /**
     * Get the current reference count
     */
    get refCount(): number {
        return this._refCount;
    }

    /**
     * Get the underlying asset
     * @internal
     */
    get asset(): Asset<T> {
        return this._asset;
    }

    /**
     * Get the asset data (undefined if not loaded)
     */
    get(): T | undefined {
        return this._asset.data;
    }

    /**
     * Check if the asset is loaded
     */
    isLoaded(): boolean {
        return this._asset.isLoaded();
    }

    /**
     * Get the current asset state
     */
    getState(): AssetState {
        return this._asset.state;
    }

    /**
     * Increment the reference count
     * Call this when starting to use an asset
     */
    acquire(): void {
        this._refCount++;
    }

    /**
     * Decrement the reference count
     * Call this when done using an asset
     * Triggers cleanup callback when count reaches 0
     */
    release(): void {
        if (this._refCount > 0) {
            this._refCount--;

            if (this._refCount === 0 && this._onRelease) {
                this._onRelease(this);
            }
        }
    }

    /**
     * Force reference count to zero and trigger cleanup
     */
    forceRelease(): void {
        this._refCount = 0;
        if (this._onRelease) {
            this._onRelease(this);
        }
    }

    /**
     * Check if this reference is still in use
     */
    isInUse(): boolean {
        return this._refCount > 0;
    }

    /**
     * Get a JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            refCount: this.refCount,
            state: this.getState(),
            isLoaded: this.isLoaded(),
        };
    }
}

/**
 * Create a scoped asset reference that automatically releases on cleanup
 * Useful with try/finally or async contexts
 */
export class ScopedAssetReference<T = unknown> {
    private _reference: AssetReference<T>;
    private _released = false;

    constructor(reference: AssetReference<T>) {
        this._reference = reference;
        this._reference.acquire();
    }

    /**
     * Get the asset data
     */
    get(): T | undefined {
        return this._reference.get();
    }

    /**
     * Get the underlying reference
     */
    getReference(): AssetReference<T> {
        return this._reference;
    }

    /**
     * Release the reference (automatically called by dispose)
     */
    release(): void {
        if (!this._released) {
            this._reference.release();
            this._released = true;
        }
    }

    /**
     * Dispose of the scoped reference
     */
    dispose(): void {
        this.release();
    }

    /**
     * Symbol.dispose support for explicit resource management
     */
    [Symbol.dispose](): void {
        this.release();
    }
}
