/**
 * ObjectPool provides memory optimization for frequently created and destroyed objects.
 * It reduces garbage collection pressure by reusing objects rather than creating new ones.
 */
export class ObjectPool<T> {
    private available: T[] = [];
    private createFn: () => T;
    private resetFn: (obj: T) => void;
    private maxSize: number;
    private totalCreated: number = 0;
    private totalAcquired: number = 0;
    private totalReleased: number = 0;
    private poolHits: number = 0;
    private objectsInUse: number = 0;

    /**
     * Create a new ObjectPool.
     * @param createFn - Function that creates new instances of T
     * @param resetFn - Function that resets an object to its initial state
     * @param initialSize - Initial number of objects to create in the pool
     * @param maxSize - Maximum number of objects to keep in the pool
     */
    constructor(
        createFn: () => T,
        resetFn: (obj: T) => void,
        initialSize: number = 10,
        maxSize: number = 100
    ) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;

        // Pre-populate the pool with initial objects
        for (let i = 0; i < initialSize; i++) {
            const obj = createFn();
            this.available.push(obj);
            this.totalCreated++;
        }
    }

    /**
     * Acquire an object from the pool. If none are available, creates a new one.
     * @returns An object ready for use
     */
    acquire(): T {
        this.totalAcquired++;
        this.objectsInUse++;

        if (this.available.length > 0) {
            this.poolHits++;
            const obj = this.available.pop();
            if (obj) return obj;
        }

        // No objects available, create a new one
        this.totalCreated++;
        return this.createFn();
    }

    /**
     * Release an object back to the pool. The object will be reset and made available for reuse.
     * @param obj - The object to return to the pool
     */
    release(obj: T): void {
        this.totalReleased++;
        this.objectsInUse--;

        // Reset the object to its initial state
        this.resetFn(obj);

        // Only add to pool if we haven't exceeded max size
        if (this.available.length < this.maxSize) {
            this.available.push(obj);
        }
        // If we're at max size, let the object be garbage collected
    }

    /**
     * Get the current number of available objects in the pool.
     * @returns Number of objects ready for acquisition
     */
    getAvailableCount(): number {
        return this.available.length;
    }

    /**
     * Get the maximum size of the pool.
     * @returns Maximum number of objects that can be stored in the pool
     */
    getMaxSize(): number {
        return this.maxSize;
    }

    /**
     * Set a new maximum size for the pool. If the current size exceeds the new max,
     * excess objects will be removed.
     * @param newMaxSize - The new maximum size
     */
    setMaxSize(newMaxSize: number): void {
        this.maxSize = newMaxSize;

        // Remove excess objects if we're over the new limit
        while (this.available.length > newMaxSize) {
            this.available.pop();
        }
    }

    /**
     * Clear all objects from the pool, allowing them to be garbage collected.
     */
    clear(): void {
        this.available.length = 0;
        this.objectsInUse = 0;
    }

    /**
     * Warm up the pool by pre-creating objects up to the specified count.
     * @param count - Number of objects to pre-create
     */
    warmUp(count: number): void {
        const targetSize = Math.min(count, this.maxSize);
        const toCreate = targetSize - this.available.length;

        for (let i = 0; i < toCreate; i++) {
            const obj = this.createFn();
            this.resetFn(obj);
            this.available.push(obj);
            this.totalCreated++;
        }
    }

    /**
     * Get performance statistics for the pool.
     * @returns Object containing pool performance metrics
     */
    getStats(): {
        availableObjects: number;
        maxSize: number;
        totalCreated: number;
        totalAcquired: number;
        totalReleased: number;
        hitRate: number;
        utilizationRate: number;
    } {
        const hitRate =
            this.totalAcquired > 0 ? this.poolHits / this.totalAcquired : 0;

        const utilizationRate =
            this.maxSize > 0 ? this.objectsInUse / this.maxSize : 0;

        return {
            availableObjects: this.available.length,
            maxSize: this.maxSize,
            totalCreated: this.totalCreated,
            totalAcquired: this.totalAcquired,
            totalReleased: this.totalReleased,
            hitRate: Math.max(0, hitRate), // Ensure non-negative
            utilizationRate: Math.max(0, Math.min(1, utilizationRate)), // Clamp between 0 and 1
        };
    }

    /**
     * Check if the pool is performing optimally.
     * @returns True if the pool has good hit rate and utilization
     */
    isPerformingWell(): boolean {
        const stats = this.getStats();

        // If no acquisitions have happened yet, consider it performing well
        if (stats.totalAcquired === 0) {
            return true;
        }

        // Consider pool performing well if hit rate > 50% and utilization < 90%
        return stats.hitRate > 0.5 && stats.utilizationRate < 0.9;
    }
}
