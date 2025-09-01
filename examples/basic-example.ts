import { BaseSystem, type Component, World } from '../src/index.ts';

// Define some example components
interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface VelocityComponent extends Component {
    readonly type: 'velocity';
    dx: number;
    dy: number;
}

interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

// Define a simple movement system
class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';

    update(world: World, deltaTime: number): void {
        // Query entities that have both position and velocity components
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            const velocity = world.getComponent<VelocityComponent>(
                entityId,
                'velocity'
            );

            if (position && velocity) {
                // Update position based on velocity
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;

                console.log(
                    `Entity ${entityId} moved to (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`
                );
            }
        }
    }
}

// Define a health regeneration system
class HealthRegenSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'HealthRegenSystem';

    update(world: World, deltaTime: number): void {
        this.queryWithComponents<HealthComponent>(
            world,
            'health',
            (entityId, health) => {
                if (health.hp < health.maxHp) {
                    health.hp = Math.min(
                        health.maxHp,
                        health.hp + 10 * deltaTime
                    ); // Regen 10 HP per second
                    console.log(
                        `Entity ${entityId} regenerated health: ${health.hp}/${health.maxHp}`
                    );
                }
            }
        );
    }
}

// Example usage
function runExample() {
    console.log('🎮 ECS Game Engine Example Starting...\n');

    // Create a world
    const world = new World();

    // Add systems
    world.addSystem(new MovementSystem());
    world.addSystem(new HealthRegenSystem());

    // Create some entities
    const player = world.createEntity();
    const enemy = world.createEntity();
    const npc = world.createEntity();

    // Add components to entities
    world.addComponent(player, {
        type: 'position',
        x: 0,
        y: 0,
    } as PositionComponent);

    world.addComponent(player, {
        type: 'velocity',
        dx: 1,
        dy: 0.5,
    } as VelocityComponent);

    world.addComponent(player, {
        type: 'health',
        hp: 80,
        maxHp: 100,
    } as HealthComponent);

    world.addComponent(enemy, {
        type: 'position',
        x: 10,
        y: 5,
    } as PositionComponent);

    world.addComponent(enemy, {
        type: 'velocity',
        dx: -0.5,
        dy: 1,
    } as VelocityComponent);

    // NPC has only health (no movement)
    world.addComponent(npc, {
        type: 'health',
        hp: 50,
        maxHp: 100,
    } as HealthComponent);

    console.log(`Created ${world.getEntityCount()} entities`);
    console.log('Component types:', world.getComponentTypes());
    console.log('Archetype stats:', world.getArchetypeStats());
    console.log('');

    // Simulate some game loops
    const deltaTime = 1.0; // 1 second per update

    for (let i = 0; i < 3; i++) {
        console.log(`--- Update ${i + 1} ---`);
        world.update(deltaTime);
        console.log('');
    }

    // Query example
    console.log('--- Query Examples ---');
    const movingEntities = world.queryMultiple(['position', 'velocity']);
    console.log(
        `Entities with position and velocity: [${movingEntities.join(', ')}]`
    );

    const healthQuery = world.query<HealthComponent>('health');
    console.log(
        `Entities with health component: [${healthQuery.getEntities().join(', ')}]`
    );

    console.log('\n🎯 Example completed successfully!');
}

// Run the example if this file is executed directly
if (import.meta.main) {
    runExample();
}
