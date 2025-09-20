# NetworkPlugin

The `NetworkPlugin` interface extends the base Plugin interface with network-specific functionality for multiplayer games. It provides a standardized API for client communication, message handling, and connection management.

## Interface Definition

```typescript
interface NetworkPlugin extends Plugin {
  sendToClient(clientId: string, message: NetworkMessage): Promise<void>;
  sendServerMessage(clientId: string, message: ServerMessage): Promise<void>;
  broadcast(message: NetworkMessage, exclude?: string[]): Promise<void>;
  broadcastServerMessage(message: ServerMessage, exclude?: string[]): Promise<void>;
  getConnectedClients(): GameClient[];
  getClient(clientId: string): GameClient | undefined;
  disconnectClient(clientId: string, reason?: string): Promise<void>;
  isClientConnected(clientId: string): boolean;
  getClientCount(): number;
  onClientMessage(messageType: string, handler: MessageHandler): () => void;
  onClientConnect(handler: ConnectionHandler): () => void;
  onClientDisconnect(handler: DisconnectionHandler): () => void;
}
```

## Quick Example

```typescript
import { BaseNetworkPlugin, NetworkPluginConfig } from '@danjdewhurst/ecs-ts';

class WebSocketNetworkPlugin extends BaseNetworkPlugin {
  readonly name = 'websocket-network';
  readonly version = '1.0.0';

  constructor(config: NetworkPluginConfig) {
    super(config);
  }

  async initialize(world: World): Promise<void> {
    // Set up WebSocket server
    this.setupServer();

    // Register event handlers
    this.setupEventHandlers(world);

    console.log('WebSocket network plugin initialized');
  }

  async sendToClient(clientId: string, message: NetworkMessage): Promise<void> {
    const client = this.getClient(clientId);
    if (client) {
      client.ws.send(JSON.stringify(message));
    }
  }

  // ... implement other required methods
}
```

## Configuration

### NetworkPluginConfig

```typescript
interface NetworkPluginConfig {
  maxClients?: number;
  heartbeatInterval?: number;
  clientTimeout?: number;
  compression?: boolean;
  rateLimit?: {
    maxMessages: number;
    windowMs: number;
  };
}
```

#### Configuration Options
- **maxClients**: Maximum concurrent connections (default: 100)
- **heartbeatInterval**: Ping interval in milliseconds (default: 30000)
- **clientTimeout**: Connection timeout in milliseconds (default: 60000)
- **compression**: Enable message compression (default: false)
- **rateLimit**: Message rate limiting configuration

#### Example
```typescript
const networkConfig: NetworkPluginConfig = {
  maxClients: 500,
  heartbeatInterval: 20000,
  clientTimeout: 45000,
  compression: true,
  rateLimit: {
    maxMessages: 50,
    windowMs: 1000
  }
};

const networkPlugin = new WebSocketNetworkPlugin(networkConfig);
```

## Message Handling

### sendToClient

```typescript
async sendToClient(clientId: string, message: NetworkMessage): Promise<void>
```

Sends a NetworkMessage to a specific client.

#### Parameters
- `clientId: string` - Target client identifier
- `message: NetworkMessage` - Message to send

#### Example
```typescript
// Send game state update to specific player
await networkPlugin.sendToClient('player_123', {
  type: 'state',
  timestamp: Date.now(),
  payload: {
    entities: getVisibleEntities(playerId)
  }
});
```

### sendServerMessage

```typescript
async sendServerMessage(clientId: string, message: ServerMessage): Promise<void>
```

Sends a ServerMessage to a specific client.

#### Example
```typescript
// Send server notification
await networkPlugin.sendServerMessage('player_123', {
  type: 'notification',
  data: { message: 'Welcome to the game!' },
  timestamp: Date.now()
});
```

### broadcast

```typescript
async broadcast(message: NetworkMessage, exclude?: string[]): Promise<void>
```

Broadcasts a NetworkMessage to all connected clients, optionally excluding specific clients.

#### Parameters
- `message: NetworkMessage` - Message to broadcast
- `exclude?: string[]` - Client IDs to exclude from broadcast

#### Example
```typescript
// Broadcast game event to all players except the sender
await networkPlugin.broadcast({
  type: 'event',
  timestamp: Date.now(),
  payload: {
    eventType: 'player-action',
    eventData: { playerId: 'player_123', action: 'jump' }
  }
}, ['player_123']); // Exclude sender
```

### broadcastServerMessage

```typescript
async broadcastServerMessage(message: ServerMessage, exclude?: string[]): Promise<void>
```

Broadcasts a ServerMessage to all connected clients.

#### Example
```typescript
// Broadcast server announcement
await networkPlugin.broadcastServerMessage({
  type: 'announcement',
  data: { message: 'Server maintenance in 5 minutes' },
  timestamp: Date.now()
});
```

## Client Management

### getConnectedClients

```typescript
getConnectedClients(): GameClient[]
```

Returns an array of all currently connected clients.

#### Example
```typescript
const clients = networkPlugin.getConnectedClients();
console.log(`${clients.length} players online`);

// Get client details
clients.forEach(client => {
  console.log(`Client ${client.id}: ${client.metadata.username || 'Anonymous'}`);
});
```

### getClient

```typescript
getClient(clientId: string): GameClient | undefined
```

Retrieves information about a specific client.

#### Example
```typescript
const client = networkPlugin.getClient('player_123');
if (client) {
  console.log(`Player: ${client.metadata.username}`);
  console.log(`Last seen: ${new Date(client.lastHeartbeat)}`);
  console.log(`Authenticated: ${client.isAuthenticated}`);
}
```

### disconnectClient

```typescript
async disconnectClient(clientId: string, reason?: string): Promise<void>
```

Forcibly disconnects a client with an optional reason.

#### Example
```typescript
// Kick player for violating rules
await networkPlugin.disconnectClient('player_456', 'Inappropriate behavior');

// Disconnect idle player
await networkPlugin.disconnectClient('player_789', 'Idle timeout');
```

### isClientConnected

```typescript
isClientConnected(clientId: string): boolean
```

Checks if a client is currently connected.

#### Example
```typescript
if (networkPlugin.isClientConnected('player_123')) {
  await sendPersonalMessage('player_123', 'You have mail!');
} else {
  queueOfflineMessage('player_123', 'You have mail!');
}
```

### getClientCount

```typescript
getClientCount(): number
```

Returns the current number of connected clients.

#### Example
```typescript
const playerCount = networkPlugin.getClientCount();
const maxPlayers = 100;

if (playerCount >= maxPlayers) {
  console.log('Server full - rejecting new connections');
} else {
  console.log(`${maxPlayers - playerCount} slots available`);
}
```

## Event Handlers

### onClientMessage

```typescript
onClientMessage(
  messageType: string,
  handler: (clientId: string, message: unknown, client: GameClient) => void
): () => void
```

Registers a handler for specific message types from clients.

#### Returns
Function to unregister the handler

#### Example
```typescript
// Handle player input messages
const unsubscribeInput = networkPlugin.onClientMessage('input',
  (clientId, message, client) => {
    const inputData = message as { action: string; data: any };

    // Validate input
    if (!client.isAuthenticated) {
      return;
    }

    // Process player input
    world.emitEvent({
      type: 'player-input',
      timestamp: Date.now(),
      source: clientId,
      data: {
        entityId: client.entityId,
        action: inputData.action,
        data: inputData.data
      }
    });
  }
);

// Handle chat messages
const unsubscribeChat = networkPlugin.onClientMessage('chat',
  (clientId, message, client) => {
    const chatData = message as { text: string; channel: string };

    // Validate and process chat
    if (chatData.text.length > 200) return; // Message too long

    // Broadcast to appropriate channel
    broadcastChatMessage(client.metadata.username, chatData.text, chatData.channel);
  }
);

// Cleanup on shutdown
plugin.shutdown = async () => {
  unsubscribeInput();
  unsubscribeChat();
};
```

### onClientConnect

```typescript
onClientConnect(handler: (client: GameClient) => void): () => void
```

Registers a handler for client connection events.

#### Example
```typescript
const unsubscribeConnect = networkPlugin.onClientConnect((client) => {
  console.log(`Client ${client.id} connected`);

  // Create player entity
  const entity = world.createEntity();
  client.entityId = entity;

  // Add default components
  world.addComponent(entity, {
    type: 'player',
    clientId: client.id,
    name: 'New Player',
    level: 1
  });

  world.addComponent(entity, {
    type: 'position',
    x: 0,
    y: 0,
    z: 0
  });

  // Send welcome message
  networkPlugin.sendServerMessage(client.id, {
    type: 'welcome',
    data: { entityId: entity, serverId: 'game-server-1' },
    timestamp: Date.now()
  });

  // Notify other players
  networkPlugin.broadcast({
    type: 'event',
    timestamp: Date.now(),
    payload: {
      eventType: 'player-joined',
      eventData: { playerId: entity, name: 'New Player' }
    }
  }, [client.id]);
});
```

### onClientDisconnect

```typescript
onClientDisconnect(handler: (clientId: string, reason?: string) => void): () => void
```

Registers a handler for client disconnection events.

#### Example
```typescript
const unsubscribeDisconnect = networkPlugin.onClientDisconnect((clientId, reason) => {
  console.log(`Client ${clientId} disconnected: ${reason || 'Unknown'}`);

  // Find client's entity
  const client = networkPlugin.getClient(clientId);
  if (client?.entityId) {
    // Save player data before cleanup
    savePlayerData(client.entityId);

    // Notify other players
    networkPlugin.broadcast({
      type: 'event',
      timestamp: Date.now(),
      payload: {
        eventType: 'player-left',
        eventData: { playerId: client.entityId, reason }
      }
    });

    // Cleanup entity
    world.destroyEntity(client.entityId);
  }
});
```

## BaseNetworkPlugin

The `BaseNetworkPlugin` abstract class provides a foundation for implementing network plugins:

```typescript
abstract class BaseNetworkPlugin implements NetworkPlugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  protected config: Required<NetworkPluginConfig>;

  constructor(config: NetworkPluginConfig = {}) {
    this.config = {
      maxClients: config.maxClients ?? 100,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      clientTimeout: config.clientTimeout ?? 60000,
      compression: config.compression ?? false,
      rateLimit: config.rateLimit ?? {
        maxMessages: 100,
        windowMs: 60000
      }
    };
  }

  // Abstract methods to implement
  abstract initialize(world: World): Promise<void>;
  abstract sendToClient(clientId: string, message: NetworkMessage): Promise<void>;
  // ... other required methods
}
```

## Implementation Examples

### WebSocket Network Plugin

```typescript
class WebSocketNetworkPlugin extends BaseNetworkPlugin {
  readonly name = 'websocket-network';
  readonly version = '1.0.0';

  private server: GameServer | null = null;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private disconnectionHandlers = new Set<DisconnectionHandler>();

  async initialize(world: World): Promise<void> {
    this.server = new GameServer(world, {
      port: 3000,
      maxClients: this.config.maxClients,
      heartbeatInterval: this.config.heartbeatInterval,
      clientTimeout: this.config.clientTimeout
    });

    await this.server.start();

    // Set up message routing
    world.subscribeToEvent('client_message', (event) => {
      const { clientId, message } = event.data;
      this.handleClientMessage(clientId, message);
    });

    world.subscribeToEvent('client_connected', (event) => {
      this.connectionHandlers.forEach(handler => handler(event.data.client));
    });

    world.subscribeToEvent('client_disconnected', (event) => {
      const { clientId, reason } = event.data;
      this.disconnectionHandlers.forEach(handler => handler(clientId, reason));
    });
  }

  async sendToClient(clientId: string, message: NetworkMessage): Promise<void> {
    if (!this.server) throw new Error('Server not initialized');

    const success = this.server.sendToClient(clientId, message);
    if (!success) {
      throw new Error(`Failed to send message to client ${clientId}`);
    }
  }

  async broadcast(message: NetworkMessage, exclude: string[] = []): Promise<void> {
    if (!this.server) throw new Error('Server not initialized');

    this.server.broadcast(message, exclude);
  }

  getConnectedClients(): GameClient[] {
    if (!this.server) return [];

    return this.server.getConnectedClients().map(clientId =>
      this.server!.clients.get(clientId)!
    );
  }

  onClientMessage(messageType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }

    this.messageHandlers.get(messageType)!.add(handler);

    return () => {
      this.messageHandlers.get(messageType)?.delete(handler);
    };
  }

  private handleClientMessage(clientId: string, message: NetworkMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      const client = this.getClient(clientId);
      if (client) {
        handlers.forEach(handler => {
          try {
            handler(clientId, message.payload, client);
          } catch (error) {
            console.error(`Message handler error: ${error}`);
          }
        });
      }
    }
  }
}
```

### UDP Network Plugin

```typescript
class UDPNetworkPlugin extends BaseNetworkPlugin {
  readonly name = 'udp-network';
  readonly version = '1.0.0';

  private socket: dgram.Socket | null = null;
  private clients = new Map<string, UDPClient>();

  async initialize(world: World): Promise<void> {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      this.handleIncomingMessage(msg, rinfo);
    });

    this.socket.bind(3000);
    console.log('UDP server listening on port 3000');
  }

  async sendToClient(clientId: string, message: NetworkMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !this.socket) {
      throw new Error(`Client ${clientId} not found or socket not ready`);
    }

    const data = Buffer.from(JSON.stringify(message));
    this.socket.send(data, client.port, client.address);
  }

  // ... implement other required methods
}
```

## Rate Limiting

```typescript
class RateLimitedNetworkPlugin extends BaseNetworkPlugin {
  private clientLimits = new Map<string, { count: number; resetTime: number }>();

  onClientMessage(messageType: string, handler: MessageHandler): () => void {
    const wrappedHandler = (clientId: string, message: unknown, client: GameClient) => {
      if (!this.checkRateLimit(clientId)) {
        console.warn(`Rate limit exceeded for client ${clientId}`);
        return;
      }

      handler(clientId, message, client);
    };

    return super.onClientMessage(messageType, wrappedHandler);
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = this.clientLimits.get(clientId);

    if (!limit || now > limit.resetTime) {
      this.clientLimits.set(clientId, {
        count: 1,
        resetTime: now + this.config.rateLimit.windowMs
      });
      return true;
    }

    if (limit.count >= this.config.rateLimit.maxMessages) {
      return false;
    }

    limit.count++;
    return true;
  }
}
```

## Testing

### Mock Network Plugin

```typescript
class MockNetworkPlugin extends BaseNetworkPlugin {
  readonly name = 'mock-network';
  readonly version = '1.0.0';

  private mockClients = new Map<string, GameClient>();
  private sentMessages: Array<{clientId: string; message: NetworkMessage}> = [];

  async initialize(world: World): Promise<void> {
    // Mock initialization
  }

  async sendToClient(clientId: string, message: NetworkMessage): Promise<void> {
    this.sentMessages.push({ clientId, message });
  }

  getConnectedClients(): GameClient[] {
    return Array.from(this.mockClients.values());
  }

  // Test utilities
  getSentMessages(): Array<{clientId: string; message: NetworkMessage}> {
    return [...this.sentMessages];
  }

  addMockClient(client: GameClient): void {
    this.mockClients.set(client.id, client);
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}
```

### Network Plugin Testing

```typescript
describe('NetworkPlugin', () => {
  let world: World;
  let networkPlugin: MockNetworkPlugin;

  beforeEach(() => {
    world = new World();
    networkPlugin = new MockNetworkPlugin();
  });

  test('should send messages to clients', async () => {
    const client = createMockClient('test-client');
    networkPlugin.addMockClient(client);

    const message: NetworkMessage = {
      type: 'state',
      timestamp: Date.now(),
      payload: { test: true }
    };

    await networkPlugin.sendToClient('test-client', message);

    const sentMessages = networkPlugin.getSentMessages();
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].clientId).toBe('test-client');
    expect(sentMessages[0].message).toEqual(message);
  });

  test('should handle client connections', async () => {
    const connectionPromise = new Promise<GameClient>(resolve => {
      networkPlugin.onClientConnect(resolve);
    });

    const client = createMockClient('new-client');
    networkPlugin.addMockClient(client);
    // Trigger connection event...

    const connectedClient = await connectionPromise;
    expect(connectedClient.id).toBe('new-client');
  });
});
```

## Performance Optimization

### Message Batching

```typescript
class BatchingNetworkPlugin extends BaseNetworkPlugin {
  private messageBatches = new Map<string, NetworkMessage[]>();
  private batchTimer: Timer | null = null;

  async sendToClient(clientId: string, message: NetworkMessage): Promise<void> {
    // Add to batch
    if (!this.messageBatches.has(clientId)) {
      this.messageBatches.set(clientId, []);
    }

    this.messageBatches.get(clientId)!.push(message);

    // Schedule batch send
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatches(), 16); // ~60fps
    }
  }

  private flushBatches(): void {
    for (const [clientId, messages] of this.messageBatches) {
      if (messages.length > 0) {
        const batchMessage: NetworkMessage = {
          type: 'batch',
          timestamp: Date.now(),
          payload: { messages }
        };

        this.sendDirectly(clientId, batchMessage);
      }
    }

    this.messageBatches.clear();
    this.batchTimer = null;
  }

  private async sendDirectly(clientId: string, message: NetworkMessage): Promise<void> {
    // Direct send implementation
  }
}
```

## See Also

- [Plugin](./plugin.md) - Base plugin interface
- [PluginManager](./plugin-manager.md) - Plugin lifecycle management
- [GameServer](../websocket/game-server.md) - WebSocket server implementation
- [NetworkMessage](../websocket/network-message.md) - Message format specification