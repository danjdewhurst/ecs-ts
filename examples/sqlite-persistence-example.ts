import { Database } from 'bun:sqlite';
import { BaseSystem, type Component, World } from '../src/index.ts';

// Define game components
interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}

interface InventoryComponent extends Component {
    readonly type: 'inventory';
    items: string[];
    gold: number;
}

interface PlayerComponent extends Component {
    readonly type: 'player';
    name: string;
    level: number;
    experience: number;
}

// SQLite persistence system
class SQLitePersistenceSystem extends BaseSystem {
    readonly priority = 100; // Low priority to run after game logic
    readonly name = 'SQLitePersistenceSystem';
    private db: Database;
    private saveInterval = 5000; // Save every 5 seconds
    private lastSave = 0;

    constructor(dbPath = ':memory:') {
        super();
        this.db = new Database(dbPath);
        this.initializeTables();
    }

    private initializeTables(): void {
        // Create entities table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS entities (
                id INTEGER PRIMARY KEY,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create components table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS components (
                entity_id INTEGER,
                component_type TEXT,
                component_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (entity_id, component_type),
                FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
            )
        `);

        // Create index for better query performance
        this.db.run(
            'CREATE INDEX IF NOT EXISTS idx_components_type ON components(component_type)'
        );

        console.log('✅ SQLite database initialized with tables');
    }

    update(world: World, _deltaTime: number): void {
        const now = Date.now();

        // Auto-save periodically
        if (now - this.lastSave > this.saveInterval) {
            this.saveWorldState(world);
            this.lastSave = now;
        }
    }

    saveWorldState(world: World): void {
        console.log('💾 Saving world state to SQLite...');

        // Get all entities by collecting from all component storages
        const allEntities = new Set<number>();
        const componentTypes = world.getComponentTypes();

        for (const componentType of componentTypes) {
            const entitiesWithComponent = world
                .query(componentType)
                .getEntities();
            for (const entityId of entitiesWithComponent) {
                allEntities.add(entityId);
            }
        }

        const transaction = this.db.transaction(() => {
            for (const entityId of allEntities) {
                // Ensure entity exists in database
                this.db.run(
                    'INSERT OR REPLACE INTO entities (id, updated_at) VALUES (?, CURRENT_TIMESTAMP)',
                    [entityId]
                );

                // Save all components for this entity
                for (const componentType of componentTypes) {
                    const component = world.getComponent(
                        entityId,
                        componentType
                    );
                    if (component) {
                        this.db.run(
                            `
                            INSERT OR REPLACE INTO components
                            (entity_id, component_type, component_data, updated_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        `,
                            [entityId, componentType, JSON.stringify(component)]
                        );
                    }
                }
            }
        });

        transaction();
        console.log(`✅ Saved ${allEntities.size} entities to database`);
    }

    loadWorldState(world: World): number {
        console.log('📂 Loading world state from SQLite...');

        const entities = this.db
            .query('SELECT id FROM entities ORDER BY id')
            .all() as { id: number }[];
        let loadedCount = 0;

        for (const { id: dbEntityId } of entities) {
            // Create new entity (gets auto-assigned ID by EntityManager)
            const worldEntityId = world.createEntity();

            // Load all components for this entity from database
            const components = this.db
                .query(`
                SELECT component_type, component_data
                FROM components
                WHERE entity_id = ?
            `)
                .all(dbEntityId) as {
                component_type: string;
                component_data: string;
            }[];

            for (const { component_type, component_data } of components) {
                try {
                    const component = JSON.parse(component_data);
                    world.addComponent(worldEntityId, component);
                } catch (error) {
                    console.error(
                        `Failed to parse component ${component_type} for entity ${dbEntityId}:`,
                        error
                    );
                }
            }

            loadedCount++;
        }

        console.log(`✅ Loaded ${loadedCount} entities from database`);
        return loadedCount;
    }

    // Query helpers for game logic
    getEntitiesByComponent(componentType: string): number[] {
        const results = this.db
            .query(`
            SELECT DISTINCT entity_id
            FROM components
            WHERE component_type = ?
        `)
            .all(componentType) as { entity_id: number }[];

        return results.map((r) => r.entity_id);
    }

    getPlayersByLevel(
        minLevel: number
    ): Array<{ entityId: number; player: PlayerComponent }> {
        const results = this.db
            .query(`
            SELECT entity_id, component_data
            FROM components
            WHERE component_type = 'player'
            AND JSON_EXTRACT(component_data, '$.level') >= ?
        `)
            .all(minLevel) as { entity_id: number; component_data: string }[];

        return results.map((r) => ({
            entityId: r.entity_id,
            player: JSON.parse(r.component_data),
        }));
    }

    close(): void {
        this.db.close();
        console.log('🗄️ Database connection closed');
    }
}

// Game systems for demonstration
class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';

    update(world: World, deltaTime: number): void {
        this.queryWithComponents<PositionComponent>(
            world,
            'position',
            (_entityId, position) => {
                // Simple random movement for demo
                position.x += (Math.random() - 0.5) * deltaTime * 2;
                position.y += (Math.random() - 0.5) * deltaTime * 2;
            }
        );
    }
}

class LevelingSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'LevelingSystem';

    update(world: World, deltaTime: number): void {
        const playerEntities = world.queryMultiple(['player', 'health']);

        for (const entityId of playerEntities) {
            const player = world.getComponent<PlayerComponent>(
                entityId,
                'player'
            );
            if (player) {
                // Add experience over time
                player.experience += Math.floor(deltaTime * 10);

                // Level up every 100 experience
                const newLevel = Math.floor(player.experience / 100) + 1;
                if (newLevel > player.level) {
                    player.level = newLevel;
                    console.log(
                        `🎉 ${player.name} leveled up to level ${player.level}!`
                    );

                    // Increase max health on level up
                    const health = world.getComponent<HealthComponent>(
                        entityId,
                        'health'
                    );
                    if (health) {
                        health.maxHp += 20;
                        health.hp = health.maxHp; // Full heal on level up
                    }
                }
            }
        }
    }
}

// Helper function to create sample entities
function createSampleEntities(world: World): void {
    // Create player entity
    const player = world.createEntity();
    world.addComponent(player, {
        type: 'player',
        name: 'Hero',
        level: 1,
        experience: 0,
    } as PlayerComponent);

    world.addComponent(player, {
        type: 'position',
        x: 0,
        y: 0,
    } as PositionComponent);

    world.addComponent(player, {
        type: 'health',
        hp: 100,
        maxHp: 100,
    } as HealthComponent);

    world.addComponent(player, {
        type: 'inventory',
        items: ['sword', 'potion'],
        gold: 50,
    } as InventoryComponent);

    // Create NPCs
    for (let i = 0; i < 3; i++) {
        const npc = world.createEntity();
        world.addComponent(npc, {
            type: 'player',
            name: `NPC_${i + 1}`,
            level: Math.floor(Math.random() * 5) + 1,
            experience: Math.floor(Math.random() * 200),
        } as PlayerComponent);

        world.addComponent(npc, {
            type: 'position',
            x: Math.random() * 100,
            y: Math.random() * 100,
        } as PositionComponent);

        world.addComponent(npc, {
            type: 'health',
            hp: 80,
            maxHp: 80,
        } as HealthComponent);
    }

    console.log(`✨ Created ${world.getEntityCount()} sample entities`);
}

// Example usage
async function runExample() {
    console.log('🗄️ SQLite Persistence Example Starting...\n');

    // Create database (use file for persistence between runs)
    const dbPath = './game_save.db';

    // Create world and persistence system
    const world = new World();
    const persistenceSystem = new SQLitePersistenceSystem(dbPath);

    // Add systems
    world.addSystem(persistenceSystem);
    world.addSystem(new MovementSystem());
    world.addSystem(new LevelingSystem());

    console.log('📂 Attempting to load existing save data...');
    const loadedEntities = persistenceSystem.loadWorldState(world);

    // If no existing data, create sample entities
    if (loadedEntities === 0) {
        console.log('🆕 No existing save found, creating new game...');
        createSampleEntities(world);
        persistenceSystem.saveWorldState(world);
    }

    console.log('\n📊 Current World State:');
    console.log(`Entities: ${world.getEntityCount()}`);
    console.log(`Component types: ${world.getComponentTypes().join(', ')}`);
    console.log(`Archetype stats:`, world.getArchetypeStats());

    // Demonstrate database queries
    console.log('\n🔍 Database Query Examples:');
    const playersData = persistenceSystem.getPlayersByLevel(1);
    for (const { entityId, player } of playersData) {
        console.log(
            `Player ${player.name} (Entity ${entityId}): Level ${player.level}, Experience ${player.experience}`
        );
    }

    console.log('\n🎮 Running game simulation with auto-save...');
    console.log('(Game will auto-save every 5 seconds)\n');

    // Run simulation for a while
    const deltaTime = 1.0;
    for (let i = 0; i < 8; i++) {
        console.log(`--- Update ${i + 1} ---`);
        world.update(deltaTime);

        // Show some player stats
        const playerEntities = world.queryMultiple(['player']);
        for (const entityId of playerEntities.slice(0, 2)) {
            // Show first 2 players
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
                    `${player.name}: Level ${player.level}, XP ${player.experience}, HP ${health.hp}/${health.maxHp}, Pos (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`
                );
            }
        }
        console.log('');

        // Simulate some delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Final save
    console.log('💾 Performing final save...');
    persistenceSystem.saveWorldState(world);

    // Demonstrate loading after restart
    console.log('\n🔄 Simulating game restart...');
    const newWorld = new World();
    const newPersistenceSystem = new SQLitePersistenceSystem(dbPath);
    const reloadedEntities = newPersistenceSystem.loadWorldState(newWorld);

    console.log(
        `✅ Successfully reloaded ${reloadedEntities} entities after restart`
    );
    console.log(`New world entity count: ${newWorld.getEntityCount()}`);

    // Cleanup
    persistenceSystem.close();
    newPersistenceSystem.close();

    console.log('\n💡 Tips for using SQLite persistence:');
    console.log('• Use database transactions for batch operations');
    console.log('• Consider async saves to avoid blocking game loop');
    console.log('• Add component versioning for save file compatibility');
    console.log('• Use database queries for complex entity searches');
    console.log('• Consider compression for large component data');

    console.log('\n🎯 SQLite Persistence Example completed successfully!');
    console.log(`💾 Game save file: ${dbPath}`);
}

// Run the example if this file is executed directly
if (import.meta.main) {
    await runExample();
}

export { SQLitePersistenceSystem };
