#!/usr/bin/env bun

import {
    createPlayerComponent,
    createPositionComponent,
} from '../src/components';
import { BaseSystem } from '../src/core/ecs/System';
import { World } from '../src/core/ecs/World';
import { GameServer } from '../src/core/websocket/GameServer';

// Game state synchronization system
class GameStateSyncSystem extends BaseSystem {
    readonly priority = 100;
    readonly name = 'GameStateSyncSystem';
    private lastSyncTime = 0;
    private readonly syncInterval = 1000 / 20; // 20 FPS

    update(world: World, deltaTime: number): void {
        this.lastSyncTime += deltaTime;

        if (this.lastSyncTime >= this.syncInterval) {
            this.syncGameState(world);
            this.lastSyncTime = 0;
        }
    }

    private syncGameState(world: World): void {
        const playerEntities = world.queryMultiple(['player', 'position']);
        const gameState = [];

        for (const entityId of playerEntities) {
            const player = world.getComponent(entityId, 'player') as any;
            const position = world.getComponent(entityId, 'position') as any;

            if (player && position) {
                gameState.push({
                    id: entityId,
                    components: {
                        player: {
                            name: player.name,
                            health: player.health,
                            maxHealth: player.maxHealth,
                            score: player.score,
                        },
                        position: {
                            x: position.x,
                            y: position.y,
                            z: position.z,
                        },
                    },
                });
            }
        }

        world.emitEvent({
            type: 'game_state_update',
            timestamp: Date.now(),
            source: 'server',
            data: { entities: gameState },
        });
    }
}

// Player input handling system
class PlayerInputSystem extends BaseSystem {
    readonly priority = 10;
    readonly name = 'PlayerInputSystem';

    update(world: World): void {
        // Input handling is done via event listeners
        // This system could process queued input events
    }
}

async function main() {
    console.log('🎮 Starting WebSocket Game Server Example...');

    // Create game world
    const world = new World();

    // Add systems
    world.addSystem(new PlayerInputSystem());
    world.addSystem(new GameStateSyncSystem());

    // Create game server
    const server = new GameServer(world, {
        port: 3000,
        heartbeatInterval: 5000,
        clientTimeout: 15000,
        maxClients: 10,
    });

    // Set up event handlers
    setupEventHandlers(world, server);

    // Start server
    try {
        await server.start();
        console.log('🚀 Game server started successfully!');
        console.log('📡 WebSocket endpoint: ws://localhost:3000/ws');
        console.log('🔍 Health check: http://localhost:3000/health');
        console.log('');
        console.log('To test the server:');
        console.log('1. Open a WebSocket client (like wscat)');
        console.log('2. Connect to ws://localhost:3000/ws');
        console.log('3. Send authentication message:');
        console.log(
            '   {"type":"system","timestamp":1234567890,"payload":{"command":"authenticate","data":{"name":"TestPlayer"}}}'
        );
        console.log('');
        console.log('Press Ctrl+C to stop the server');

        // Game loop
        let lastTime = Date.now();
        const targetFPS = 60;
        const frameTime = 1000 / targetFPS;

        const gameLoop = () => {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            // Update world
            world.update(deltaTime);

            // Schedule next frame
            setTimeout(gameLoop, Math.max(0, frameTime - deltaTime));
        };

        gameLoop();
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down server...');
        server.stop();
        process.exit(0);
    });
}

function setupEventHandlers(world: World, server: GameServer): void {
    // Handle client authentication
    world.subscribeToEvent('client_authenticated', (event) => {
        const { clientId, entityId } = event.data as {
            clientId: string;
            entityId: number;
        };
        console.log(
            `✅ Client ${clientId} authenticated with entity ${entityId}`
        );

        // Create player components
        const playerComponent = createPlayerComponent(
            clientId,
            `Player_${clientId.slice(-4)}`
        );
        const positionComponent = createPositionComponent(
            Math.random() * 100,
            Math.random() * 100
        );

        world.addComponent(entityId, playerComponent);
        world.addComponent(entityId, positionComponent);

        // Send welcome message
        server.sendToClient(clientId, {
            type: 'system',
            timestamp: Date.now(),
            payload: {
                command: 'welcome',
                data: {
                    entityId,
                    message: `Welcome ${playerComponent.name}! You spawned at (${Math.round(positionComponent.x)}, ${Math.round(positionComponent.y)})`,
                },
            },
        });
    });

    // Handle client messages
    world.subscribeToEvent('client_message', (event) => {
        const { message, clientId } = event.data as {
            message: any;
            clientId: string;
        };

        // Find player entity for this client
        const playerEntities = world.queryMultiple(['player']);
        const playerEntity = playerEntities.find((entityId) => {
            const player = world.getComponent(entityId, 'player') as any;
            return player?.clientId === clientId;
        });

        if (!playerEntity) {
            console.warn(`No player entity found for client ${clientId}`);
            return;
        }

        // Handle different message types
        switch (message.type) {
            case 'input':
                handlePlayerInput(
                    world,
                    server,
                    playerEntity,
                    clientId,
                    message
                );
                break;
            default:
                console.log(
                    `📨 Received ${message.type} from ${clientId}:`,
                    message.payload
                );
        }
    });

    // Handle client disconnection
    world.subscribeToEvent('client_disconnected', (event) => {
        const { clientId } = event.data as { clientId: string };
        console.log(`👋 Client ${clientId} disconnected`);
    });
}

function handlePlayerInput(
    world: World,
    server: GameServer,
    playerEntity: number,
    clientId: string,
    message: any
): void {
    const { action, data } = message.payload;

    switch (action) {
        case 'move': {
            const position = world.getComponent(
                playerEntity,
                'position'
            ) as any;
            if (position && data.x !== undefined && data.y !== undefined) {
                // Validate movement (simple bounds checking)
                const newX = Math.max(0, Math.min(100, data.x));
                const newY = Math.max(0, Math.min(100, data.y));

                position.x = newX;
                position.y = newY;

                console.log(
                    `🏃 Player ${clientId} moved to (${newX}, ${newY})`
                );

                // Broadcast movement to other players
                server.broadcast(
                    {
                        type: 'event',
                        timestamp: Date.now(),
                        payload: {
                            eventType: 'player_moved',
                            eventData: {
                                entityId: playerEntity,
                                clientId,
                                x: newX,
                                y: newY,
                            },
                        },
                    },
                    [clientId]
                ); // Exclude the moving player
            }
            break;
        }

        case 'chat': {
            const player = world.getComponent(playerEntity, 'player') as any;
            if (player && data.message) {
                const chatMessage = {
                    type: 'event' as const,
                    timestamp: Date.now(),
                    payload: {
                        eventType: 'chat_message',
                        eventData: {
                            from: player.name,
                            message: data.message,
                        },
                    },
                };

                console.log(`💬 ${player.name}: ${data.message}`);
                server.broadcast(chatMessage);
            }
            break;
        }

        default:
            console.log(`❓ Unknown action: ${action} from ${clientId}`);
    }
}

// Only run if this file is executed directly
if (import.meta.main) {
    main().catch(console.error);
}
