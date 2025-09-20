import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { World } from '../ecs/World';
import { GameServer } from './GameServer';
import * as MessageSerializer from './MessageSerializer';
import type { NetworkMessage } from './NetworkMessage';

describe('GameServer', () => {
    let world: World;
    let server: GameServer;

    beforeEach(() => {
        world = new World();
        server = new GameServer(world, {
            port: 0, // Use random port for testing
            heartbeatInterval: 100,
            clientTimeout: 200,
            maxClients: 2,
        });
    });

    afterEach(() => {
        server.stop();
    });

    test('should start and stop server', async () => {
        await server.start();
        expect(server.getClientCount()).toBe(0);

        server.stop();
        expect(server.getClientCount()).toBe(0);
    });

    test('should track client connections', () => {
        expect(server.getClientCount()).toBe(0);
        expect(server.getConnectedClients()).toEqual([]);
    });

    test('should handle message serialization errors gracefully', () => {
        const clientId = 'test-client';
        const invalidMessage = {
            invalid: 'message',
        } as unknown as NetworkMessage;

        const result = server.sendToClient(clientId, invalidMessage);
        expect(result).toBe(false);
    });

    test('should create heartbeat messages', () => {
        const heartbeat = MessageSerializer.createHeartbeat('client123');

        expect(heartbeat.type).toBe('system');
        expect(heartbeat.payload).toEqual({ command: 'heartbeat' });
    });

    test('should create error messages', () => {
        const error = MessageSerializer.createError('Test error', 'client123');

        expect(error.type).toBe('system');
        expect(error.payload).toEqual({
            command: 'error',
            data: { message: 'Test error' },
        });
    });

    test('should broadcast messages to multiple clients', () => {
        const message = {
            type: 'event' as const,
            timestamp: Date.now(),
            payload: { test: 'data' },
        };

        // Should not throw when no clients connected
        expect(() => server.broadcast(message)).not.toThrow();

        // Should not throw when excluding clients
        expect(() =>
            server.broadcast(message, ['client1', 'client2'])
        ).not.toThrow();
    });

    test('should handle client kicking', () => {
        const result = server.kickClient('nonexistent-client', 'Test reason');
        expect(result).toBe(false);
    });

    test('should generate unique client IDs', async () => {
        const server1 = new GameServer(world);

        // Access private method through reflection for testing
        const generateId = (
            server1 as unknown as { generateClientId: () => string }
        ).generateClientId;

        const id1 = generateId.call(server1);
        const id2 = generateId.call(server1);

        // Add small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 1));

        const server2 = new GameServer(world);
        const generateId2 = (
            server2 as unknown as { generateClientId: () => string }
        ).generateClientId;
        const id3 = generateId2.call(server2);

        expect(id1).not.toBe(id2);
        expect(id1).not.toBe(id3);
        expect(id2).not.toBe(id3);

        server1.stop();
        server2.stop();
    });

    test('should integrate with world event system', () => {
        let eventReceived = false;

        world.subscribeToEvent('client_connected', () => {
            eventReceived = true;
        });

        // Simulate event emission
        world.emitEvent({
            type: 'client_connected',
            timestamp: Date.now(),
            source: 'server',
            data: { clientId: 'test-client' },
        });

        world.update(16); // Process events
        expect(eventReceived).toBe(true);
    });
});
