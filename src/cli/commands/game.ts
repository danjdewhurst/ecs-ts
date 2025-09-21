import { join } from 'node:path';
import inquirer from 'inquirer';
import {
    GAME_TEMPLATE,
    type GameTemplateVars,
} from '../templates/game.template.ts';
import { createFile, validateFileName } from '../utils/file-operations.ts';
import { analyzeProject } from '../utils/project-analysis.ts';
import { renderTemplate, toPascalCase } from '../utils/template-engine.ts';

interface GameTemplate {
    name: string;
    description: string;
    value: string;
}

interface GameData {
    name: string;
    description: string;
    componentDefinitions: string;
    systemDefinitions: string;
    systemSetup: string;
    entitySetup: string;
}

const GAME_TEMPLATES: GameTemplate[] = [
    {
        name: 'Platformer - Basic 2D platformer with physics',
        description: 'A basic 2D platformer game with jumping and gravity',
        value: 'platformer',
    },
    {
        name: 'Space Shooter - Top-down space combat',
        description: 'A top-down space shooter with enemies and projectiles',
        value: 'spaceshooter',
    },
    {
        name: 'RPG - Role-playing game systems',
        description: 'An RPG with stats, inventory, and combat systems',
        value: 'rpg',
    },
    {
        name: 'Tower Defense - Strategy game with waves',
        description: 'A tower defense game with towers and enemy waves',
        value: 'towerdefense',
    },
    {
        name: 'Snake - Classic snake game',
        description: 'The classic snake game with growing segments',
        value: 'snake',
    },
    {
        name: 'Custom - Design your own game template',
        description: 'A custom game template',
        value: 'custom',
    },
];

export async function gameCommand(): Promise<void> {
    console.log('🔧 Game Template Scaffolding\\n');

    const structure = analyzeProject();

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'template',
            message: 'Select game template:',
            choices: GAME_TEMPLATES,
            pageSize: GAME_TEMPLATES.length,
        },
    ]);

    let gameData: GameData;

    if (answers.template === 'custom') {
        gameData = await createCustomGame();
    } else {
        gameData = getPrebuiltGame(answers.template);
    }

    const nameAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Game file name:',
            default: `${gameData.name}-game`,
            validate: (input: string) => {
                try {
                    validateFileName(input);
                    if (structure.existingExamples.includes(input)) {
                        return `Game ${input} already exists`;
                    }
                    return true;
                } catch (error) {
                    return (error as Error).message;
                }
            },
        },
    ]);

    const configAnswers = await inquirer.prompt([
        {
            type: 'number',
            name: 'fps',
            message: 'Target FPS (frames per second):',
            default: 60,
            validate: (input: number) =>
                Number.isInteger(input) && input > 0
                    ? true
                    : 'FPS must be a positive integer',
        },
        {
            type: 'number',
            name: 'duration',
            message: 'Demo duration (seconds):',
            default: 10,
            validate: (input: number) =>
                input > 0 ? true : 'Duration must be positive',
        },
    ]);

    // Generate template variables
    const templateVars: GameTemplateVars = {
        gameName: toPascalCase(nameAnswer.name),
        gameDescription: gameData.description,
        componentDefinitions: gameData.componentDefinitions,
        systemDefinitions: gameData.systemDefinitions,
        systemSetup: gameData.systemSetup,
        entitySetup: gameData.entitySetup,
        frameDelay: Math.round(1000 / configAnswers.fps),
        duration: configAnswers.duration,
    };

    // Create file
    const filePath = join(structure.examplesDir, `${nameAnswer.name}.ts`);
    const content = renderTemplate(GAME_TEMPLATE, templateVars);

    createFile(filePath, content);

    console.log(`\\n✅ Created game: ${nameAnswer.name}`);
    console.log(`📁 File: ${filePath}`);
    console.log(`🚀 Run with: bun ${filePath}`);
    console.log(
        `🎮 Game will run at ${configAnswers.fps} FPS for ${configAnswers.duration} seconds`
    );
}

async function createCustomGame(): Promise<GameData> {
    console.log('\\n📝 Custom Game Configuration:');

    const customAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Game name:',
            validate: (input: string) =>
                input.trim() ? true : 'Name cannot be empty',
        },
        {
            type: 'input',
            name: 'description',
            message: 'Game description:',
            validate: (input: string) =>
                input.trim() ? true : 'Description cannot be empty',
        },
    ]);

    return {
        name: customAnswers.name,
        description: customAnswers.description,
        componentDefinitions: buildCustomGameComponents(),
        systemDefinitions: buildCustomGameSystems(customAnswers.name),
        systemSetup: buildCustomSystemSetup(customAnswers.name),
        entitySetup: buildCustomEntitySetup(),
    };
}

function getPrebuiltGame(templateType: string): GameData {
    switch (templateType) {
        case 'platformer':
            return {
                name: 'platformer',
                description:
                    'A basic 2D platformer game with jumping and gravity',
                componentDefinitions: `// Platformer Components
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

interface PhysicsComponent extends Component {
    readonly type: 'physics';
    onGround: boolean;
    gravity: number;
}

interface PlayerComponent extends Component {
    readonly type: 'player';
    jumpPower: number;
    speed: number;
}

interface PlatformComponent extends Component {
    readonly type: 'platform';
    width: number;
    height: number;
}`,
                systemDefinitions: `// Platformer Systems
class GravitySystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'GravitySystem';

    update(world: World, deltaTime: number): void {
        const entities = this.queryEntities(world, 'velocity', 'physics');

        for (const entityId of entities) {
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');
            const physics = world.getComponent<PhysicsComponent>(entityId, 'physics');

            if (velocity && physics && !physics.onGround) {
                velocity.dy -= physics.gravity * deltaTime;
            }
        }
    }
}

class MovementSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'MovementSystem';

    update(world: World, deltaTime: number): void {
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

            if (position && velocity) {
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;

                console.log(\`Entity \${entityId} at (\${position.x.toFixed(1)}, \${position.y.toFixed(1)})\`);
            }
        }
    }
}

class CollisionSystem extends BaseSystem {
    readonly priority = 3;
    readonly name = 'CollisionSystem';

    update(world: World, deltaTime: number): void {
        const entities = this.queryEntities(world, 'position', 'physics');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const physics = world.getComponent<PhysicsComponent>(entityId, 'physics');

            if (position && physics) {
                // Simple ground collision
                if (position.y <= 0) {
                    position.y = 0;
                    physics.onGround = true;
                    const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');
                    if (velocity) velocity.dy = 0;
                } else {
                    physics.onGround = false;
                }
            }
        }
    }
}`,
                systemSetup: `        world.addSystem(new GravitySystem());
        world.addSystem(new MovementSystem());
        world.addSystem(new CollisionSystem());`,
                entitySetup: `        // Create player
        const player = this.world.createEntity();
        this.world.addComponent(player, { type: 'position', x: 0, y: 10 } as PositionComponent);
        this.world.addComponent(player, { type: 'velocity', dx: 2, dy: 0 } as VelocityComponent);
        this.world.addComponent(player, { type: 'physics', onGround: false, gravity: 9.8 } as PhysicsComponent);
        this.world.addComponent(player, { type: 'player', jumpPower: 5, speed: 3 } as PlayerComponent);

        // Create platforms
        const platform1 = this.world.createEntity();
        this.world.addComponent(platform1, { type: 'position', x: 5, y: 0 } as PositionComponent);
        this.world.addComponent(platform1, { type: 'platform', width: 10, height: 1 } as PlatformComponent);`,
            };

        case 'spaceshooter':
            return {
                name: 'spaceshooter',
                description:
                    'A top-down space shooter with enemies and projectiles',
                componentDefinitions: `// Space Shooter Components
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
    fireRate: number;
    lastShot: number;
}

interface EnemyComponent extends Component {
    readonly type: 'enemy';
    damage: number;
    attackRate: number;
}

interface ProjectileComponent extends Component {
    readonly type: 'projectile';
    damage: number;
    lifetime: number;
}`,
                systemDefinitions: `// Space Shooter Systems
class MovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'MovementSystem';

    update(world: World, deltaTime: number): void {
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

            if (position && velocity) {
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;
            }
        }
    }
}

class CombatSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'CombatSystem';

    update(world: World, deltaTime: number): void {
        console.log('Combat systems engaging...');
        // Simplified combat simulation
    }
}

class ProjectileSystem extends BaseSystem {
    readonly priority = 3;
    readonly name = 'ProjectileSystem';

    update(world: World, deltaTime: number): void {
        this.queryWithComponents<ProjectileComponent>(world, 'projectile', (entityId, projectile) => {
            projectile.lifetime -= deltaTime;
            if (projectile.lifetime <= 0) {
                console.log(\`Projectile \${entityId} expired\`);
            }
        });
    }
}`,
                systemSetup: `        world.addSystem(new MovementSystem());
        world.addSystem(new CombatSystem());
        world.addSystem(new ProjectileSystem());`,
                entitySetup: `        // Create player ship
        const player = this.world.createEntity();
        this.world.addComponent(player, { type: 'position', x: 0, y: 0 } as PositionComponent);
        this.world.addComponent(player, { type: 'velocity', dx: 0, dy: 1 } as VelocityComponent);
        this.world.addComponent(player, { type: 'health', hp: 100, maxHp: 100 } as HealthComponent);
        this.world.addComponent(player, { type: 'player', fireRate: 0.5, lastShot: 0 } as PlayerComponent);

        // Create enemy ships
        for (let i = 0; i < 3; i++) {
            const enemy = this.world.createEntity();
            this.world.addComponent(enemy, { type: 'position', x: i * 5, y: 10 } as PositionComponent);
            this.world.addComponent(enemy, { type: 'velocity', dx: 0, dy: -2 } as VelocityComponent);
            this.world.addComponent(enemy, { type: 'health', hp: 50, maxHp: 50 } as HealthComponent);
            this.world.addComponent(enemy, { type: 'enemy', damage: 20, attackRate: 1.0 } as EnemyComponent);
        }`,
            };

        case 'snake':
            return {
                name: 'snake',
                description: 'The classic snake game with growing segments',
                componentDefinitions: `// Snake Game Components
interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface SnakeHeadComponent extends Component {
    readonly type: 'snake-head';
    direction: 'up' | 'down' | 'left' | 'right';
    speed: number;
}

interface SnakeSegmentComponent extends Component {
    readonly type: 'snake-segment';
    segmentIndex: number;
}

interface FoodComponent extends Component {
    readonly type: 'food';
    value: number;
}

interface GameStateComponent extends Component {
    readonly type: 'game-state';
    score: number;
    gameOver: boolean;
}`,
                systemDefinitions: `// Snake Game Systems
class SnakeMovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'SnakeMovementSystem';

    update(world: World, deltaTime: number): void {
        this.queryWithComponents<SnakeHeadComponent>(world, 'snake-head', (entityId, snake) => {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            if (!position) return;

            const moveDistance = snake.speed * deltaTime;

            switch (snake.direction) {
                case 'up':
                    position.y += moveDistance;
                    break;
                case 'down':
                    position.y -= moveDistance;
                    break;
                case 'left':
                    position.x -= moveDistance;
                    break;
                case 'right':
                    position.x += moveDistance;
                    break;
            }

            console.log(\`Snake head at (\${position.x.toFixed(1)}, \${position.y.toFixed(1)}) moving \${snake.direction}\`);
        });
    }
}

class FoodSystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'FoodSystem';

    update(world: World, deltaTime: number): void {
        const foodEntities = world.query('food').getEntities();
        if (foodEntities.length === 0) {
            // Spawn new food
            this.spawnFood(world);
        }
    }

    private spawnFood(world: World): void {
        const food = world.createEntity();
        const x = Math.floor(Math.random() * 20) - 10;
        const y = Math.floor(Math.random() * 20) - 10;

        world.addComponent(food, { type: 'position', x, y } as PositionComponent);
        world.addComponent(food, { type: 'food', value: 10 } as FoodComponent);

        console.log(\`Food spawned at (\${x}, \${y})\`);
    }
}`,
                systemSetup: `        world.addSystem(new SnakeMovementSystem());
        world.addSystem(new FoodSystem());`,
                entitySetup: `        // Create snake head
        const snakeHead = this.world.createEntity();
        this.world.addComponent(snakeHead, { type: 'position', x: 0, y: 0 } as PositionComponent);
        this.world.addComponent(snakeHead, { type: 'snake-head', direction: 'right', speed: 2 } as SnakeHeadComponent);

        // Create game state
        const gameState = this.world.createEntity();
        this.world.addComponent(gameState, { type: 'game-state', score: 0, gameOver: false } as GameStateComponent);`,
            };

        default:
            return getPrebuiltGame('platformer');
    }
}

function buildCustomGameComponents(): string {
    return `// TODO: Define your custom game components here
// Example:
// interface CustomGameComponent extends Component {
//     readonly type: 'custom-game';
//     value: number;
// }`;
}

function buildCustomGameSystems(gameName: string): string {
    const systemName = `${toPascalCase(gameName)}System`;
    return `// TODO: Define your custom game systems here
class ${systemName} extends BaseSystem {
    readonly priority = 1;
    readonly name = '${systemName}';

    update(world: World, deltaTime: number): void {
        // TODO: Implement your custom game logic here
        console.log(\`${systemName} updated with deltaTime: \${deltaTime}\`);
    }
}`;
}

function buildCustomSystemSetup(gameName: string): string {
    const systemName = `${toPascalCase(gameName)}System`;
    return `        world.addSystem(new ${systemName}());`;
}

function buildCustomEntitySetup(): string {
    return `        // TODO: Create your custom game entities here
        // Example:
        // const entity = this.world.createEntity();
        // this.world.addComponent(entity, { type: 'custom-game', value: 42 });`;
}
