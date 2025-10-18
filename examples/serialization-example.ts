/**
 * Comprehensive Serialization Example
 *
 * Demonstrates the core serialization features of the ECS engine:
 * - Creating snapshots
 * - Saving/loading with JSON format
 * - Saving/loading with Binary format
 * - Filtering (selective serialization)
 * - Version compatibility
 * - World save/load convenience methods
 */

import {
    BinaryFormat,
    type Component,
    JSONFormat,
    type SerializationFilter,
    World,
} from '../src/index.ts';

// Define game components
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

interface PlayerComponent extends Component {
    readonly type: 'player';
    name: string;
    level: number;
    score: number;
}

interface TemporaryComponent extends Component {
    readonly type: 'temporary';
    ttl: number;
}

// Helper functions
function createPlayer(
    world: World,
    name: string,
    x: number,
    y: number
): number {
    const entity = world.createEntity();

    world.addComponent(entity, {
        type: 'player',
        name,
        level: 1,
        score: 0,
    } as PlayerComponent);

    world.addComponent(entity, {
        type: 'position',
        x,
        y,
    } as PositionComponent);

    world.addComponent(entity, {
        type: 'velocity',
        dx: 0,
        dy: 0,
    } as VelocityComponent);

    world.addComponent(entity, {
        type: 'health',
        hp: 100,
        maxHp: 100,
    } as HealthComponent);

    return entity;
}

function createEnemy(world: World, x: number, y: number): number {
    const entity = world.createEntity();

    world.addComponent(entity, {
        type: 'position',
        x,
        y,
    } as PositionComponent);

    world.addComponent(entity, {
        type: 'velocity',
        dx: Math.random() * 2 - 1,
        dy: Math.random() * 2 - 1,
    } as VelocityComponent);

    world.addComponent(entity, {
        type: 'health',
        hp: 50,
        maxHp: 50,
    } as HealthComponent);

    return entity;
}

function printWorldState(world: World, title: string): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${title}`);
    console.log('='.repeat(60));
    console.log(`Entities: ${world.getEntityCount()}`);
    console.log(`Component types: ${world.getComponentTypes().join(', ')}`);

    // Show players
    const players = world.queryMultiple(['player', 'position', 'health']);
    if (players.length > 0) {
        console.log('\n🎮 Players:');
        for (const entityId of players) {
            const player = world.getComponent<PlayerComponent>(
                entityId,
                'player'
            );
            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            const health = world.getComponent<HealthComponent>(
                entityId,
                'health'
            );

            if (player && position && health) {
                console.log(
                    `  ${player.name} (Entity ${entityId}): Level ${player.level}, Score ${player.score}, HP ${health.hp}/${health.maxHp}, Pos (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`
                );
            }
        }
    }

    // Show enemies
    const enemies = world
        .queryMultiple(['position', 'health'])
        .filter((id) => !world.hasComponent(id, 'player'));
    if (enemies.length > 0) {
        console.log(`\n👾 Enemies: ${enemies.length} total`);
    }
}

async function example1_BasicSerialization() {
    console.log('\n\n🔹 Example 1: Basic Serialization (JSON Format)');
    console.log('─'.repeat(60));

    // Create world with game state
    const world = new World();
    createPlayer(world, 'Hero', 10, 20);
    createEnemy(world, 50, 30);
    createEnemy(world, 60, 40);

    printWorldState(world, 'Original World State');

    // Create snapshot
    const result = world.createSnapshot();
    console.log(`\n✅ Snapshot created successfully!`);
    console.log(`   Entities: ${result.snapshot?.stats.entityCount}`);
    console.log(`   Components: ${result.snapshot?.stats.componentCount}`);
    console.log(
        `   Estimated size: ${((result.snapshot?.stats.estimatedSize ?? 0) / 1024).toFixed(2)} KB`
    );
    console.log(`   Duration: ${result.duration.toFixed(2)}ms`);

    // Serialize to JSON
    const jsonFormat = new JSONFormat();
    const jsonData = jsonFormat.serialize(result.snapshot!, {
        prettyPrint: true,
    });
    console.log(
        `\n📄 JSON serialized: ${(jsonData.length / 1024).toFixed(2)} KB`
    );

    // Save to file
    await Bun.write('./game-save.json', jsonData);
    console.log('💾 Saved to: ./game-save.json');

    // Load into new world
    const loadedData = await Bun.file('./game-save.json').arrayBuffer();
    const snapshot = jsonFormat.deserialize(new Uint8Array(loadedData));

    const newWorld = new World();
    const loadResult = newWorld.loadSnapshot(snapshot, {
        clearExisting: true,
    });

    console.log(`\n✅ Snapshot loaded successfully!`);
    console.log(`   Entities loaded: ${loadResult.entitiesLoaded}`);
    console.log(`   Components loaded: ${loadResult.componentsLoaded}`);
    console.log(`   Duration: ${loadResult.duration.toFixed(2)}ms`);

    printWorldState(newWorld, 'Loaded World State');
}

async function example2_BinaryFormat() {
    console.log('\n\n🔹 Example 2: Binary Format (Compact & Efficient)');
    console.log('─'.repeat(60));

    const world = new World();
    createPlayer(world, 'Warrior', 15, 25);
    createPlayer(world, 'Mage', 5, 35);

    for (let i = 0; i < 5; i++) {
        createEnemy(world, Math.random() * 100, Math.random() * 100);
    }

    printWorldState(world, 'World State to Serialize');

    // Compare formats
    const snapshot = world.createSnapshot().snapshot!;

    // JSON format
    const jsonFormat = new JSONFormat();
    const jsonData = jsonFormat.serialize(snapshot);
    const jsonSize = jsonData.length;

    // Binary format
    const binaryFormat = new BinaryFormat();
    const binaryData = binaryFormat.serialize(snapshot);
    const binarySize = binaryData.length;

    console.log('\n📊 Format Comparison:');
    console.log(`   JSON size:   ${(jsonSize / 1024).toFixed(2)} KB`);
    console.log(`   Binary size: ${(binarySize / 1024).toFixed(2)} KB`);
    console.log(
        `   Savings:     ${(((jsonSize - binarySize) / jsonSize) * 100).toFixed(1)}%`
    );

    // Save both formats
    await Bun.write('./game-save.json', jsonData);
    await Bun.write('./game-save.ecsb', binaryData);

    console.log('\n💾 Files saved:');
    console.log('   - ./game-save.json (human-readable)');
    console.log('   - ./game-save.ecsb (binary, compact)');

    // Load from binary
    const loadedBinaryData = await Bun.file('./game-save.ecsb').arrayBuffer();
    const loadedSnapshot = binaryFormat.deserialize(
        new Uint8Array(loadedBinaryData)
    );

    const newWorld = new World();
    newWorld.loadSnapshot(loadedSnapshot);

    printWorldState(newWorld, 'Loaded from Binary Format');
}

async function example3_SelectiveSerialization() {
    console.log('\n\n🔹 Example 3: Selective Serialization (Filtering)');
    console.log('─'.repeat(60));

    const world = new World();
    const player1 = createPlayer(world, 'Alice', 10, 10);
    const player2 = createPlayer(world, 'Bob', 20, 20);

    // Add temporary debug components
    world.addComponent(player1, {
        type: 'temporary',
        ttl: 100,
    } as TemporaryComponent);
    world.addComponent(player2, {
        type: 'temporary',
        ttl: 50,
    } as TemporaryComponent);

    createEnemy(world, 30, 30);

    printWorldState(world, 'World with Temporary Components');

    // Filter 1: Exclude temporary components
    console.log('\n🔍 Filter 1: Exclude temporary components');
    const filter1: SerializationFilter = {
        excludeComponentTypes: ['temporary'],
    };

    const result1 = world.createSnapshot({ filter: filter1 });
    console.log(
        `   Components in snapshot: ${result1.snapshot?.stats.componentCount}`
    );
    console.log(
        `   Component types: ${result1.snapshot?.componentTypes.join(', ')}`
    );

    // Filter 2: Only save player entities
    console.log('\n🔍 Filter 2: Only save player entities');
    const filter2: SerializationFilter = {
        includeEntities: [player1, player2],
    };

    const result2 = world.createSnapshot({ filter: filter2 });
    console.log(
        `   Entities in snapshot: ${result2.snapshot?.stats.entityCount}`
    );

    // Filter 3: Only save position and health
    console.log('\n🔍 Filter 3: Only save position and health components');
    const filter3: SerializationFilter = {
        includeComponentTypes: ['position', 'health'],
    };

    const result3 = world.createSnapshot({ filter: filter3 });
    console.log(
        `   Component types: ${result3.snapshot?.componentTypes.join(', ')}`
    );
    console.log(
        `   Total components: ${result3.snapshot?.stats.componentCount}`
    );

    // Custom predicate: Only entities with health > 75
    console.log('\n🔍 Filter 4: Custom predicate (health > 75)');
    const filter4: SerializationFilter = {
        entityPredicate: (entityId) => {
            const health = world.getComponent<HealthComponent>(
                entityId,
                'health'
            );
            return health ? health.hp > 75 : false;
        },
    };

    const result4 = world.createSnapshot({ filter: filter4 });
    console.log(
        `   Entities in snapshot: ${result4.snapshot?.stats.entityCount}`
    );
}

async function example4_ConvenienceMethods() {
    console.log('\n\n🔹 Example 4: Convenience Save/Load Methods');
    console.log('─'.repeat(60));

    const world = new World();
    const player = createPlayer(world, 'Champion', 42, 84);

    // Update player stats
    const playerComp = world.getComponent<PlayerComponent>(player, 'player');
    if (playerComp) {
        playerComp.level = 10;
        playerComp.score = 1000;
    }

    printWorldState(world, 'World to Save');

    // Direct save using World.save()
    console.log('\n💾 Saving using World.save()...');
    const saveResult = await world.save(
        './champion-save.json',
        new JSONFormat(),
        {
            prettyPrint: true,
            metadata: {
                saveDate: new Date().toISOString(),
                gameVersion: '1.0.0',
            },
        }
    );

    if (saveResult.success) {
        console.log('✅ Save successful!');
        console.log(`   Duration: ${saveResult.duration.toFixed(2)}ms`);
    }

    // Simulate game restart
    console.log('\n🔄 Simulating game restart...');
    const newWorld = new World();

    // Direct load using World.load()
    console.log('📂 Loading using World.load()...');
    const loadResult = await newWorld.load(
        './champion-save.json',
        new JSONFormat(),
        {
            clearExisting: true,
            validateVersion: true,
        }
    );

    if (loadResult.success) {
        console.log('✅ Load successful!');
        console.log(`   Entities loaded: ${loadResult.entitiesLoaded}`);
        console.log(`   Components loaded: ${loadResult.componentsLoaded}`);
        console.log(`   Duration: ${loadResult.duration.toFixed(2)}ms`);
    }

    printWorldState(newWorld, 'Loaded World State');
}

async function example5_MergeVsClear() {
    console.log('\n\n🔹 Example 5: Merge vs Clear Loading');
    console.log('─'.repeat(60));

    const world = new World();
    createPlayer(world, 'ExistingPlayer', 10, 10);
    createEnemy(world, 20, 20);

    printWorldState(world, 'Existing World State');

    // Create a snapshot with different data
    const tempWorld = new World();
    createPlayer(tempWorld, 'NewPlayer', 30, 30);

    const snapshot = tempWorld.createSnapshot().snapshot!;

    // Test 1: Load with merge
    console.log('\n📥 Loading with merge (clearExisting: false)');
    const world1 = new World();
    createPlayer(world1, 'ExistingPlayer', 10, 10);

    world1.loadSnapshot(snapshot, { clearExisting: false });
    console.log(`   Total entities after merge: ${world1.getEntityCount()}`);
    console.log(
        `   Player entities: ${world1.queryMultiple(['player']).length}`
    );

    // Test 2: Load with clear
    console.log('\n🗑️  Loading with clear (clearExisting: true)');
    const world2 = new World();
    createPlayer(world2, 'ExistingPlayer', 10, 10);

    world2.loadSnapshot(snapshot, { clearExisting: true });
    console.log(`   Total entities after clear: ${world2.getEntityCount()}`);
    console.log(
        `   Player entities: ${world2.queryMultiple(['player']).length}`
    );
}

// Run all examples
async function runAllExamples() {
    console.log('🚀 ECS Serialization Examples\n');
    console.log('Demonstrates comprehensive serialization features:\n');
    console.log('1. Basic JSON serialization');
    console.log('2. Binary format (compact)');
    console.log('3. Selective serialization (filtering)');
    console.log('4. Convenience save/load methods');
    console.log('5. Merge vs clear loading strategies');

    await example1_BasicSerialization();
    await example2_BinaryFormat();
    await example3_SelectiveSerialization();
    await example4_ConvenienceMethods();
    await example5_MergeVsClear();

    console.log('\n\n✨ All examples completed successfully!');
    console.log('\n💡 Key Takeaways:');
    console.log('• Use JSON format for human-readable saves and debugging');
    console.log('• Use Binary format for production (smaller, faster)');
    console.log('• Apply filters to exclude temporary/debug data');
    console.log('• Use World.save/load for quick file operations');
    console.log('• Choose merge or clear based on your game requirements');
    console.log('\n📚 See docs for advanced features like:');
    console.log('• Version compatibility checking');
    console.log('• Entity ID remapping');
    console.log('• Custom serialization formats');
    console.log('• StoragePlugin integration for databases');
}

// Run if executed directly
if (import.meta.main) {
    await runAllExamples();
}

export {
    createPlayer,
    createEnemy,
    example1_BasicSerialization,
    example2_BinaryFormat,
    example3_SelectiveSerialization,
    example4_ConvenienceMethods,
    example5_MergeVsClear,
};
