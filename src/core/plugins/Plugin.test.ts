import { beforeEach, describe, expect, test } from 'bun:test';
import type { ServerWebSocket } from 'bun';
import { World } from '../ecs/World.ts';
import type { GameClient, ServerMessage } from '../websocket/GameClient.ts';
import type { NetworkMessage } from '../websocket/NetworkMessage.ts';
import { BaseNetworkPlugin } from './NetworkPlugin.ts';
import { PluginManager } from './PluginManager.ts';
import {
    BaseStoragePlugin,
    type LoadOptions,
    type StorageMetadata,
    type StorageOperation,
    type StorageOptions,
    type StorageStats,
} from './StoragePlugin.ts';

describe('Plugin Interfaces', () => {
    let world: World;
    let pluginManager: PluginManager;

    beforeEach(() => {
        world = new World();
        pluginManager = new PluginManager(world);
    });

    describe('NetworkPlugin interface', () => {
        class MockNetworkPlugin extends BaseNetworkPlugin {
            readonly name = 'mock-network';
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

            async initialize(): Promise<void> {
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
                    this.disconnectHandlers.forEach((handler) => {
                        handler(clientId, reason);
                    });
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
            mockAddClient(client: GameClient): void {
                this.clients.set(client.id, client);
                this.connectHandlers.forEach((handler) => {
                    handler(client);
                });
            }

            mockTriggerMessage(
                clientId: string,
                messageType: string,
                message: unknown
            ): void {
                const client = this.clients.get(clientId);
                if (client) {
                    const handlers =
                        this.messageHandlers.get(messageType) ?? [];
                    handlers.forEach((handler) => {
                        handler(clientId, message, client);
                    });
                }
            }
        }

        test('should implement NetworkPlugin interface correctly', async () => {
            const plugin = new MockNetworkPlugin();
            await pluginManager.loadPlugin(plugin);

            expect(pluginManager.isPluginLoaded('mock-network')).toBe(true);
        });

        test('should handle client connections and disconnections', async () => {
            const plugin = new MockNetworkPlugin();
            await pluginManager.loadPlugin(plugin);

            const mockClient: GameClient = {
                id: 'test-client',
                ws: {} as ServerWebSocket<unknown>,
                lastHeartbeat: Date.now(),
                isAuthenticated: true,
                metadata: {},
            };

            // Test connection
            let connectedClient: GameClient | undefined;
            plugin.onClientConnect((client) => {
                connectedClient = client;
            });

            plugin.mockAddClient(mockClient);
            expect(connectedClient).toBe(mockClient);
            expect(plugin.isClientConnected('test-client')).toBe(true);
            expect(plugin.getClientCount()).toBe(1);

            // Test disconnection
            let disconnectedClientId: string | undefined;
            plugin.onClientDisconnect((clientId) => {
                disconnectedClientId = clientId;
            });

            await plugin.disconnectClient('test-client', 'test reason');
            expect(disconnectedClientId).toBe('test-client');
            expect(plugin.isClientConnected('test-client')).toBe(false);
            expect(plugin.getClientCount()).toBe(0);
        });

        test('should handle message events', async () => {
            const plugin = new MockNetworkPlugin();
            await pluginManager.loadPlugin(plugin);

            const mockClient: GameClient = {
                id: 'test-client',
                ws: {} as ServerWebSocket<unknown>,
                lastHeartbeat: Date.now(),
                isAuthenticated: true,
                metadata: {},
            };

            plugin.mockAddClient(mockClient);

            let receivedMessage:
                | { clientId: string; message: unknown }
                | undefined;
            plugin.onClientMessage(
                'test-message',
                (clientId: string, message: unknown) => {
                    receivedMessage = { clientId, message };
                }
            );

            const testMessage = { data: 'test data' };
            plugin.mockTriggerMessage(
                'test-client',
                'test-message',
                testMessage
            );

            expect(receivedMessage).toEqual({
                clientId: 'test-client',
                message: testMessage,
            });
        });
    });

    describe('StoragePlugin interface', () => {
        class MockStoragePlugin extends BaseStoragePlugin {
            readonly name = 'mock-storage';
            readonly version = '1.0.0';

            private storage = new Map<
                string,
                { data: string; metadata: StorageMetadata }
            >();

            constructor() {
                super({
                    backend: 'memory',
                });
            }

            async initialize(): Promise<void> {
                // Mock initialization
            }

            async save(
                key: string,
                data: unknown,
                options?: StorageOptions
            ): Promise<void> {
                this.validateKey(key);
                const serialized = this.serialize(data);
                this.storage.set(key, {
                    data: serialized,
                    metadata: {
                        size: serialized.length,
                        createdAt: Date.now(),
                        modifiedAt: Date.now(),
                        compressed: false,
                        encrypted: false,
                        metadata: options?.metadata,
                    },
                });
            }

            async load<T = unknown>(
                key: string,
                options?: LoadOptions
            ): Promise<T | undefined> {
                this.validateKey(key);
                const item = this.storage.get(key);
                if (!item) {
                    return options?.defaultValue as T | undefined;
                }
                return this.deserialize<T>(item.data);
            }

            async delete(key: string): Promise<boolean> {
                this.validateKey(key);
                return this.storage.delete(key);
            }

            async exists(key: string): Promise<boolean> {
                this.validateKey(key);
                return this.storage.has(key);
            }

            async listKeys(prefix?: string): Promise<string[]> {
                const keys = Array.from(this.storage.keys());
                return prefix
                    ? keys.filter((key) => key.startsWith(prefix))
                    : keys;
            }

            async clear(): Promise<void> {
                this.storage.clear();
            }

            async getMetadata(
                key: string
            ): Promise<StorageMetadata | undefined> {
                this.validateKey(key);
                const item = this.storage.get(key);
                return item?.metadata;
            }

            async transaction(operations: StorageOperation[]): Promise<void> {
                // Simple mock transaction - in real implementation this would be atomic
                for (const op of operations) {
                    if (op.type === 'save') {
                        await this.save(op.key, op.data, op.options);
                    } else if (op.type === 'delete') {
                        await this.delete(op.key);
                    }
                }
            }

            async getStats(): Promise<StorageStats> {
                return {
                    itemCount: this.storage.size,
                    totalSize: Array.from(this.storage.values()).reduce(
                        (sum, item) => sum + item.data.length,
                        0
                    ),
                    backendType: 'memory',
                    isHealthy: true,
                    performance: {
                        avgReadTime: 1,
                        avgWriteTime: 1,
                        operationCount: 0,
                    },
                };
            }
        }

        test('should implement StoragePlugin interface correctly', async () => {
            const plugin = new MockStoragePlugin();
            await pluginManager.loadPlugin(plugin);

            expect(pluginManager.isPluginLoaded('mock-storage')).toBe(true);
        });

        test('should save and load data correctly', async () => {
            const plugin = new MockStoragePlugin();
            await pluginManager.loadPlugin(plugin);

            const testData = { message: 'Hello, World!', count: 42 };

            await plugin.save('test-key', testData);
            expect(await plugin.exists('test-key')).toBe(true);

            const loadedData = await plugin.load('test-key');
            expect(loadedData).toEqual(testData);
        });

        test('should handle key validation', async () => {
            const plugin = new MockStoragePlugin();
            await pluginManager.loadPlugin(plugin);

            await expect(plugin.save('', 'data')).rejects.toThrow(
                'Key must be a non-empty string'
            );

            await expect(
                plugin.save('key with spaces', 'data')
            ).rejects.toThrow('Key can only contain alphanumeric characters');

            await expect(plugin.save('a'.repeat(300), 'data')).rejects.toThrow(
                'Key must be 250 characters or less'
            );
        });

        test('should handle transactions', async () => {
            const plugin = new MockStoragePlugin();
            await pluginManager.loadPlugin(plugin);

            const operations: StorageOperation[] = [
                { type: 'save', key: 'key1', data: 'value1' },
                { type: 'save', key: 'key2', data: 'value2' },
                { type: 'delete', key: 'key3' },
            ];

            await plugin.transaction(operations);

            const value1 = await plugin.load('key1');
            const value2 = await plugin.load('key2');
            expect(value1).toBe('value1');
            expect(value2).toBe('value2');
        });

        test('should provide storage statistics', async () => {
            const plugin = new MockStoragePlugin();
            await pluginManager.loadPlugin(plugin);

            await plugin.save('test-key', 'test-data');

            const stats = await plugin.getStats();
            expect(stats.itemCount).toBe(1);
            expect(stats.totalSize).toBeGreaterThan(0);
            expect(stats.backendType).toBe('memory');
            expect(stats.isHealthy).toBe(true);
        });

        test('should handle prefix filtering', async () => {
            const plugin = new MockStoragePlugin();
            await pluginManager.loadPlugin(plugin);

            await plugin.save('user:1', 'user1 data');
            await plugin.save('user:2', 'user2 data');
            await plugin.save('config:setting', 'config data');

            const userKeys = await plugin.listKeys('user:');
            expect(userKeys).toHaveLength(2);
            expect(userKeys).toContain('user:1');
            expect(userKeys).toContain('user:2');

            const allKeys = await plugin.listKeys();
            expect(allKeys).toHaveLength(3);
        });
    });
});
