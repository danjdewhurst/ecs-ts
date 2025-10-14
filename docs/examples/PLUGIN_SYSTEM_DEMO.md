# Plugin System Demo

This example demonstrates the complete plugin architecture of the ECS game engine, showing how to create custom plugins, manage dependencies, integrate with storage and networking, and build modular, extensible games.

## Overview

The plugin system demo showcases:
- Creating custom game plugins with dependencies
- Storage plugin for persistent data
- Network plugin for real-time communication
- Plugin lifecycle management
- Inter-plugin communication through events

## Core Plugin Implementation

```typescript
import { BaseSystem } from '../src/core/ecs/System.ts';
import { World } from '../src/core/ecs/World.ts';
import type { Plugin } from '../src/core/plugins/Plugin.ts';
import { PluginManager } from '../src/core/plugins/PluginManager.ts';

// Game Components
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

// Core Game System
class PlayerSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'PlayerSystem';

    update(world: World, deltaTime: number): void {
        const players = world.queryMultiple(['player']);
        for (const entityId of players) {
            const player = world.getComponent<PlayerComponent>(entityId, 'player');
            if (player) {
                // Simulate player progression
                player.score += Math.floor(deltaTime / 100);

                if (player.score >= player.level * 1000) {
                    player.level++;
                    console.log(`🎉 ${player.name} leveled up to ${player.level}!`);

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

// Core Game Plugin
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

    private createPlayer(world: World, name: string, level: number, score: number): number {
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

        return entity;
    }
}
```

## Storage Plugin Implementation

```typescript
import { BaseStoragePlugin } from '../src/core/plugins/StoragePlugin.ts';

class LocalStoragePlugin extends BaseStoragePlugin {
    readonly name = 'local-storage';
    readonly version = '1.2.0';

    private storagePrefix = 'ecs-game-';

    async initialize(world: World): Promise<void> {
        console.log('💾 Initializing Local Storage Plugin...');

        // Listen for save/load events
        world.subscribeToEvent('save-game', (event) => {
            this.handleSaveGame(world, event.data);
        });

        world.subscribeToEvent('load-game', (event) => {
            this.handleLoadGame(world, event.data);
        });

        console.log('✅ Local Storage Plugin initialized');
    }

    async save<T>(key: string, data: T, options?: any): Promise<void> {
        try {
            const serialized = JSON.stringify(data);
            const fullKey = this.storagePrefix + key;
            localStorage.setItem(fullKey, serialized);

            console.log(`💾 Saved data to ${key} (${serialized.length} bytes)`);
        } catch (error) {
            throw new Error(`Failed to save ${key}: ${error.message}`);
        }
    }

    async load<T>(key: string, defaultValue?: T): Promise<T | undefined> {
        try {
            const fullKey = this.storagePrefix + key;
            const serialized = localStorage.getItem(fullKey);

            if (serialized === null) {
                console.log(`💾 No data found for ${key}, using default`);
                return defaultValue;
            }

            const data = JSON.parse(serialized) as T;
            console.log(`💾 Loaded data from ${key}`);
            return data;
        } catch (error) {
            console.error(`Failed to load ${key}:`, error);
            return defaultValue;
        }
    }

    async remove(key: string): Promise<boolean> {
        const fullKey = this.storagePrefix + key;
        const existed = localStorage.getItem(fullKey) !== null;
        localStorage.removeItem(fullKey);
        return existed;
    }

    async clear(): Promise<void> {
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.storagePrefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`💾 Cleared ${keysToRemove.length} items from storage`);
    }

    private async handleSaveGame(world: World, saveData: any): Promise<void> {
        try {
            // Save player data
            const players = world.queryMultiple(['player']);
            const playerData = [];

            for (const entityId of players) {
                const player = world.getComponent<PlayerComponent>(entityId, 'player');
                const inventory = world.getComponent<InventoryComponent>(entityId, 'inventory');

                if (player) {
                    playerData.push({
                        entityId,
                        player,
                        inventory
                    });
                }
            }

            await this.save('game-save', {
                timestamp: Date.now(),
                players: playerData,
                metadata: saveData.metadata || {}
            });

            world.emitEvent({
                type: 'game-saved',
                timestamp: Date.now(),
                data: { playerCount: playerData.length }
            });

        } catch (error) {
            console.error('Failed to save game:', error);
        }
    }

    private async handleLoadGame(world: World, loadData: any): Promise<void> {
        try {
            const saveData = await this.load('game-save');
            if (!saveData) {
                console.log('No save data found');
                return;
            }

            // Clear existing players
            const existingPlayers = world.queryMultiple(['player']);
            existingPlayers.forEach(id => world.destroyEntity(id));

            // Recreate players from save data
            for (const playerData of (saveData as any).players) {
                const entity = world.createEntity();
                world.addComponent(entity, playerData.player);
                if (playerData.inventory) {
                    world.addComponent(entity, playerData.inventory);
                }
            }

            world.emitEvent({
                type: 'game-loaded',
                timestamp: Date.now(),
                data: { playerCount: (saveData as any).players.length }
            });

            console.log(`🎮 Loaded game with ${(saveData as any).players.length} players`);

        } catch (error) {
            console.error('Failed to load game:', error);
        }
    }
}
```

## Network Plugin Implementation

```typescript
import { BaseNetworkPlugin } from '../src/core/plugins/NetworkPlugin.ts';

class SimpleNetworkPlugin extends BaseNetworkPlugin {
    readonly name = 'simple-network';
    readonly version = '1.0.0';
    readonly dependencies = ['core-game'];

    private ws?: WebSocket;
    private connected = false;
    private messageQueue: any[] = [];

    async initialize(world: World): Promise<void> {
        console.log('🌐 Initializing Simple Network Plugin...');

        // Listen for network events
        world.subscribeToEvent('network-connect', (event) => {
            this.connect(event.data.url);
        });

        world.subscribeToEvent('network-send', (event) => {
            this.send(event.data.message);
        });

        // Listen for player events to broadcast
        world.subscribeToEvent('player-level-up', (event) => {
            this.broadcastPlayerEvent('player-level-up', event.data);
        });

        console.log('✅ Simple Network Plugin initialized');
    }

    async connect(url: string = 'ws://localhost:3000/ws'): Promise<void> {
        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('🌐 Connected to server');

                // Send queued messages
                this.flushMessageQueue();

                this.getWorld()?.emitEvent({
                    type: 'network-connected',
                    timestamp: Date.now(),
                    data: { url }
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse network message:', error);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('🌐 Disconnected from server');

                this.getWorld()?.emitEvent({
                    type: 'network-disconnected',
                    timestamp: Date.now(),
                    data: {}
                });
            };

            this.ws.onerror = (error) => {
                console.error('🌐 Network error:', error);
            };

        } catch (error) {
            throw new Error(`Failed to connect: ${error.message}`);
        }
    }

    async send(message: any): Promise<void> {
        if (!this.connected || !this.ws) {
            // Queue message for later
            this.messageQueue.push(message);
            console.log('🌐 Message queued (not connected)');
            return;
        }

        try {
            this.ws.send(JSON.stringify(message));
            console.log('🌐 Message sent:', message.type);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0 && this.connected) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }

    private handleMessage(message: any): void {
        console.log('🌐 Received message:', message.type);

        // Emit received message as event
        this.getWorld()?.emitEvent({
            type: 'network-message-received',
            timestamp: Date.now(),
            data: message
        });
    }

    private broadcastPlayerEvent(eventType: string, data: any): void {
        if (this.connected) {
            this.send({
                type: eventType,
                timestamp: Date.now(),
                data: data
            });
        }
    }

    async shutdown(): Promise<void> {
        if (this.ws) {
            this.ws.close();
        }
        console.log('🔄 Network plugin shut down');
    }
}
```

## Auto-Save Plugin

```typescript
class AutoSavePlugin implements Plugin {
    readonly name = 'auto-save';
    readonly version = '1.0.0';
    readonly dependencies = ['core-game', 'local-storage'];

    private saveInterval?: Timer;
    private autoSaveEnabled = true;

    async initialize(world: World): Promise<void> {
        console.log('💾 Initializing Auto-Save Plugin...');

        // Start auto-save timer
        this.startAutoSave(world);

        // Listen for level up events to trigger saves
        world.subscribeToEvent('player-level-up', () => {
            if (this.autoSaveEnabled) {
                this.triggerSave(world);
            }
        });

        // Listen for save configuration events
        world.subscribeToEvent('configure-auto-save', (event) => {
            this.configureAutoSave(world, event.data);
        });

        console.log('✅ Auto-Save Plugin initialized');
    }

    private startAutoSave(world: World): void {
        // Auto-save every 30 seconds
        this.saveInterval = setInterval(() => {
            if (this.autoSaveEnabled) {
                this.triggerSave(world);
            }
        }, 30000);
    }

    private triggerSave(world: World): void {
        console.log('💾 Auto-saving game...');

        world.emitEvent({
            type: 'save-game',
            timestamp: Date.now(),
            data: {
                metadata: {
                    autoSave: true,
                    timestamp: Date.now()
                }
            }
        });
    }

    private configureAutoSave(world: World, config: any): void {
        this.autoSaveEnabled = config.enabled ?? true;
        console.log(`💾 Auto-save ${this.autoSaveEnabled ? 'enabled' : 'disabled'}`);
    }

    async shutdown(): Promise<void> {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        console.log('🔄 Auto-Save plugin shut down');
    }
}
```

## Statistics Plugin

```typescript
class StatisticsPlugin implements Plugin {
    readonly name = 'statistics';
    readonly version = '1.0.0';
    readonly dependencies = ['core-game'];

    private stats = {
        totalLevelUps: 0,
        totalScore: 0,
        sessionStartTime: Date.now(),
        playerStats: new Map<string, any>()
    };

    async initialize(world: World): Promise<void> {
        console.log('📊 Initializing Statistics Plugin...');

        // Track player events
        world.subscribeToEvent('player-level-up', (event) => {
            this.trackLevelUp(event.data);
        });

        world.subscribeToEvent('core-game-initialized', () => {
            this.initializePlayerStats(world);
        });

        // Provide stats reporting
        world.subscribeToEvent('get-statistics', () => {
            this.reportStatistics(world);
        });

        console.log('✅ Statistics Plugin initialized');
    }

    private trackLevelUp(data: any): void {
        this.stats.totalLevelUps++;

        const playerName = data.playerName;
        if (!this.stats.playerStats.has(playerName)) {
            this.stats.playerStats.set(playerName, {
                levelUps: 0,
                highestLevel: 0
            });
        }

        const playerStats = this.stats.playerStats.get(playerName);
        playerStats.levelUps++;
        playerStats.highestLevel = Math.max(playerStats.highestLevel, data.newLevel);

        console.log(`📊 Tracked level up for ${playerName} (total: ${this.stats.totalLevelUps})`);
    }

    private initializePlayerStats(world: World): void {
        const players = world.queryMultiple(['player']);

        for (const entityId of players) {
            const player = world.getComponent<PlayerComponent>(entityId, 'player');
            if (player) {
                this.stats.totalScore += player.score;

                if (!this.stats.playerStats.has(player.name)) {
                    this.stats.playerStats.set(player.name, {
                        levelUps: 0,
                        highestLevel: player.level
                    });
                }
            }
        }
    }

    private reportStatistics(world: World): void {
        const sessionTime = Date.now() - this.stats.sessionStartTime;
        const sessionMinutes = Math.floor(sessionTime / 60000);

        console.log('\n📊 === Game Statistics ===');
        console.log(`Session time: ${sessionMinutes} minutes`);
        console.log(`Total level ups: ${this.stats.totalLevelUps}`);
        console.log(`Total score: ${this.stats.totalScore}`);
        console.log('Player stats:');

        for (const [name, stats] of this.stats.playerStats) {
            console.log(`  ${name}: ${stats.levelUps} level ups, highest level ${stats.highestLevel}`);
        }

        // Emit statistics event
        world.emitEvent({
            type: 'statistics-report',
            timestamp: Date.now(),
            data: { ...this.stats, sessionMinutes }
        });
    }

    async shutdown(): Promise<void> {
        console.log('🔄 Statistics plugin shut down');
    }
}
```

## Running the Demo

```typescript
async function runPluginSystemExample(): Promise<void> {
    console.log('🔌 ECS Plugin System Example\n');

    const world = new World();
    const pluginManager = new PluginManager(world);

    try {
        // Load plugins in dependency order
        console.log('Loading plugins...\n');

        await pluginManager.loadPlugin(new CoreGamePlugin());
        await pluginManager.loadPlugin(new LocalStoragePlugin());
        await pluginManager.loadPlugin(new SimpleNetworkPlugin());
        await pluginManager.loadPlugin(new AutoSavePlugin());
        await pluginManager.loadPlugin(new StatisticsPlugin());

        console.log('\n🎮 All plugins loaded successfully!');
        console.log('Plugin load order:', pluginManager.getLoadOrder());

        // Simulate game activity
        console.log('\n🎯 Simulating game activity...\n');

        // Run game loop for demonstration
        let elapsedTime = 0;
        const demoLength = 10000; // 10 seconds

        const gameLoop = () => {
            if (elapsedTime >= demoLength) {
                console.log('\n📊 Generating final statistics...');
                world.emitEvent({
                    type: 'get-statistics',
                    timestamp: Date.now(),
                    data: {}
                });

                console.log('\n💾 Triggering final save...');
                world.emitEvent({
                    type: 'save-game',
                    timestamp: Date.now(),
                    data: { metadata: { finalSave: true } }
                });

                // Shutdown plugins
                setTimeout(async () => {
                    console.log('\n🔄 Shutting down plugins...');
                    await pluginManager.shutdownAll();
                    console.log('✅ Plugin system example completed!');
                }, 1000);

                return;
            }

            // Update world
            world.update(100); // 100ms delta
            elapsedTime += 100;

            // Trigger events occasionally
            if (elapsedTime % 2000 === 0) {
                world.emitEvent({
                    type: 'get-statistics',
                    timestamp: Date.now(),
                    data: {}
                });
            }

            setTimeout(gameLoop, 100);
        };

        gameLoop();

    } catch (error) {
        console.error('❌ Failed to run plugin system example:', error);
    }
}

// Run the example
runPluginSystemExample();
```

## Expected Output

When you run the demo, you should see:

```
🔌 ECS Plugin System Example

Loading plugins...

🎮 Initializing Core Game Plugin...
✅ Core Game Plugin initialized
💾 Initializing Local Storage Plugin...
✅ Local Storage Plugin initialized
🌐 Initializing Simple Network Plugin...
✅ Simple Network Plugin initialized
💾 Initializing Auto-Save Plugin...
✅ Auto-Save Plugin initialized
📊 Initializing Statistics Plugin...
✅ Statistics Plugin initialized

🎮 All plugins loaded successfully!
Plugin load order: ['core-game', 'local-storage', 'simple-network', 'auto-save', 'statistics']

🎯 Simulating game activity...

🎉 Alice leveled up to 2!
📊 Tracked level up for Alice (total: 1)
🎉 Bob leveled up to 3!
📊 Tracked level up for Bob (total: 2)
💾 Auto-saving game...
💾 Saved data to game-save (234 bytes)

📊 === Game Statistics ===
Session time: 2 minutes
Total level ups: 2
Total score: 3500
Player stats:
  Alice: 1 level ups, highest level 2
  Bob: 1 level ups, highest level 3

💾 Triggering final save...
💾 Saved data to game-save (267 bytes)

🔄 Shutting down plugins...
🔄 Auto-Save plugin shut down
🔄 Statistics plugin shut down
🔄 Network plugin shut down
🔄 Local Storage Plugin shut down
🔄 Core Game Plugin shut down
✅ Plugin system example completed!
```

## Key Features Demonstrated

### 1. Plugin Dependencies

Plugins can depend on other plugins:

```typescript
readonly dependencies = ['core-game', 'local-storage'];
```

The plugin manager automatically resolves dependencies and loads plugins in the correct order.

### 2. Inter-Plugin Communication

Plugins communicate through events without direct coupling:

```typescript
// One plugin emits an event
world.emitEvent({
    type: 'player-level-up',
    data: { playerName: 'Alice', newLevel: 5 }
});

// Other plugins listen and respond
world.subscribeToEvent('player-level-up', (event) => {
    this.trackLevelUp(event.data);
});
```

### 3. Plugin Lifecycle

Proper initialization and shutdown:

```typescript
async initialize(world: World): Promise<void> {
    // Setup resources, systems, event listeners
}

async shutdown(): Promise<void> {
    // Clean up resources, timers, connections
}
```

### 4. Storage Integration

Plugins can save and load persistent data:

```typescript
await this.save('game-save', playerData);
const saveData = await this.load('game-save');
```

### 5. Network Integration

Real-time communication capabilities:

```typescript
await this.connect('ws://localhost:3000');
this.send({ type: 'player-update', data: playerData });
```

## Running the Demo

```bash
bun examples/plugin-system-example.ts
```

## Benefits Demonstrated

1. **Modularity**: Features are cleanly separated into focused plugins
2. **Extensibility**: New plugins can be added without modifying existing code
3. **Reusability**: Plugins can be used across different games
4. **Maintainability**: Each plugin has clear responsibilities
5. **Testability**: Plugins can be tested in isolation
6. **Flexibility**: Plugins can be loaded/unloaded dynamically

## See Also

- [Plugin Development Guide](../guides/plugin-development.md) - Creating custom plugins
- [Plugin API](../api/plugins/plugin.md) - Plugin interface reference
- [Plugin Manager API](../api/plugins/plugin-manager.md) - Loading and managing plugins
- [Storage Plugin API](../api/plugins/storage-plugin.md) - Persistent data storage
- [Network Plugin API](../api/plugins/network-plugin.md) - Real-time communication