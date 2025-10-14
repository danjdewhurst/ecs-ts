# EventComponent

The `EventComponent` is a specialized component that provides event queuing capabilities for entities. It allows entities to queue events locally before they are processed and emitted through the global event system.

## Quick Example

```typescript
import { World } from '@danjdewhurst/ecs-ts';
import { EventComponent } from '@danjdewhurst/ecs-ts';

const world = new World();
const entity = world.createEntity();

// Add event component to entity
const eventComponent = new EventComponent();
world.addComponent(entity, eventComponent);

// Queue events on the component
eventComponent.queueEvent('player-moved', { x: 10, y: 20 });
eventComponent.queueEvent('item-collected', { itemId: 42 });

// Events are automatically flushed during world.update()
world.update(16.67);
```

## API Reference

### Constructor

```typescript
new EventComponent()
```

Creates a new EventComponent instance with an empty event queue.

### queueEvent

```typescript
queueEvent(type: string, data: Record<string, unknown>): void
```

Queues an event to be processed during the next world update cycle.

#### Parameters
- `type: string` - The event type identifier
- `data: Record<string, unknown>` - Event payload data

#### Example
```typescript
eventComponent.queueEvent('player-action', {
  action: 'jump',
  force: 150,
  timestamp: Date.now()
});
```

### flushEvents

```typescript
flushEvents(): GameEvent[]
```

Retrieves and clears all pending events from the queue. This method is automatically called by the World during the update cycle.

#### Returns
`GameEvent[]` - Array of pending events with automatically added timestamp and source information

#### Example
```typescript
const events = eventComponent.flushEvents();
console.log(`Flushed ${events.length} events`);
```

### hasPendingEvents

```typescript
hasPendingEvents(): boolean
```

Checks if there are any events waiting to be processed.

#### Returns
`boolean` - True if events are queued, false otherwise

#### Example
```typescript
if (eventComponent.hasPendingEvents()) {
  console.log('Entity has pending events');
}
```

### getPendingEventCount

```typescript
getPendingEventCount(): number
```

Returns the number of events currently queued.

#### Returns
`number` - Count of pending events

#### Example
```typescript
const count = eventComponent.getPendingEventCount();
console.log(`${count} events pending`);
```

## Usage Patterns

### Entity State Broadcasting

Use EventComponent to broadcast entity state changes:

```typescript
class MovementSystem extends BaseSystem {
  update(world: World): void {
    const entities = world.getEntitiesWithComponent('position', 'velocity', 'event');

    for (const entity of entities) {
      const position = world.getComponent(entity, 'position');
      const velocity = world.getComponent(entity, 'velocity');
      const eventComp = world.getComponent(entity, 'event');

      // Update position
      position.x += velocity.x;
      position.y += velocity.y;

      // Broadcast movement event
      eventComp.queueEvent('entity-moved', {
        entityId: entity,
        newPosition: { x: position.x, y: position.y },
        velocity: { x: velocity.x, y: velocity.y }
      });
    }
  }
}
```

### Interaction Events

Queue events for entity interactions:

```typescript
class CollisionSystem extends BaseSystem {
  update(world: World): void {
    // Detect collisions...

    for (const collision of detectedCollisions) {
      const eventComp1 = world.getComponent(collision.entity1, 'event');
      const eventComp2 = world.getComponent(collision.entity2, 'event');

      // Both entities emit collision events
      eventComp1?.queueEvent('collision-detected', {
        other: collision.entity2,
        point: collision.point,
        normal: collision.normal
      });

      eventComp2?.queueEvent('collision-detected', {
        other: collision.entity1,
        point: collision.point,
        normal: collision.normal.multiply(-1)
      });
    }
  }
}
```

## Event Processing Lifecycle

1. **Queue Phase**: Events are queued during system execution
2. **Flush Phase**: Events are flushed from components during `world.update()`
3. **Process Phase**: Events are processed through the EventBus
4. **Delivery Phase**: Event listeners receive events

## Performance Notes

- EventComponent uses an internal array for efficient event queuing
- Events are flushed in batch for optimal performance
- The component automatically clears the queue after flushing
- Queuing events has minimal overhead - O(1) operation

## Integration with World

The EventComponent integrates seamlessly with the World's event system:

- Events queued in EventComponents are automatically flushed during `world.update()`
- Flushed events include automatic source attribution (`entity:${entityId}`)
- Events flow through the global EventBus for system-wide handling

## See Also

- [EventBus](./event-bus.md) - Global event publishing and subscription
- [GameEvent](./game-event.md) - Event data structure definition
- [World](../core/world.md) - World event methods