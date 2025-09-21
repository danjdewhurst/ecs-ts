import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
    SYSTEM_TEMPLATE,
    SYSTEM_TEST_TEMPLATE,
} from '../templates/system.template.ts';
import { renderTemplate } from '../utils/template-engine.ts';

const TEST_PROJECT_DIR = join(process.cwd(), 'test-system-scaffold');

beforeEach(() => {
    // Clean up test project directory
    if (existsSync(TEST_PROJECT_DIR)) {
        rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }

    // Create a mock project structure
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });

    // Create package.json to make it a valid project root
    writeFileSync(
        join(TEST_PROJECT_DIR, 'package.json'),
        JSON.stringify({ name: 'test-project' })
    );

    // Set up the directory structure
    mkdirSync(join(TEST_PROJECT_DIR, 'src', 'systems'), { recursive: true });
    mkdirSync(join(TEST_PROJECT_DIR, 'src', 'components'), { recursive: true });

    // Change to test project directory
    process.chdir(TEST_PROJECT_DIR);
});

afterEach(() => {
    // Change back to original directory
    process.chdir(join(TEST_PROJECT_DIR, '..'));

    // Clean up test project directory
    if (existsSync(TEST_PROJECT_DIR)) {
        rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
});

describe('System Template Generation', () => {
    test('should generate basic system template', () => {
        const templateVars = {
            systemName: 'MovementSystem',
            systemFile: 'MovementSystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody:
                '{\n        // TODO: Implement movement logic here\n    ',
            testImports: '',
            testMethods: '',
        };

        const result = renderTemplate(SYSTEM_TEMPLATE, templateVars);

        expect(result).toContain(
            'export class MovementSystem extends BaseSystem'
        );
        expect(result).toContain('readonly priority = 1;');
        expect(result).toContain("readonly name = 'MovementSystem';");
        expect(result).toContain(
            'update(world: World, deltaTime: number): void {'
        );
        expect(result).toContain('// TODO: Implement movement logic here');
        expect(result).toContain('initialize?(world: World): void');
        expect(result).toContain('shutdown?(world: World): void');
    });

    test('should generate system template with dependencies', () => {
        const templateVars = {
            systemName: 'CombatSystem',
            systemFile: 'CombatSystem',
            priority: 2,
            imports: '',
            dependencies:
                "\n    readonly dependencies = ['MovementSystem', 'HealthSystem'];",
            updateBody: '\n        // TODO: Implement combat logic here',
            testImports: '',
            testMethods: '',
        };

        const result = renderTemplate(SYSTEM_TEMPLATE, templateVars);

        expect(result).toContain(
            'export class CombatSystem extends BaseSystem'
        );
        expect(result).toContain('readonly priority = 2;');
        expect(result).toContain(
            "readonly dependencies = ['MovementSystem', 'HealthSystem'];"
        );
    });

    test('should generate system template with component imports', () => {
        const templateVars = {
            systemName: 'HealthSystem',
            systemFile: 'HealthSystem',
            priority: 1,
            imports:
                "\nimport type { HealthComponent, PositionComponent } from '../components/index.ts';",
            dependencies: '',
            updateBody: `
        // Query entities with health component
        this.queryWithComponents<HealthComponent>(world, 'health', (entityId, health) => {
            // TODO: Implement health logic
        });`,
            testImports: '',
            testMethods: '',
        };

        const result = renderTemplate(SYSTEM_TEMPLATE, templateVars);

        expect(result).toContain(
            "import type { HealthComponent, PositionComponent } from '../components/index.ts';"
        );
        expect(result).toContain('this.queryWithComponents<HealthComponent>');
    });

    test('should generate system template with complex update body', () => {
        const templateVars = {
            systemName: 'MovementSystem',
            systemFile: 'MovementSystem',
            priority: 1,
            imports:
                "\nimport type { PositionComponent, VelocityComponent } from '../components/index.ts';",
            dependencies: '',
            updateBody: `
        // Query entities with position, velocity components
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

            // TODO: Implement logic for entities with position, velocity
        }`,
            testImports: '',
            testMethods: '',
        };

        const result = renderTemplate(SYSTEM_TEMPLATE, templateVars);

        expect(result).toContain('const entities = this.queryEntities(world');
        expect(result).toContain('for (const entityId of entities)');
        expect(result).toContain('world.getComponent<PositionComponent>');
        expect(result).toContain('world.getComponent<VelocityComponent>');
    });

    test('should generate test template', () => {
        const templateVars = {
            systemName: 'MovementSystem',
            systemFile: 'MovementSystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody: '',
            testImports:
                "\nimport { PositionComponent, VelocityComponent, createPositionComponent, createVelocityComponent } from '../components/index.ts';",
            testMethods: `

    test('should process entities correctly', () => {
        const world = new World();
        const system = new MovementSystem();

        // Create test entity
        const entity = world.createEntity();

        world.addComponent(entity, createPositionComponent(/* add test parameters */));
        world.addComponent(entity, createVelocityComponent(/* add test parameters */));

        expect(() => {
            system.update(world, 1.0);
        }).not.toThrow();
    });`,
        };

        const result = renderTemplate(SYSTEM_TEST_TEMPLATE, templateVars);

        expect(result).toContain(
            "import { MovementSystem } from './MovementSystem.ts';"
        );
        expect(result).toContain("describe('MovementSystem', () => {");
        expect(result).toContain('expect(system.priority).toBe(1);');
        expect(result).toContain("expect(system.name).toBe('MovementSystem');");
        expect(result).toContain('should process entities correctly');
        expect(result).toContain(
            'world.addComponent(entity, createPositionComponent'
        );
    });
});

describe('System Code Generation Integration', () => {
    test('should generate valid TypeScript system code', () => {
        const systemCode = renderTemplate(SYSTEM_TEMPLATE, {
            systemName: 'TestSystem',
            systemFile: 'TestSystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody: '\n        console.log("Test system update");',
            testImports: '',
            testMethods: '',
        });

        // Write to file and verify it's valid
        const systemPath = join(
            TEST_PROJECT_DIR,
            'src',
            'systems',
            'TestSystem.ts'
        );
        writeFileSync(systemPath, systemCode);

        expect(existsSync(systemPath)).toBe(true);

        const content = readFileSync(systemPath, 'utf-8');
        expect(content).toContain('import { BaseSystem }');
        expect(content).toContain('export class TestSystem extends BaseSystem');
        expect(content).toContain('readonly priority = 1;');
        expect(content).toContain("readonly name = 'TestSystem';");

        // Check that generated code follows expected patterns
        expect(content).toMatch(/class \w+System extends BaseSystem/);
        expect(content).toMatch(/readonly priority = \d+;/);
        expect(content).toMatch(/readonly name = '[^']+';/);
        expect(content).toMatch(
            /update\(world: World, deltaTime: number\): void/
        );
    });

    test('should generate valid TypeScript test code', () => {
        const testCode = renderTemplate(SYSTEM_TEST_TEMPLATE, {
            systemName: 'TestSystem',
            systemFile: 'TestSystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody: '',
            testImports: '',
            testMethods: '',
        });

        const testPath = join(
            TEST_PROJECT_DIR,
            'src',
            'systems',
            'TestSystem.test.ts'
        );
        writeFileSync(testPath, testCode);

        expect(existsSync(testPath)).toBe(true);

        const content = readFileSync(testPath, 'utf-8');
        expect(content).toContain('import { test, expect, describe }');
        expect(content).toContain('import { World }');
        expect(content).toContain('import { TestSystem }');
        expect(content).toMatch(/describe\('TestSystem'/);
        expect(content).toMatch(
            /test\('should have correct priority and name'/
        );
        expect(content).toMatch(/test\('should update without errors'/);
    });

    test('should handle system with complex component queries', () => {
        const systemCode = renderTemplate(SYSTEM_TEMPLATE, {
            systemName: 'ComplexSystem',
            systemFile: 'ComplexSystem',
            priority: 2,
            imports:
                "\nimport type { HealthComponent, PositionComponent, VelocityComponent } from '../components/index.ts';",
            dependencies: "\n    readonly dependencies = ['MovementSystem'];",
            updateBody: `
        // Query entities with health component
        this.queryWithComponents<HealthComponent>(world, 'health', (entityId, health) => {
            // TODO: Implement logic for health component
        });

        // Query entities with position, velocity components
        const entities = this.queryEntities(world, 'position', 'velocity');

        for (const entityId of entities) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

            // TODO: Implement logic for entities with position, velocity
        }`,
            testImports: '',
            testMethods: '',
        });

        expect(systemCode).toContain(
            'import type { HealthComponent, PositionComponent, VelocityComponent }'
        );
        expect(systemCode).toContain(
            "readonly dependencies = ['MovementSystem'];"
        );
        expect(systemCode).toContain(
            'this.queryWithComponents<HealthComponent>'
        );
        expect(systemCode).toContain(
            "this.queryEntities(world, 'position', 'velocity')"
        );
        expect(systemCode).toContain('world.getComponent<PositionComponent>');
        expect(systemCode).toContain('world.getComponent<VelocityComponent>');
    });

    test('should generate system with comprehensive test methods', () => {
        const testCode = renderTemplate(SYSTEM_TEST_TEMPLATE, {
            systemName: 'MovementSystem',
            systemFile: 'MovementSystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody: '',
            testImports:
                "\nimport { PositionComponent, VelocityComponent, createPositionComponent, createVelocityComponent } from '../components/index.ts';",
            testMethods: `

    test('should process entities correctly', () => {
        const world = new World();
        const system = new MovementSystem();

        // Create test entity
        const entity = world.createEntity();

        world.addComponent(entity, createPositionComponent(0, 0));
        world.addComponent(entity, createVelocityComponent(1, 1));

        expect(() => {
            system.update(world, 1.0);
        }).not.toThrow();

        // Additional test logic here
        const position = world.getComponent(entity, 'position');
        expect(position).toBeDefined();
    });`,
        });

        expect(testCode).toContain('should process entities correctly');
        expect(testCode).toContain(
            'world.addComponent(entity, createPositionComponent(0, 0));'
        );
        expect(testCode).toContain(
            'world.addComponent(entity, createVelocityComponent(1, 1));'
        );
        expect(testCode).toContain('expect(position).toBeDefined();');
    });
});

describe('Template Validation', () => {
    test('should ensure all template variables are handled', () => {
        const minimalVars = {
            systemName: 'TestSystem',
            systemFile: 'TestSystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody: '',
            testImports: '',
            testMethods: '',
        };

        // Should not throw errors with minimal variables
        expect(() =>
            renderTemplate(SYSTEM_TEMPLATE, minimalVars)
        ).not.toThrow();
        expect(() =>
            renderTemplate(SYSTEM_TEST_TEMPLATE, minimalVars)
        ).not.toThrow();
    });

    test('should generate consistent naming patterns', () => {
        const templateVars = {
            systemName: 'MyCustomSystem',
            systemFile: 'MyCustomSystem',
            priority: 3,
            imports: '',
            dependencies: '',
            updateBody: '',
            testImports: '',
            testMethods: '',
        };

        const systemCode = renderTemplate(SYSTEM_TEMPLATE, templateVars);
        const testCode = renderTemplate(SYSTEM_TEST_TEMPLATE, templateVars);

        // System file should use consistent naming
        expect(systemCode).toContain('class MyCustomSystem extends BaseSystem');
        expect(systemCode).toContain("readonly name = 'MyCustomSystem';");
        expect(systemCode).toContain('readonly priority = 3;');

        // Test file should reference the same names
        expect(testCode).toContain('import { MyCustomSystem }');
        expect(testCode).toContain(
            "expect(system.name).toBe('MyCustomSystem');"
        );
        expect(testCode).toContain('expect(system.priority).toBe(3);');
        expect(testCode).toContain("describe('MyCustomSystem'");
    });

    test('should handle various priority values', () => {
        const priorities = [1, 10, 100, 999];

        priorities.forEach((priority) => {
            const systemCode = renderTemplate(SYSTEM_TEMPLATE, {
                systemName: 'TestSystem',
                systemFile: 'TestSystem',
                priority,
                imports: '',
                dependencies: '',
                updateBody: '',
                testImports: '',
                testMethods: '',
            });

            expect(systemCode).toContain(`readonly priority = ${priority};`);
        });
    });

    test('should handle empty update body gracefully', () => {
        const systemCode = renderTemplate(SYSTEM_TEMPLATE, {
            systemName: 'EmptySystem',
            systemFile: 'EmptySystem',
            priority: 1,
            imports: '',
            dependencies: '',
            updateBody: '{\n    ',
            testImports: '',
            testMethods: '',
        });

        expect(systemCode).toContain(
            'update(world: World, deltaTime: number): void {'
        );
        expect(systemCode).toContain('}');
    });
});
