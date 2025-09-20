import type { NetworkMessage } from './NetworkMessage';

export class MessageSerializer {
    private static readonly PROTOCOL_VERSION = 1;

    static serialize(message: NetworkMessage): string {
        try {
            const envelope = {
                version: MessageSerializer.PROTOCOL_VERSION,
                message,
            };
            return JSON.stringify(envelope);
        } catch (error) {
            throw new Error(`Failed to serialize message: ${error}`);
        }
    }

    static deserialize(data: string | Buffer): NetworkMessage {
        try {
            const text = typeof data === 'string' ? data : data.toString();
            const envelope = JSON.parse(text);

            if (
                !envelope.version ||
                envelope.version !== MessageSerializer.PROTOCOL_VERSION
            ) {
                throw new Error(
                    `Unsupported protocol version: ${envelope.version}`
                );
            }

            const message = envelope.message;

            if (!MessageSerializer.isValidMessage(message)) {
                throw new Error('Invalid message format');
            }

            return message;
        } catch (error) {
            throw new Error(`Failed to deserialize message: ${error}`);
        }
    }

    static serializeBinary(message: NetworkMessage): ArrayBuffer {
        const jsonString = MessageSerializer.serialize(message);
        const encoded = new TextEncoder().encode(jsonString);
        return encoded.buffer.slice(
            encoded.byteOffset,
            encoded.byteOffset + encoded.byteLength
        ) as ArrayBuffer;
    }

    static deserializeBinary(buffer: ArrayBuffer): NetworkMessage {
        const text = new TextDecoder().decode(buffer);
        return MessageSerializer.deserialize(text);
    }

    private static isValidMessage(obj: unknown): obj is NetworkMessage {
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

    static createHeartbeat(clientId: string): NetworkMessage {
        return {
            type: 'system',
            timestamp: Date.now(),
            clientId,
            payload: {
                command: 'heartbeat',
            },
        };
    }

    static createError(message: string, clientId?: string): NetworkMessage {
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
}
