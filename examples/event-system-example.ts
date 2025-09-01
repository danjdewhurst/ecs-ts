import {
    BaseSystem,
    type Component,
    EventComponent,
    type GameEvent,
    World,
} from '../src/index.ts';

// Example components
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

// Example system that listens to and emits events
class CombatSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'CombatSystem';

    private unsubscribeFromDamage?: () => void;

    constructor(world: World) {
        super();
        // Subscribe to damage events
        this.unsubscribeFromDamage = world.subscribeToEvent(
            'damage',
            (event) => {
                this.handleDamageEvent(event, world);
            }
        );
    }

    update(_world: World, _deltaTime: number): void {
        // This system doesn't run continuously, it only responds to events
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

// System that handles entity death events
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
        // This system only responds to death events
    }

    private handleDeathEvent(event: GameEvent, world: World): void {
        const { entityId } = event.data;

        if (typeof entityId === 'number') {
            console.log(`💀 Entity ${entityId} has died and will be destroyed`);

            // Emit a death effect event before destroying
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

// System that creates visual effects based on events
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
    }

    destroy(): void {
        this.unsubscribeFromEffects?.();
    }
}

// Main example function
function runEventSystemExample(): void {
    console.log('🎮 ECS Event System Example\n');

    const world = new World();

    // Add systems that use events
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

    // Add EventComponents to demonstrate component-based events
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

    // Process first round of combat
    console.log('--- Round 1 ---');
    world.update(16.67);

    console.log('\\n--- Round 2 ---');
    // More damage to the warrior
    world.emitEvent({
        type: 'damage',
        timestamp: Date.now(),
        source: 'monster',
        data: { entityId: warrior, damage: 40 },
    });

    world.update(16.67);

    console.log('\\n--- Round 3 ---');
    // Finish off the mage
    world.emitEvent({
        type: 'damage',
        timestamp: Date.now(),
        source: 'warrior',
        data: { entityId: mage, damage: 30 },
    });

    world.update(16.67);

    console.log('\\n--- Round 4 ---');
    // Queue an event through the EventComponent
    warriorEvents.queueEvent('victory', {
        message: 'Warrior celebrates victory!',
        experienceGained: 100,
    });

    // Subscribe to victory events to demonstrate component events
    world.subscribeToEvent('victory', (event) => {
        console.log(
            `🎉 Victory Event: ${event.data.message} (XP: ${event.data.experienceGained})`
        );
        console.log(`   Event source: ${event.source}`);
    });

    world.update(16.67);

    console.log('\\n📊 Final Statistics:');
    console.log(`Entities remaining: ${world.getEntityCount()}`);
    console.log(
        `Event listeners: ${world.getEventBus().getListenerCount('damage')} damage listeners`
    );

    // Clean up
    combatSystem.destroy();
    deathSystem.destroy();
    effectSystem.destroy();

    console.log('\\n✅ Event system example completed!');
}

// Run the example
runEventSystemExample();
