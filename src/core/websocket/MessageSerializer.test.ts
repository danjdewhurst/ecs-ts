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

    test('should deserialize from Buffer correctly', () => {
        const serialized = MessageSerializer.serialize(validMessage);
        const buffer = Buffer.from(serialized);
        const deserialized = MessageSerializer.deserialize(buffer);

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

    test('should reject missing protocol version', () => {
        const invalidData = JSON.stringify({
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

    test('should create valid error messages with clientId', () => {
        const error = MessageSerializer.createError('Test error', 'client123');

        expect(error.type).toBe('system');
        expect(error.clientId).toBe('client123');
        expect(error.payload).toEqual({
            command: 'error',
            data: { message: 'Test error' },
        });
    });

    test('should create valid error messages without clientId', () => {
        const error = MessageSerializer.createError('Test error');

        expect(error.type).toBe('system');
        expect(error.clientId).toBeUndefined();
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
            null, // null message
            'not an object', // primitive value
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

    test('should handle all valid message types', () => {
        const messageTypes: Array<'input' | 'state' | 'event' | 'system'> = [
            'input',
            'state',
            'event',
            'system',
        ];

        for (const type of messageTypes) {
            const message: NetworkMessage = {
                type,
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            const serialized = MessageSerializer.serialize(message);
            const deserialized = MessageSerializer.deserialize(serialized);

            expect(deserialized.type).toBe(type);
        }
    });

    test('should handle serialization errors when JSON.stringify fails', () => {
        // Create a message with a circular reference that will cause JSON.stringify to fail
        const circularPayload: Record<string, unknown> = { value: 'test' };
        circularPayload.self = circularPayload;

        const messageWithCircularRef: NetworkMessage = {
            type: 'input',
            timestamp: Date.now(),
            payload: circularPayload,
        };

        expect(() =>
            MessageSerializer.serialize(messageWithCircularRef)
        ).toThrow('Failed to serialize message');
    });
});
