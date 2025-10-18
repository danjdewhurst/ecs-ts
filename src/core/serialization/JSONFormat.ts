import {
    DeserializationError,
    type DeserializationOptions,
    SERIALIZATION_VERSION,
    SerializationError,
    type SerializationFormat,
    type SerializationOptions,
    type WorldSnapshot,
} from './types.ts';

/**
 * JSON serialization format for human-readable world snapshots.
 * Provides easy debugging and manual editing capabilities.
 */
export class JSONFormat implements SerializationFormat {
    readonly name = 'JSON';
    readonly extension = '.json';
    readonly mimeType = 'application/json';

    serialize(
        snapshot: WorldSnapshot,
        options?: SerializationOptions
    ): Uint8Array {
        try {
            const jsonString = options?.prettyPrint
                ? JSON.stringify(snapshot, null, 2)
                : JSON.stringify(snapshot);

            return new TextEncoder().encode(jsonString);
        } catch (error) {
            throw new SerializationError(
                'Failed to serialize snapshot to JSON',
                'JSON_SERIALIZE_ERROR',
                error
            );
        }
    }

    deserialize(
        data: Uint8Array,
        _options?: DeserializationOptions
    ): WorldSnapshot {
        try {
            const jsonString = new TextDecoder().decode(data);
            const snapshot = JSON.parse(jsonString) as WorldSnapshot;

            // Validate snapshot structure
            this.validateSnapshot(snapshot);

            return snapshot;
        } catch (error) {
            if (error instanceof DeserializationError) {
                throw error;
            }
            throw new DeserializationError(
                'Failed to deserialize JSON data',
                'JSON_DESERIALIZE_ERROR',
                error
            );
        }
    }

    estimateSize(snapshot: WorldSnapshot): number {
        // Estimate based on JSON string length
        const jsonString = JSON.stringify(snapshot);
        return new TextEncoder().encode(jsonString).length;
    }

    validate(data: Uint8Array): boolean {
        try {
            const jsonString = new TextDecoder().decode(data);
            const parsed = JSON.parse(jsonString);

            return (
                typeof parsed === 'object' &&
                parsed !== null &&
                'version' in parsed &&
                'entities' in parsed &&
                Array.isArray(parsed.entities)
            );
        } catch {
            return false;
        }
    }

    private validateSnapshot(
        snapshot: unknown
    ): asserts snapshot is WorldSnapshot {
        if (typeof snapshot !== 'object' || snapshot === null) {
            throw new DeserializationError(
                'Invalid snapshot: must be an object',
                'INVALID_SNAPSHOT_TYPE',
                { received: typeof snapshot }
            );
        }

        const s = snapshot as Partial<WorldSnapshot>;

        if (typeof s.version !== 'string') {
            throw new DeserializationError(
                'Invalid snapshot: missing or invalid version',
                'INVALID_VERSION',
                { version: s.version }
            );
        }

        if (!Array.isArray(s.entities)) {
            throw new DeserializationError(
                'Invalid snapshot: entities must be an array',
                'INVALID_ENTITIES',
                { entities: s.entities }
            );
        }

        if (typeof s.timestamp !== 'number') {
            throw new DeserializationError(
                'Invalid snapshot: timestamp must be a number',
                'INVALID_TIMESTAMP',
                { timestamp: s.timestamp }
            );
        }

        // Validate entities structure
        for (const entity of s.entities) {
            this.validateEntitySnapshot(entity);
        }
    }

    private validateEntitySnapshot(entity: unknown): void {
        if (typeof entity !== 'object' || entity === null) {
            throw new DeserializationError(
                'Invalid entity snapshot: must be an object',
                'INVALID_ENTITY_TYPE',
                { entity }
            );
        }

        const e = entity as { id?: unknown; components?: unknown };

        if (typeof e.id !== 'number') {
            throw new DeserializationError(
                'Invalid entity snapshot: id must be a number',
                'INVALID_ENTITY_ID',
                { id: e.id }
            );
        }

        if (!Array.isArray(e.components)) {
            throw new DeserializationError(
                'Invalid entity snapshot: components must be an array',
                'INVALID_COMPONENTS',
                { components: e.components }
            );
        }

        // Validate components structure
        for (const component of e.components) {
            this.validateComponentSnapshot(component);
        }
    }

    private validateComponentSnapshot(component: unknown): void {
        if (typeof component !== 'object' || component === null) {
            throw new DeserializationError(
                'Invalid component snapshot: must be an object',
                'INVALID_COMPONENT_TYPE',
                { component }
            );
        }

        const c = component as { type?: unknown; data?: unknown };

        if (typeof c.type !== 'string') {
            throw new DeserializationError(
                'Invalid component snapshot: type must be a string',
                'INVALID_COMPONENT_TYPE_FIELD',
                { type: c.type }
            );
        }

        if (c.data === undefined) {
            throw new DeserializationError(
                'Invalid component snapshot: data is required',
                'MISSING_COMPONENT_DATA',
                { type: c.type }
            );
        }
    }
}

/**
 * Helper to check if a snapshot is compatible with the current version
 */
export function isVersionCompatible(snapshotVersion: string): boolean {
    const [major] = snapshotVersion.split('.').map(Number);
    const [currentMajor] = SERIALIZATION_VERSION.split('.').map(Number);

    // Major version must match for compatibility
    return major === currentMajor;
}

/**
 * Helper to create an empty snapshot
 */
export function createEmptySnapshot(
    metadata: Record<string, unknown> = {}
): WorldSnapshot {
    return {
        version: SERIALIZATION_VERSION,
        timestamp: Date.now(),
        metadata,
        entities: [],
        componentTypes: [],
        stats: {
            entityCount: 0,
            componentCount: 0,
            componentsByType: {},
            estimatedSize: 0,
        },
    };
}
