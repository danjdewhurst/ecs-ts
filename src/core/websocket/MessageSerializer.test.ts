import { describe, expect, test } from 'bun:test';
import * as MessageSerializer from './MessageSerializer';
import type { NetworkMessage } from './NetworkMessage';

describe('MessageSerializer', () => {
    const validMessage: NetworkMessage = {
        type: 'input',
        timestamp: Date.now(),
        payload: {
            action: 'move',
            data: { x: 10, y: 20 },
        },
    };

    test('should serialize and deserialize messages correctly', () => {
        const serialized = MessageSerializer.serialize(validMessage);
        const deserialized = MessageSerializer.deserialize(serialized);

        expect(deserialized).toEqual(validMessage);
    });

    test('should handle binary serialization', () => {
        const binaryData = MessageSerializer.serializeBinary(validMessage);
        const deserialized = MessageSerializer.deserializeBinary(binaryData);

        expect(deserialized).toEqual(validMessage);
    });

    test('should include protocol version in serialized data', () => {
        const serialized = MessageSerializer.serialize(validMessage);
        const parsed = JSON.parse(serialized);

        expect(parsed.version).toBe(1);
        expect(parsed.message).toEqual(validMessage);
    });

    test('should reject invalid protocol versions', () => {
        const invalidData = JSON.stringify({
            version: 999,
            message: validMessage,
        });

        expect(() => MessageSerializer.deserialize(invalidData)).toThrow(
            'Unsupported protocol version'
        );
    });

    test('should reject malformed JSON', () => {
        expect(() => MessageSerializer.deserialize('invalid json')).toThrow(
            'Failed to deserialize message'
        );
    });

    test('should reject invalid message format', () => {
        const invalidMessage = JSON.stringify({
            version: 1,
            message: { invalid: 'format' },
        });

        expect(() => MessageSerializer.deserialize(invalidMessage)).toThrow(
            'Invalid message format'
        );
    });

    test('should create valid heartbeat messages', () => {
        const heartbeat = MessageSerializer.createHeartbeat('client123');

        expect(heartbeat.type).toBe('system');
        expect(heartbeat.clientId).toBe('client123');
        expect(heartbeat.payload).toEqual({ command: 'heartbeat' });
        expect(typeof heartbeat.timestamp).toBe('number');
    });

    test('should create valid error messages', () => {
        const error = MessageSerializer.createError('Test error', 'client123');

        expect(error.type).toBe('system');
        expect(error.clientId).toBe('client123');
        expect(error.payload).toEqual({
            command: 'error',
            data: { message: 'Test error' },
        });
    });

    test('should validate required message fields', () => {
        const invalidMessages = [
            { timestamp: Date.now(), payload: {} }, // missing type
            { type: 'invalid', timestamp: Date.now(), payload: {} }, // invalid type
            { type: 'input', payload: {} }, // missing timestamp
            { type: 'input', timestamp: Date.now() }, // missing payload
        ];

        for (const invalidMessage of invalidMessages) {
            const serialized = JSON.stringify({
                version: 1,
                message: invalidMessage,
            });

            expect(() => MessageSerializer.deserialize(serialized)).toThrow(
                'Invalid message format'
            );
        }
    });
});
