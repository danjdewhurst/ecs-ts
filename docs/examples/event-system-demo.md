# Event System Demo

This example demonstrates the power of event-driven architecture in the ECS game engine. It shows how systems can communicate through events without tight coupling, creating a flexible and maintainable codebase.

## Overview

The event system demo simulates a combat scenario where:
- Players and enemies have health
- Damage events trigger health reduction
- Death events trigger cleanup and effects
- All communication happens through events

## Code Example

```typescript
import {
    BaseSystem,
    type Component,
    EventComponent,
    type GameEvent,
    World,
} from '@danjdewhurst/ecs-ts';

// Component Definitions
interface Position extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface Health extends Component {
    readonly type: 'health';
    current: number;
    maximum: number;
}

// Event-Driven Combat System
class CombatSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'CombatSystem';

    private unsubscribeFromDamage?: () => void;

    constructor(world: World) {
        super();
        // Subscribe to damage events in constructor
        this.unsubscribeFromDamage = world.subscribeToEvent(
            'damage',
            (event) => {
                this.handleDamageEvent(event, world);
            }
        );
    }

    update(_world: World, _deltaTime: number): void {
        // This system responds to events rather than running continuously
        // In a real game, you might have other combat logic here
    }

    private handleDamageEvent(event: GameEvent, world: World): void {
        const { entityId, damage } = event.data;

        if (typeof entityId === 'number' && typeof damage === 'number') {
            const health = world.getComponent<Health>(entityId, 'health');
            if (health) {
                health.current = Math.max(0, health.current - damage);

                console.log(
                    `Entity ${entityId} took ${damage} damage, health: ${health.current}/${health.maximum}`
                );

                // Emit death event if health reaches 0
                if (health.current <= 0) {
                    world.emitEvent({
                        type: 'entity-death',
                        timestamp: Date.now(),
                        source: 'CombatSystem',
                        data: { entityId },
                    });
                }
            }
        }
    }

    destroy(): void {
        // Clean up event subscriptions
        this.unsubscribeFromDamage?.();
    }
}

// Death Handling System
class DeathSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'DeathSystem';

    private unsubscribeFromDeath?: () => void;

    constructor(world: World) {
        super();
        this.unsubscribeFromDeath = world.subscribeToEvent(
            'entity-death',
            (event) => {
                this.handleDeathEvent(event, world);
            }
        );
    }

    update(_world: World, _deltaTime: number): void {
        // Event-driven system
    }

    private handleDeathEvent(event: GameEvent, world: World): void {
        const { entityId } = event.data;

        if (typeof entityId === 'number') {
            console.log(`💀 Entity ${entityId} has died and will be destroyed`);

            // Emit death effect event before destroying
            world.emitEvent({
                type: 'death-effect',
                timestamp: Date.now(),
                source: 'DeathSystem',
                data: {
                    entityId,
                    effectType: 'explosion',
                    position: world.getComponent<Position>(
                        entityId,
                        'position'
                    ),
                },
            });

            // Destroy the entity
            world.destroyEntity(entityId);
        }
    }

    destroy(): void {
        this.unsubscribeFromDeath?.();
    }
}

// Visual Effects System
class EffectSystem extends BaseSystem {
    readonly priority = 3;
    readonly name = 'EffectSystem';

    private unsubscribeFromEffects?: () => void;

    constructor(world: World) {
        super();
        this.unsubscribeFromEffects = world.subscribeToEvent(
            'death-effect',
            (event) => {
                this.handleEffectEvent(event, world);
            }
        );
    }

    update(_world: World, _deltaTime: number): void {
        // Handle ongoing visual effects here
    }

    private handleEffectEvent(event: GameEvent, _world: World): void {
        const { entityId, effectType, position } = event.data;
        const pos = position as Position | undefined;

        console.log(
            `✨ Creating ${effectType} effect at position (${pos?.x ?? 0}, ${pos?.y ?? 0}) for entity ${entityId}`
        );

        // In a real game, this would create particle effects, play sounds, etc.
    }

    destroy(): void {
        this.unsubscribeFromEffects?.();
    }
}
```

## Running the Demo

```typescript
function runEventSystemExample(): void {
    console.log('🎮 ECS Event System Example\n');

    const world = new World();

    // Add event-driven systems
    const combatSystem = new CombatSystem(world);
    const deathSystem = new DeathSystem(world);
    const effectSystem = new EffectSystem(world);

    world.addSystem(combatSystem);
    world.addSystem(deathSystem);
    world.addSystem(effectSystem);

    // Create entities
    console.log('📝 Creating entities...\n');

    const warrior = world.createEntity();
    world.addComponent<Position>(warrior, { type: 'position', x: 100, y: 50 });
    world.addComponent<Health>(warrior, {
        type: 'health',
        current: 100,
        maximum: 100,
    });

    const mage = world.createEntity();
    world.addComponent<Position>(mage, { type: 'position', x: 200, y: 75 });
    world.addComponent<Health>(mage, {
        type: 'health',
        current: 50,
        maximum: 50,
    });

    // Demonstrate component-based events
    const warriorEvents = new EventComponent();
    world.addComponent(warrior, warriorEvents);

    console.log('⚔️  Combat simulation starting...\n');

    // Simulate combat by emitting damage events
    world.emitEvent({
        type: 'damage',
        timestamp: Date.now(),
        source: 'player',
        data: { entityId: warrior, damage: 30 },
    });

    world.emitEvent({
        type: 'damage',
        timestamp: Date.now(),
        source: 'monster',
        data: { entityId: mage, damage: 25 },
    });

    // Process combat round
    console.log('--- Round 1 ---');
    world.update(16.67);

    // Continue combat
    console.log('\n--- Round 2 ---');
    world.emitEvent({
        type: 'damage',
        timestamp: Date.now(),
        source: 'monster',
        data: { entityId: warrior, damage: 40 },
    });

    world.update(16.67);

    // Finish off the mage
    console.log('\n--- Round 3 ---');
    world.emitEvent({
        type: 'damage',
        timestamp: Date.now(),
        source: 'warrior',
        data: { entityId: mage, damage: 30 },
    });

    world.update(16.67);

    // Demonstrate EventComponent usage
    console.log('\n--- Victory ---');
    warriorEvents.queueEvent('victory', {
        message: 'Warrior celebrates victory!',
        experienceGained: 100,
    });

    // Subscribe to victory events
    world.subscribeToEvent('victory', (event) => {
        console.log(
            `🎉 Victory Event: ${event.data.message} (XP: ${event.data.experienceGained})`
        );
        console.log(`   Event source: ${event.source}`);
    });

    world.update(16.67);

    console.log('\n📊 Final Statistics:');
    console.log(`Entities remaining: ${world.getEntityCount()}`);
    console.log(
        `Event listeners: ${world.getEventBus().getListenerCount('damage')} damage listeners`
    );

    // Clean up
    combatSystem.destroy();
    deathSystem.destroy();
    effectSystem.destroy();

    console.log('\n✅ Event system example completed!');
}

// Run the example
runEventSystemExample();
```

## Key Concepts Demonstrated

### 1. Event-Driven System Communication

Instead of systems directly calling each other, they communicate through events:

```typescript
// ❌ Bad: Direct coupling
class BadCombatSystem {
    constructor(private deathSystem: DeathSystem) {}

    handleDamage(entity: number, damage: number) {
        // Apply damage...
        if (health <= 0) {
            this.deathSystem.handleDeath(entity); // Direct coupling
        }
    }
}

// ✅ Good: Event-driven communication
class GoodCombatSystem {
    handleDamage(world: World, entity: number, damage: number) {
        // Apply damage...
        if (health <= 0) {
            world.emitEvent({
                type: 'entity-death',
                data: { entityId: entity }
            }); // Loose coupling through events
        }
    }
}
```

### 2. Event Chaining

Events can trigger other events, creating complex behavior chains:

```
Damage Event → Health Reduction → Death Event → Effect Event → Cleanup
```

### 3. Component-Based Events

The `EventComponent` allows entities to queue and emit their own events:

```typescript
const eventComponent = new EventComponent();
world.addComponent(entity, eventComponent);

// Queue events from entity
eventComponent.queueEvent('level-up', { newLevel: 5 });

// Events are processed during world update
world.update(deltaTime);
```

### 4. System Lifecycle Management

Proper cleanup of event subscriptions prevents memory leaks:

```typescript
class ProperSystem extends BaseSystem {
    private unsubscribeCallbacks: Array<() => void> = [];

    initialize(world: World): void {
        const unsubscribe = world.subscribeToEvent('some-event', handler);
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    shutdown(): void {
        // Clean up all subscriptions
        this.unsubscribeCallbacks.forEach(callback => callback());
        this.unsubscribeCallbacks = [];
    }
}
```

## Expected Output

When you run this example, you should see output like:

```
🎮 ECS Event System Example

📝 Creating entities...

⚔️  Combat simulation starting...

--- Round 1 ---
Entity 1 took 30 damage, health: 70/100
Entity 2 took 25 damage, health: 25/50

--- Round 2 ---
Entity 1 took 40 damage, health: 30/100

--- Round 3 ---
Entity 2 took 30 damage, health: 0/50
💀 Entity 2 has died and will be destroyed
✨ Creating explosion effect at position (200, 75) for entity 2

--- Victory ---
🎉 Victory Event: Warrior celebrates victory! (XP: 100)
   Event source: EventComponent

📊 Final Statistics:
Entities remaining: 1
Event listeners: 1 damage listeners

✅ Event system example completed!
```

## Benefits Demonstrated

1. **Loose Coupling**: Systems don't need direct references to each other
2. **Extensibility**: New systems can listen to existing events without modifying existing code
3. **Maintainability**: Clear separation of concerns and responsibilities
4. **Flexibility**: Easy to add, remove, or modify system behavior
5. **Testability**: Systems can be tested in isolation by emitting specific events

## Try It Yourself

Experiment with the event system by:

1. Adding new event types (healing, level-up, spell-cast)
2. Creating systems that respond to multiple event types
3. Implementing event filtering or priority systems
4. Adding conditional event handling based on game state

Run the example with:
```bash
bun examples/event-system-example.ts
```

## See Also

- [Events and Communication Guide](../guides/events-and-communication.md) - Comprehensive event patterns
- [Event Bus API](../api/events/event-bus.md) - Technical event system reference
- [Systems Guide](../guides/systems-and-scheduling.md) - System design patterns