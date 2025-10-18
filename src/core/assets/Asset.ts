/**
 * Asset class - represents a loaded asset with metadata and lifecycle management
 */

import type { AssetMetadata, AssetState } from './types.ts';
import { AssetState as State } from './types.ts';

/**
 * Generic asset wrapper with metadata and state management
 */
export class Asset<T = unknown> {
    private _state: AssetState = State.PENDING;
    private _data: T | undefined;
    private _metadata: AssetMetadata;
    private _error: string | undefined;
    private _loadStartTime = 0;
    private _loadEndTime = 0;

    constructor(metadata: AssetMetadata) {
        this._metadata = { ...metadata };
    }

    /**
     * Get the asset ID
     */
    get id(): string {
        return this._metadata.id;
    }

    /**
     * Get the asset path
     */
    get path(): string {
        return this._metadata.path;
    }

    /**
     * Get the asset type
     */
    get type(): string {
        return this._metadata.type;
    }

    /**
     * Get the current state
     */
    get state(): AssetState {
        return this._state;
    }

    /**
     * Get the asset metadata
     */
    get metadata(): Readonly<AssetMetadata> {
        return this._metadata;
    }

    /**
     * Get the asset data (undefined if not loaded)
     */
    get data(): T | undefined {
        return this._data;
    }

    /**
     * Get the error message (if failed)
     */
    get error(): string | undefined {
        return this._error;
    }

    /**
     * Get load duration in milliseconds
     */
    get loadDuration(): number {
        if (this._loadStartTime === 0) return 0;
        const endTime = this._loadEndTime || Date.now();
        return endTime - this._loadStartTime;
    }

    /**
     * Check if asset is loaded
     */
    isLoaded(): boolean {
        return this._state === State.LOADED;
    }

    /**
     * Check if asset is loading
     */
    isLoading(): boolean {
        return this._state === State.LOADING || this._state === State.RELOADING;
    }

    /**
     * Check if asset failed to load
     */
    isFailed(): boolean {
        return this._state === State.FAILED;
    }

    /**
     * Check if asset is pending
     */
    isPending(): boolean {
        return this._state === State.PENDING;
    }

    /**
     * Mark asset as loading
     * @internal
     */
    markLoading(reloading = false): void {
        this._state = reloading ? State.RELOADING : State.LOADING;
        this._loadStartTime = Date.now();
        this._loadEndTime = 0;
        this._error = undefined;
    }

    /**
     * Mark asset as loaded with data
     * @internal
     */
    markLoaded(data: T, metadata?: Partial<AssetMetadata>): void {
        this._state = State.LOADED;
        this._data = data;
        this._loadEndTime = Date.now();
        this._error = undefined;

        if (metadata) {
            this._metadata = { ...this._metadata, ...metadata };
        }
    }

    /**
     * Mark asset as failed
     * @internal
     */
    markFailed(error: string): void {
        this._state = State.FAILED;
        this._data = undefined;
        this._loadEndTime = Date.now();
        this._error = error;
    }

    /**
     * Mark asset as unloaded
     * @internal
     */
    markUnloaded(): void {
        this._state = State.UNLOADED;
        this._data = undefined;
        this._error = undefined;
    }

    /**
     * Update asset metadata
     * @internal
     */
    updateMetadata(metadata: Partial<AssetMetadata>): void {
        this._metadata = { ...this._metadata, ...metadata };
    }

    /**
     * Get a JSON representation of the asset (without data)
     */
    toJSON(): object {
        return {
            id: this.id,
            path: this.path,
            type: this.type,
            state: this.state,
            metadata: this.metadata,
            error: this.error,
            loadDuration: this.loadDuration,
        };
    }
}
