/**
 * Serialization module for ECS Game Engine
 *
 * Provides comprehensive serialization and deserialization capabilities for World state,
 * including multiple formats (JSON, Binary), filtering, and versioning support.
 *
 * @example
 * ```typescript
 * import { World } from '../ecs/World';
 * import { WorldSerializer, JSONFormat, BinaryFormat } from './serialization';
 *
 * const world = new World();
 * const serializer = new WorldSerializer();
 *
 * // Create a snapshot
 * const result = serializer.createSnapshot(world);
 * if (result.success && result.snapshot) {
 *   // Serialize to JSON
 *   const jsonFormat = new JSONFormat();
 *   const data = jsonFormat.serialize(result.snapshot, { prettyPrint: true });
 *
 *   // Save to file
 *   await Bun.write('save.json', data);
 * }
 *
 * // Load snapshot
 * const data = await Bun.file('save.json').arrayBuffer();
 * const snapshot = jsonFormat.deserialize(new Uint8Array(data));
 * const loadResult = serializer.loadSnapshot(world, snapshot);
 * ```
 */

export { BinaryFormat } from './BinaryFormat.ts';

// Serialization formats
export {
    createEmptySnapshot,
    isVersionCompatible,
    JSONFormat,
} from './JSONFormat.ts';
// Core serialization types
export {
    type ComponentSnapshot,
    DeserializationError,
    type DeserializationOptions,
    type DeserializationResult,
    type EntitySnapshot,
    SERIALIZATION_VERSION,
    SerializationError,
    type SerializationFilter,
    type SerializationFormat,
    type SerializationOptions,
    type SerializationResult,
    type SnapshotStats,
    type WorldSnapshot,
} from './types.ts';

// World serializer
export { WorldSerializer } from './WorldSerializer.ts';
