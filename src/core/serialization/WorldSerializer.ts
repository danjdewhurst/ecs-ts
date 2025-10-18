import type { Component } from '../ecs/Component.ts';
import type { World } from '../ecs/World.ts';
import { createEmptySnapshot } from './JSONFormat.ts';
import {
    type ComponentSnapshot,
    DeserializationError,
    type DeserializationOptions,
    type DeserializationResult,
    type EntitySnapshot,
    SERIALIZATION_VERSION,
    SerializationError,
    type SerializationFilter,
    type SerializationOptions,
    type SerializationResult,
    type WorldSnapshot,
} from './types.ts';

/**
 * WorldSerializer handles serialization and deserialization of World state.
 * Provides snapshot capabilities and filtering options.
 */
export class WorldSerializer {
    /**
     * Create a snapshot of the world state
     */
    createSnapshot(
        world: World,
        options?: SerializationOptions
    ): SerializationResult {
        const startTime = performance.now();
        const warnings: string[] = [];

        try {
            const filter = options?.filter;
            const snapshot = this.buildSnapshot(world, filter, warnings);

            // Add custom metadata
            if (options?.metadata) {
                snapshot.metadata = {
                    ...snapshot.metadata,
                    ...options.metadata,
                };
            }

            // Validate if requested
            if (options?.validate) {
                this.validateSnapshot(snapshot);
            }

            const duration = performance.now() - startTime;

            return {
                success: true,
                snapshot,
                warnings,
                duration,
            };
        } catch (error) {
            const duration = performance.now() - startTime;
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                warnings,
                duration,
            };
        }
    }

    /**
     * Load a snapshot into the world
     */
    loadSnapshot(
        world: World,
        snapshot: WorldSnapshot,
        options?: DeserializationOptions
    ): DeserializationResult {
        const startTime = performance.now();
        const warnings: string[] = [];
        const entityIdMappings = new Map<number, number>();

        try {
            // Validate version compatibility
            if (options?.validateVersion !== false) {
                this.validateVersionCompatibility(snapshot.version, warnings);
            }

            // Clear existing world if requested
            if (options?.clearExisting) {
                this.clearWorld(world);
            }

            // Load entities and components
            const { entitiesLoaded, componentsLoaded } = this.loadEntities(
                world,
                snapshot,
                entityIdMappings,
                options,
                warnings
            );

            const duration = performance.now() - startTime;

            return {
                success: true,
                entitiesLoaded,
                componentsLoaded,
                entityIdMappings,
                warnings,
                duration,
            };
        } catch (error) {
            const duration = performance.now() - startTime;
            return {
                success: false,
                entitiesLoaded: 0,
                componentsLoaded: 0,
                entityIdMappings,
                error: error instanceof Error ? error.message : String(error),
                warnings,
                duration,
            };
        }
    }

    /**
     * Build a snapshot from the world state
     */
    private buildSnapshot(
        world: World,
        filter: SerializationFilter | undefined,
        warnings: string[]
    ): WorldSnapshot {
        const snapshot = createEmptySnapshot();
        const componentTypes = world.getComponentTypes();

        // Collect all entities
        const allEntityIds = new Set<number>();
        for (const componentType of componentTypes) {
            const entities = world.query(componentType).getEntities();
            for (const entityId of entities) {
                allEntityIds.add(entityId);
            }
        }

        // Filter entities
        const filteredEntityIds = this.filterEntities(
            allEntityIds,
            filter,
            warnings
        );

        // Build entity snapshots
        for (const entityId of filteredEntityIds) {
            const entitySnapshot = this.buildEntitySnapshot(
                world,
                entityId,
                componentTypes,
                filter,
                warnings
            );

            if (entitySnapshot.components.length > 0) {
                snapshot.entities.push(entitySnapshot);
            }
        }

        // Update stats
        snapshot.componentTypes = componentTypes;
        snapshot.stats = this.calculateStats(snapshot);

        return snapshot;
    }

    /**
     * Build a snapshot for a single entity
     */
    private buildEntitySnapshot(
        world: World,
        entityId: number,
        componentTypes: string[],
        filter: SerializationFilter | undefined,
        warnings: string[]
    ): EntitySnapshot {
        const components: ComponentSnapshot[] = [];

        for (const componentType of componentTypes) {
            // Check filter
            if (!this.shouldIncludeComponent(entityId, componentType, filter)) {
                continue;
            }

            const component = world.getComponent(entityId, componentType);
            if (component) {
                try {
                    components.push({
                        type: componentType,
                        data: this.serializeComponent(component),
                    });
                } catch (error) {
                    warnings.push(
                        `Failed to serialize component ${componentType} for entity ${entityId}: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        }

        return {
            id: entityId,
            components,
        };
    }

    /**
     * Serialize a component to plain data
     */
    private serializeComponent(component: Component): unknown {
        // Components should be plain data objects
        // We create a copy to avoid references
        return JSON.parse(JSON.stringify(component));
    }

    /**
     * Filter entities based on filter criteria
     */
    private filterEntities(
        entityIds: Set<number>,
        filter: SerializationFilter | undefined,
        _warnings: string[]
    ): Set<number> {
        if (!filter) {
            return entityIds;
        }

        let filtered = new Set(entityIds);

        // Include filter
        if (filter.includeEntities) {
            const includeSet = new Set(filter.includeEntities);
            filtered = new Set(
                Array.from(filtered).filter((id) => includeSet.has(id))
            );
        }

        // Exclude filter
        if (filter.excludeEntities) {
            const excludeSet = new Set(filter.excludeEntities);
            filtered = new Set(
                Array.from(filtered).filter((id) => !excludeSet.has(id))
            );
        }

        // Predicate filter
        if (filter.entityPredicate) {
            filtered = new Set(
                Array.from(filtered).filter((id) => filter.entityPredicate!(id))
            );
        }

        return filtered;
    }

    /**
     * Check if a component should be included based on filter
     */
    private shouldIncludeComponent(
        entityId: number,
        componentType: string,
        filter: SerializationFilter | undefined
    ): boolean {
        if (!filter) {
            return true;
        }

        // Include component types filter
        if (
            filter.includeComponentTypes &&
            !filter.includeComponentTypes.includes(componentType)
        ) {
            return false;
        }

        // Exclude component types filter
        if (
            filter.excludeComponentTypes &&
            filter.excludeComponentTypes.includes(componentType)
        ) {
            return false;
        }

        // Component predicate filter
        if (
            filter.componentPredicate &&
            !filter.componentPredicate(entityId, componentType)
        ) {
            return false;
        }

        return true;
    }

    /**
     * Load entities from a snapshot into the world
     */
    private loadEntities(
        world: World,
        snapshot: WorldSnapshot,
        entityIdMappings: Map<number, number>,
        options: DeserializationOptions | undefined,
        warnings: string[]
    ): { entitiesLoaded: number; componentsLoaded: number } {
        let entitiesLoaded = 0;
        let componentsLoaded = 0;

        const remapIds = options?.remapEntityIds ?? true;
        const offset = options?.entityIdOffset ?? 0;
        const strict = options?.strict ?? false;

        for (const entitySnapshot of snapshot.entities) {
            try {
                // Create new entity or use existing ID
                const newEntityId = world.createEntity();

                // Track ID mapping
                if (remapIds) {
                    entityIdMappings.set(
                        entitySnapshot.id,
                        newEntityId + offset
                    );
                }

                // Load components
                for (const componentSnapshot of entitySnapshot.components) {
                    try {
                        // Validate component type if requested
                        if (
                            options?.validateComponents &&
                            !snapshot.componentTypes.includes(
                                componentSnapshot.type
                            )
                        ) {
                            warnings.push(
                                `Unknown component type: ${componentSnapshot.type}`
                            );
                            if (strict) {
                                throw new DeserializationError(
                                    `Unknown component type: ${componentSnapshot.type}`,
                                    'UNKNOWN_COMPONENT_TYPE',
                                    { type: componentSnapshot.type }
                                );
                            }
                            continue;
                        }

                        // Deserialize component data
                        const component =
                            this.deserializeComponent(componentSnapshot);

                        world.addComponent(newEntityId, component);
                        componentsLoaded++;
                    } catch (error) {
                        const message = `Failed to load component ${componentSnapshot.type} for entity ${entitySnapshot.id}: ${error instanceof Error ? error.message : String(error)}`;
                        warnings.push(message);
                        if (strict) {
                            throw error;
                        }
                    }
                }

                entitiesLoaded++;
            } catch (error) {
                const message = `Failed to load entity ${entitySnapshot.id}: ${error instanceof Error ? error.message : String(error)}`;
                warnings.push(message);
                if (strict) {
                    throw error;
                }
            }
        }

        return { entitiesLoaded, componentsLoaded };
    }

    /**
     * Deserialize a component from snapshot data
     */
    private deserializeComponent(snapshot: ComponentSnapshot): Component {
        if (typeof snapshot.data !== 'object' || snapshot.data === null) {
            throw new DeserializationError(
                'Component data must be an object',
                'INVALID_COMPONENT_DATA',
                { type: snapshot.type, data: snapshot.data }
            );
        }

        // Ensure component has type property
        return {
            ...(snapshot.data as object),
            type: snapshot.type,
        } as Component;
    }

    /**
     * Clear all entities and components from the world
     */
    private clearWorld(world: World): void {
        const componentTypes = world.getComponentTypes();
        const allEntityIds = new Set<number>();

        // Collect all entities
        for (const componentType of componentTypes) {
            const entities = world.query(componentType).getEntities();
            for (const entityId of entities) {
                allEntityIds.add(entityId);
            }
        }

        // Destroy all entities
        for (const entityId of allEntityIds) {
            world.destroyEntity(entityId);
        }
    }

    /**
     * Calculate statistics for a snapshot
     */
    private calculateStats(snapshot: WorldSnapshot): WorldSnapshot['stats'] {
        let componentCount = 0;
        const componentsByType: Record<string, number> = {};

        for (const entity of snapshot.entities) {
            for (const component of entity.components) {
                componentCount++;
                componentsByType[component.type] =
                    (componentsByType[component.type] ?? 0) + 1;
            }
        }

        // Estimate size
        const jsonString = JSON.stringify(snapshot);
        const estimatedSize = new TextEncoder().encode(jsonString).length;

        return {
            entityCount: snapshot.entities.length,
            componentCount,
            componentsByType,
            estimatedSize,
        };
    }

    /**
     * Validate snapshot structure and data
     */
    private validateSnapshot(snapshot: WorldSnapshot): void {
        if (snapshot.version !== SERIALIZATION_VERSION) {
            throw new SerializationError(
                `Invalid snapshot version: ${snapshot.version}`,
                'INVALID_VERSION',
                { version: snapshot.version }
            );
        }

        if (!Array.isArray(snapshot.entities)) {
            throw new SerializationError(
                'Snapshot entities must be an array',
                'INVALID_ENTITIES',
                { entities: snapshot.entities }
            );
        }

        // Validate each entity
        for (const entity of snapshot.entities) {
            if (typeof entity.id !== 'number') {
                throw new SerializationError(
                    'Entity ID must be a number',
                    'INVALID_ENTITY_ID',
                    { id: entity.id }
                );
            }

            if (!Array.isArray(entity.components)) {
                throw new SerializationError(
                    'Entity components must be an array',
                    'INVALID_ENTITY_COMPONENTS',
                    { entityId: entity.id }
                );
            }
        }
    }

    /**
     * Validate version compatibility
     */
    private validateVersionCompatibility(
        snapshotVersion: string,
        warnings: string[]
    ): void {
        const [snapshotMajor] = snapshotVersion.split('.').map(Number);
        const [currentMajor] = SERIALIZATION_VERSION.split('.').map(Number);

        if (snapshotMajor !== currentMajor) {
            throw new DeserializationError(
                `Incompatible snapshot version: ${snapshotVersion} (current: ${SERIALIZATION_VERSION})`,
                'VERSION_MISMATCH',
                {
                    snapshotVersion,
                    currentVersion: SERIALIZATION_VERSION,
                }
            );
        }

        if (snapshotVersion !== SERIALIZATION_VERSION) {
            warnings.push(
                `Snapshot version ${snapshotVersion} differs from current version ${SERIALIZATION_VERSION}`
            );
        }
    }
}
