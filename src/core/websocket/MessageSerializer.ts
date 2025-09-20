import type { NetworkMessage } from './NetworkMessage';

const PROTOCOL_VERSION = 1;

export function serialize(message: NetworkMessage): string {
    try {
        const envelope = {
            version: PROTOCOL_VERSION,
            message,
        };
        return JSON.stringify(envelope);
    } catch (error) {
        throw new Error(`Failed to serialize message: ${error}`);
    }
}

export function deserialize(data: string | Buffer): NetworkMessage {
    try {
        const text = typeof data === 'string' ? data : data.toString();
        const envelope = JSON.parse(text);

        if (!envelope.version || envelope.version !== PROTOCOL_VERSION) {
            throw new Error(
                `Unsupported protocol version: ${envelope.version}`
            );
        }

        const message = envelope.message;

        if (!isValidMessage(message)) {
            throw new Error('Invalid message format');
        }

        return message;
    } catch (error) {
        throw new Error(`Failed to deserialize message: ${error}`);
    }
}

export function serializeBinary(message: NetworkMessage): ArrayBuffer {
    const jsonString = serialize(message);
    const encoded = new TextEncoder().encode(jsonString);
    return encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength
    ) as ArrayBuffer;
}

export function deserializeBinary(buffer: ArrayBuffer): NetworkMessage {
    const text = new TextDecoder().decode(buffer);
    return deserialize(text);
}

function isValidMessage(obj: unknown): obj is NetworkMessage {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const message = obj as Record<string, unknown>;

    return (
        typeof message.type === 'string' &&
        ['input', 'state', 'event', 'system'].includes(message.type) &&
        typeof message.timestamp === 'number' &&
        message.payload !== undefined
    );
}

export function createHeartbeat(clientId: string): NetworkMessage {
    return {
        type: 'system',
        timestamp: Date.now(),
        clientId,
        payload: {
            command: 'heartbeat',
        },
    };
}

export function createError(
    message: string,
    clientId?: string
): NetworkMessage {
    return {
        type: 'system',
        timestamp: Date.now(),
        clientId,
        payload: {
            command: 'error',
            data: { message },
        },
    };
}
