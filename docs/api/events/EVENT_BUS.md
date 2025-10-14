# EventBus API Reference

The EventBus provides decoupled communication between systems through an event-driven architecture. It enables systems to communicate without direct dependencies, promoting loose coupling and maintainable code.

## Overview

The EventBus features:

- **Decoupled Communication**: Systems communicate via events, not direct calls
- **Event Queuing**: Events are queued and processed at controlled times
- **Error Isolation**: Listener errors don't affect other listeners or event processing
- **Type Safety**: Strongly typed event interfaces with TypeScript
- **Performance Optimized**: Efficient event processing and listener management

Events flow through the system in a controlled manner, ensuring predictable execution order and system stability.

## GameEvent Interface

### GameEvent

All events implement the GameEvent interface.

```typescript
interface GameEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly source?: string;
  readonly data: Record<string, unknown>;
}
```

**Properties:**
- `type: string` - Unique identifier for the event type
- `timestamp: number` - When the event was created (milliseconds since epoch)
- `source?: string` - Optional identifier of the event source
- `data: Record<string, unknown>` - Event payload data

## Quick Example

```typescript
import { EventBus, type GameEvent } from '@danjdewhurst/ecs-ts';

const eventBus = new EventBus();

// Subscribe to events
const unsubscribe = eventBus.subscribe('player-died', (event) => {
  console.log(`Player died at ${event.timestamp}`);
  console.log('Death data:', event.data);
});

// Emit an event
eventBus.emit({
  type: 'player-died',
  timestamp: Date.now(),
  source: 'HealthSystem',
  data: {
    playerId: 1,
    cause: 'enemy-damage',
    location: { x: 100, y: 200 }
  }
});

// Process events (typically called by World.update)
eventBus.processEvents();

// Unsubscribe when done
unsubscribe();
```

## Constructor

### EventBus()

Creates a new EventBus with empty state.

```typescript
const eventBus = new EventBus();
```

**Initial State:**
- Empty listener registry
- Empty event queue

## Event Management

### emit(event)

Adds an event to the processing queue.

```typescript
emit(event: GameEvent): void
```

**Parameters:**
- `event: GameEvent` - Event to queue for processing

**Example:**
```typescript
// Simple event
eventBus.emit({
  type: 'level-complete',
  timestamp: Date.now(),
  data: { level: 1, score: 1000 }
});

// Event with source tracking
eventBus.emit({
  type: 'entity-spawned',
  timestamp: Date.now(),
  source: 'SpawnSystem',
  data: {
    entityId: 42,
    entityType: 'enemy',
    position: { x: 50, y: 100 }
  }
});

// Event with complex data
eventBus.emit({
  type: 'collision-detected',
  timestamp: Date.now(),
  source: 'CollisionSystem',
  data: {
    entity1: 1,
    entity2: 2,
    contactPoint: { x: 75, y: 150 },
    impulse: { x: -10, y: 5 },
    damage: 25
  }
});
```

**Behavior:**
- Events are queued immediately but not processed until `processEvents()` is called
- No validation is performed on event structure (trust-based)
- Events are processed in FIFO (first-in, first-out) order

### processEvents()

Processes all queued events and delivers them to subscribers.

```typescript
processEvents(): void
```

**Example:**
```typescript
// Typical usage in game loop
class GameWorld {
  private eventBus = new EventBus();

  update(deltaTime: number): void {
    // 1. Process events from previous frame
    this.eventBus.processEvents();

    // 2. Update systems (may emit new events)
    for (const system of this.systems) {
      system.update(this, deltaTime);
    }

    // 3. Process events generated during system updates
    this.eventBus.processEvents();
  }
}
```

**Behavior:**
- Processes events in the order they were emitted
- Clears the event queue after processing
- Catches and logs listener errors without stopping processing
- Safe to call multiple times (no-op if queue is empty)

**Error Handling:**
- Individual listener errors are caught and logged
- Failed listeners don't prevent other listeners from executing
- Event processing continues even if some listeners fail

## Event Subscription

### subscribe(eventType, listener)

Subscribes to events of a specific type.

```typescript
subscribe(eventType: string, listener: (event: GameEvent) => void): () => void
```

**Parameters:**
- `eventType: string` - Type of events to listen for
- `listener: Function` - Callback function for event handling

**Returns:** `() => void` - Unsubscribe function

**Example:**
```typescript
// Basic subscription
const unsubscribe = eventBus.subscribe('player-died', (event) => {
  console.log('Player death event received:', event.data);
});

// Multiple listeners for same event
eventBus.subscribe('player-died', (event) => {
  // Update UI
  updateHealthDisplay(event.data.playerId);
});

eventBus.subscribe('player-died', (event) => {
  // Play sound effect
  playSound('death.wav');
});

eventBus.subscribe('player-died', (event) => {
  // Save statistics
  savePlayerStats(event.data.playerId, event.data.stats);
});

// Later, unsubscribe
unsubscribe();
```

**Subscription Management:**
- Multiple listeners can subscribe to the same event type
- Listeners are called in the order they were registered
- Unsubscribe functions are safe to call multiple times
- Removing a listener doesn't affect other listeners

### Unsubscribing

```typescript
// Store unsubscribe function
const unsubscribe = eventBus.subscribe('game-over', (event) => {
  console.log('Game over!');
});

// Unsubscribe when no longer needed
unsubscribe();

// Safe to call multiple times
unsubscribe(); // No error, no effect
```

## Utility Methods

### hasQueuedEvents()

Checks if there are events waiting to be processed.

```typescript
hasQueuedEvents(): boolean
```

**Returns:** `boolean` - True if events are queued

**Example:**
```typescript
// Check before processing
if (eventBus.hasQueuedEvents()) {
  console.log('Processing queued events...');
  eventBus.processEvents();
} else {
  console.log('No events to process');
}

// Useful for debugging
function debugEventQueue(eventBus: EventBus): void {
  if (eventBus.hasQueuedEvents()) {
    console.log('Warning: Events remain in queue');
  }
}
```

### clearQueue()

Removes all queued events without processing them.

```typescript
clearQueue(): void
```

**Example:**
```typescript
// Emergency cleanup
eventBus.clearQueue();

// Reset state
function resetGame(): void {
  eventBus.clearQueue(); // Discard any pending events
  // Reset other game state...
}

// Testing utility
function setupCleanTest(): void {
  eventBus.clearQueue(); // Ensure clean test environment
}
```

**Use Cases:**
- Game state reset
- Emergency cleanup
- Testing setup
- Preventing unwanted event processing

### getListenerCount(eventType)

Returns the number of listeners for a specific event type.

```typescript
getListenerCount(eventType: string): number
```

**Parameters:**
- `eventType: string` - Event type to count listeners for

**Returns:** `number` - Number of active listeners

**Example:**
```typescript
// Check listener count
const deathListeners = eventBus.getListenerCount('player-died');
console.log(`${deathListeners} listeners for player death`);

// Conditional behavior based on listeners
if (eventBus.getListenerCount('debug-info') > 0) {
  // Only collect debug info if someone is listening
  const debugData = collectDebugInformation();
  eventBus.emit({
    type: 'debug-info',
    timestamp: Date.now(),
    data: debugData
  });
}

// Monitoring system health
function monitorEventSystem(eventBus: EventBus): void {
  const eventTypes = ['player-died', 'level-complete', 'enemy-spawned'];

  eventTypes.forEach(type => {
    const count = eventBus.getListenerCount(type);
    if (count === 0) {
      console.warn(`No listeners for critical event: ${type}`);
    }
  });
}
```

## Event Patterns

### System Communication

```typescript
class HealthSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'HealthSystem';

  update(world: World): void {
    world.query<HealthComponent>('health').forEach((entityId, health) => {
      if (health.current <= 0) {
        // Emit death event for other systems to handle
        world.emitEvent({
          type: 'entity-died',
          timestamp: Date.now(),
          source: this.name,
          data: {
            entityId,
            entityType: this.getEntityType(world, entityId),
            position: world.getComponent(entityId, 'position')
          }
        });
      }
    });
  }

  private getEntityType(world: World, entityId: number): string {
    if (world.hasComponent(entityId, 'player')) return 'player';
    if (world.hasComponent(entityId, 'enemy')) return 'enemy';
    return 'unknown';
  }
}

class ScoreSystem extends BaseSystem {
  readonly priority = 10;
  readonly name = 'ScoreSystem';

  initialize(world: World): void {
    // Listen for death events to award points
    world.subscribeToEvent('entity-died', (event) => {
      if (event.data.entityType === 'enemy') {
        this.awardPoints(world, 100);
      }
    });
  }

  private awardPoints(world: World, points: number): void {
    // Award points logic
  }
}
```

### Game State Management

```typescript
class GameStateSystem extends BaseSystem {
  private gameState: 'playing' | 'paused' | 'game-over' = 'playing';

  initialize(world: World): void {
    // Listen for state change events
    world.subscribeToEvent('player-died', () => {
      this.setGameState(world, 'game-over');
    });

    world.subscribeToEvent('level-complete', () => {
      this.setGameState(world, 'paused');
    });

    world.subscribeToEvent('game-restart', () => {
      this.setGameState(world, 'playing');
    });
  }

  private setGameState(world: World, newState: typeof this.gameState): void {
    const oldState = this.gameState;
    this.gameState = newState;

    // Emit state change event
    world.emitEvent({
      type: 'game-state-changed',
      timestamp: Date.now(),
      source: this.name,
      data: {
        oldState,
        newState,
        timestamp: Date.now()
      }
    });
  }

  update(world: World): void {
    // Only update if game is playing
    if (this.gameState !== 'playing') {
      return;
    }

    // Game logic here
  }
}
```

### UI Updates

```typescript
class UISystem extends BaseSystem {
  readonly priority = 100; // Update UI last
  readonly name = 'UISystem';

  private scoreElement?: HTMLElement;
  private healthElement?: HTMLElement;

  initialize(world: World): void {
    this.scoreElement = document.getElementById('score');
    this.healthElement = document.getElementById('health');

    // Subscribe to events that affect UI
    world.subscribeToEvent('score-changed', (event) => {
      this.updateScore(event.data.newScore);
    });

    world.subscribeToEvent('health-changed', (event) => {
      this.updateHealth(event.data.current, event.data.maximum);
    });

    world.subscribeToEvent('game-state-changed', (event) => {
      this.updateGameState(event.data.newState);
    });
  }

  private updateScore(score: number): void {
    if (this.scoreElement) {
      this.scoreElement.textContent = `Score: ${score}`;
    }
  }

  private updateHealth(current: number, maximum: number): void {
    if (this.healthElement) {
      this.healthElement.textContent = `Health: ${current}/${maximum}`;
      this.healthElement.style.color = current < maximum * 0.3 ? 'red' : 'white';
    }
  }

  private updateGameState(state: string): void {
    document.body.className = `game-state-${state}`;
  }
}
```

### Event Chaining

```typescript
class WeaponSystem extends BaseSystem {
  initialize(world: World): void {
    // Chain events: collision → damage → death → explosion
    world.subscribeToEvent('projectile-collision', (event) => {
      this.handleProjectileCollision(world, event);
    });
  }

  private handleProjectileCollision(world: World, event: GameEvent): void {
    const { projectileId, targetId, damage } = event.data;

    // Apply damage
    const health = world.getComponent<HealthComponent>(targetId, 'health');
    if (health) {
      health.current -= damage;

      // Emit damage event
      world.emitEvent({
        type: 'damage-dealt',
        timestamp: Date.now(),
        source: this.name,
        data: {
          targetId,
          damage,
          newHealth: health.current,
          damageSource: 'projectile'
        }
      });

      // Check for death
      if (health.current <= 0) {
        world.emitEvent({
          type: 'entity-died',
          timestamp: Date.now(),
          source: this.name,
          data: {
            entityId: targetId,
            cause: 'projectile-damage',
            explosionRadius: 50
          }
        });
      }
    }
  }
}

class EffectsSystem extends BaseSystem {
  initialize(world: World): void {
    world.subscribeToEvent('entity-died', (event) => {
      if (event.data.explosionRadius) {
        this.createExplosion(world, event);
      }
    });
  }

  private createExplosion(world: World, event: GameEvent): void {
    // Create explosion effect
    const explosionEntity = world.createEntity();
    // Add explosion components...

    // Emit explosion event for other systems
    world.emitEvent({
      type: 'explosion-created',
      timestamp: Date.now(),
      source: this.name,
      data: {
        explosionId: explosionEntity,
        radius: event.data.explosionRadius,
        position: event.data.position
      }
    });
  }
}
```

## Performance Optimization

### Event Batching

```typescript
class BatchedEventSystem extends BaseSystem {
  private eventBatch: GameEvent[] = [];
  private batchSize = 10;

  update(world: World): void {
    // Collect events into batches
    this.collectEvents(world);

    // Process when batch is full
    if (this.eventBatch.length >= this.batchSize) {
      this.processBatch(world);
    }
  }

  private processBatch(world: World): void {
    // Emit batch event
    world.emitEvent({
      type: 'event-batch',
      timestamp: Date.now(),
      source: this.name,
      data: {
        events: this.eventBatch,
        batchSize: this.eventBatch.length
      }
    });

    this.eventBatch.length = 0;
  }
}
```

### Conditional Event Processing

```typescript
class OptimizedEventSystem extends BaseSystem {
  update(world: World): void {
    // Only emit expensive events if someone is listening
    if (world.getEventBus().getListenerCount('detailed-stats') > 0) {
      const stats = this.calculateDetailedStats(world);
      world.emitEvent({
        type: 'detailed-stats',
        timestamp: Date.now(),
        data: stats
      });
    }

    // Always emit critical events
    if (this.criticalConditionMet(world)) {
      world.emitEvent({
        type: 'critical-alert',
        timestamp: Date.now(),
        data: { level: 'high' }
      });
    }
  }

  private calculateDetailedStats(world: World): any {
    // Expensive calculation only done if needed
    return {};
  }

  private criticalConditionMet(world: World): boolean {
    return false;
  }
}
```

## Error Handling

The EventBus handles errors gracefully:

```typescript
// Listeners that throw errors don't affect other listeners
eventBus.subscribe('test-event', (event) => {
  throw new Error('First listener failed!');
});

eventBus.subscribe('test-event', (event) => {
  console.log('Second listener still executes');
});

eventBus.emit({
  type: 'test-event',
  timestamp: Date.now(),
  data: {}
});

eventBus.processEvents();
// Output: Error logged, then "Second listener still executes"
```

## Debugging Events

### Event Monitoring

```typescript
class EventMonitor {
  private eventCounts = new Map<string, number>();

  constructor(private eventBus: EventBus) {
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    // Monitor all events by subscribing to common types
    const eventTypes = [
      'entity-died', 'level-complete', 'collision-detected',
      'damage-dealt', 'item-collected', 'player-moved'
    ];

    eventTypes.forEach(type => {
      this.eventBus.subscribe(type, (event) => {
        this.eventCounts.set(type, (this.eventCounts.get(type) || 0) + 1);
      });
    });
  }

  getEventStats(): Map<string, number> {
    return new Map(this.eventCounts);
  }

  logStats(): void {
    console.log('Event Statistics:');
    for (const [type, count] of this.eventCounts) {
      console.log(`  ${type}: ${count} events`);
    }
  }
}
```

### Event Tracing

```typescript
class EventTracer {
  private eventHistory: GameEvent[] = [];
  private maxHistory = 100;

  constructor(eventBus: EventBus) {
    // Intercept all events by wrapping emit
    const originalEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = (event: GameEvent) => {
      this.recordEvent(event);
      originalEmit(event);
    };
  }

  private recordEvent(event: GameEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
  }

  getRecentEvents(eventType?: string): GameEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  getEventTimeline(): string {
    return this.eventHistory
      .map(e => `${e.timestamp}: ${e.type}`)
      .join('\n');
  }
}
```

## See Also

- **[Event Component](./event-component.md)** - Component-based event emission
- **[Game Event Types](./game-event.md)** - Built-in event types and custom events
- **[World API](../core/world.md)** - Event system integration with World
- **[System Communication](../../guides/events-and-communication.md)** - Best practices for system communication
- **[Event-Driven Architecture](../../advanced/architecture-deep-dive.md)** - Understanding event-driven design