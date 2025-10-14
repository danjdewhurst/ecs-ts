import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ServerWebSocket } from 'bun';
import { World } from '../ecs/World';
import type { GameClient } from './GameClient';
import { GameServer } from './GameServer';
import * as MessageSerializer from './MessageSerializer';
import type { NetworkMessage } from './NetworkMessage';

// Mock WebSocket implementation for testing
class MockWebSocket {
    public sentMessages: string[] = [];
    public closed = false;
    public id: string;

    constructor(id: string) {
        this.id = id;
    }

    send(data: string): void {
        if (this.closed) {
            throw new Error('WebSocket is closed');
        }
        this.sentMessages.push(data);
    }

    close(): void {
        this.closed = true;
    }

    getSentMessages(): NetworkMessage[] {
        return this.sentMessages.map((msg) =>
            MessageSerializer.deserialize(msg)
        );
    }
}

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

    describe('Server Lifecycle', () => {
        test('should start server successfully', async () => {
            await server.start();
            expect(server.getClientCount()).toBe(0);
        });

        test('should stop server and cleanup resources', async () => {
            await server.start();

            // Add mock client to test cleanup
            const mockWs = new MockWebSocket(
                'test-client'
            ) as unknown as ServerWebSocket<unknown>;
            const client: GameClient = {
                id: 'test-client',
                ws: mockWs,
                lastHeartbeat: Date.now(),
                isAuthenticated: true,
                metadata: {},
            };

            (server as any).clients.set('test-client', client);
            expect(server.getClientCount()).toBe(1);

            server.stop();

            expect(server.getClientCount()).toBe(0);
            expect((mockWs as any).closed).toBe(true);
            expect((server as any).server).toBe(null);
            expect((server as any).heartbeatTimer).toBe(null);
        });

        test('should handle multiple stop calls gracefully', () => {
            // Stop server multiple times should not throw
            expect(() => server.stop()).not.toThrow();
            expect(() => server.stop()).not.toThrow();
        });

        test('should stop server without heartbeat timer', () => {
            // Stop without starting (no heartbeat timer)
            expect(() => server.stop()).not.toThrow();
        });
    });

    describe('Client Management', () => {
        test('should track client connections', () => {
            expect(server.getClientCount()).toBe(0);
            expect(server.getConnectedClients()).toEqual([]);
        });

        test('should handle client connection', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            let clientConnectedEvent: any = null;

            world.subscribeToEvent('client_connected', (event) => {
                clientConnectedEvent = event;
            });

            (server as any).handleConnection(mockWs);
            world.update(0);

            expect(server.getClientCount()).toBe(1);
            const clients = server.getConnectedClients();
            expect(clients.length).toBe(1);
            expect(clientConnectedEvent).toBeTruthy();
            expect(clientConnectedEvent.data.clientId).toBe(clients[0]);

            // Verify welcome message was sent
            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].type).toBe('system');
            expect((sentMessages[0].payload as any).command).toBe(
                'authenticate'
            );
        });

        test('should handle client disconnection', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            let disconnectEvent: any = null;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];

            world.subscribeToEvent('client_disconnected', (event) => {
                disconnectEvent = event;
            });

            (server as any).handleDisconnection(mockWs);
            world.update(0);

            expect(server.getClientCount()).toBe(0);
            expect(disconnectEvent).toBeTruthy();
            expect(disconnectEvent.data.clientId).toBe(clientId);
        });

        test('should handle disconnection from unknown client', () => {
            const mockWs = new MockWebSocket(
                'unknown'
            ) as unknown as ServerWebSocket<unknown>;

            // Should not throw when disconnecting unknown client
            expect(() =>
                (server as any).handleDisconnection(mockWs)
            ).not.toThrow();
        });

        test('should remove client with entity', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            const entity = world.createEntity();

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];

            // Set entity ID
            const client = (server as any).clients.get(clientId);
            client.entityId = entity;

            (server as any).removeClient(clientId);

            expect(server.getClientCount()).toBe(0);
            expect((world as any).entityManager.isEntityAlive(entity)).toBe(
                false
            );
        });

        test('should handle removal of nonexistent client', () => {
            expect(() =>
                (server as any).removeClient('nonexistent')
            ).not.toThrow();
        });

        test('should find client by websocket', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);

            const foundClient = (server as any).findClientByWebSocket(mockWs);
            expect(foundClient).toBeTruthy();
            expect(foundClient.id).toBeTruthy();
        });

        test('should return undefined for unknown websocket', () => {
            const mockWs = new MockWebSocket(
                'unknown'
            ) as unknown as ServerWebSocket<unknown>;

            const foundClient = (server as any).findClientByWebSocket(mockWs);
            expect(foundClient).toBeUndefined();
        });

        test('should generate unique client IDs', () => {
            const id1 = (server as any).generateClientId();
            const id2 = (server as any).generateClientId();
            const id3 = (server as any).generateClientId();

            expect(id1).not.toBe(id2);
            expect(id1).not.toBe(id3);
            expect(id2).not.toBe(id3);

            expect(id1).toMatch(/^client_\d+_\d+$/);
            expect(id2).toMatch(/^client_\d+_\d+$/);
        });
    });

    describe('Message Handling', () => {
        test('should handle valid client message', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            let messageEvent: any = null;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];

            // Authenticate client
            const authMessage: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: {
                    command: 'authenticate',
                    data: { username: 'tester' },
                },
            };
            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(authMessage)
            );

            world.subscribeToEvent('client_message', (event) => {
                messageEvent = event;
            });

            // Send regular message
            const testMessage: NetworkMessage = {
                type: 'input',
                timestamp: Date.now(),
                payload: { action: 'move', data: { x: 10, y: 20 } },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(testMessage)
            );
            world.update(0);

            expect(messageEvent).toBeTruthy();
            expect(messageEvent.source).toBe(clientId);
            expect(messageEvent.data.message.type).toBe('input');
        });

        test('should reject message from unauthenticated client', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            (mockWs as any).sentMessages = []; // Clear welcome message

            const testMessage: NetworkMessage = {
                type: 'input',
                timestamp: Date.now(),
                payload: { action: 'move', data: { x: 10, y: 20 } },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(testMessage)
            );

            // Should receive error message
            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].type).toBe('system');
            expect((sentMessages[0].payload as any).command).toBe('error');
            expect((sentMessages[0].payload as any).data.message).toBe(
                'Not authenticated'
            );
        });

        test('should handle invalid message format', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            (mockWs as any).sentMessages = []; // Clear welcome message

            // Send invalid JSON
            (server as any).handleMessage(mockWs, 'invalid json');

            // Should receive error message
            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].type).toBe('system');
            expect((sentMessages[0].payload as any).command).toBe('error');
        });

        test('should handle message from unknown client', () => {
            const mockWs = new MockWebSocket(
                'unknown'
            ) as unknown as ServerWebSocket<unknown>;

            const consoleSpy = mock(() => {});
            const originalWarn = console.warn;
            console.warn = consoleSpy;

            const testMessage: NetworkMessage = {
                type: 'input',
                timestamp: Date.now(),
                payload: { action: 'test' },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(testMessage)
            );

            expect(consoleSpy).toHaveBeenCalled();
            console.warn = originalWarn;
        });

        test('should update client heartbeat on message', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];
            const client = (server as any).clients.get(clientId);

            const initialHeartbeat = client.lastHeartbeat;

            // Wait a bit
            const testMessage: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: { command: 'heartbeat' },
            };

            // Small delay to ensure different timestamp
            setTimeout(() => {}, 10);

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(testMessage)
            );

            expect(client.lastHeartbeat).toBeGreaterThanOrEqual(
                initialHeartbeat
            );
        });

        test('should handle drain event', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);

            const consoleSpy = mock(() => {});
            const originalWarn = console.warn;
            console.warn = consoleSpy;

            (server as any).handleDrain(mockWs);

            expect(consoleSpy).toHaveBeenCalled();
            console.warn = originalWarn;
        });

        test('should handle drain from unknown client', () => {
            const mockWs = new MockWebSocket(
                'unknown'
            ) as unknown as ServerWebSocket<unknown>;

            expect(() => (server as any).handleDrain(mockWs)).not.toThrow();
        });
    });

    describe('System Messages', () => {
        test('should handle heartbeat message', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];
            const client = (server as any).clients.get(clientId);

            const beforeHeartbeat = client.lastHeartbeat;

            const heartbeatMsg: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: { command: 'heartbeat' },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(heartbeatMsg)
            );

            expect(client.lastHeartbeat).toBeGreaterThanOrEqual(
                beforeHeartbeat
            );
        });

        test('should handle authentication', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            let authEvent: any = null;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];
            const client = (server as any).clients.get(clientId);

            world.subscribeToEvent('client_authenticated', (event) => {
                authEvent = event;
            });

            const authMessage: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: {
                    command: 'authenticate',
                    data: { username: 'player1', level: 5 },
                },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(authMessage)
            );
            world.update(0);

            expect(client.isAuthenticated).toBe(true);
            expect(client.entityId).toBeDefined();
            expect(client.metadata.username).toBe('player1');
            expect(client.metadata.level).toBe(5);
            expect(authEvent).toBeTruthy();
            expect(authEvent.data.clientId).toBe(clientId);
            expect(authEvent.data.entityId).toBe(client.entityId);
        });

        test('should handle authentication without metadata', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];
            const client = (server as any).clients.get(clientId);

            const authMessage: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: { command: 'authenticate' },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(authMessage)
            );

            expect(client.isAuthenticated).toBe(true);
            expect(client.entityId).toBeDefined();
        });

        test('should handle authentication with invalid metadata', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const client = (server as any).clients.get(
                server.getConnectedClients()[0]
            );

            const authMessage: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: { command: 'authenticate', data: 'invalid' },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(authMessage)
            );

            expect(client.isAuthenticated).toBe(true);
            expect(client.entityId).toBeDefined();
        });

        test('should handle unknown system command', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);

            const consoleSpy = mock(() => {});
            const originalWarn = console.warn;
            console.warn = consoleSpy;

            const unknownMessage: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: { command: 'unknown_command' },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(unknownMessage)
            );

            expect(consoleSpy).toHaveBeenCalled();
            console.warn = originalWarn;
        });
    });

    describe('Broadcasting', () => {
        test('should broadcast message to all clients', () => {
            const mockWs1 = new MockWebSocket(
                'ws1'
            ) as unknown as ServerWebSocket<unknown>;
            const mockWs2 = new MockWebSocket(
                'ws2'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs1);
            (server as any).handleConnection(mockWs2);

            // Clear welcome messages
            (mockWs1 as any).sentMessages = [];
            (mockWs2 as any).sentMessages = [];

            const broadcastMessage: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { eventType: 'test', eventData: { value: 42 } },
            };

            server.broadcast(broadcastMessage);

            expect((mockWs1 as any).sentMessages.length).toBe(1);
            expect((mockWs2 as any).sentMessages.length).toBe(1);

            const msg1 = (mockWs1 as any).getSentMessages()[0];
            const msg2 = (mockWs2 as any).getSentMessages()[0];

            expect(msg1.type).toBe('event');
            expect(msg2.type).toBe('event');
        });

        test('should broadcast with exclusions', () => {
            const mockWs1 = new MockWebSocket(
                'ws1'
            ) as unknown as ServerWebSocket<unknown>;
            const mockWs2 = new MockWebSocket(
                'ws2'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs1);
            (server as any).handleConnection(mockWs2);

            const client1Id = server.getConnectedClients()[0]!;

            // Clear welcome messages
            (mockWs1 as any).sentMessages = [];
            (mockWs2 as any).sentMessages = [];

            const broadcastMessage: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            server.broadcast(broadcastMessage, [client1Id]);

            expect((mockWs1 as any).sentMessages.length).toBe(0);
            expect((mockWs2 as any).sentMessages.length).toBe(1);
        });

        test('should handle broadcast to no clients', () => {
            const message: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            expect(() => server.broadcast(message)).not.toThrow();
        });

        test('should handle broadcast send failure', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const _clientId = server.getConnectedClients()[0];

            // Make send throw error
            (mockWs as any).send = () => {
                throw new Error('Send failed');
            };

            const message: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            const consoleSpy = mock(() => {});
            const originalError = console.error;
            console.error = consoleSpy;

            server.broadcast(message);

            // Client should be removed after send failure
            expect(server.getClientCount()).toBe(0);
            expect(consoleSpy).toHaveBeenCalled();

            console.error = originalError;
        });
    });

    describe('Direct Messaging', () => {
        test('should send message to specific client', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0]!;

            (mockWs as any).sentMessages = []; // Clear welcome message

            const message: NetworkMessage = {
                type: 'state',
                timestamp: Date.now(),
                payload: { entities: [] },
            };

            const result = server.sendToClient(clientId, message);

            expect(result).toBe(true);
            expect((mockWs as any).sentMessages.length).toBe(1);

            const sentMsg = (mockWs as any).getSentMessages()[0];
            expect(sentMsg.type).toBe('state');
        });

        test('should fail to send to nonexistent client', () => {
            const message: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            const result = server.sendToClient('nonexistent', message);
            expect(result).toBe(false);
        });

        test('should handle send failure and remove client', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0]!;

            // Make send throw error
            (mockWs as any).send = () => {
                throw new Error('Send failed');
            };

            const message: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            const consoleSpy = mock(() => {});
            const originalError = console.error;
            console.error = consoleSpy;

            const result = server.sendToClient(clientId, message);

            expect(result).toBe(false);
            expect(server.getClientCount()).toBe(0);
            expect(consoleSpy).toHaveBeenCalled();

            console.error = originalError;
        });
    });

    describe('Client Kicking', () => {
        test('should kick client without reason', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0]!;

            const result = server.kickClient(clientId);

            expect(result).toBe(true);
            expect((mockWs as any).closed).toBe(true);
        });

        test('should kick client with reason', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0]!;

            (mockWs as any).sentMessages = []; // Clear welcome message

            const result = server.kickClient(clientId, 'Violation of rules');

            expect(result).toBe(true);
            expect((mockWs as any).closed).toBe(true);

            // Should have received error message before being kicked
            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].type).toBe('system');
            expect((sentMessages[0].payload as any).command).toBe('error');
            expect((sentMessages[0].payload as any).data.message).toBe(
                'Violation of rules'
            );
        });

        test('should fail to kick nonexistent client', () => {
            const result = server.kickClient('nonexistent', 'Test reason');
            expect(result).toBe(false);
        });
    });

    describe('Heartbeat System', () => {
        test('should send heartbeats to connected clients', async () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            await server.start();
            (server as any).handleConnection(mockWs);

            (mockWs as any).sentMessages = []; // Clear welcome message

            // Wait for heartbeat interval
            await new Promise((resolve) => setTimeout(resolve, 150));

            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBeGreaterThan(0);

            const heartbeatMsg = sentMessages.find(
                (msg: NetworkMessage) =>
                    msg.type === 'system' &&
                    (msg.payload as any).command === 'heartbeat'
            );
            expect(heartbeatMsg).toBeTruthy();
        });

        test('should timeout inactive clients', async () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            let disconnectEvent: any = null;

            await server.start();
            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];
            const client = (server as any).clients.get(clientId);

            world.subscribeToEvent('client_disconnected', (event) => {
                disconnectEvent = event;
            });

            // Set lastHeartbeat to old value to trigger timeout
            client.lastHeartbeat = Date.now() - 300; // Older than clientTimeout (200ms)

            // Wait for heartbeat check
            await new Promise((resolve) => setTimeout(resolve, 150));
            world.update(0);

            expect(server.getClientCount()).toBe(0);
            expect(disconnectEvent).toBeTruthy();
        });

        test('should not timeout active clients', async () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            await server.start();
            (server as any).handleConnection(mockWs);
            expect(server.getClientCount()).toBe(1);

            // Wait for heartbeat interval (client should receive heartbeat and stay connected)
            await new Promise((resolve) => setTimeout(resolve, 150));

            expect(server.getClientCount()).toBe(1);
        });
    });

    describe('HTTP Request Handling', () => {
        test('should handle WebSocket upgrade request', async () => {
            await server.start();

            const request = new Request('http://localhost/ws', {
                headers: {
                    upgrade: 'websocket',
                    connection: 'upgrade',
                },
            });

            // Mock server upgrade
            const mockUpgrade = mock(() => true);
            (server as any).server.upgrade = mockUpgrade;

            const response = (server as any).handleHttpRequest(request);

            expect(mockUpgrade).toHaveBeenCalled();
            expect(response).toBeUndefined();
        });

        test('should reject WebSocket when server is full', async () => {
            await server.start();

            // Add clients up to max
            const mockWs1 = new MockWebSocket(
                'ws1'
            ) as unknown as ServerWebSocket<unknown>;
            const mockWs2 = new MockWebSocket(
                'ws2'
            ) as unknown as ServerWebSocket<unknown>;
            (server as any).handleConnection(mockWs1);
            (server as any).handleConnection(mockWs2);

            expect(server.getClientCount()).toBe(2); // maxClients = 2

            const request = new Request('http://localhost/ws');
            const response = (server as any).handleHttpRequest(request);

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(503);
            expect(await response.text()).toBe('Server full');
        });

        test('should handle failed WebSocket upgrade', async () => {
            await server.start();

            const request = new Request('http://localhost/ws');

            // Mock failed upgrade
            const mockUpgrade = mock(() => false);
            (server as any).server.upgrade = mockUpgrade;

            const response = (server as any).handleHttpRequest(request);

            expect(mockUpgrade).toHaveBeenCalled();
            // When upgrade fails, undefined is not returned
            expect(response).toBeDefined();
        });

        test('should handle health check request', async () => {
            await server.start();

            const request = new Request('http://localhost/health');
            const response = (server as any).handleHttpRequest(
                request
            ) as Response;

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe(
                'application/json'
            );

            const body = (await response.json()) as Record<string, unknown>;
            expect(body.status).toBe('ok');
            expect(body.clients).toBe(0);
            expect(typeof body.uptime).toBe('number');
        });

        test('should return 404 for unknown paths', async () => {
            await server.start();

            const request = new Request('http://localhost/unknown');
            const response = (server as any).handleHttpRequest(
                request
            ) as Response;

            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(404);
            expect(await response.text()).toBe('Not Found');
        });
    });

    describe('Event Integration', () => {
        test('should broadcast game_state_update events', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            (mockWs as any).sentMessages = []; // Clear welcome message

            // Emit game state update
            world.emitEvent({
                type: 'game_state_update',
                timestamp: Date.now(),
                source: 'game',
                data: { frame: 100, entities: [1, 2, 3] },
            });

            world.update(0);

            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].type).toBe('state');
            expect(sentMessages[0].payload).toEqual({
                frame: 100,
                entities: [1, 2, 3],
            });
        });

        test('should handle multiple event subscribers', () => {
            let event1Received = false;
            let event2Received = false;

            world.subscribeToEvent('client_connected', () => {
                event1Received = true;
            });

            world.subscribeToEvent('client_connected', () => {
                event2Received = true;
            });

            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;
            (server as any).handleConnection(mockWs);
            world.update(0);

            expect(event1Received).toBe(true);
            expect(event2Received).toBe(true);
        });
    });

    describe('Configuration', () => {
        test('should use default configuration', () => {
            const defaultServer = new GameServer(world);
            const config = (defaultServer as any).config;

            expect(config.port).toBe(3000);
            expect(config.heartbeatInterval).toBe(30000);
            expect(config.clientTimeout).toBe(60000);
            expect(config.maxClients).toBe(100);

            defaultServer.stop();
        });

        test('should merge partial configuration', () => {
            const customServer = new GameServer(world, {
                port: 8080,
                maxClients: 50,
            });
            const config = (customServer as any).config;

            expect(config.port).toBe(8080);
            expect(config.maxClients).toBe(50);
            expect(config.heartbeatInterval).toBe(30000); // default
            expect(config.clientTimeout).toBe(60000); // default

            customServer.stop();
        });
    });

    describe('Edge Cases', () => {
        test('should handle Buffer message format', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            const clientId = server.getConnectedClients()[0];

            const message: NetworkMessage = {
                type: 'system',
                timestamp: Date.now(),
                payload: { command: 'heartbeat' },
            };

            const buffer = Buffer.from(MessageSerializer.serialize(message));

            expect(() =>
                (server as any).handleMessage(mockWs, buffer)
            ).not.toThrow();

            const client = (server as any).clients.get(clientId);
            expect(client).toBeTruthy();
        });

        test('should handle concurrent client connections', () => {
            const mockWs1 = new MockWebSocket(
                'ws1'
            ) as unknown as ServerWebSocket<unknown>;
            const mockWs2 = new MockWebSocket(
                'ws2'
            ) as unknown as ServerWebSocket<unknown>;
            const mockWs3 = new MockWebSocket(
                'ws3'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs1);
            (server as any).handleConnection(mockWs2);
            (server as any).handleConnection(mockWs3);

            expect(server.getClientCount()).toBe(3);

            const clientIds = server.getConnectedClients();
            expect(clientIds.length).toBe(3);
            expect(new Set(clientIds).size).toBe(3); // All unique
        });

        test('should handle rapid connect/disconnect', () => {
            const mockWs1 = new MockWebSocket(
                'ws1'
            ) as unknown as ServerWebSocket<unknown>;
            const mockWs2 = new MockWebSocket(
                'ws2'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs1);
            (server as any).handleDisconnection(mockWs1);
            (server as any).handleConnection(mockWs2);
            (server as any).handleDisconnection(mockWs2);

            expect(server.getClientCount()).toBe(0);
        });

        test('should handle message during authentication', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            (mockWs as any).sentMessages = []; // Clear welcome message

            // Try to send message before authenticating
            const message: NetworkMessage = {
                type: 'input',
                timestamp: Date.now(),
                payload: { action: 'move' },
            };

            (server as any).handleMessage(
                mockWs,
                MessageSerializer.serialize(message)
            );

            // Should receive error about authentication
            const sentMessages = (mockWs as any).getSentMessages();
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].type).toBe('system');
            expect((sentMessages[0].payload as any).command).toBe('error');
        });

        test('should handle empty exclusion list in broadcast', () => {
            const mockWs = new MockWebSocket(
                'test-ws'
            ) as unknown as ServerWebSocket<unknown>;

            (server as any).handleConnection(mockWs);
            (mockWs as any).sentMessages = [];

            const message: NetworkMessage = {
                type: 'event',
                timestamp: Date.now(),
                payload: { test: 'data' },
            };

            server.broadcast(message, []);

            expect((mockWs as any).sentMessages.length).toBe(1);
        });
    });
});
