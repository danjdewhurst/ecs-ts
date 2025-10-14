# WebSocket Multiplayer Demo

This example demonstrates how to build a real-time multiplayer game using the built-in WebSocket functionality. It shows client-server communication, state synchronization, and player management in a multiplayer environment.

## Overview

The multiplayer demo creates:
- A WebSocket server that manages multiple connected players
- Real-time synchronization of player positions and game state
- Client authentication and connection management
- Event-driven networking architecture

## Server Implementation

```typescript
#!/usr/bin/env bun

import {
    createPlayerComponent,
    createPositionComponent,
    type PlayerComponent,
    type PositionComponent,
} from '../src/components';
import { BaseSystem } from '../src/core/ecs/System';
import { World } from '../src/core/ecs/World';
import { GameServer } from '../src/core/websocket/GameServer';

// Game State Synchronization System
class GameStateSyncSystem extends BaseSystem {
    readonly priority = 100;
    readonly name = 'GameStateSyncSystem';
    private lastSyncTime = 0;
    private readonly syncInterval = 1000 / 20; // 20 FPS sync rate

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
            const player = world.getComponent(
                entityId,
                'player'
            ) as PlayerComponent | null;
            const position = world.getComponent(
                entityId,
                'position'
            ) as PositionComponent | null;

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

        // Emit game state update event
        world.emitEvent({
            type: 'game_state_update',
            timestamp: Date.now(),
            source: 'server',
            data: { entities: gameState },
        });
    }
}

// Player Input Handling System
class PlayerInputSystem extends BaseSystem {
    readonly priority = 10;
    readonly name = 'PlayerInputSystem';

    initialize(world: World): void {
        // Listen for player input events from clients
        world.subscribeToEvent('player_input', (event) => {
            this.handlePlayerInput(world, event.data);
        });
    }

    update(_world: World): void {
        // Input handling is done via event listeners
    }

    private handlePlayerInput(world: World, inputData: any): void {
        const { clientId, input } = inputData;

        // Find player entity for this client
        const playerEntities = world.queryMultiple(['player']);
        let playerEntity = null;

        for (const entityId of playerEntities) {
            const player = world.getComponent(entityId, 'player') as PlayerComponent;
            if (player && player.clientId === clientId) {
                playerEntity = entityId;
                break;
            }
        }

        if (playerEntity) {
            this.applyInputToPlayer(world, playerEntity, input);
        }
    }

    private applyInputToPlayer(world: World, playerId: number, input: any): void {
        const position = world.getComponent(playerId, 'position') as PositionComponent;

        if (position) {
            const speed = 5; // pixels per frame
            const { moveX, moveY } = input;

            // Apply movement input
            position.x += moveX * speed;
            position.y += moveY * speed;

            // Keep player within bounds
            position.x = Math.max(0, Math.min(800, position.x));
            position.y = Math.max(0, Math.min(600, position.y));

            // Mark position as dirty for synchronization
            world.markComponentDirty(playerId, 'position');
        }
    }
}

// Event handlers for server lifecycle
function setupEventHandlers(world: World, server: GameServer): void {
    // Client connection events
    world.subscribeToEvent('client_connected', (event) => {
        console.log(`🔌 Client connected: ${event.data.clientId}`);
    });

    world.subscribeToEvent('client_disconnected', (event) => {
        console.log(`🔌 Client disconnected: ${event.data.clientId}`);
        handleClientDisconnection(world, event.data.clientId);
    });

    // Authentication events
    world.subscribeToEvent('client_authenticated', (event) => {
        console.log(`✅ Client authenticated: ${event.data.name}`);
        createPlayerForClient(world, event.data.clientId, event.data.name);
    });

    // Game state synchronization
    world.subscribeToEvent('game_state_update', (event) => {
        server.broadcast({
            type: 'game_state',
            timestamp: Date.now(),
            data: event.data
        });
    });
}

function createPlayerForClient(world: World, clientId: string, playerName: string): void {
    const playerEntity = world.createEntity();

    // Add player component
    world.addComponent(playerEntity, createPlayerComponent({
        name: playerName,
        clientId: clientId,
        health: 100,
        maxHealth: 100,
        score: 0
    }));

    // Add position component (random spawn position)
    world.addComponent(playerEntity, createPositionComponent({
        x: Math.random() * 700 + 50,
        y: Math.random() * 500 + 50,
        z: 0
    }));

    console.log(`👤 Created player ${playerName} for client ${clientId}`);

    // Notify all clients about new player
    world.emitEvent({
        type: 'player_joined',
        timestamp: Date.now(),
        data: {
            entityId: playerEntity,
            playerName: playerName,
            clientId: clientId
        }
    });
}

function handleClientDisconnection(world: World, clientId: string): void {
    // Find and remove player entity
    const playerEntities = world.queryMultiple(['player']);

    for (const entityId of playerEntities) {
        const player = world.getComponent(entityId, 'player') as PlayerComponent;
        if (player && player.clientId === clientId) {
            console.log(`🗑️  Removing player ${player.name}`);

            // Notify other clients
            world.emitEvent({
                type: 'player_left',
                timestamp: Date.now(),
                data: {
                    entityId: entityId,
                    playerName: player.name,
                    clientId: clientId
                }
            });

            // Remove player entity
            world.destroyEntity(entityId);
            break;
        }
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

// Start the server
main();
```

## Client Implementation

```typescript
// Simple HTML/JavaScript client example
const client = `
<!DOCTYPE html>
<html>
<head>
    <title>Multiplayer Game Client</title>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial; }
        #gameArea {
            width: 800px;
            height: 600px;
            border: 2px solid #333;
            position: relative;
            background: #f0f0f0;
        }
        .player {
            position: absolute;
            width: 20px;
            height: 20px;
            background: #ff6b6b;
            border-radius: 50%;
            transition: all 0.1s;
        }
        .local-player { background: #4ecdc4; }
        #info { margin-bottom: 10px; }
        #controls { margin-top: 10px; }
    </style>
</head>
<body>
    <div id="info">
        <div>Status: <span id="status">Disconnected</span></div>
        <div>Players online: <span id="playerCount">0</span></div>
    </div>

    <div id="gameArea"></div>

    <div id="controls">
        <p>Use WASD or Arrow keys to move</p>
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()">Disconnect</button>
    </div>

    <script>
        let ws = null;
        let playerId = null;
        let players = new Map();
        let keys = {};

        function connect() {
            if (ws) return;

            ws = new WebSocket('ws://localhost:3000/ws');

            ws.onopen = () => {
                updateStatus('Connected');

                // Authenticate
                const authMessage = {
                    type: 'system',
                    timestamp: Date.now(),
                    payload: {
                        command: 'authenticate',
                        data: {
                            name: 'Player' + Math.floor(Math.random() * 1000)
                        }
                    }
                };
                ws.send(JSON.stringify(authMessage));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleServerMessage(message);
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            };

            ws.onclose = () => {
                updateStatus('Disconnected');
                ws = null;
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                updateStatus('Error');
            };
        }

        function disconnect() {
            if (ws) {
                ws.close();
            }
        }

        function handleServerMessage(message) {
            switch (message.type) {
                case 'game_state':
                    updateGameState(message.data);
                    break;
                case 'player_joined':
                    console.log('Player joined:', message.data.playerName);
                    break;
                case 'player_left':
                    console.log('Player left:', message.data.playerName);
                    removePlayer(message.data.entityId);
                    break;
                case 'authentication_success':
                    playerId = message.data.playerId;
                    updateStatus('Authenticated');
                    break;
            }
        }

        function updateGameState(gameData) {
            const gameArea = document.getElementById('gameArea');

            // Clear existing players
            gameArea.innerHTML = '';
            players.clear();

            // Add players
            gameData.entities.forEach(entity => {
                const playerElement = document.createElement('div');
                playerElement.className = 'player';
                playerElement.id = 'player-' + entity.id;

                if (entity.id === playerId) {
                    playerElement.classList.add('local-player');
                }

                playerElement.style.left = entity.components.position.x + 'px';
                playerElement.style.top = entity.components.position.y + 'px';
                playerElement.title = entity.components.player.name;

                gameArea.appendChild(playerElement);
                players.set(entity.id, entity);
            });

            document.getElementById('playerCount').textContent = gameData.entities.length;
        }

        function removePlayer(entityId) {
            const playerElement = document.getElementById('player-' + entityId);
            if (playerElement) {
                playerElement.remove();
            }
            players.delete(entityId);
        }

        function updateStatus(status) {
            document.getElementById('status').textContent = status;
        }

        function sendInput() {
            if (!ws || ws.readyState !== WebSocket.OPEN) return;

            let moveX = 0;
            let moveY = 0;

            if (keys['ArrowLeft'] || keys['KeyA']) moveX = -1;
            if (keys['ArrowRight'] || keys['KeyD']) moveX = 1;
            if (keys['ArrowUp'] || keys['KeyW']) moveY = -1;
            if (keys['ArrowDown'] || keys['KeyS']) moveY = 1;

            if (moveX !== 0 || moveY !== 0) {
                const inputMessage = {
                    type: 'player_input',
                    timestamp: Date.now(),
                    data: {
                        input: { moveX, moveY }
                    }
                };
                ws.send(JSON.stringify(inputMessage));
            }
        }

        // Input handling
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        // Send input at 60fps
        setInterval(sendInput, 1000 / 60);
    </script>
</body>
</html>
`;

// Save this as client.html
console.log('Save the above HTML as client.html and open in a browser');
```

## Running the Demo

### 1. Start the Server

```bash
bun examples/websocket-example.ts
```

The server will start on port 3000 and display connection information.

### 2. Connect Clients

You can connect clients in several ways:

**Option A: HTML Client**
1. Save the HTML client code above as `client.html`
2. Open it in a web browser
3. Click "Connect" to join the game

**Option B: Command Line Client (wscat)**
```bash
# Install wscat if needed
npm install -g wscat

# Connect to server
wscat -c ws://localhost:3000/ws

# Send authentication message
{"type":"system","timestamp":1234567890,"payload":{"command":"authenticate","data":{"name":"TestPlayer"}}}

# Send movement input
{"type":"player_input","timestamp":1234567890,"data":{"input":{"moveX":1,"moveY":0}}}
```

## Key Features Demonstrated

### 1. Real-Time State Synchronization

The server continuously broadcasts game state to all connected clients:

```typescript
// Server sends updates at 20fps
private readonly syncInterval = 1000 / 20; // 20 FPS

// Client receives and applies updates
function updateGameState(gameData) {
    gameData.entities.forEach(entity => {
        // Update player positions in real-time
        updatePlayerPosition(entity.id, entity.components.position);
    });
}
```

### 2. Client Authentication

Players must authenticate before joining:

```typescript
// Client sends authentication
{
    "type": "system",
    "payload": {
        "command": "authenticate",
        "data": { "name": "PlayerName" }
    }
}

// Server creates player entity
function createPlayerForClient(world: World, clientId: string, playerName: string) {
    const playerEntity = world.createEntity();
    world.addComponent(playerEntity, createPlayerComponent({
        name: playerName,
        clientId: clientId
    }));
}
```

### 3. Input Handling

Client input is sent to server for authoritative processing:

```typescript
// Client sends input
{
    "type": "player_input",
    "data": {
        "input": { "moveX": 1, "moveY": 0 }
    }
}

// Server processes input
private applyInputToPlayer(world: World, playerId: number, input: any) {
    const position = world.getComponent(playerId, 'position');
    position.x += input.moveX * speed;
    position.y += input.moveY * speed;
}
```

### 4. Connection Management

The server handles client connections and disconnections gracefully:

```typescript
world.subscribeToEvent('client_disconnected', (event) => {
    handleClientDisconnection(world, event.data.clientId);
});

function handleClientDisconnection(world: World, clientId: string) {
    // Find and remove player entity
    // Notify other clients
    // Clean up resources
}
```

## Expected Behavior

When running the demo:

1. **Server starts** and displays connection information
2. **Clients connect** and authenticate with player names
3. **Players appear** in the game area at random positions
4. **Movement input** from clients moves players in real-time
5. **All clients** see synchronized player positions
6. **Disconnected players** are removed from all clients

## Console Output

Server console will show:
```
🎮 Starting WebSocket Game Server Example...
🚀 Game server started successfully!
📡 WebSocket endpoint: ws://localhost:3000/ws

🔌 Client connected: client-abc123
✅ Client authenticated: Player42
👤 Created player Player42 for client client-abc123

🔌 Client connected: client-def456
✅ Client authenticated: Player789
👤 Created player Player789 for client client-def456
```

## Architecture Benefits

1. **Authoritative Server**: All game logic runs on server, preventing cheating
2. **Real-Time Updates**: Smooth multiplayer experience with regular state sync
3. **Event-Driven**: Clean separation between networking and game logic
4. **Scalable**: Can easily add more game systems and features
5. **ECS Integration**: Leverages ECS architecture for clean, maintainable code

## Extending the Demo

Try adding these features:

1. **Chat System**: Send messages between players
2. **Game Objects**: Add collectible items or obstacles
3. **Health System**: Add player health and damage
4. **Rooms/Lobbies**: Support multiple game rooms
5. **Spectator Mode**: Allow clients to watch without playing

## See Also

- [Multiplayer Networking Guide](../guides/multiplayer-networking.md) - Comprehensive networking patterns
- [GameServer API](../api/websocket/game-server.md) - Server configuration reference
- [Events and Communication](../guides/events-and-communication.md) - Event-driven architecture