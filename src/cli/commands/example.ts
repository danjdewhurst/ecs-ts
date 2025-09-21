import { join } from 'node:path';
import inquirer from 'inquirer';
import {
    EXAMPLE_TEMPLATE,
    type ExampleTemplateVars,
} from '../templates/example.template.ts';
import { createFile, validateFileName } from '../utils/file-operations.ts';
import { analyzeProject } from '../utils/project-analysis.ts';
import { renderTemplate, toPascalCase } from '../utils/template-engine.ts';

interface ExampleTemplate {
    name: string;
    description: string;
    value: string;
}

interface ExampleData {
    name: string;
    description: string;
    componentDefinitions: string;
    systemDefinitions: string;
    systemRegistration: string;
    entityCreation: string;
    queries?: string;
}

const EXAMPLE_TEMPLATES: ExampleTemplate[] = [
    {
        name: 'Movement System - Position and velocity components',
        description: 'Basic Movement System Example',
        value: 'movement',
    },
    {
        name: 'Health System - Health and regeneration',
        description: 'Health Management System Example',
        value: 'health',
    },
    {
        name: 'Physics - Collision detection and response',
        description: 'Physics System Example',
        value: 'physics',
    },
    {
        name: 'Inventory - Item management system',
        description: 'Inventory Management Example',
        value: 'inventory',
    },
    {
        name: 'Combat - Damage dealing and taking',
        description: 'Combat System Example',
        value: 'combat',
    },
    {
        name: 'Custom - Define your own example',
        description: 'Custom Example',
        value: 'custom',
    },
];

export async function exampleCommand(): Promise<void> {
    console.log('🔧 Example Scaffolding\\n');

    const structure = analyzeProject();

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'template',
            message: 'Select example template:',
            choices: EXAMPLE_TEMPLATES,
            pageSize: EXAMPLE_TEMPLATES.length,
        },
    ]);

    let exampleData: ExampleData;

    if (answers.template === 'custom') {
        exampleData = await createCustomExample();
    } else {
        exampleData = getPrebuiltExample(answers.template);
    }

    const nameAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Example file name:',
            default: `${exampleData.name}-example`,
            validate: (input: string) => {
                try {
                    validateFileName(input);
                    if (structure.existingExamples.includes(input)) {
                        return `Example ${input} already exists`;
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
            name: 'deltaTime',
            message: 'Delta time per update (seconds):',
            default: 1.0,
            validate: (input: number) =>
                input > 0 ? true : 'Delta time must be positive',
        },
        {
            type: 'number',
            name: 'iterations',
            message: 'Number of update iterations:',
            default: 3,
            validate: (input: number) =>
                Number.isInteger(input) && input > 0
                    ? true
                    : 'Iterations must be a positive integer',
        },
    ]);

    // Generate template variables
    const templateVars: ExampleTemplateVars = {
        exampleName: toPascalCase(nameAnswer.name),
        exampleDescription: exampleData.description,
        componentDefinitions: exampleData.componentDefinitions,
        systemDefinitions: exampleData.systemDefinitions,
        systemRegistration: exampleData.systemRegistration,
        entityCreation: exampleData.entityCreation,
        deltaTime: configAnswers.deltaTime,
        iterations: configAnswers.iterations,
        queries: exampleData.queries || '',
    };

    // Create file
    const filePath = join(structure.examplesDir, `${nameAnswer.name}.ts`);
    const content = renderTemplate(EXAMPLE_TEMPLATE, templateVars);

    createFile(filePath, content);

    console.log(`\\n✅ Created example: ${nameAnswer.name}`);
    console.log(`📁 File: ${filePath}`);
    console.log(`🚀 Run with: bun ${filePath}`);
}

async function createCustomExample(): Promise<ExampleData> {
    console.log('\\n📝 Custom Example Configuration:');

    const customAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Example name:',
            validate: (input: string) =>
                input.trim() ? true : 'Name cannot be empty',
        },
        {
            type: 'input',
            name: 'description',
            message: 'Example description:',
            validate: (input: string) =>
                input.trim() ? true : 'Description cannot be empty',
        },
    ]);

    return {
        name: customAnswers.name,
        description: customAnswers.description,
        componentDefinitions: buildCustomComponents(),
        systemDefinitions: buildCustomSystem(customAnswers.name),
        systemRegistration: `    world.addSystem(new ${toPascalCase(customAnswers.name)}System());`,
        entityCreation: buildCustomEntities(),
        queries: buildCustomQueries(),
    };
}

function getPrebuiltExample(templateType: string): ExampleData {
    switch (templateType) {
        case 'movement':
            return {
                name: 'movement',
                description: 'Basic Movement System Example',
                componentDefinitions: `interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface VelocityComponent extends Component {
    readonly type: 'velocity';
    dx: number;
    dy: number;
}`,
                systemDefinitions: `class MovementSystem extends BaseSystem {
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

                console.log(\`Entity \${entityId} moved to (\${position.x.toFixed(2)}, \${position.y.toFixed(2)})\`);
            }
        }
    }
}`,
                systemRegistration:
                    '    world.addSystem(new MovementSystem());',
                entityCreation: `    const player = world.createEntity();
    world.addComponent(player, { type: 'position', x: 0, y: 0 } as PositionComponent);
    world.addComponent(player, { type: 'velocity', dx: 1, dy: 0.5 } as VelocityComponent);

    const enemy = world.createEntity();
    world.addComponent(enemy, { type: 'position', x: 10, y: 5 } as PositionComponent);
    world.addComponent(enemy, { type: 'velocity', dx: -0.5, dy: 1 } as VelocityComponent);`,
                queries: `    // Query examples
    console.log('--- Query Examples ---');
    const movingEntities = world.queryMultiple(['position', 'velocity']);
    console.log(\`Entities with position and velocity: [\${movingEntities.join(', ')}]\`);`,
            };

        case 'health':
            return {
                name: 'health',
                description: 'Health Management System Example',
                componentDefinitions: `interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
    regenerationRate: number;
}`,
                systemDefinitions: `class HealthRegenSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'HealthRegenSystem';

    update(world: World, deltaTime: number): void {
        this.queryWithComponents<HealthComponent>(world, 'health', (entityId, health) => {
            if (health.hp < health.maxHp) {
                health.hp = Math.min(health.maxHp, health.hp + health.regenerationRate * deltaTime);
                console.log(\`Entity \${entityId} regenerated health: \${health.hp}/\${health.maxHp}\`);
            }
        });
    }
}`,
                systemRegistration:
                    '    world.addSystem(new HealthRegenSystem());',
                entityCreation: `    const player = world.createEntity();
    world.addComponent(player, { type: 'health', hp: 80, maxHp: 100, regenerationRate: 10 } as HealthComponent);

    const npc = world.createEntity();
    world.addComponent(npc, { type: 'health', hp: 50, maxHp: 100, regenerationRate: 5 } as HealthComponent);`,
                queries: `    // Query examples
    console.log('--- Query Examples ---');
    const healthQuery = world.query<HealthComponent>('health');
    console.log(\`Entities with health: [\${healthQuery.getEntities().join(', ')}]\`);`,
            };

        default:
            return getPrebuiltExample('movement');
    }
}

function buildCustomComponents(): string {
    return `// TODO: Define your custom components here
// Example:
// interface CustomComponent extends Component {
//     readonly type: 'custom';
//     value: number;
// }`;
}

function buildCustomSystem(name: string): string {
    const systemName = `${toPascalCase(name)}System`;
    return `class ${systemName} extends BaseSystem {
    readonly priority = 1;
    readonly name = '${systemName}';

    update(world: World, deltaTime: number): void {
        // TODO: Implement your custom system logic here
        console.log(\`${systemName} updated with deltaTime: \${deltaTime}\`);
    }
}`;
}

function buildCustomEntities(): string {
    return `    // TODO: Create your custom entities here
    // Example:
    // const entity = world.createEntity();
    // world.addComponent(entity, { type: 'custom', value: 42 });`;
}

function buildCustomQueries(): string {
    return `    // TODO: Add your custom queries here
    // Example:
    // const customEntities = world.query('custom');
    // console.log(\`Custom entities: [\${customEntities.getEntities().join(', ')}]\`);`;
}
