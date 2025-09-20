# NetworkMessage

The `NetworkMessage` interface defines the structure for all messages exchanged between GameServer and clients in multiplayer games. It provides a type-safe, extensible format for real-time communication.

## Base Interface

```typescript
interface NetworkMessage {
  type: 'input' | 'state' | 'event' | 'system';
  frame?: number;
  entities?: number[];
  payload: unknown;
  timestamp: number;
  clientId?: string;
}
```

## Properties

### type

```typescript
type: 'input' | 'state' | 'event' | 'system'
```

The message category that determines how it should be processed:
- **input**: Player input and actions
- **state**: Game state updates and synchronization
- **event**: Game events and notifications
- **system**: Server control messages (heartbeat, auth, errors)

### frame

```typescript
frame?: number
```

Optional frame number for synchronized gameplay and rollback networking.

### entities

```typescript
entities?: number[]
```

Optional array of entity IDs that this message relates to, used for spatial filtering and optimization.

### payload

```typescript
payload: unknown
```

Message-specific data. Type varies based on message type and should be cast to the appropriate interface.

### timestamp

```typescript
timestamp: number
```

Unix timestamp when the message was created, used for ordering and latency calculation.

### clientId

```typescript
clientId?: string
```

Optional client identifier, typically set by the server for tracking message origin.

## Message Types

### InputMessage

Used for player input and game actions.

```typescript
interface InputMessage extends NetworkMessage {
  type: 'input';
  payload: {
    action: string;
    data: Record<string, unknown>;
  };
}
```

#### Example
```typescript
const moveInput: InputMessage = {
  type: 'input',
  timestamp: Date.now(),
  payload: {
    action: 'move',
    data: {
      direction: { x: 1, y: 0 },
      speed: 2.5,
      sprint: true
    }
  }
};

// Client sends input
client.send(MessageSerializer.serialize(moveInput));
```

#### Common Input Actions
```typescript
// Movement
{
  action: 'move',
  data: { direction: { x: number, y: number }, speed: number }
}

// Attack
{
  action: 'attack',
  data: { target: number, weaponId: number }
}

// Interact
{
  action: 'interact',
  data: { targetEntity: number, interactionType: string }
}

// Chat
{
  action: 'chat',
  data: { message: string, channel: 'global' | 'team' | 'private' }
}
```

### StateMessage

Used for game state synchronization and updates.

```typescript
interface StateMessage extends NetworkMessage {
  type: 'state';
  payload: {
    entities: Array<{
      id: number;
      components: Record<string, unknown>;
    }>;
  };
}
```

#### Example
```typescript
const stateUpdate: StateMessage = {
  type: 'state',
  timestamp: Date.now(),
  frame: 1234,
  payload: {
    entities: [
      {
        id: 42,
        components: {
          position: { x: 100, y: 200 },
          velocity: { x: 5, y: 0 },
          health: { current: 80, max: 100 }
        }
      },
      {
        id: 43,
        components: {
          position: { x: 150, y: 180 },
          player: { name: 'Alice', level: 15 }
        }
      }
    ]
  }
};

// Server broadcasts state
server.broadcast(stateUpdate);
```

#### State Optimization Patterns
```typescript
// Delta state (only changed entities)
const deltaState: StateMessage = {
  type: 'state',
  timestamp: Date.now(),
  frame: 1235,
  entities: [42], // Only entity 42 changed
  payload: {
    entities: [
      {
        id: 42,
        components: {
          position: { x: 105, y: 200 } // Only position changed
        }
      }
    ]
  }
};

// Spatial filtering (only nearby entities)
const spatialState: StateMessage = {
  type: 'state',
  timestamp: Date.now(),
  entities: nearbyEntityIds,
  payload: {
    entities: getNearbyEntities(playerPosition, viewDistance)
  }
};
```

### EventMessage

Used for game events and notifications.

```typescript
interface EventMessage extends NetworkMessage {
  type: 'event';
  payload: {
    eventType: string;
    eventData: Record<string, unknown>;
  };
}
```

#### Example
```typescript
const playerDeathEvent: EventMessage = {
  type: 'event',
  timestamp: Date.now(),
  payload: {
    eventType: 'player-death',
    eventData: {
      playerId: 42,
      killer: 13,
      weapon: 'sword',
      location: { x: 100, y: 200 }
    }
  }
};

// Server notifies all clients
server.broadcast(playerDeathEvent);
```

#### Common Event Types
```typescript
// Player events
{
  eventType: 'player-joined',
  eventData: { playerId: number, name: string }
}

{
  eventType: 'player-left',
  eventData: { playerId: number, reason: string }
}

// Game events
{
  eventType: 'item-spawned',
  eventData: { itemId: number, type: string, position: Point }
}

{
  eventType: 'match-started',
  eventData: { matchId: string, mode: string, playerCount: number }
}

// Achievement events
{
  eventType: 'achievement-unlocked',
  eventData: { playerId: number, achievementId: string }
}
```

### SystemMessage

Used for server control and client management.

```typescript
interface SystemMessage extends NetworkMessage {
  type: 'system';
  payload: {
    command: 'heartbeat' | 'authenticate' | 'disconnect' | 'error';
    data?: Record<string, unknown>;
  };
}
```

#### Example
```typescript
// Heartbeat
const heartbeat: SystemMessage = {
  type: 'system',
  timestamp: Date.now(),
  clientId: 'client_123',
  payload: {
    command: 'heartbeat'
  }
};

// Authentication request
const authRequest: SystemMessage = {
  type: 'system',
  timestamp: Date.now(),
  payload: {
    command: 'authenticate',
    data: {
      clientId: 'client_123',
      required: true
    }
  }
};

// Error message
const errorMessage: SystemMessage = {
  type: 'system',
  timestamp: Date.now(),
  clientId: 'client_456',
  payload: {
    command: 'error',
    data: {
      message: 'Invalid action',
      code: 'INVALID_ACTION'
    }
  }
};
```

## Message Creation Patterns

### Factory Functions

Create consistent messages using factory functions:

```typescript
class MessageFactory {
  static createInput(action: string, data: Record<string, unknown>): InputMessage {
    return {
      type: 'input',
      timestamp: Date.now(),
      payload: { action, data }
    };
  }

  static createStateUpdate(entities: Array<{ id: number; components: any }>): StateMessage {
    return {
      type: 'state',
      timestamp: Date.now(),
      frame: getCurrentFrame(),
      payload: { entities }
    };
  }

  static createEvent(eventType: string, eventData: Record<string, unknown>): EventMessage {
    return {
      type: 'event',
      timestamp: Date.now(),
      payload: { eventType, eventData }
    };
  }

  static createHeartbeat(clientId: string): SystemMessage {
    return {
      type: 'system',
      timestamp: Date.now(),
      clientId,
      payload: { command: 'heartbeat' }
    };
  }
}

// Usage
const input = MessageFactory.createInput('move', { direction: 'north' });
server.processMessage(client, input);
```

### Type Guards

Ensure type safety when processing messages:

```typescript
function isInputMessage(message: NetworkMessage): message is InputMessage {
  return message.type === 'input' &&
         typeof message.payload === 'object' &&
         message.payload !== null &&
         'action' in message.payload;
}

function isStateMessage(message: NetworkMessage): message is StateMessage {
  return message.type === 'state' &&
         typeof message.payload === 'object' &&
         message.payload !== null &&
         'entities' in message.payload;
}

// Usage in message handler
function handleMessage(message: NetworkMessage): void {
  if (isInputMessage(message)) {
    // TypeScript knows this is InputMessage
    handlePlayerInput(message.payload.action, message.payload.data);
  } else if (isStateMessage(message)) {
    // TypeScript knows this is StateMessage
    updateGameState(message.payload.entities);
  }
}
```

## Performance Optimization

### Message Pooling

Reuse message objects to reduce garbage collection:

```typescript
class MessagePool {
  private inputPool: InputMessage[] = [];
  private statePool: StateMessage[] = [];

  createInput(action: string, data: Record<string, unknown>): InputMessage {
    const message = this.inputPool.pop() || {} as InputMessage;

    message.type = 'input';
    message.timestamp = Date.now();
    message.payload = { action, data };

    return message;
  }

  releaseInput(message: InputMessage): void {
    // Clear references
    message.payload = { action: '', data: {} };
    message.frame = undefined;
    message.entities = undefined;

    this.inputPool.push(message);
  }
}
```

### Compression

Compress large state messages:

```typescript
import { gzipSync, gunzipSync } from 'bun';

function compressMessage(message: NetworkMessage): ArrayBuffer {
  const json = JSON.stringify(message);
  const compressed = gzipSync(Buffer.from(json));
  return compressed.buffer;
}

function decompressMessage(buffer: ArrayBuffer): NetworkMessage {
  const decompressed = gunzipSync(Buffer.from(buffer));
  return JSON.parse(decompressed.toString());
}
```

### Batching

Batch multiple messages for efficiency:

```typescript
interface MessageBatch {
  messages: NetworkMessage[];
  timestamp: number;
}

class MessageBatcher {
  private batch: NetworkMessage[] = [];
  private batchSize = 10;
  private flushInterval = 16; // ~60fps

  addMessage(message: NetworkMessage): void {
    this.batch.push(message);

    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.batch.length === 0) return;

    const batchMessage: MessageBatch = {
      messages: [...this.batch],
      timestamp: Date.now()
    };

    server.broadcast({
      type: 'system',
      timestamp: Date.now(),
      payload: { command: 'batch', data: batchMessage }
    });

    this.batch.length = 0;
  }
}
```

## Validation and Security

### Message Validation

```typescript
function validateNetworkMessage(obj: unknown): obj is NetworkMessage {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const message = obj as Record<string, unknown>;

  // Required fields
  if (typeof message.type !== 'string' ||
      !['input', 'state', 'event', 'system'].includes(message.type) ||
      typeof message.timestamp !== 'number' ||
      message.payload === undefined) {
    return false;
  }

  // Optional fields
  if (message.frame !== undefined && typeof message.frame !== 'number') {
    return false;
  }

  if (message.entities !== undefined && !Array.isArray(message.entities)) {
    return false;
  }

  if (message.clientId !== undefined && typeof message.clientId !== 'string') {
    return false;
  }

  return true;
}
```

### Rate Limiting

```typescript
class MessageRateLimiter {
  private clientCounts = new Map<string, { count: number; resetTime: number }>();

  checkLimit(clientId: string, messageType: string): boolean {
    const limits = {
      input: 60,  // 60 input messages per second
      event: 10,  // 10 event messages per second
      system: 5   // 5 system messages per second
    };

    const maxCount = limits[messageType as keyof typeof limits] || 1;
    const windowMs = 1000;

    const key = `${clientId}:${messageType}`;
    const now = Date.now();
    const record = this.clientCounts.get(key);

    if (!record || now > record.resetTime) {
      this.clientCounts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxCount) {
      return false; // Rate limit exceeded
    }

    record.count++;
    return true;
  }
}
```

### Sanitization

```typescript
function sanitizeMessage(message: NetworkMessage): NetworkMessage {
  // Deep clone to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(message));

  // Sanitize string fields
  if (sanitized.type) {
    sanitized.type = sanitized.type.substring(0, 20);
  }

  // Sanitize payload based on type
  if (sanitized.type === 'input' && sanitized.payload) {
    const payload = sanitized.payload as InputMessage['payload'];
    if (payload.action) {
      payload.action = payload.action.substring(0, 50);
    }
  }

  return sanitized;
}
```

## Testing

### Mock Messages

```typescript
function createMockInputMessage(action: string, data: any = {}): InputMessage {
  return {
    type: 'input',
    timestamp: Date.now(),
    payload: { action, data }
  };
}

function createMockStateMessage(entities: any[] = []): StateMessage {
  return {
    type: 'state',
    timestamp: Date.now(),
    frame: 1,
    payload: { entities }
  };
}

// Test usage
describe('Message Processing', () => {
  test('should handle player movement input', () => {
    const message = createMockInputMessage('move', { direction: 'north' });
    const result = processInputMessage(message);
    expect(result.success).toBe(true);
  });
});
```

## See Also

- [GameServer](./game-server.md) - Server-side message handling
- [GameClient](./game-client.md) - Client connection management
- [MessageSerializer](./message-serializer.md) - Message serialization utilities
- [World](../core/world.md) - ECS integration with networking