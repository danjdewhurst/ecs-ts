import { beforeEach, describe, expect, test } from 'bun:test';
import type { ServerWebSocket } from 'bun';
import { World } from '../ecs/World.ts';
import type { GameClient, ServerMessage } from '../websocket/GameClient.ts';
import type { NetworkMessage } from '../websocket/NetworkMessage.ts';
import {
    BaseNetworkPlugin,
    type NetworkPluginConfig,
} from './NetworkPlugin.ts';

describe('NetworkPlugin', () => {
    let world: World;

    beforeEach(() => {
        world = new World();
    });

    describe('BaseNetworkPlugin', () => {
        class TestNetworkPlugin extends BaseNetworkPlugin {
            readonly name = 'test-network';
            readonly version = '1.0.0';

            private clients = new Map<string, GameClient>();
            private messageHandlers = new Map<
                string,
                ((
                    clientId: string,
                    message: unknown,
                    client: GameClient
                ) => void)[]
            >();
            private connectHandlers: ((client: GameClient) => void)[] = [];
            private disconnectHandlers: ((
                clientId: string,
                reason?: string
            ) => void)[] = [];

            async initialize(_world: World): Promise<void> {
                // Mock initialization
            }

            async sendToClient(
                clientId: string,
                _message: NetworkMessage
            ): Promise<void> {
                const client = this.clients.get(clientId);
                if (!client) {
                    throw new Error(`Client ${clientId} not found`);
                }
                // Mock send implementation
            }

            async sendServerMessage(
                clientId: string,
                _message: ServerMessage
            ): Promise<void> {
                const client = this.clients.get(clientId);
                if (!client) {
                    throw new Error(`Client ${clientId} not found`);
                }
                // Mock send implementation
            }

            async broadcast(
                message: NetworkMessage,
                exclude?: string[]
            ): Promise<void> {
                for (const [clientId] of this.clients) {
                    if (!exclude?.includes(clientId)) {
                        await this.sendToClient(clientId, message);
                    }
                }
            }

            async broadcastServerMessage(
                message: ServerMessage,
                exclude?: string[]
            ): Promise<void> {
                for (const [clientId] of this.clients) {
                    if (!exclude?.includes(clientId)) {
                        await this.sendServerMessage(clientId, message);
                    }
                }
            }

            getConnectedClients(): GameClient[] {
                return Array.from(this.clients.values());
            }

            getClient(clientId: string): GameClient | undefined {
                return this.clients.get(clientId);
            }

            async disconnectClient(
                clientId: string,
                reason?: string
            ): Promise<void> {
                const client = this.clients.get(clientId);
                if (client) {
                    this.clients.delete(clientId);
                    for (const handler of this.disconnectHandlers) {
                        handler(clientId, reason);
                    }
                }
            }

            isClientConnected(clientId: string): boolean {
                return this.clients.has(clientId);
            }

            getClientCount(): number {
                return this.clients.size;
            }

            onClientMessage(
                messageType: string,
                handler: (
                    clientId: string,
                    message: unknown,
                    client: GameClient
                ) => void
            ): () => void {
                if (!this.messageHandlers.has(messageType)) {
                    this.messageHandlers.set(messageType, []);
                }
                this.messageHandlers.get(messageType)?.push(handler);

                return () => {
                    const handlers = this.messageHandlers.get(messageType);
                    if (handlers) {
                        const index = handlers.indexOf(handler);
                        if (index !== -1) {
                            handlers.splice(index, 1);
                        }
                    }
                };
            }

            onClientConnect(handler: (client: GameClient) => void): () => void {
                this.connectHandlers.push(handler);
                return () => {
                    const index = this.connectHandlers.indexOf(handler);
                    if (index !== -1) {
                        this.connectHandlers.splice(index, 1);
                    }
                };
            }

            onClientDisconnect(
                handler: (clientId: string, reason?: string) => void
            ): () => void {
                this.disconnectHandlers.push(handler);
                return () => {
                    const index = this.disconnectHandlers.indexOf(handler);
                    if (index !== -1) {
                        this.disconnectHandlers.splice(index, 1);
                    }
                };
            }

            // Test helpers
            addTestClient(client: GameClient): void {
                this.clients.set(client.id, client);
                for (const handler of this.connectHandlers) {
                    handler(client);
                }
            }

            triggerMessage(
                clientId: string,
                messageType: string,
                message: unknown
            ): void {
                const client = this.clients.get(clientId);
                if (client) {
                    const handlers =
                        this.messageHandlers.get(messageType) ?? [];
                    for (const handler of handlers) {
                        handler(clientId, message, client);
                    }
                }
            }

            getConfig(): Required<NetworkPluginConfig> {
                return this.config;
            }
        }

        describe('constructor and configuration', () => {
            test('should initialize with default configuration', () => {
                // Arrange & Act
                const plugin = new TestNetworkPlugin();

                // Assert
                const config = plugin.getConfig();
                expect(config.maxClients).toBe(100);
                expect(config.heartbeatInterval).toBe(30000);
                expect(config.clientTimeout).toBe(60000);
                expect(config.compression).toBe(false);
                expect(config.rateLimit).toEqual({
                    maxMessages: 100,
                    windowMs: 60000,
                });
            });

            test('should initialize with custom configuration', () => {
                // Arrange
                const customConfig: NetworkPluginConfig = {
                    maxClients: 50,
                    heartbeatInterval: 15000,
                    clientTimeout: 30000,
                    compression: true,
                    rateLimit: {
                        maxMessages: 200,
                        windowMs: 30000,
                    },
                };

                // Act
                const plugin = new TestNetworkPlugin(customConfig);

                // Assert
                const config = plugin.getConfig();
                expect(config.maxClients).toBe(50);
                expect(config.heartbeatInterval).toBe(15000);
                expect(config.clientTimeout).toBe(30000);
                expect(config.compression).toBe(true);
                expect(config.rateLimit).toEqual({
                    maxMessages: 200,
                    windowMs: 30000,
                });
            });

            test('should merge partial configuration with defaults', () => {
                // Arrange
                const partialConfig: NetworkPluginConfig = {
                    maxClients: 75,
                    compression: true,
                };

                // Act
                const plugin = new TestNetworkPlugin(partialConfig);

                // Assert
                const config = plugin.getConfig();
                expect(config.maxClients).toBe(75);
                expect(config.compression).toBe(true);
                expect(config.heartbeatInterval).toBe(30000); // default
                expect(config.clientTimeout).toBe(60000); // default
                expect(config.rateLimit).toEqual({
                    // default
                    maxMessages: 100,
                    windowMs: 60000,
                });
            });

            test('should handle empty configuration object', () => {
                // Arrange & Act
                const plugin = new TestNetworkPlugin({});

                // Assert
                const config = plugin.getConfig();
                expect(config.maxClients).toBe(100);
                expect(config.heartbeatInterval).toBe(30000);
                expect(config.clientTimeout).toBe(60000);
                expect(config.compression).toBe(false);
            });
        });

        describe('shutdown method', () => {
            test('should call shutdown successfully', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                await plugin.initialize(world);

                // Act
                const result = await plugin.shutdown?.();

                // Assert
                expect(result).toBeUndefined();
            });

            test('should return resolved promise from shutdown', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();

                // Act & Assert
                await expect(plugin.shutdown?.()).resolves.toBeUndefined();
            });
        });

        describe('client management', () => {
            test('should track connected clients', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };

                // Act
                plugin.addTestClient(mockClient);

                // Assert
                expect(plugin.isClientConnected('client-1')).toBe(true);
                expect(plugin.getClientCount()).toBe(1);
                expect(plugin.getClient('client-1')).toBe(mockClient);
                expect(plugin.getConnectedClients()).toEqual([mockClient]);
            });

            test('should handle multiple clients', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const client1: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                const client2: GameClient = {
                    id: 'client-2',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: false,
                    metadata: { role: 'guest' },
                };

                // Act
                plugin.addTestClient(client1);
                plugin.addTestClient(client2);

                // Assert
                expect(plugin.getClientCount()).toBe(2);
                expect(plugin.isClientConnected('client-1')).toBe(true);
                expect(plugin.isClientConnected('client-2')).toBe(true);
                expect(plugin.getConnectedClients()).toHaveLength(2);
            });

            test('should return undefined for non-existent client', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();

                // Act & Assert
                expect(plugin.getClient('non-existent')).toBeUndefined();
                expect(plugin.isClientConnected('non-existent')).toBe(false);
            });

            test('should disconnect client successfully', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                // Act
                await plugin.disconnectClient('client-1', 'test disconnect');

                // Assert
                expect(plugin.isClientConnected('client-1')).toBe(false);
                expect(plugin.getClientCount()).toBe(0);
            });
        });

        describe('event handlers', () => {
            test('should register and trigger client connect handlers', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                let connectedClient: GameClient | undefined;
                const handler = (client: GameClient) => {
                    connectedClient = client;
                };

                // Act
                const unregister = plugin.onClientConnect(handler);
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                // Assert
                expect(connectedClient).toBe(mockClient);
                expect(typeof unregister).toBe('function');
            });

            test('should unregister client connect handlers', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                let callCount = 0;
                const handler = () => {
                    callCount++;
                };
                const unregister = plugin.onClientConnect(handler);

                // Act
                unregister();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                // Assert
                expect(callCount).toBe(0);
            });

            test('should register and trigger client disconnect handlers', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let disconnectedClientId: string | undefined;
                let disconnectReason: string | undefined;
                plugin.onClientDisconnect((clientId, reason) => {
                    disconnectedClientId = clientId;
                    disconnectReason = reason;
                });

                // Act
                await plugin.disconnectClient('client-1', 'test reason');

                // Assert
                expect(disconnectedClientId).toBe('client-1');
                expect(disconnectReason).toBe('test reason');
            });

            test('should unregister client disconnect handlers', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let callCount = 0;
                const unregister = plugin.onClientDisconnect(() => {
                    callCount++;
                });

                // Act
                unregister();
                await plugin.disconnectClient('client-1');

                // Assert
                expect(callCount).toBe(0);
            });

            test('should register and trigger message handlers', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let receivedMessage:
                    | { clientId: string; message: unknown; client: GameClient }
                    | undefined;
                plugin.onClientMessage(
                    'test-message',
                    (clientId, message, client) => {
                        receivedMessage = { clientId, message, client };
                    }
                );

                // Act
                const testMessage = { data: 'test data' };
                plugin.triggerMessage('client-1', 'test-message', testMessage);

                // Assert
                expect(receivedMessage).toEqual({
                    clientId: 'client-1',
                    message: testMessage,
                    client: mockClient,
                });
            });

            test('should unregister message handlers', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let callCount = 0;
                const unregister = plugin.onClientMessage(
                    'test-message',
                    () => {
                        callCount++;
                    }
                );

                // Act
                unregister();
                plugin.triggerMessage('client-1', 'test-message', {
                    data: 'test',
                });

                // Assert
                expect(callCount).toBe(0);
            });

            test('should handle multiple message handlers for same type', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let handler1Called = false;
                let handler2Called = false;

                plugin.onClientMessage('test-message', () => {
                    handler1Called = true;
                });
                plugin.onClientMessage('test-message', () => {
                    handler2Called = true;
                });

                // Act
                plugin.triggerMessage('client-1', 'test-message', {
                    data: 'test',
                });

                // Assert
                expect(handler1Called).toBe(true);
                expect(handler2Called).toBe(true);
            });
        });

        describe('messaging', () => {
            test('should send message to specific client', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                const message: NetworkMessage = {
                    type: 'event',
                    payload: { eventType: 'test', eventData: { data: 'test' } },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.sendToClient('client-1', message)
                ).resolves.toBeUndefined();
            });

            test('should throw error when sending to non-existent client', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const message: NetworkMessage = {
                    type: 'event',
                    payload: { eventType: 'test', eventData: { data: 'test' } },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.sendToClient('non-existent', message)
                ).rejects.toThrow('Client non-existent not found');
            });

            test('should send server message to specific client', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                const message: ServerMessage = {
                    type: 'connected',
                    data: { clientId: 'client-1' },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.sendServerMessage('client-1', message)
                ).resolves.toBeUndefined();
            });

            test('should throw error when sending server message to non-existent client', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const message: ServerMessage = {
                    type: 'connected',
                    data: { clientId: 'test' },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.sendServerMessage('non-existent', message)
                ).rejects.toThrow('Client non-existent not found');
            });

            test('should broadcast message to all clients', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const client1: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                const client2: GameClient = {
                    id: 'client-2',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(client1);
                plugin.addTestClient(client2);

                const message: NetworkMessage = {
                    type: 'event',
                    payload: {
                        eventType: 'broadcast',
                        eventData: { data: 'test' },
                    },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.broadcast(message)
                ).resolves.toBeUndefined();
            });

            test('should broadcast message excluding specific clients', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const client1: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                const client2: GameClient = {
                    id: 'client-2',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(client1);
                plugin.addTestClient(client2);

                const message: NetworkMessage = {
                    type: 'event',
                    payload: {
                        eventType: 'broadcast',
                        eventData: { data: 'test' },
                    },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.broadcast(message, ['client-1'])
                ).resolves.toBeUndefined();
            });

            test('should broadcast server message to all clients', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const client1: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                const client2: GameClient = {
                    id: 'client-2',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(client1);
                plugin.addTestClient(client2);

                const message: ServerMessage = {
                    type: 'state-update',
                    data: { state: 'updated' },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.broadcastServerMessage(message)
                ).resolves.toBeUndefined();
            });

            test('should broadcast server message excluding specific clients', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const client1: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                const client2: GameClient = {
                    id: 'client-2',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(client1);
                plugin.addTestClient(client2);

                const message: ServerMessage = {
                    type: 'state-update',
                    data: { state: 'updated' },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.broadcastServerMessage(message, ['client-2'])
                ).resolves.toBeUndefined();
            });
        });

        describe('edge cases', () => {
            test('should handle disconnect of non-existent client gracefully', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();

                // Act & Assert
                await expect(
                    plugin.disconnectClient('non-existent')
                ).resolves.toBeUndefined();
            });

            test('should handle message trigger for non-existent client', () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                let callCount = 0;
                plugin.onClientMessage('test', () => {
                    callCount++;
                });

                // Act
                plugin.triggerMessage('non-existent', 'test', { data: 'test' });

                // Assert
                expect(callCount).toBe(0);
            });

            test('should handle broadcast with empty client list', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const message: NetworkMessage = {
                    type: 'event',
                    payload: { eventType: 'test', eventData: { data: 'test' } },
                    timestamp: Date.now(),
                };

                // Act & Assert
                await expect(
                    plugin.broadcast(message)
                ).resolves.toBeUndefined();
            });

            test('should handle disconnect with reason', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let capturedReason: string | undefined;
                plugin.onClientDisconnect((_, reason) => {
                    capturedReason = reason;
                });

                // Act
                await plugin.disconnectClient('client-1', 'timeout');

                // Assert
                expect(capturedReason).toBe('timeout');
            });

            test('should handle disconnect without reason', async () => {
                // Arrange
                const plugin = new TestNetworkPlugin();
                const mockClient: GameClient = {
                    id: 'client-1',
                    ws: {} as ServerWebSocket<unknown>,
                    lastHeartbeat: Date.now(),
                    isAuthenticated: true,
                    metadata: {},
                };
                plugin.addTestClient(mockClient);

                let capturedReason: string | undefined = 'initial';
                plugin.onClientDisconnect((_, reason) => {
                    capturedReason = reason;
                });

                // Act
                await plugin.disconnectClient('client-1');

                // Assert
                expect(capturedReason).toBeUndefined();
            });
        });
    });
});
