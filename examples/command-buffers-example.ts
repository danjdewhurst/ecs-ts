/**
 * Command Buffer System Example
 *
 * Demonstrates the use of command buffers for deferred operations,
 * safe structural changes during system execution, and undo/replay functionality.
 */

import {
    AddComponentCommand,
    BaseSystem,
    type Component,
    CreateEntityCommand,
    DestroyEntityCommand,
    RemoveComponentCommand,
    World,
} from '../src';

// Component definitions
interface PositionComponent extends Component {
    type: 'position';
    x: number;
    y: number;
}

interface HealthComponent extends Component {
    type: 'health';
    value: number;
    maxValue: number;
}

interface DamageComponent extends Component {
    type: 'damage';
    amount: number;
    targetEntityId: number;
}

// System that uses command buffers to safely spawn entities during update
class SpawnerSystem extends BaseSystem {
    readonly name = 'SpawnerSystem';
    readonly priority = 1;

    private spawnTimer = 0;
    private readonly spawnInterval = 1.0; // Spawn every 1 second
    private spawnCount = 0;
    private readonly maxSpawns = 5;

    update(world: World, deltaTime: number): void {
        this.spawnTimer += deltaTime;

        if (
            this.spawnTimer >= this.spawnInterval &&
            this.spawnCount < this.maxSpawns
        ) {
            this.spawnTimer = 0;
            this.spawnCount++;

            // Use command buffer to defer entity creation until after systems run
            const buffer = world.getCommandBuffer();

            console.log(`[SpawnerSystem] Queuing spawn #${this.spawnCount}`);

            // Queue entity creation
            const createCmd = new CreateEntityCommand();
            buffer.enqueue(createCmd);

            // Note: We can't immediately use the entity ID here because
            // the command hasn't executed yet. This is a known limitation.
            // For complex spawning, consider using a two-phase approach.
        }
    }
}

// System that uses command buffers to safely apply damage
class DamageSystem extends BaseSystem {
    readonly name = 'DamageSystem';
    readonly priority = 2;

    update(world: World, _deltaTime: number): void {
        const buffer = world.getCommandBuffer();

        // Query all entities with damage components
        const damageEntities = world
            .query<DamageComponent>('damage')
            .getEntities();

        for (const entityId of damageEntities) {
            const damage = world.getComponent<DamageComponent>(
                entityId,
                'damage'
            );
            if (!damage) continue;

            const target = damage.targetEntityId;
            const health = world.getComponent<HealthComponent>(
                target,
                'health'
            );

            if (health) {
                console.log(
                    `[DamageSystem] Entity ${target} takes ${damage.amount} damage`
                );

                // Queue health component update
                const newHealth: HealthComponent = {
                    type: 'health',
                    value: Math.max(0, health.value - damage.amount),
                    maxValue: health.maxValue,
                };

                // Remove old health, add new health (component update pattern)
                buffer.enqueue(new RemoveComponentCommand(target, 'health'));
                buffer.enqueue(new AddComponentCommand(target, newHealth));

                // If health reaches zero, queue entity destruction
                if (newHealth.value <= 0) {
                    console.log(`[DamageSystem] Entity ${target} destroyed`);
                    buffer.enqueue(new DestroyEntityCommand(target));
                }
            }

            // Remove the damage component after processing
            buffer.enqueue(new RemoveComponentCommand(entityId, 'damage'));
        }
    }
}

// System that displays entity status
class StatusDisplaySystem extends BaseSystem {
    readonly name = 'StatusDisplaySystem';
    readonly priority = 3;

    update(world: World, _deltaTime: number): void {
        const healthEntities = world
            .query<HealthComponent>('health')
            .getEntities();

        if (healthEntities.length > 0) {
            console.log('\n--- Entity Status ---');
            for (const entityId of healthEntities) {
                const health = world.getComponent<HealthComponent>(
                    entityId,
                    'health'
                );
                const position = world.getComponent<PositionComponent>(
                    entityId,
                    'position'
                );

                if (health) {
                    const posStr = position
                        ? ` at (${position.x}, ${position.y})`
                        : '';
                    console.log(
                        `Entity ${entityId}: ${health.value}/${health.maxValue} HP${posStr}`
                    );
                }
            }
            console.log('-------------------\n');
        }
    }
}

// Example 1: Basic command buffer usage
function basicExample() {
    console.log('\n=== Example 1: Basic Command Buffer Usage ===\n');

    const world = new World();

    // Get the main command buffer
    const buffer = world.getCommandBuffer();

    // Queue multiple commands
    console.log('Queueing commands...');
    buffer.enqueue(new CreateEntityCommand());
    buffer.enqueue(new CreateEntityCommand());
    buffer.enqueue(new CreateEntityCommand());

    console.log(`Queued: ${buffer.getQueuedCount()} commands`);
    console.log(`Entities before execution: ${world.getEntityCount()}`);

    // Execute all queued commands
    const stats = world.executeCommands();

    console.log(`\nExecution stats:`);
    console.log(`  Total: ${stats.totalCommands}`);
    console.log(`  Successful: ${stats.successfulCommands}`);
    console.log(`  Failed: ${stats.failedCommands}`);
    console.log(`  Time: ${stats.executionTime.toFixed(2)}ms`);
    console.log(`Entities after execution: ${world.getEntityCount()}`);
}

// Example 2: Auto-execution during update cycle
function autoExecutionExample() {
    console.log('\n=== Example 2: Auto-Execution During Update ===\n');

    const world = new World();

    // Add spawner system
    world.addSystem(new SpawnerSystem());

    console.log('Running update cycles...\n');

    // Run multiple update cycles
    for (let i = 0; i < 6; i++) {
        console.log(`\n--- Update ${i + 1} ---`);
        world.update(1.0); // 1 second per frame
        console.log(`Entities: ${world.getEntityCount()}`);
    }

    console.log('\nSpawning complete!');
}

// Example 3: Undo/Redo functionality
function undoRedoExample() {
    console.log('\n=== Example 3: Undo/Redo Functionality ===\n');

    const world = new World();

    // Create a command buffer with undo enabled
    const buffer = world.createCommandBuffer({ enableUndo: true });

    // Create some entities
    console.log('Creating entities...');
    buffer.enqueue(new CreateEntityCommand());
    buffer.enqueue(new CreateEntityCommand());
    buffer.enqueue(new CreateEntityCommand());

    buffer.execute(world);
    console.log(`Entities after creation: ${world.getEntityCount()}`);

    // Undo the operations
    console.log('\nUndoing operations...');
    buffer.undo(world);
    console.log(`Entities after undo: ${world.getEntityCount()}`);

    // Replay the operations
    console.log('\nReplaying operations...');
    buffer.replay(world);
    console.log(`Entities after replay: ${world.getEntityCount()}`);
}

// Example 4: Complex scenario with damage system
function damageSystemExample() {
    console.log('\n=== Example 4: Damage System with Command Buffers ===\n');

    const world = new World();

    // Add systems
    world.addSystem(new DamageSystem());
    world.addSystem(new StatusDisplaySystem());

    // Disable auto-execution for manual control
    world.setAutoExecuteCommands(false);

    // Create player entity
    const playerId = world.createEntity();
    world.addComponent(playerId, {
        type: 'health',
        value: 100,
        maxValue: 100,
    } as HealthComponent);
    world.addComponent(playerId, {
        type: 'position',
        x: 0,
        y: 0,
    } as PositionComponent);

    console.log('Player created with 100 HP\n');

    // Create enemy entity
    const enemyId = world.createEntity();
    world.addComponent(enemyId, {
        type: 'health',
        value: 50,
        maxValue: 50,
    } as HealthComponent);
    world.addComponent(enemyId, {
        type: 'position',
        x: 10,
        y: 10,
    } as PositionComponent);

    console.log('Enemy created with 50 HP\n');

    // Apply damage to player
    console.log('=== Turn 1: Player takes 30 damage ===');
    const damageEntity1 = world.createEntity();
    world.addComponent(damageEntity1, {
        type: 'damage',
        amount: 30,
        targetEntityId: playerId,
    } as DamageComponent);

    world.update(0.016);
    world.executeCommands(); // Manually execute commands

    // Apply more damage to player
    console.log('\n=== Turn 2: Player takes 40 damage ===');
    const damageEntity2 = world.createEntity();
    world.addComponent(damageEntity2, {
        type: 'damage',
        amount: 40,
        targetEntityId: playerId,
    } as DamageComponent);

    world.update(0.016);
    world.executeCommands();

    // Apply fatal damage to enemy
    console.log('\n=== Turn 3: Enemy takes 60 damage (fatal) ===');
    const damageEntity3 = world.createEntity();
    world.addComponent(damageEntity3, {
        type: 'damage',
        amount: 60,
        targetEntityId: enemyId,
    } as DamageComponent);

    world.update(0.016);
    world.executeCommands();

    console.log(`\nFinal entity count: ${world.getEntityCount()}`);
}

// Example 5: Multiple independent buffers
function multipleBuffersExample() {
    console.log('\n=== Example 5: Multiple Independent Buffers ===\n');

    const world = new World();

    // Create multiple independent buffers
    const buffer1 = world.createCommandBuffer();
    const buffer2 = world.createCommandBuffer();
    const buffer3 = world.createCommandBuffer({ enableUndo: true });

    console.log('Creating commands in different buffers...');

    // Buffer 1: Create entities
    buffer1.enqueue(new CreateEntityCommand());
    buffer1.enqueue(new CreateEntityCommand());

    // Buffer 2: Create more entities
    buffer2.enqueue(new CreateEntityCommand());

    // Buffer 3: Create entities with undo support
    buffer3.enqueue(new CreateEntityCommand());
    buffer3.enqueue(new CreateEntityCommand());

    console.log(`\nBuffer 1 queue: ${buffer1.getQueuedCount()} commands`);
    console.log(`Buffer 2 queue: ${buffer2.getQueuedCount()} commands`);
    console.log(`Buffer 3 queue: ${buffer3.getQueuedCount()} commands`);

    // Execute buffers separately
    console.log('\nExecuting buffer 1...');
    buffer1.execute(world);
    console.log(`Entities: ${world.getEntityCount()}`);

    console.log('\nExecuting buffer 2...');
    buffer2.execute(world);
    console.log(`Entities: ${world.getEntityCount()}`);

    console.log('\nExecuting buffer 3...');
    buffer3.execute(world);
    console.log(`Entities: ${world.getEntityCount()}`);

    // Undo buffer 3
    console.log('\nUndoing buffer 3...');
    buffer3.undo(world);
    console.log(`Entities: ${world.getEntityCount()}`);
}

// Example 6: Performance test
function performanceExample() {
    console.log('\n=== Example 6: Performance Test ===\n');

    const world = new World();
    const buffer = world.getCommandBuffer();

    const commandCount = 10000;
    console.log(`Queueing ${commandCount} entity creation commands...`);

    const startQueue = performance.now();
    for (let i = 0; i < commandCount; i++) {
        buffer.enqueue(new CreateEntityCommand());
    }
    const queueTime = performance.now() - startQueue;

    console.log(`Queue time: ${queueTime.toFixed(2)}ms`);

    console.log('\nExecuting commands...');
    const stats = buffer.execute(world);

    console.log(`\nExecution stats:`);
    console.log(`  Total commands: ${stats.totalCommands}`);
    console.log(`  Successful: ${stats.successfulCommands}`);
    console.log(`  Execution time: ${stats.executionTime.toFixed(2)}ms`);
    console.log(
        `  Commands/ms: ${(stats.totalCommands / stats.executionTime).toFixed(2)}`
    );
    console.log(`\nFinal entity count: ${world.getEntityCount()}`);
}

// Run all examples
function main() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║     Command Buffer System Examples            ║');
    console.log('╚════════════════════════════════════════════════╝');

    basicExample();
    autoExecutionExample();
    undoRedoExample();
    damageSystemExample();
    multipleBuffersExample();
    performanceExample();

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║     All Examples Complete!                    ║');
    console.log('╚════════════════════════════════════════════════╝\n');
}

main();
