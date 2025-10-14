/**
 * System Dependencies Example
 *
 * Demonstrates how to use the SystemScheduler's dependency management
 * to ensure systems execute in the correct order.
 *
 * Run: bun examples/system-dependencies-example.ts
 */

import { BaseSystem, type Component, World } from '../src/index.ts';

// Components
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

interface CollisionComponent extends Component {
    readonly type: 'collision';
    radius: number;
    colliding: boolean;
}

interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

// Systems with dependencies

/**
 * PhysicsSystem - Updates positions based on velocity
 * Runs first (no dependencies)
 */
class PhysicsSystem extends BaseSystem {
    override readonly name = 'PhysicsSystem';
    override readonly priority = 1;

    override update(world: World, deltaTime: number): void {
        const entities = world.queryMultiple(['position', 'velocity']);

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
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;
            }
        }

        console.log(`  [PhysicsSystem] Updated ${entities.length} entities`);
    }
}

/**
 * CollisionSystem - Detects collisions between entities
 * Depends on PhysicsSystem (positions must be updated first)
 */
class CollisionSystem extends BaseSystem {
    override readonly name = 'CollisionSystem';
    override readonly priority = 10; // Higher priority, but runs AFTER physics due to dependency
    override readonly dependencies = ['PhysicsSystem'];

    override update(world: World, _deltaTime: number): void {
        const entities = world.queryMultiple(['position', 'collision']);

        // Simple collision detection (distance-based)
        let collisionCount = 0;
        for (let i = 0; i < entities.length; i++) {
            const entityA = entities[i];
            if (!entityA) continue;

            const posA = world.getComponent<PositionComponent>(
                entityA,
                'position'
            );
            const colA = world.getComponent<CollisionComponent>(
                entityA,
                'collision'
            );

            if (!posA || !colA) continue;

            colA.colliding = false; // Reset

            for (let j = i + 1; j < entities.length; j++) {
                const entityB = entities[j];
                if (!entityB) continue;

                const posB = world.getComponent<PositionComponent>(
                    entityB,
                    'position'
                );
                const colB = world.getComponent<CollisionComponent>(
                    entityB,
                    'collision'
                );

                if (!posB || !colB) continue;

                const dx = posA.x - posB.x;
                const dy = posA.y - posB.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = colA.radius + colB.radius;

                if (distance < minDistance) {
                    colA.colliding = true;
                    colB.colliding = true;
                    collisionCount++;
                }
            }
        }

        console.log(
            `  [CollisionSystem] Detected ${collisionCount} collisions among ${entities.length} entities`
        );
    }
}

/**
 * DamageSystem - Applies damage when entities collide
 * Depends on CollisionSystem (collisions must be detected first)
 */
class DamageSystem extends BaseSystem {
    override readonly name = 'DamageSystem';
    override readonly priority = 1; // Highest priority, but runs LAST due to dependencies
    override readonly dependencies = ['CollisionSystem'];

    override update(world: World, _deltaTime: number): void {
        const entities = world.queryMultiple(['collision', 'health']);

        let damageApplied = 0;
        for (const entityId of entities) {
            const collision = world.getComponent<CollisionComponent>(
                entityId,
                'collision'
            );
            const health = world.getComponent<HealthComponent>(
                entityId,
                'health'
            );

            if (collision?.colliding && health) {
                health.hp = Math.max(0, health.hp - 10);
                damageApplied++;
            }
        }

        console.log(
            `  [DamageSystem] Applied damage to ${damageApplied} entities`
        );
    }
}

/**
 * RenderSystem - Renders entities (runs after all game logic)
 * Depends on DamageSystem to ensure all game state is final
 */
class RenderSystem extends BaseSystem {
    override readonly name = 'RenderSystem';
    override readonly priority = 100;
    override readonly dependencies = ['DamageSystem'];

    override update(world: World, _deltaTime: number): void {
        const entities = world.queryMultiple(['position']);
        console.log(`  [RenderSystem] Rendered ${entities.length} entities`);
    }
}

// Main example
console.log('=== System Dependencies Example ===\n');

const world = new World();

// Create some entities
console.log('Creating entities...');
const entity1 = world.createEntity();
world.addComponent<PositionComponent>(entity1, {
    type: 'position',
    x: 0,
    y: 0,
});
world.addComponent<VelocityComponent>(entity1, {
    type: 'velocity',
    dx: 10,
    dy: 5,
});
world.addComponent<CollisionComponent>(entity1, {
    type: 'collision',
    radius: 5,
    colliding: false,
});
world.addComponent<HealthComponent>(entity1, {
    type: 'health',
    hp: 100,
    maxHp: 100,
});

const entity2 = world.createEntity();
world.addComponent<PositionComponent>(entity2, {
    type: 'position',
    x: 15,
    y: 8,
});
world.addComponent<VelocityComponent>(entity2, {
    type: 'velocity',
    dx: -5,
    dy: -3,
});
world.addComponent<CollisionComponent>(entity2, {
    type: 'collision',
    radius: 5,
    colliding: false,
});
world.addComponent<HealthComponent>(entity2, {
    type: 'health',
    hp: 100,
    maxHp: 100,
});

console.log(`Created ${world.getEntityCount()} entities\n`);

// Add systems - dependencies determine execution order, not add order
console.log('Adding systems...');
console.log('  - PhysicsSystem (no dependencies, priority 1)');
console.log('  - CollisionSystem (depends on PhysicsSystem, priority 10)');
console.log('  - DamageSystem (depends on CollisionSystem, priority 1)');
console.log('  - RenderSystem (depends on DamageSystem, priority 100)');

// Note: Execution order is determined by dependencies, not by add order or priority alone
world.addSystem(new PhysicsSystem());
world.addSystem(new CollisionSystem());
world.addSystem(new DamageSystem());
world.addSystem(new RenderSystem());

console.log('\nActual execution order (based on dependencies):');
const executionOrder = world.getSystemExecutionOrder();
for (const [index, system] of executionOrder.entries()) {
    const deps =
        system.dependencies && system.dependencies.length > 0
            ? ` (depends on: ${system.dependencies.join(', ')})`
            : '';
    console.log(
        `  ${index + 1}. ${system.name} (priority: ${system.priority})${deps}`
    );
}

// Show dependency graph
console.log('\nSystem Dependency Graph:');
const graph = world.getSystemDependencyGraph();
for (const system of graph.systems) {
    const deps =
        system.dependencies.length > 0
            ? `depends on: [${system.dependencies.join(', ')}]`
            : 'no dependencies';
    const dependents =
        system.dependents.length > 0
            ? `, required by: [${system.dependents.join(', ')}]`
            : '';
    console.log(`  ${system.name}: ${deps}${dependents}`);
}

// Run simulation
console.log('\n=== Running Simulation ===\n');

for (let frame = 1; frame <= 3; frame++) {
    console.log(`Frame ${frame}:`);
    world.update(0.016); // 16ms per frame

    // Show entity states
    const pos1 = world.getComponent<PositionComponent>(entity1, 'position');
    const health1 = world.getComponent<HealthComponent>(entity1, 'health');
    const pos2 = world.getComponent<PositionComponent>(entity2, 'position');
    const health2 = world.getComponent<HealthComponent>(entity2, 'health');

    console.log(
        `  Entity 1: pos=(${pos1?.x.toFixed(1)}, ${pos1?.y.toFixed(1)}), hp=${health1?.hp}`
    );
    console.log(
        `  Entity 2: pos=(${pos2?.x.toFixed(1)}, ${pos2?.y.toFixed(1)}), hp=${health2?.hp}\n`
    );
}

// Demonstrate validation
console.log('=== Dependency Validation ===\n');

class InvalidSystem extends BaseSystem {
    override readonly name = 'InvalidSystem';
    override readonly priority = 1;
    override readonly dependencies = ['NonExistentSystem']; // Invalid dependency!

    override update(_world: World, _deltaTime: number): void {
        // Won't run
    }
}

const validation = world.validateSystemDependencies([new InvalidSystem()]);
console.log('Validating system with missing dependency:');
console.log(`  Valid: ${validation.valid}`);
console.log(`  Error: ${validation.error}\n`);

console.log('=== Example Complete ===');
console.log(
    '\nKey Takeaways:',
    '\n  1. Systems execute in dependency order, not add order or priority',
    '\n  2. Priority only matters within the same dependency level',
    '\n  3. Dependencies ensure correctness (physics before collision before damage)',
    '\n  4. Validation helps catch configuration errors early'
);
