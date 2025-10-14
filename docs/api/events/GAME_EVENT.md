# GameEvent

The `GameEvent` interface defines the structure for all events in the ECS system. It provides a standardized format for event data that flows through the EventBus and EventComponent system.

## Quick Example

```typescript
import type { GameEvent } from '@danjdewhurst/ecs-ts';

// Creating a custom event
const playerEvent: GameEvent = {
  type: 'player-action',
  timestamp: Date.now(),
  source: 'player-system',
  data: {
    action: 'jump',
    playerId: 123,
    position: { x: 10, y: 20 }
  }
};

// Emit through World
world.emitEvent(playerEvent);
```

## Interface Definition

```typescript
interface GameEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly source?: string;
  readonly data: Record<string, unknown>;
}
```

## Properties

### type

```typescript
readonly type: string
```

The event type identifier used for categorization and routing. Event types should follow a consistent naming convention.

#### Naming Conventions
- Use kebab-case: `player-moved`, `item-collected`
- Be descriptive: `collision-detected` vs `collision`
- Use namespaces for clarity: `ui-button-clicked`, `game-level-completed`

#### Example
```typescript
const event: GameEvent = {
  type: 'entity-health-changed',
  timestamp: Date.now(),
  data: { entityId: 42, newHealth: 75, previousHealth: 100 }
};
```

### timestamp

```typescript
readonly timestamp: number
```

Unix timestamp (milliseconds) when the event was created. Used for event ordering and debugging.

#### Example
```typescript
const event: GameEvent = {
  type: 'game-started',
  timestamp: Date.now(), // Current time
  data: { level: 1, difficulty: 'normal' }
};
```

### source

```typescript
readonly source?: string
```

Optional identifier for the event source. Automatically set by EventComponent to `entity:${entityId}` format.

#### Source Types
- `entity:123` - Events from EventComponent
- `system:MovementSystem` - Events from systems
- `network:client-456` - Events from network
- `user` - User-initiated events

#### Example
```typescript
const systemEvent: GameEvent = {
  type: 'physics-step-completed',
  timestamp: Date.now(),
  source: 'system:PhysicsSystem',
  data: { deltaTime: 16.67, entityCount: 150 }
};
```

### data

```typescript
readonly data: Record<string, unknown>
```

Event payload containing arbitrary event-specific data. Should be serializable for network events.

#### Data Guidelines
- Use plain objects and primitives
- Avoid functions, classes, or circular references
- Keep data focused and relevant to the event
- Use consistent property names across similar events

#### Example
```typescript
const collisionEvent: GameEvent = {
  type: 'collision-detected',
  timestamp: Date.now(),
  data: {
    entity1: 123,
    entity2: 456,
    point: { x: 100, y: 50 },
    normal: { x: 0, y: 1 },
    impulse: 2.5
  }
};
```

## Built-in Event Types

The engine provides several built-in event types for common scenarios:

### Entity Lifecycle Events

```typescript
// Entity created
{
  type: 'entity-created',
  data: { entityId: number }
}

// Entity destroyed
{
  type: 'entity-destroyed',
  data: { entityId: number }
}

// Component added
{
  type: 'component-added',
  data: { entityId: number, componentType: string }
}

// Component removed
{
  type: 'component-removed',
  data: { entityId: number, componentType: string }
}
```

### System Events

```typescript
// System added to world
{
  type: 'system-added',
  data: { systemName: string, priority: number }
}

// System execution error
{
  type: 'system-error',
  data: { systemName: string, error: string }
}
```

### Network Events

```typescript
// Client connected
{
  type: 'client-connected',
  data: { clientId: string, timestamp: number }
}

// Client disconnected
{
  type: 'client-disconnected',
  data: { clientId: string, reason: string }
}

// Network message received
{
  type: 'network-message',
  data: { clientId: string, messageType: string, payload: any }
}
```

## Custom Event Creation

### Event Factory Pattern

Create consistent events using factory functions:

```typescript
class EventFactory {
  static createPlayerAction(playerId: number, action: string, data: any): GameEvent {
    return {
      type: 'player-action',
      timestamp: Date.now(),
      source: `player:${playerId}`,
      data: { playerId, action, ...data }
    };
  }

  static createCollision(entity1: number, entity2: number, collision: CollisionData): GameEvent {
    return {
      type: 'collision-detected',
      timestamp: Date.now(),
      data: {
        entity1,
        entity2,
        point: collision.point,
        normal: collision.normal,
        impulse: collision.impulse
      }
    };
  }
}

// Usage
const jumpEvent = EventFactory.createPlayerAction(123, 'jump', { force: 150 });
world.emitEvent(jumpEvent);
```

### Event Type Constants

Define event types as constants to avoid typos:

```typescript
export const EventTypes = {
  PLAYER_ACTION: 'player-action',
  COLLISION_DETECTED: 'collision-detected',
  ITEM_COLLECTED: 'item-collected',
  HEALTH_CHANGED: 'health-changed',
  LEVEL_COMPLETED: 'level-completed'
} as const;

// Usage with type safety
const event: GameEvent = {
  type: EventTypes.PLAYER_ACTION,
  timestamp: Date.now(),
  data: { action: 'jump' }
};
```

## Serialization and Network Events

GameEvents are designed to be serializable for network transmission:

```typescript
// Serialize for network
const serialized = JSON.stringify(gameEvent);

// Deserialize from network
const received: GameEvent = JSON.parse(serialized);

// Validate received event
function isValidGameEvent(obj: any): obj is GameEvent {
  return (
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.data === 'object' &&
    obj.data !== null
  );
}
```

## Performance Notes

- Events are immutable for safety and performance
- Use object pooling for high-frequency events
- Keep event data minimal to reduce memory usage
- Timestamp generation is the most expensive operation

## Type Safety with TypeScript

Define typed events for better developer experience:

```typescript
interface PlayerActionEvent extends GameEvent {
  type: 'player-action';
  data: {
    playerId: number;
    action: 'jump' | 'move' | 'attack';
    position: { x: number; y: number };
  };
}

interface CollisionEvent extends GameEvent {
  type: 'collision-detected';
  data: {
    entity1: number;
    entity2: number;
    point: { x: number; y: number };
    normal: { x: number; y: number };
  };
}

// Type-safe event handling
world.subscribeToEvent('player-action', (event: PlayerActionEvent) => {
  // TypeScript knows event.data.playerId exists
  console.log(`Player ${event.data.playerId} performed ${event.data.action}`);
});
```

## See Also

- [EventBus](./event-bus.md) - Event publishing and subscription system
- [EventComponent](./event-component.md) - Entity-level event queuing
- [World](../core/world.md) - World-level event methods