/**
 * DirtyTracker manages component change detection for performance optimization.
 * It tracks which entities have been modified, allowing systems to process only
 * changed entities rather than iterating over all entities.
 */
export class DirtyTracker {
    private dirtyComponents = new Map<string, Set<number>>();
    private dirtyEntities = new Set<number>();

    constructor() {
        // Field initializers are already defined above
        // Constructor explicitly defined for test coverage
    }

    /**
     * Mark an entity's component as dirty (modified).
     * @param entityId - The entity that was modified
     * @param componentType - The type of component that was modified
     */
    markDirty(entityId: number, componentType: string): void {
        if (!this.dirtyComponents.has(componentType)) {
            this.dirtyComponents.set(componentType, new Set());
        }
        this.dirtyComponents.get(componentType)?.add(entityId);
        this.dirtyEntities.add(entityId);
    }

    /**
     * Get all dirty entities for a specific component type.
     * @param componentType - The component type to check
     * @returns Set of entity IDs that have dirty components of this type
     */
    getDirtyEntities(componentType: string): Set<number> {
        const dirtySet = this.dirtyComponents.get(componentType);
        return dirtySet ? new Set(dirtySet) : new Set();
    }

    /**
     * Get all dirty entities regardless of component type.
     * @returns Set of all entity IDs that have any dirty components
     */
    getAllDirtyEntities(): Set<number> {
        return new Set(this.dirtyEntities);
    }

    /**
     * Check if a specific entity is dirty.
     * @param entityId - The entity to check
     * @returns True if the entity has any dirty components
     */
    isEntityDirty(entityId: number): boolean {
        return this.dirtyEntities.has(entityId);
    }

    /**
     * Check if a specific entity has a dirty component of the given type.
     * @param entityId - The entity to check
     * @param componentType - The component type to check
     * @returns True if the entity has a dirty component of this type
     */
    isComponentDirty(entityId: number, componentType: string): boolean {
        const dirtySet = this.dirtyComponents.get(componentType);
        return dirtySet ? dirtySet.has(entityId) : false;
    }

    /**
     * Clear all dirty tracking state. Should be called after processing dirty entities.
     */
    clearDirty(): void {
        this.dirtyComponents.clear();
        this.dirtyEntities.clear();
    }

    /**
     * Clear dirty state for a specific component type only.
     * @param componentType - The component type to clear
     */
    clearDirtyComponent(componentType: string): void {
        const dirtySet = this.dirtyComponents.get(componentType);
        if (dirtySet) {
            for (const entityId of dirtySet) {
                // Only remove from global dirty set if no other components are dirty
                let hasOtherDirtyComponents = false;
                for (const [type, entities] of this.dirtyComponents) {
                    if (type !== componentType && entities.has(entityId)) {
                        hasOtherDirtyComponents = true;
                        break;
                    }
                }
                if (!hasOtherDirtyComponents) {
                    this.dirtyEntities.delete(entityId);
                }
            }
            this.dirtyComponents.delete(componentType);
        }
    }

    /**
     * Clear dirty state for a specific entity.
     * @param entityId - The entity to clear
     */
    clearDirtyEntity(entityId: number): void {
        this.dirtyEntities.delete(entityId);
        for (const dirtySet of this.dirtyComponents.values()) {
            dirtySet.delete(entityId);
        }
    }

    /**
     * Get statistics about the current dirty state.
     * @returns Object containing dirty tracking statistics
     */
    getStats(): {
        totalDirtyEntities: number;
        dirtyComponentTypes: number;
        averageDirtyPerType: number;
    } {
        const totalDirtyEntities = this.dirtyEntities.size;
        const dirtyComponentTypes = this.dirtyComponents.size;
        const totalDirtyComponents = Array.from(
            this.dirtyComponents.values()
        ).reduce((sum, set) => sum + set.size, 0);

        return {
            totalDirtyEntities,
            dirtyComponentTypes,
            averageDirtyPerType:
                dirtyComponentTypes > 0
                    ? totalDirtyComponents / dirtyComponentTypes
                    : 0,
        };
    }
}
