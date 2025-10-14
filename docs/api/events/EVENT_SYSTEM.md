# Event System

The Event System is the core communication mechanism in the ECS engine, enabling decoupled interaction between entities, components, and systems. It consists of three main components: EventBus, EventComponent, and World-level event integration.

## Overview

The event system provides:
- **Decoupled Communication**: Systems and entities communicate without direct references
- **Event Queuing**: Events are queued and processed in batches for performance
- **Type Safety**: Strong TypeScript typing for event handling
- **Network Ready**: Events are serializable for multiplayer synchronization

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  EventComponent │    │    EventBus     │    │     World       │
│                 │    │                 │    │                 │
│ • queueEvent()  │───▶│ • emit()        │◀───│ • emitEvent()   │
│ • flushEvents() │    │ • subscribe()   │    │ • subscribeToEvent()
│                 │    │ • processEvents()│   │ • update()      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │   GameEvent     │
                    │                 │
                    │ • type          │
                    │ • timestamp     │
                    │ • source        │
                    │ • data          │
                    └─────────────────┘
```

## Quick Example

```typescript
import { World } from '@danjdewhurst/ecs-ts';
import { EventComponent } from '@danjdewhurst/ecs-ts';

const world = new World();

// Subscribe to events
world.subscribeToEvent('player-moved', (event) => {
  console.log(`Player moved to ${event.data.x}, ${event.data.y}`);
});

// Entity with event component
const player = world.createEntity();
const eventComp = new EventComponent();
world.addComponent(player, eventComp);

// Queue event from entity
eventComp.queueEvent('player-moved', { x: 10, y: 20 });

// Or emit directly through world
world.emitEvent({
  type: 'game-started',
  timestamp: Date.now(),
  data: { level: 1 }
});

// Process all events
world.update(16.67);
```

## Event Flow

### 1. Event Creation
Events can be created in multiple ways:

```typescript
// Through EventComponent (entity-level)
const eventComp = world.getComponent(entity, 'event');
eventComp.queueEvent('entity-action', { action: 'jump' });

// Through World (global)
world.emitEvent({
  type: 'system-notification',
  timestamp: Date.now(),
  data: { message: 'Physics step completed' }
});

// Through EventBus directly (advanced)
const eventBus = world.getEventBus();
eventBus.emit({
  type: 'debug-info',
  timestamp: Date.now(),
  data: { fps: 60, entities: 1000 }
});
```

### 2. Event Processing Lifecycle

Events follow a specific processing order during `world.update()`:

```typescript
class World {
  update(deltaTime: number): void {
    // 1. Process pre-existing events
    this.eventBus.processEvents();

    // 2. Flush events from EventComponents
    this.flushEntityEvents();

    // 3. Execute systems (may generate new events)
    this.systemScheduler.update(this, deltaTime);

    // 4. Process events generated during system execution
    this.eventBus.processEvents();
  }
}
```

### 3. Event Subscription and Handling

```typescript
// Basic subscription
const unsubscribe = world.subscribeToEvent('collision', (event) => {
  handleCollision(event.data);
});

// Multiple event types
world.subscribeToEvent('player-action', handlePlayerAction);
world.subscribeToEvent('item-collected', handleItemCollection);
world.subscribeToEvent('level-completed', handleLevelCompletion);

// Conditional handling
world.subscribeToEvent('entity-health-changed', (event) => {
  if (event.data.newHealth <= 0) {
    handleEntityDeath(event.data.entityId);
  }
});

// Cleanup
unsubscribe(); // Remove subscription
```

## System Integration Patterns

### Event-Driven Systems

Systems can both consume and produce events:

```typescript
class MovementSystem extends BaseSystem {
  readonly name = 'MovementSystem';
  readonly priority = 1;

  private handlePlayerInput = (event: GameEvent) => {
    // React to player input events
    const { playerId, direction } = event.data;
    this.movePlayer(playerId, direction);
  };

  onAddedToWorld(world: World): void {
    // Subscribe to relevant events
    world.subscribeToEvent('player-input', this.handlePlayerInput);
  }

  update(world: World, deltaTime: number): void {
    const movedEntities = this.updatePositions(world, deltaTime);

    // Emit movement events for each moved entity
    for (const entity of movedEntities) {
      world.emitEvent({
        type: 'entity-moved',
        timestamp: Date.now(),
        source: `system:${this.name}`,
        data: {
          entityId: entity.id,
          position: entity.position,
          velocity: entity.velocity
        }
      });
    }
  }
}
```

### Cross-System Communication

```typescript
class HealthSystem extends BaseSystem {
  readonly name = 'HealthSystem';

  private handleDamage = (event: GameEvent) => {
    const { targetId, damage, source } = event.data;
    const health = world.getComponent(targetId, 'health');

    health.current -= damage;

    // Emit health changed event
    world.emitEvent({
      type: 'health-changed',
      timestamp: Date.now(),
      data: {
        entityId: targetId,
        newHealth: health.current,
        previousHealth: health.current + damage,
        damageSource: source
      }
    });

    // Emit death event if health <= 0
    if (health.current <= 0) {
      world.emitEvent({
        type: 'entity-died',
        timestamp: Date.now(),
        data: { entityId: targetId, killer: source }
      });
    }
  };

  onAddedToWorld(world: World): void {
    world.subscribeToEvent('damage-dealt', this.handleDamage);
  }
}

class CombatSystem extends BaseSystem {
  readonly name = 'CombatSystem';

  private handleCollision = (event: GameEvent) => {
    const { entity1, entity2 } = event.data;

    if (this.isAttack(entity1, entity2)) {
      // Emit damage event for HealthSystem to handle
      world.emitEvent({
        type: 'damage-dealt',
        timestamp: Date.now(),
        data: {
          targetId: entity2,
          damage: this.calculateDamage(entity1),
          source: entity1
        }
      });
    }
  };

  onAddedToWorld(world: World): void {
    world.subscribeToEvent('collision-detected', this.handleCollision);
  }
}
```

## Event Patterns

### State Change Broadcasting

```typescript
class InventorySystem extends BaseSystem {
  private addItem(entityId: number, item: Item): void {
    const inventory = world.getComponent(entityId, 'inventory');
    inventory.items.push(item);

    // Broadcast inventory change
    world.emitEvent({
      type: 'inventory-changed',
      timestamp: Date.now(),
      data: {
        entityId,
        action: 'add',
        item: item,
        totalItems: inventory.items.length
      }
    });
  }
}
```

### Event Chaining

```typescript
// Chain of events: pickup → inventory → UI update
world.subscribeToEvent('item-pickup', (event) => {
  // Add to inventory
  const success = inventory.addItem(event.data.item);

  if (success) {
    world.emitEvent({
      type: 'inventory-changed',
      timestamp: Date.now(),
      data: { playerId: event.data.playerId, item: event.data.item }
    });
  }
});

world.subscribeToEvent('inventory-changed', (event) => {
  // Update UI
  world.emitEvent({
    type: 'ui-update-required',
    timestamp: Date.now(),
    data: { component: 'inventory', playerId: event.data.playerId }
  });
});
```

### Event Filtering and Middleware

```typescript
class EventMiddleware {
  static createAuthFilter(allowedSources: string[]) {
    return (event: GameEvent): boolean => {
      return !event.source || allowedSources.includes(event.source);
    };
  }

  static createRateLimiter(maxEventsPerSecond: number) {
    const eventCounts = new Map<string, number>();
    const windowStart = Date.now();

    return (event: GameEvent): boolean => {
      const now = Date.now();
      const window = Math.floor((now - windowStart) / 1000);
      const key = `${event.type}-${window}`;
      const count = eventCounts.get(key) || 0;

      if (count >= maxEventsPerSecond) {
        return false; // Rate limit exceeded
      }

      eventCounts.set(key, count + 1);
      return true;
    };
  }
}
```

## Performance Considerations

### Event Batching

```typescript
class EventBatcher {
  private batch: GameEvent[] = [];
  private batchSize = 100;

  queueEvent(event: GameEvent): void {
    this.batch.push(event);

    if (this.batch.length >= this.batchSize) {
      this.flushBatch();
    }
  }

  private flushBatch(): void {
    for (const event of this.batch) {
      world.emitEvent(event);
    }
    this.batch.length = 0;
  }
}
```

### Memory Management

```typescript
class EventPool {
  private pool: GameEvent[] = [];

  createEvent(type: string, data: Record<string, unknown>): GameEvent {
    const event = this.pool.pop() || {} as GameEvent;

    // Reuse object to avoid allocations
    (event as any).type = type;
    (event as any).timestamp = Date.now();
    (event as any).data = data;

    return event;
  }

  releaseEvent(event: GameEvent): void {
    // Clear references and return to pool
    (event as any).data = {};
    (event as any).source = undefined;
    this.pool.push(event);
  }
}
```

## Error Handling

```typescript
world.subscribeToEvent('system-error', (event) => {
  console.error(`System error in ${event.data.systemName}:`, event.data.error);

  // Optionally pause or restart the problematic system
  if (event.data.critical) {
    world.pauseSystem(event.data.systemName);
  }
});

// Systems can emit error events
class PhysicsSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    try {
      this.performPhysicsStep(deltaTime);
    } catch (error) {
      world.emitEvent({
        type: 'system-error',
        timestamp: Date.now(),
        data: {
          systemName: this.name,
          error: error.message,
          critical: true
        }
      });
    }
  }
}
```

## Network Event Synchronization

```typescript
class NetworkSystem extends BaseSystem {
  private handleNetworkEvent = (event: GameEvent) => {
    // Serialize and send to clients
    const serialized = this.serializeEvent(event);
    this.broadcastToClients(serialized);
  };

  onAddedToWorld(world: World): void {
    // Subscribe to networkable events
    world.subscribeToEvent('player-action', this.handleNetworkEvent);
    world.subscribeToEvent('entity-moved', this.handleNetworkEvent);
    world.subscribeToEvent('item-collected', this.handleNetworkEvent);
  }

  private serializeEvent(event: GameEvent): string {
    return JSON.stringify({
      type: event.type,
      timestamp: event.timestamp,
      data: event.data
      // Note: source omitted for network events
    });
  }
}
```

## Testing Event Systems

```typescript
describe('Event System Integration', () => {
  test('should handle event chain correctly', () => {
    const world = new World();
    const events: GameEvent[] = [];

    // Set up event chain
    world.subscribeToEvent('player-action', (event) => {
      world.emitEvent({
        type: 'action-processed',
        timestamp: Date.now(),
        data: { original: event.data }
      });
    });

    world.subscribeToEvent('action-processed', (event) => {
      events.push(event);
    });

    // Trigger chain
    world.emitEvent({
      type: 'player-action',
      timestamp: Date.now(),
      data: { action: 'jump' }
    });

    world.update(16.67);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('action-processed');
  });
});
```

## See Also

- [EventBus](./event-bus.md) - Core event publishing and subscription
- [EventComponent](./event-component.md) - Entity-level event queuing
- [GameEvent](./game-event.md) - Event data structure
- [World](../core/world.md) - World-level event integration
- [System](../core/system.md) - System event patterns