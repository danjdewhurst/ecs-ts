/**
 * Core serialization types and interfaces for the ECS engine.
 * Provides type-safe serialization of world state, entities, and components.
 */

/**
 * Serialization format version for compatibility checking
 */
export const SERIALIZATION_VERSION = '1.0.0';

/**
 * Represents a serialized world snapshot
 */
export interface WorldSnapshot {
    /** Version of the serialization format */
    version: string;

    /** Timestamp when snapshot was created */
    timestamp: number;

    /** Custom metadata for the snapshot */
    metadata: Record<string, unknown>;

    /** Serialized entity data */
    entities: EntitySnapshot[];

    /** Component type registry for validation */
    componentTypes: string[];

    /** Statistics about the snapshot */
    stats: SnapshotStats;
}

/**
 * Represents a single entity and its components
 */
export interface EntitySnapshot {
    /** Entity ID */
    id: number;

    /** Components attached to this entity */
    components: ComponentSnapshot[];

    /** Custom metadata for the entity */
    metadata?: Record<string, unknown>;
}

/**
 * Represents a single component instance
 */
export interface ComponentSnapshot {
    /** Component type identifier */
    type: string;

    /** Serialized component data */
    data: unknown;

    /** Component-specific metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Statistics about a snapshot
 */
export interface SnapshotStats {
    /** Total number of entities */
    entityCount: number;

    /** Total number of components */
    componentCount: number;

    /** Component counts by type */
    componentsByType: Record<string, number>;

    /** Estimated size in bytes */
    estimatedSize: number;
}

/**
 * Options for serialization operations
 */
export interface SerializationOptions {
    /** Filter to control what gets serialized */
    filter?: SerializationFilter;

    /** Include metadata in the snapshot */
    includeMetadata?: boolean;

    /** Validate data during serialization */
    validate?: boolean;

    /** Pretty-print JSON output */
    prettyPrint?: boolean;

    /** Compression level (0-9) for binary format */
    compressionLevel?: number;

    /** Custom metadata to include in snapshot */
    metadata?: Record<string, unknown>;
}

/**
 * Options for deserialization operations
 */
export interface DeserializationOptions {
    /** Validate version compatibility */
    validateVersion?: boolean;

    /** Merge with existing world state */
    merge?: boolean;

    /** Clear existing world state before loading */
    clearExisting?: boolean;

    /** Entity ID remapping strategy */
    remapEntityIds?: boolean;

    /** Entity ID offset for remapping */
    entityIdOffset?: number;

    /** Strict mode throws on any error */
    strict?: boolean;

    /** Component type validation */
    validateComponents?: boolean;
}

/**
 * Filter to control what gets serialized
 */
export interface SerializationFilter {
    /** Include only these entity IDs (if specified) */
    includeEntities?: number[];

    /** Exclude these entity IDs */
    excludeEntities?: number[];

    /** Include only these component types (if specified) */
    includeComponentTypes?: string[];

    /** Exclude these component types */
    excludeComponentTypes?: string[];

    /** Custom predicate function for entities */
    entityPredicate?: (entityId: number) => boolean;

    /** Custom predicate function for components */
    componentPredicate?: (entityId: number, componentType: string) => boolean;
}

/**
 * Result of a serialization operation
 */
export interface SerializationResult {
    /** Whether the operation was successful */
    success: boolean;

    /** The resulting snapshot (if successful) */
    snapshot?: WorldSnapshot;

    /** Error message (if failed) */
    error?: string;

    /** Warnings generated during serialization */
    warnings: string[];

    /** Duration of the operation in milliseconds */
    duration: number;
}

/**
 * Result of a deserialization operation
 */
export interface DeserializationResult {
    /** Whether the operation was successful */
    success: boolean;

    /** Number of entities loaded */
    entitiesLoaded: number;

    /** Number of components loaded */
    componentsLoaded: number;

    /** Entity ID mappings (old ID → new ID) */
    entityIdMappings: Map<number, number>;

    /** Error message (if failed) */
    error?: string;

    /** Warnings generated during deserialization */
    warnings: string[];

    /** Duration of the operation in milliseconds */
    duration: number;
}

/**
 * Serialization format interface
 */
export interface SerializationFormat {
    /** Format name */
    readonly name: string;

    /** Format file extension */
    readonly extension: string;

    /** MIME type for the format */
    readonly mimeType: string;

    /**
     * Serialize a snapshot to a buffer
     */
    serialize(
        snapshot: WorldSnapshot,
        options?: SerializationOptions
    ): Uint8Array;

    /**
     * Deserialize a buffer to a snapshot
     */
    deserialize(
        data: Uint8Array,
        options?: DeserializationOptions
    ): WorldSnapshot;

    /**
     * Estimate the size of a snapshot in this format
     */
    estimateSize(snapshot: WorldSnapshot): number;

    /**
     * Validate that data can be deserialized
     */
    validate(data: Uint8Array): boolean;
}

/**
 * Error thrown during serialization operations
 */
export class SerializationError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'SerializationError';
    }
}

/**
 * Error thrown during deserialization operations
 */
export class DeserializationError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'DeserializationError';
    }
}
