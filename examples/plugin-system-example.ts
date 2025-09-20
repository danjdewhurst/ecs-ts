/**
 * Plugin System Example
 *
 * This example demonstrates the complete plugin architecture including:
 * - Creating custom plugins with dependencies
 * - Plugin lifecycle management
 * - Integration with ECS systems and components
 * - Event-driven plugin communication
 * - Storage and networking plugin implementations
 */

import type { ServerWebSocket } from 'bun';
import type { Component } from '../src/core/ecs/Component.ts';
import { BaseSystem } from '../src/core/ecs/System.ts';
import { World } from '../src/core/ecs/World.ts';
import {
    BaseNetworkPlugin,
    BaseStoragePlugin,
} from '../src/core/plugins/index.ts';
import type { Plugin } from '../src/core/plugins/Plugin.ts';
import { PluginManager } from '../src/core/plugins/PluginManager.ts';
import type {
    StorageMetadata,
    StorageOperation,
    StorageOptions,
    StorageStats,
} from '../src/core/plugins/StoragePlugin.ts';
import type {
    GameClient,
    ServerMessage,
} from '../src/core/websocket/GameClient.ts';
import type { NetworkMessage } from '../src/core/websocket/NetworkMessage.ts';

// ============================================================================
// Game Components
// ============================================================================

interface PlayerComponent extends Component {
    readonly type: 'player';
    name: string;
    level: number;
    score: number;
}

interface InventoryComponent extends Component {
    readonly type: 'inventory';
    items: Array<{ id: string; name: string; quantity: number }>;
}

// ============================================================================
// Game Systems
// ============================================================================

class PlayerSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'PlayerSystem';

    update(world: World, deltaTime: number): void {
        const players = world.queryMultiple(['player']);
        for (const entityId of players) {
            const player = world.getComponent<PlayerComponent>(
                entityId,
                'player'
            );
            if (player) {
                // Simulate player progression
                player.score += Math.floor(deltaTime / 100);

                if (player.score >= player.level * 1000) {
                    player.level++;
                    console.log(
                        `🎉 ${player.name} leveled up to ${player.level}!`
                    );

                    // Emit level up event
                    world.emitEvent({
                        type: 'player-level-up',
                        timestamp: Date.now(),
                        data: {
                            entityId,
                            playerName: player.name,
                            newLevel: player.level,
                        },
                    });
                }
            }
        }
    }
}

// ============================================================================
// Core Plugins
// ============================================================================

/**
 * Core Game Plugin - Provides basic game functionality
 */
class CoreGamePlugin implements Plugin {
    readonly name = 'core-game';
    readonly version = '1.0.0';

    private playerSystem = new PlayerSystem();

    async initialize(world: World): Promise<void> {
        console.log('🎮 Initializing Core Game Plugin...');

        // Register game systems
        world.addSystem(this.playerSystem);

        // Create sample players
        this.createPlayer(world, 'Alice', 1, 0);
        this.createPlayer(world, 'Bob', 2, 1500);

        // Emit core initialized event
        world.emitEvent({
            type: 'core-game-initialized',
            timestamp: Date.now(),
            data: { message: 'Core game systems are ready' },
        });

        console.log('✅ Core Game Plugin initialized');
    }

    async shutdown(): Promise<void> {
        console.log('🔄 Shutting down Core Game Plugin...');
    }

    private createPlayer(
        world: World,
        name: string,
        level: number,
        score: number
    ): number {
        const entity = world.createEntity();

        world.addComponent<PlayerComponent>(entity, {
            type: 'player',
            name,
            level,
            score,
        });

        world.addComponent<InventoryComponent>(entity, {
            type: 'inventory',
            items: [
                { id: 'sword', name: 'Iron Sword', quantity: 1 },
                { id: 'potion', name: 'Health Potion', quantity: 3 },
            ],
        });

        console.log(
            `👤 Created player: ${name} (Level ${level}, Score: ${score})`
        );
        return entity;
    }
}

/**
 * Memory Storage Plugin Implementation
 */
class MemoryStoragePlugin extends BaseStoragePlugin {
    readonly name = 'memory-storage';
    readonly version = '1.0.0';

    private storage = new Map<
        string,
        { data: string; metadata: StorageMetadata }
    >();

    constructor() {
        super({
            backend: 'memory',
            maxSize: 1024 * 1024, // 1MB
            defaultTtl: 0,
        });
    }

    async initialize(world: World): Promise<void> {
        console.log('💾 Initializing Memory Storage Plugin...');

        // Listen for player events and save data
        world.subscribeToEvent('player-level-up', async (event) => {
            const { entityId, playerName, newLevel } = event.data as {
                entityId: number;
                playerName: string;
                newLevel: number;
            };
            await this.save(`player:${entityId}:level`, newLevel);
            console.log(`💾 Saved level ${newLevel} for player ${playerName}`);
        });

        console.log('✅ Memory Storage Plugin initialized');
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

    async load<T = unknown>(key: string): Promise<T | undefined> {
        this.validateKey(key);
        const item = this.storage.get(key);
        if (!item) return undefined;

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
        return prefix ? keys.filter((key) => key.startsWith(prefix)) : keys;
    }

    async clear(): Promise<void> {
        this.storage.clear();
    }

    async getMetadata(key: string): Promise<StorageMetadata | undefined> {
        this.validateKey(key);
        return this.storage.get(key)?.metadata;
    }

    async transaction(operations: StorageOperation[]): Promise<void> {
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
                avgReadTime: 0.1,
                avgWriteTime: 0.1,
                operationCount: 0,
            },
        };
    }
}

/**
 * Mock Network Plugin Implementation
 */
class MockNetworkPlugin extends BaseNetworkPlugin {
    readonly name = 'mock-network';
    readonly version = '1.0.0';
    override readonly dependencies = ['core-game'];

    private clients = new Map<string, GameClient>();
    private messageHandlers = new Map<
        string,
        ((clientId: string, message: unknown, client: GameClient) => void)[]
    >();
    private connectHandlers: ((client: GameClient) => void)[] = [];
    private disconnectHandlers: ((
        clientId: string,
        reason?: string
    ) => void)[] = [];

    constructor() {
        super({
            maxClients: 10,
            heartbeatInterval: 30000,
        });
    }

    async initialize(world: World): Promise<void> {
        console.log('🌐 Initializing Mock Network Plugin...');

        // Listen for player events and broadcast them
        world.subscribeToEvent('player-level-up', (event) => {
            this.broadcast({
                type: 'event',
                timestamp: Date.now(),
                payload: {
                    eventType: 'player-level-up',
                    eventData: event.data,
                },
            });
        });

        // Simulate some clients connecting
        this.simulateClientConnection('client-1', 'Alice');
        this.simulateClientConnection('client-2', 'Bob');

        console.log('✅ Mock Network Plugin initialized');
    }

    // Network plugin method implementations (simplified for demo)
    async sendToClient(
        clientId: string,
        message: NetworkMessage
    ): Promise<void> {
        const client = this.clients.get(clientId);
        if (!client) throw new Error(`Client ${clientId} not found`);
        console.log(`📡 Sending to ${clientId}:`, message.type);
    }

    async sendServerMessage(
        clientId: string,
        message: ServerMessage
    ): Promise<void> {
        const client = this.clients.get(clientId);
        if (!client) throw new Error(`Client ${clientId} not found`);
        console.log(`📡 Server message to ${clientId}:`, message.type);
    }

    async broadcast(
        message: NetworkMessage,
        exclude?: string[]
    ): Promise<void> {
        console.log(
            `📢 Broadcasting ${message.type} to ${this.getClientCount()} clients`
        );
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

    async disconnectClient(clientId: string, reason?: string): Promise<void> {
        if (this.clients.delete(clientId)) {
            console.log(
                `🔌 Client ${clientId} disconnected: ${reason || 'No reason'}`
            );
            this.disconnectHandlers.forEach((h) => {
                h(clientId, reason);
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
                if (index !== -1) handlers.splice(index, 1);
            }
        };
    }

    onClientConnect(handler: (client: GameClient) => void): () => void {
        this.connectHandlers.push(handler);
        return () => {
            const index = this.connectHandlers.indexOf(handler);
            if (index !== -1) this.connectHandlers.splice(index, 1);
        };
    }

    onClientDisconnect(
        handler: (clientId: string, reason?: string) => void
    ): () => void {
        this.disconnectHandlers.push(handler);
        return () => {
            const index = this.disconnectHandlers.indexOf(handler);
            if (index !== -1) this.disconnectHandlers.splice(index, 1);
        };
    }

    private simulateClientConnection(
        clientId: string,
        playerName: string
    ): void {
        const client: GameClient = {
            id: clientId,
            ws: {} as ServerWebSocket<unknown>,
            lastHeartbeat: Date.now(),
            isAuthenticated: true,
            metadata: { playerName },
        };

        this.clients.set(clientId, client);
        console.log(`🔗 Client connected: ${clientId} (${playerName})`);
        this.connectHandlers.forEach((h) => {
            h(client);
        });
    }
}

/**
 * Statistics Plugin - Depends on storage plugin
 */
class StatisticsPlugin implements Plugin {
    readonly name = 'statistics';
    readonly version = '1.0.0';
    readonly dependencies = ['memory-storage'];

    async initialize(world: World): Promise<void> {
        console.log('📊 Initializing Statistics Plugin...');

        // Track game events for statistics
        world.subscribeToEvent('player-level-up', async (event) => {
            const timestamp = Date.now();
            const _key = `stats:level-ups:${timestamp}`;

            // Get storage plugin instance (would be provided via dependency injection in real implementation)
            // For demo purposes, we'll just log what we would store
            console.log(
                `📊 Recording level-up stat for ${event.data.playerName}`
            );
        });

        console.log('✅ Statistics Plugin initialized');
    }

    async shutdown(): Promise<void> {
        console.log('📊 Shutting down Statistics Plugin...');
    }
}

// ============================================================================
// Main Example
// ============================================================================

async function runPluginSystemExample(): Promise<void> {
    console.log('🚀 Starting Plugin System Example...\n');

    // Create world and plugin manager
    const world = new World();
    const pluginManager = new PluginManager(world);

    try {
        // Create plugins
        const corePlugin = new CoreGamePlugin();
        const storagePlugin = new MemoryStoragePlugin();
        const networkPlugin = new MockNetworkPlugin();
        const statsPlugin = new StatisticsPlugin();

        console.log('📦 Loading plugins...\n');

        // Load plugins (dependencies will be resolved automatically)
        await pluginManager.loadPlugin(corePlugin);
        await pluginManager.loadPlugin(storagePlugin);
        await pluginManager.loadPlugin(networkPlugin);
        await pluginManager.loadPlugin(statsPlugin);

        console.log('\n📋 Plugin load order:', pluginManager.getLoadOrder());
        console.log(
            '📋 Loaded plugins:',
            pluginManager
                .getAllPluginMetadata()
                .map((m) => `${m.name} v${m.version}`)
        );

        console.log('\n🎮 Running game simulation...\n');

        // Run game simulation for 10 seconds
        for (let i = 0; i < 10; i++) {
            world.update(1000); // 1 second per update
            await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for readability
        }

        console.log('\n💾 Storage statistics:');
        const stats = await storagePlugin.getStats();
        console.log(`  Items stored: ${stats.itemCount}`);
        console.log(`  Total size: ${stats.totalSize} bytes`);
        console.log(`  Backend: ${stats.backendType}`);

        console.log('\n🔍 Stored data:');
        const keys = await storagePlugin.listKeys();
        for (const key of keys) {
            const value = await storagePlugin.load(key);
            console.log(`  ${key}: ${value}`);
        }

        console.log('\n🌐 Network status:');
        console.log(`  Connected clients: ${networkPlugin.getClientCount()}`);
        networkPlugin.getConnectedClients().forEach((client) => {
            console.log(`    - ${client.id} (${client.metadata.playerName})`);
        });

        console.log('\n🔄 Shutting down plugins...');
        await pluginManager.shutdownAll();
    } catch (error) {
        console.error(
            '❌ Error in plugin system:',
            error instanceof Error ? error.message : String(error)
        );
    }

    console.log('\n✅ Plugin System Example completed!');
}

// ============================================================================
// Error Demonstration
// ============================================================================

async function demonstrateErrorHandling(): Promise<void> {
    console.log('\n🔧 Demonstrating error handling...\n');

    const world = new World();
    const pluginManager = new PluginManager(world);

    // Plugin with missing dependency
    class FailingPlugin implements Plugin {
        readonly name = 'failing-plugin';
        readonly version = '1.0.0';
        readonly dependencies = ['non-existent-plugin'];

        async initialize(): Promise<void> {
            throw new Error('This plugin always fails');
        }
    }

    try {
        await pluginManager.loadPlugin(new FailingPlugin());
    } catch (error) {
        console.log(
            '✅ Caught expected error:',
            error instanceof Error ? error.message : String(error)
        );
    }

    // Circular dependency demonstration
    class PluginA implements Plugin {
        readonly name = 'plugin-a';
        readonly version = '1.0.0';
        readonly dependencies = ['plugin-b'];
        async initialize(): Promise<void> {}
    }

    class PluginB implements Plugin {
        readonly name = 'plugin-b';
        readonly version = '1.0.0';
        readonly dependencies = ['plugin-a'];
        async initialize(): Promise<void> {}
    }

    try {
        await pluginManager.loadPlugin(new PluginA());
        await pluginManager.loadPlugin(new PluginB());
    } catch (error) {
        console.log(
            '✅ Caught circular dependency:',
            error instanceof Error ? error.message : String(error)
        );
    }
}

// ============================================================================
// Run Example
// ============================================================================

if (import.meta.main) {
    await runPluginSystemExample();
    await demonstrateErrorHandling();
}
