# GameServer

The `GameServer` provides a high-performance WebSocket server for real-time multiplayer game communication built on Bun's native WebSocket support. It handles client connections, authentication, message routing, and state synchronization.

## Quick Example

```typescript
import { World, GameServer } from '@danjdewhurst/ecs-ts';

const world = new World();

// Create server with configuration
const server = new GameServer(world, {
  port: 3000,
  maxClients: 100,
  heartbeatInterval: 30000,
  clientTimeout: 60000
});

// Set up event handlers
world.subscribeToEvent('client_connected', (event) => {
  console.log(`Client ${event.data.clientId} connected`);
});

// Start the server
await server.start();
console.log('Game server is running!');
```

## Configuration

### GameServerConfig

```typescript
interface GameServerConfig {
  port: number;
  heartbeatInterval: number;
  clientTimeout: number;
  maxClients: number;
}
```

- **port**: WebSocket server port (default: 3000)
- **heartbeatInterval**: Heartbeat ping interval in milliseconds (default: 30000)
- **clientTimeout**: Client timeout threshold in milliseconds (default: 60000)
- **maxClients**: Maximum concurrent clients (default: 100)

## Constructor

```typescript
new GameServer(world: World, config?: Partial<GameServerConfig>)
```

Creates a new GameServer instance integrated with the provided World.

### Parameters
- `world: World` - The ECS World instance to integrate with
- `config?: Partial<GameServerConfig>` - Optional server configuration

### Example
```typescript
const server = new GameServer(world, {
  port: 8080,
  maxClients: 50,
  heartbeatInterval: 20000
});
```

## Server Lifecycle

### start

```typescript
async start(): Promise<void>
```

Starts the WebSocket server and begins accepting connections.

#### Example
```typescript
try {
  await server.start();
  console.log('Server started successfully');
} catch (error) {
  console.error('Failed to start server:', error);
}
```

### stop

```typescript
stop(): void
```

Gracefully shuts down the server, disconnecting all clients and cleaning up resources.

#### Example
```typescript
// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.stop();
  process.exit(0);
});
```

## Client Management

### broadcast

```typescript
broadcast(message: NetworkMessage, excludeClients?: string[]): void
```

Sends a message to all connected clients, optionally excluding specific clients.

#### Parameters
- `message: NetworkMessage` - The message to broadcast
- `excludeClients?: string[]` - Array of client IDs to exclude

#### Example
```typescript
// Broadcast game state update
server.broadcast({
  type: 'state',
  timestamp: Date.now(),
  payload: {
    entities: world.getAllEntities().map(entity => ({
      id: entity,
      components: world.getEntityComponents(entity)
    }))
  }
});

// Broadcast to all except sender
server.broadcast(message, [senderClientId]);
```

### sendToClient

```typescript
sendToClient(clientId: string, message: NetworkMessage): boolean
```

Sends a message to a specific client.

#### Parameters
- `clientId: string` - Target client identifier
- `message: NetworkMessage` - Message to send

#### Returns
`boolean` - True if message was sent successfully, false if client not found

#### Example
```typescript
// Send private message
const success = server.sendToClient('client_123', {
  type: 'event',
  timestamp: Date.now(),
  payload: {
    eventType: 'private-message',
    eventData: { text: 'Welcome to the game!' }
  }
});

if (!success) {
  console.log('Client not found or disconnected');
}
```

### getConnectedClients

```typescript
getConnectedClients(): string[]
```

Returns an array of all connected client IDs.

#### Example
```typescript
const clients = server.getConnectedClients();
console.log(`${clients.length} clients connected:`, clients);
```

### getClientCount

```typescript
getClientCount(): number
```

Returns the current number of connected clients.

#### Example
```typescript
const count = server.getClientCount();
console.log(`Server load: ${count}/${server.config.maxClients} clients`);
```

### kickClient

```typescript
kickClient(clientId: string, reason?: string): boolean
```

Forcibly disconnects a client with an optional reason.

#### Parameters
- `clientId: string` - Client to disconnect
- `reason?: string` - Optional disconnect reason sent to client

#### Returns
`boolean` - True if client was kicked, false if client not found

#### Example
```typescript
// Kick misbehaving client
server.kickClient('client_456', 'Violated game rules');

// Kick without reason
server.kickClient('client_789');
```

## HTTP Endpoints

The GameServer provides several HTTP endpoints alongside WebSocket functionality:

### WebSocket Upgrade (`/ws`)
- Upgrades HTTP connections to WebSocket
- Checks client capacity before accepting
- Returns 503 if server is full

### Health Check (`/health`)
- Returns server status information
- Useful for load balancers and monitoring

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "clients": 42,
  "uptime": 3600.5
}
```

## Event Integration

The GameServer emits events through the World's event system for game logic integration:

### Server Events

```typescript
// Client connected (before authentication)
world.subscribeToEvent('client_connected', (event) => {
  const { clientId } = event.data;
  console.log(`New connection: ${clientId}`);
});

// Client authenticated (ready for game)
world.subscribeToEvent('client_authenticated', (event) => {
  const { clientId, entityId } = event.data;

  // Set up player entity
  world.addComponent(entityId, {
    type: 'player',
    clientId: clientId,
    name: 'New Player'
  });
});

// Client disconnected
world.subscribeToEvent('client_disconnected', (event) => {
  const { clientId, entityId } = event.data;
  console.log(`Client ${clientId} disconnected`);

  // Entity is automatically destroyed
});

// Client message received
world.subscribeToEvent('client_message', (event) => {
  const { message, clientId } = event.data;

  // Process game input
  handleClientInput(clientId, message);
});
```

### Game State Broadcasting

```typescript
// Automatically broadcast game state updates
world.subscribeToEvent('game_state_update', (event) => {
  // GameServer automatically handles this event
  // and broadcasts state to all clients
});

// Manual state update
world.emitEvent({
  type: 'game_state_update',
  timestamp: Date.now(),
  data: {
    entities: getVisibleEntities(),
    gameTime: world.getGameTime()
  }
});
```

## Authentication and Security

### Client Authentication Flow

1. **Connection**: Client connects to `/ws` endpoint
2. **Welcome**: Server sends authentication challenge
3. **Response**: Client sends authentication data
4. **Verification**: Server validates credentials
5. **Entity Creation**: Server creates player entity

```typescript
// Handle custom authentication
world.subscribeToEvent('client_message', (event) => {
  const { message, clientId } = event.data;

  if (message.type === 'system' &&
      message.payload.command === 'authenticate') {

    const authData = message.payload.data;

    if (validatePlayerCredentials(authData)) {
      // Authentication handled automatically
      console.log(`Player authenticated: ${authData.username}`);
    } else {
      server.kickClient(clientId, 'Invalid credentials');
    }
  }
});
```

### Message Validation

All incoming messages are automatically validated:
- Protocol version checking
- Message format validation
- Authentication requirement enforcement
- Rate limiting (via heartbeat monitoring)

## Performance Features

### Connection Management
- Automatic heartbeat/ping system
- Client timeout detection
- Graceful connection cleanup
- Backpressure handling

### Message Serialization
- Efficient JSON serialization
- Protocol versioning support
- Binary serialization option
- Error recovery

### Resource Limits
- Maximum client connections
- Per-client timeouts
- Memory-efficient client storage

## Error Handling

```typescript
// Server automatically handles common errors:
// - Invalid message format
// - Unauthenticated requests
// - Network failures
// - Protocol violations

// Custom error handling
world.subscribeToEvent('client_message', (event) => {
  try {
    processMessage(event.data.message);
  } catch (error) {
    server.sendToClient(event.data.clientId, {
      type: 'system',
      timestamp: Date.now(),
      payload: {
        command: 'error',
        data: { message: 'Invalid game action' }
      }
    });
  }
});
```

## Production Deployment

### Environment Configuration

```typescript
const config = {
  port: process.env.PORT || 3000,
  maxClients: process.env.MAX_CLIENTS || 1000,
  heartbeatInterval: 30000,
  clientTimeout: 60000
};

const server = new GameServer(world, config);
```

### Load Balancing

```typescript
// Multiple server instances
const servers = [];
for (let i = 0; i < 4; i++) {
  const server = new GameServer(world, {
    port: 3000 + i,
    maxClients: 250
  });
  servers.push(server);
  await server.start();
}
```

### Monitoring

```typescript
// Server metrics
setInterval(() => {
  const stats = {
    clients: server.getClientCount(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };

  console.log('Server stats:', stats);

  // Send to monitoring service
  metrics.push(stats);
}, 60000);
```

## Performance Notes

- Uses Bun's high-performance WebSocket implementation
- Zero-copy message passing where possible
- Efficient client lookup with Map-based storage
- Automatic resource cleanup prevents memory leaks
- Heartbeat system prevents zombie connections

## See Also

- [GameClient](./game-client.md) - Client-side WebSocket connection
- [NetworkMessage](./network-message.md) - Message format specification
- [MessageSerializer](./message-serializer.md) - Serialization utilities
- [World](../core/world.md) - ECS World integration