import {
    DeserializationError,
    type DeserializationOptions,
    SerializationError,
    type SerializationFormat,
    type SerializationOptions,
    type WorldSnapshot,
} from './types.ts';

/**
 * Binary serialization format for compact, efficient storage.
 * Uses JSON encoding internally but with binary wrapper for future optimization.
 *
 * Format structure:
 * - Magic bytes (4 bytes): 'ECSB' (ECS Binary)
 * - Version (4 bytes): Major.Minor.Patch
 * - Flags (4 bytes): Compression, encryption, etc.
 * - Data length (4 bytes): Length of JSON data
 * - Data: JSON-encoded snapshot
 * - Checksum (4 bytes): CRC32 checksum
 */
export class BinaryFormat implements SerializationFormat {
    readonly name = 'Binary';
    readonly extension = '.ecsb';
    readonly mimeType = 'application/octet-stream';

    private static readonly MAGIC = 0x45435342; // 'ECSB' in ASCII
    private static readonly HEADER_SIZE = 16; // Magic + Version + Flags + Length (without checksum)
    private static readonly CHECKSUM_SIZE = 4;

    serialize(
        snapshot: WorldSnapshot,
        options?: SerializationOptions
    ): Uint8Array {
        try {
            // Serialize snapshot to JSON
            const jsonString = JSON.stringify(snapshot);
            const jsonBytes = new TextEncoder().encode(jsonString);

            // Optional compression (simple for now, can be enhanced later)
            const dataBytes = options?.compressionLevel
                ? this.compress(jsonBytes, options.compressionLevel)
                : jsonBytes;

            // Create buffer: header + data + checksum
            const totalSize =
                BinaryFormat.HEADER_SIZE +
                dataBytes.length +
                BinaryFormat.CHECKSUM_SIZE;
            const buffer = new ArrayBuffer(totalSize);
            const view = new DataView(buffer);
            const uint8View = new Uint8Array(buffer);

            let offset = 0;

            // Magic bytes
            view.setUint32(offset, BinaryFormat.MAGIC, false);
            offset += 4;

            // Version (encoded as 3 bytes: major.minor.patch)
            const versionParts = snapshot.version.split('.').map(Number);
            const major = versionParts[0] ?? 1;
            const minor = versionParts[1] ?? 0;
            const patch = versionParts[2] ?? 0;
            view.setUint8(offset++, major);
            view.setUint8(offset++, minor);
            view.setUint8(offset++, patch);
            view.setUint8(offset++, 0); // Reserved

            // Flags
            const flags = options?.compressionLevel ? 0x01 : 0x00;
            view.setUint32(offset, flags, false);
            offset += 4;

            // Data length
            view.setUint32(offset, dataBytes.length, false);
            offset += 4;

            // Copy data
            uint8View.set(dataBytes, offset);
            offset += dataBytes.length;

            // Calculate and write checksum
            const checksum = this.calculateChecksum(
                uint8View.subarray(0, offset)
            );
            view.setUint32(offset, checksum, false);

            return uint8View;
        } catch (error) {
            throw new SerializationError(
                'Failed to serialize snapshot to binary format',
                'BINARY_SERIALIZE_ERROR',
                error
            );
        }
    }

    deserialize(
        data: Uint8Array,
        _options?: DeserializationOptions
    ): WorldSnapshot {
        try {
            if (
                data.length <
                BinaryFormat.HEADER_SIZE + BinaryFormat.CHECKSUM_SIZE
            ) {
                throw new DeserializationError(
                    'Invalid binary data: too short',
                    'INVALID_DATA_LENGTH',
                    { length: data.length }
                );
            }

            const view = new DataView(
                data.buffer,
                data.byteOffset,
                data.byteLength
            );
            let offset = 0;

            // Verify magic bytes
            const magic = view.getUint32(offset, false);
            offset += 4;
            if (magic !== BinaryFormat.MAGIC) {
                throw new DeserializationError(
                    'Invalid binary data: bad magic bytes',
                    'INVALID_MAGIC',
                    { expected: BinaryFormat.MAGIC, received: magic }
                );
            }

            // Read version
            const major = view.getUint8(offset++);
            const minor = view.getUint8(offset++);
            const patch = view.getUint8(offset++);
            offset++; // Skip reserved byte
            const version = `${major}.${minor}.${patch}`;

            // Read flags
            const flags = view.getUint32(offset, false);
            offset += 4;
            const isCompressed = (flags & 0x01) !== 0;

            // Read data length
            const dataLength = view.getUint32(offset, false);
            offset += 4;

            const expectedLength =
                BinaryFormat.HEADER_SIZE +
                dataLength +
                BinaryFormat.CHECKSUM_SIZE;
            if (data.length < expectedLength) {
                throw new DeserializationError(
                    'Invalid binary data: unexpected end of data',
                    'TRUNCATED_DATA',
                    {
                        expected: expectedLength,
                        received: data.length,
                    }
                );
            }

            // Verify checksum
            const checksumOffset = BinaryFormat.HEADER_SIZE + dataLength;
            const storedChecksum = view.getUint32(checksumOffset, false);
            const calculatedChecksum = this.calculateChecksum(
                data.subarray(0, checksumOffset)
            );
            if (storedChecksum !== calculatedChecksum) {
                throw new DeserializationError(
                    'Invalid binary data: checksum mismatch',
                    'CHECKSUM_MISMATCH',
                    {
                        expected: storedChecksum,
                        calculated: calculatedChecksum,
                    }
                );
            }

            // Extract and decompress data
            const dataBytes = data.subarray(offset, offset + dataLength);
            const jsonBytes = isCompressed
                ? this.decompress(dataBytes)
                : dataBytes;

            // Parse JSON
            const jsonString = new TextDecoder().decode(jsonBytes);
            const snapshot = JSON.parse(jsonString) as WorldSnapshot;

            // Update version from header
            snapshot.version = version;

            return snapshot;
        } catch (error) {
            if (error instanceof DeserializationError) {
                throw error;
            }
            throw new DeserializationError(
                'Failed to deserialize binary data',
                'BINARY_DESERIALIZE_ERROR',
                error
            );
        }
    }

    estimateSize(snapshot: WorldSnapshot): number {
        // Estimate: header + JSON size + checksum
        const jsonString = JSON.stringify(snapshot);
        const jsonSize = new TextEncoder().encode(jsonString).length;
        return BinaryFormat.HEADER_SIZE + jsonSize + BinaryFormat.CHECKSUM_SIZE;
    }

    validate(data: Uint8Array): boolean {
        try {
            if (
                data.length <
                BinaryFormat.HEADER_SIZE + BinaryFormat.CHECKSUM_SIZE
            ) {
                return false;
            }

            const view = new DataView(
                data.buffer,
                data.byteOffset,
                data.byteLength
            );
            const magic = view.getUint32(0, false);

            return magic === BinaryFormat.MAGIC;
        } catch {
            return false;
        }
    }

    /**
     * Calculate CRC32 checksum for data integrity verification
     */
    private calculateChecksum(data: Uint8Array): number {
        let crc = 0xffffffff;
        const polynomial = 0xedb88320;

        for (let i = 0; i < data.length; i++) {
            crc ^= data[i] ?? 0;
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? polynomial : 0);
            }
        }

        return (crc ^ 0xffffffff) >>> 0;
    }

    /**
     * Simple compression using deflate (placeholder for now)
     * TODO: Implement proper compression using Bun's native compression
     */
    private compress(data: Uint8Array, _level: number): Uint8Array {
        // For now, return uncompressed data
        // In the future, use Bun.deflate() or similar
        return data;
    }

    /**
     * Simple decompression (placeholder for now)
     * TODO: Implement proper decompression using Bun's native decompression
     */
    private decompress(data: Uint8Array): Uint8Array {
        // For now, return data as-is
        // In the future, use Bun.inflate() or similar
        return data;
    }
}
