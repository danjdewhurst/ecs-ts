# MessageSerializer

The `MessageSerializer` module provides utilities for serializing and deserializing NetworkMessages for WebSocket communication. It handles protocol versioning, validation, and supports both JSON and binary formats.

## Overview

MessageSerializer ensures reliable message transmission between GameServer and clients by:
- **Protocol Versioning**: Maintains compatibility across different client/server versions
- **Validation**: Ensures message integrity and format compliance
- **Error Handling**: Graceful error recovery with descriptive error messages
- **Binary Support**: Optional binary serialization for performance-critical scenarios

## API Reference

### serialize

```typescript
function serialize(message: NetworkMessage): string
```

Serializes a NetworkMessage to a JSON string with protocol envelope.

#### Parameters
- `message: NetworkMessage` - The message to serialize

#### Returns
`string` - JSON string with protocol envelope

#### Example
```typescript
import * as MessageSerializer from '@danjdewhurst/ecs-ts/websocket';

const message: NetworkMessage = {
  type: 'input',
  timestamp: Date.now(),
  payload: {
    action: 'move',
    data: { direction: 'north' }
  }
};

const serialized = MessageSerializer.serialize(message);
// Result: '{"version":1,"message":{"type":"input",...}}'

// Send over WebSocket
client.ws.send(serialized);
```

#### Protocol Envelope Structure
```typescript
interface MessageEnvelope {
  version: number;  // Protocol version (currently 1)
  message: NetworkMessage;
}
```

### deserialize

```typescript
function deserialize(data: string | Buffer): NetworkMessage
```

Deserializes a JSON string or Buffer back to a NetworkMessage with validation.

#### Parameters
- `data: string | Buffer` - Serialized message data

#### Returns
`NetworkMessage` - Validated and parsed message

#### Throws
- `Error` - If protocol version is unsupported
- `Error` - If message format is invalid
- `Error` - If JSON parsing fails

#### Example
```typescript
// Receive from WebSocket
ws.on('message', (data) => {
  try {
    const message = MessageSerializer.deserialize(data);
    processMessage(message);
  } catch (error) {
    console.error('Invalid message received:', error.message);
    sendErrorResponse('Invalid message format');
  }
});
```

### serializeBinary

```typescript
function serializeBinary(message: NetworkMessage): ArrayBuffer
```

Serializes a NetworkMessage to binary format for reduced bandwidth usage.

#### Parameters
- `message: NetworkMessage` - The message to serialize

#### Returns
`ArrayBuffer` - Binary representation of the message

#### Example
```typescript
const message: NetworkMessage = {
  type: 'state',
  timestamp: Date.now(),
  payload: { entities: largeEntityArray }
};

// Use binary for large state updates
const binaryData = MessageSerializer.serializeBinary(message);
client.ws.send(binaryData);

// Savings: ~15-30% smaller than JSON for large payloads
```

### deserializeBinary

```typescript
function deserializeBinary(buffer: ArrayBuffer): NetworkMessage
```

Deserializes a binary-encoded NetworkMessage.

#### Parameters
- `buffer: ArrayBuffer` - Binary message data

#### Returns
`NetworkMessage` - Parsed message

#### Example
```typescript
ws.on('message', (data) => {
  if (data instanceof ArrayBuffer) {
    const message = MessageSerializer.deserializeBinary(data);
    processMessage(message);
  } else {
    const message = MessageSerializer.deserialize(data);
    processMessage(message);
  }
});
```

### createHeartbeat

```typescript
function createHeartbeat(clientId: string): NetworkMessage
```

Creates a standardized heartbeat message for connection monitoring.

#### Parameters
- `clientId: string` - Client identifier

#### Returns
`NetworkMessage` - Heartbeat system message

#### Example
```typescript
// Server sends heartbeat to client
const heartbeat = MessageSerializer.createHeartbeat(client.id);
server.sendToClient(client.id, heartbeat);

// Client responds with heartbeat
const response = MessageSerializer.createHeartbeat(myClientId);
ws.send(MessageSerializer.serialize(response));
```

### createError

```typescript
function createError(message: string, clientId?: string): NetworkMessage
```

Creates a standardized error message for client communication.

#### Parameters
- `message: string` - Error description
- `clientId?: string` - Optional client identifier

#### Returns
`NetworkMessage` - Error system message

#### Example
```typescript
// Send error to specific client
const error = MessageSerializer.createError('Invalid action', client.id);
server.sendToClient(client.id, error);

// Broadcast general error
const generalError = MessageSerializer.createError('Server maintenance in 5 minutes');
server.broadcast(generalError);
```

## Protocol Versioning

The MessageSerializer implements a versioning system to maintain compatibility:

```typescript
const PROTOCOL_VERSION = 1;

// Version checking during deserialization
if (!envelope.version || envelope.version !== PROTOCOL_VERSION) {
  throw new Error(`Unsupported protocol version: ${envelope.version}`);
}
```

### Version Migration

```typescript
class MessageMigrator {
  static migrateMessage(envelope: any): NetworkMessage {
    switch (envelope.version) {
      case 1:
        return envelope.message; // Current version

      case 0:
        // Migrate from legacy format
        return {
          type: envelope.message.messageType, // Renamed field
          timestamp: envelope.message.time,   // Renamed field
          payload: envelope.message.data      // Renamed field
        };

      default:
        throw new Error(`Unsupported version: ${envelope.version}`);
    }
  }
}
```

## Message Validation

The serializer includes comprehensive validation:

```typescript
function isValidMessage(obj: unknown): obj is NetworkMessage {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const message = obj as Record<string, unknown>;

  // Type validation
  if (typeof message.type !== 'string' ||
      !['input', 'state', 'event', 'system'].includes(message.type)) {
    return false;
  }

  // Timestamp validation
  if (typeof message.timestamp !== 'number' || message.timestamp <= 0) {
    return false;
  }

  // Payload validation
  if (message.payload === undefined) {
    return false;
  }

  return true;
}
```

### Custom Validation

Extend validation for specific message types:

```typescript
class MessageValidator {
  static validateInputMessage(message: NetworkMessage): boolean {
    if (message.type !== 'input') return false;

    const payload = message.payload as any;
    return (
      typeof payload.action === 'string' &&
      payload.action.length > 0 &&
      payload.action.length <= 50 &&
      typeof payload.data === 'object'
    );
  }

  static validateStateMessage(message: NetworkMessage): boolean {
    if (message.type !== 'state') return false;

    const payload = message.payload as any;
    return (
      Array.isArray(payload.entities) &&
      payload.entities.every((entity: any) =>
        typeof entity.id === 'number' &&
        typeof entity.components === 'object'
      )
    );
  }
}
```

## Error Handling Patterns

### Graceful Degradation

```typescript
class RobustSerializer {
  static safeDejson(data: string | Buffer): NetworkMessage | null {
    try {
      return MessageSerializer.deserialize(data);
    } catch (error) {
      console.warn('Message deserialization failed:', error.message);
      return null;
    }
  }

  static safeSerialize(message: NetworkMessage): string | null {
    try {
      return MessageSerializer.serialize(message);
    } catch (error) {
      console.error('Message serialization failed:', error.message);
      return null;
    }
  }
}

// Usage
ws.on('message', (data) => {
  const message = RobustSerializer.safeDeserialize(data);
  if (message) {
    processMessage(message);
  } else {
    // Handle corrupt message gracefully
    sendErrorResponse('Message format error');
  }
});
```

### Error Recovery

```typescript
class MessageRecovery {
  private static corruptMessageCount = 0;
  private static maxCorruptMessages = 5;

  static handleCorruptMessage(clientId: string, error: Error): boolean {
    this.corruptMessageCount++;

    if (this.corruptMessageCount > this.maxCorruptMessages) {
      // Too many corrupt messages, disconnect client
      server.kickClient(clientId, 'Too many invalid messages');
      return false;
    }

    // Send error message to client
    const errorMessage = MessageSerializer.createError(
      `Message error: ${error.message}`,
      clientId
    );
    server.sendToClient(clientId, errorMessage);

    return true; // Continue processing
  }

  static resetCorruptCounter(): void {
    this.corruptMessageCount = 0;
  }
}
```

## Performance Optimization

### Message Compression

```typescript
import { gzipSync, gunzipSync } from 'bun';

class CompressedSerializer {
  static compressThreshold = 1024; // Compress messages > 1KB

  static serialize(message: NetworkMessage): string | ArrayBuffer {
    const json = MessageSerializer.serialize(message);

    if (json.length > this.compressThreshold) {
      const compressed = gzipSync(Buffer.from(json));
      return compressed.buffer;
    }

    return json;
  }

  static deserialize(data: string | ArrayBuffer): NetworkMessage {
    if (data instanceof ArrayBuffer) {
      // Decompress binary data
      const decompressed = gunzipSync(Buffer.from(data));
      return MessageSerializer.deserialize(decompressed.toString());
    }

    return MessageSerializer.deserialize(data);
  }
}
```

### Serialization Caching

```typescript
class CachedSerializer {
  private static cache = new Map<string, string>();
  private static cacheHits = 0;
  private static cacheMisses = 0;

  static serialize(message: NetworkMessage): string {
    // Create cache key from message (excluding timestamp)
    const cacheKey = this.createCacheKey(message);

    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    this.cacheMisses++;
    const serialized = MessageSerializer.serialize(message);
    this.cache.set(cacheKey, serialized);

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return serialized;
  }

  private static createCacheKey(message: NetworkMessage): string {
    const keyMessage = { ...message };
    delete keyMessage.timestamp; // Exclude timestamp from cache key
    return JSON.stringify(keyMessage);
  }

  static getCacheStats(): { hits: number; misses: number; ratio: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      ratio: total > 0 ? this.cacheHits / total : 0
    };
  }
}
```

## Testing Utilities

### Mock Messages

```typescript
class MessageTestUtils {
  static createTestInput(action: string, data: any = {}): NetworkMessage {
    return {
      type: 'input',
      timestamp: Date.now(),
      payload: { action, data }
    };
  }

  static createTestState(entities: any[] = []): NetworkMessage {
    return {
      type: 'state',
      timestamp: Date.now(),
      frame: 1,
      payload: { entities }
    };
  }

  static createTestEvent(eventType: string, eventData: any = {}): NetworkMessage {
    return {
      type: 'event',
      timestamp: Date.now(),
      payload: { eventType, eventData }
    };
  }

  static assertValidSerialization(message: NetworkMessage): void {
    const serialized = MessageSerializer.serialize(message);
    const deserialized = MessageSerializer.deserialize(serialized);

    expect(deserialized).toEqual(message);
  }
}
```

### Serialization Testing

```typescript
describe('MessageSerializer', () => {
  test('should serialize and deserialize input messages', () => {
    const original = MessageTestUtils.createTestInput('move', { x: 1, y: 0 });
    MessageTestUtils.assertValidSerialization(original);
  });

  test('should handle protocol versioning', () => {
    const message = MessageTestUtils.createTestInput('test');
    const serialized = MessageSerializer.serialize(message);
    const envelope = JSON.parse(serialized);

    expect(envelope.version).toBe(1);
    expect(envelope.message).toBeDefined();
  });

  test('should reject invalid protocol versions', () => {
    const invalidEnvelope = JSON.stringify({
      version: 999,
      message: { type: 'input', timestamp: Date.now(), payload: {} }
    });

    expect(() => {
      MessageSerializer.deserialize(invalidEnvelope);
    }).toThrow('Unsupported protocol version');
  });

  test('should handle binary serialization', () => {
    const message = MessageTestUtils.createTestState([
      { id: 1, components: { position: { x: 1, y: 2 } } }
    ]);

    const binary = MessageSerializer.serializeBinary(message);
    const deserialized = MessageSerializer.deserializeBinary(binary);

    expect(deserialized).toEqual(message);
  });
});
```

## Production Considerations

### Monitoring

```typescript
class SerializationMetrics {
  private static stats = {
    totalSerialized: 0,
    totalDeserialized: 0,
    errors: 0,
    avgSerializeTime: 0,
    avgDeserializeTime: 0
  };

  static trackSerialization<T>(operation: () => T): T {
    const start = Date.now();
    try {
      const result = operation();
      this.stats.totalSerialized++;
      this.updateAvgTime('avgSerializeTime', Date.now() - start);
      return result;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  static trackDeserialization<T>(operation: () => T): T {
    const start = Date.now();
    try {
      const result = operation();
      this.stats.totalDeserialized++;
      this.updateAvgTime('avgDeserializeTime', Date.now() - start);
      return result;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  private static updateAvgTime(field: 'avgSerializeTime' | 'avgDeserializeTime', time: number): void {
    const count = field === 'avgSerializeTime' ? this.stats.totalSerialized : this.stats.totalDeserialized;
    this.stats[field] = ((this.stats[field] * (count - 1)) + time) / count;
  }

  static getStats() {
    return { ...this.stats };
  }
}
```

### Security

```typescript
class SecureSerializer {
  private static maxMessageSize = 1024 * 1024; // 1MB limit
  private static maxNestingDepth = 10;

  static serialize(message: NetworkMessage): string {
    // Validate message size
    const json = JSON.stringify(message);
    if (json.length > this.maxMessageSize) {
      throw new Error('Message too large');
    }

    // Check nesting depth
    if (this.getObjectDepth(message) > this.maxNestingDepth) {
      throw new Error('Message too deeply nested');
    }

    return MessageSerializer.serialize(message);
  }

  private static getObjectDepth(obj: any, depth = 0): number {
    if (depth > this.maxNestingDepth) return depth;
    if (typeof obj !== 'object' || obj === null) return depth;

    return Math.max(
      ...Object.values(obj).map(value => this.getObjectDepth(value, depth + 1))
    );
  }
}
```

## See Also

- [NetworkMessage](./network-message.md) - Message format specification
- [GameServer](./game-server.md) - Server-side message handling
- [GameClient](./game-client.md) - Client connection management
- [World](../core/world.md) - ECS integration with networking