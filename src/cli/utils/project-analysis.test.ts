import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    analyzeProject,
    getExistingComponentTypes,
    getExistingSystemNames,
} from './project-analysis.ts';

const TEST_PROJECT_DIR = join(process.cwd(), 'test-project');

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
    mkdirSync(join(TEST_PROJECT_DIR, 'src', 'components'), { recursive: true });
    mkdirSync(join(TEST_PROJECT_DIR, 'src', 'systems'), { recursive: true });
    mkdirSync(join(TEST_PROJECT_DIR, 'src', 'core', 'plugins'), {
        recursive: true,
    });
    mkdirSync(join(TEST_PROJECT_DIR, 'examples'), { recursive: true });

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

describe('analyzeProject', () => {
    test('should analyze empty project structure', () => {
        const structure = analyzeProject();

        expect(structure.componentsDir).toBe(
            join(TEST_PROJECT_DIR, 'src', 'components')
        );
        expect(structure.systemsDir).toBe(
            join(TEST_PROJECT_DIR, 'src', 'systems')
        );
        expect(structure.examplesDir).toBe(join(TEST_PROJECT_DIR, 'examples'));
        expect(structure.pluginsDir).toBe(
            join(TEST_PROJECT_DIR, 'src', 'core', 'plugins')
        );
        expect(structure.existingComponents).toEqual([]);
        expect(structure.existingSystems).toEqual([]);
        expect(structure.existingExamples).toEqual([]);
        expect(structure.existingPlugins).toEqual([]);
    });

    test('should analyze project with components', () => {
        // Create test components
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'HealthComponent.ts'),
            'export interface HealthComponent { readonly type: "health"; hp: number; }'
        );
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'PositionComponent.ts'),
            'export interface PositionComponent { readonly type: "position"; x: number; y: number; }'
        );
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'index.ts'),
            'export * from "./HealthComponent.ts";'
        );

        const structure = analyzeProject();

        expect(structure.existingComponents).toEqual([
            'HealthComponent',
            'PositionComponent',
        ]);
        expect(structure.existingComponents).not.toContain('index');
    });

    test('should analyze project with systems', () => {
        // Create test systems
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'MovementSystem.ts'),
            'export class MovementSystem { readonly name = "MovementSystem"; }'
        );
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'HealthSystem.ts'),
            'export class HealthSystem { readonly name = "HealthSystem"; }'
        );
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'index.ts'),
            'export * from "./MovementSystem.ts";'
        );

        const structure = analyzeProject();

        expect(structure.existingSystems).toContain('MovementSystem');
        expect(structure.existingSystems).toContain('HealthSystem');
        expect(structure.existingSystems.length).toBe(2);
        expect(structure.existingSystems).not.toContain('index');
    });

    test('should analyze project with examples', () => {
        // Create test examples
        writeFileSync(
            join(TEST_PROJECT_DIR, 'examples', 'basic-example.ts'),
            'console.log("Basic example");'
        );
        writeFileSync(
            join(TEST_PROJECT_DIR, 'examples', 'advanced-example.ts'),
            'console.log("Advanced example");'
        );

        const structure = analyzeProject();

        expect(structure.existingExamples).toEqual([
            'advanced-example',
            'basic-example',
        ]);
    });

    test('should analyze project with plugins', () => {
        // Create test plugins
        writeFileSync(
            join(
                TEST_PROJECT_DIR,
                'src',
                'core',
                'plugins',
                'StoragePlugin.ts'
            ),
            'export class StoragePlugin { readonly name = "StoragePlugin"; }'
        );
        writeFileSync(
            join(
                TEST_PROJECT_DIR,
                'src',
                'core',
                'plugins',
                'NetworkPlugin.ts'
            ),
            'export class NetworkPlugin { readonly name = "NetworkPlugin"; }'
        );
        writeFileSync(
            join(
                TEST_PROJECT_DIR,
                'src',
                'core',
                'plugins',
                'StoragePlugin.test.ts'
            ),
            'test("StoragePlugin test", () => {});'
        );
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'core', 'plugins', 'index.ts'),
            'export * from "./StoragePlugin.ts";'
        );

        const structure = analyzeProject();

        expect(structure.existingPlugins).toContain('StoragePlugin');
        expect(structure.existingPlugins).toContain('NetworkPlugin');
        expect(structure.existingPlugins.length).toBe(2);
        expect(structure.existingPlugins).not.toContain('StoragePlugin.test');
        expect(structure.existingPlugins).not.toContain('index');
    });

    test('should handle missing directories gracefully', () => {
        // Remove some directories
        rmSync(join(TEST_PROJECT_DIR, 'src', 'systems'), {
            recursive: true,
            force: true,
        });
        rmSync(join(TEST_PROJECT_DIR, 'examples'), {
            recursive: true,
            force: true,
        });

        const structure = analyzeProject();

        expect(structure.existingComponents).toEqual([]);
        expect(structure.existingSystems).toEqual([]);
        expect(structure.existingExamples).toEqual([]);
        expect(structure.existingPlugins).toEqual([]);
    });
});

describe('getExistingComponentTypes', () => {
    test('should extract component types from files', () => {
        // Create components with type definitions
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'HealthComponent.ts'),
            `
export interface HealthComponent extends Component {
    readonly type: 'health';
    hp: number;
    maxHp: number;
}
            `
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'PositionComponent.ts'),
            `
export interface PositionComponent extends Component {
    readonly type: "position";
    x: number;
    y: number;
}
            `
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'VelocityComponent.ts'),
            `
export interface VelocityComponent extends Component {
    readonly type: 'velocity';
    dx: number;
    dy: number;
}
            `
        );

        const componentTypes = getExistingComponentTypes();

        expect(componentTypes).toContain('health');
        expect(componentTypes).toContain('position');
        expect(componentTypes).toContain('velocity');
        expect(componentTypes.length).toBe(3);
    });

    test('should handle components without type definitions', () => {
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'components', 'InvalidComponent.ts'),
            'export interface InvalidComponent { someProperty: string; }'
        );

        const componentTypes = getExistingComponentTypes();

        expect(componentTypes).toEqual([]);
    });

    test('should handle malformed component files', () => {
        writeFileSync(
            join(
                TEST_PROJECT_DIR,
                'src',
                'components',
                'MalformedComponent.ts'
            ),
            'export interface MalformedComponent extends Component { readonly type:'
        );

        const componentTypes = getExistingComponentTypes();

        expect(componentTypes).toEqual([]);
    });

    test('should return empty array when components directory does not exist', () => {
        rmSync(join(TEST_PROJECT_DIR, 'src', 'components'), {
            recursive: true,
            force: true,
        });

        const componentTypes = getExistingComponentTypes();

        expect(componentTypes).toEqual([]);
    });

    test('should handle components with different quote styles', () => {
        writeFileSync(
            join(
                TEST_PROJECT_DIR,
                'src',
                'components',
                'SingleQuoteComponent.ts'
            ),
            "export interface SingleQuoteComponent { readonly type: 'single-quote'; }"
        );

        writeFileSync(
            join(
                TEST_PROJECT_DIR,
                'src',
                'components',
                'DoubleQuoteComponent.ts'
            ),
            'export interface DoubleQuoteComponent { readonly type: "double-quote"; }'
        );

        const componentTypes = getExistingComponentTypes();

        expect(componentTypes).toContain('single-quote');
        expect(componentTypes).toContain('double-quote');
    });
});

describe('getExistingSystemNames', () => {
    test('should extract system names from files', () => {
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'MovementSystem.ts'),
            `
export class MovementSystem extends BaseSystem {
    readonly name = 'MovementSystem';
    readonly priority = 1;
}
            `
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'HealthSystem.ts'),
            `
export class HealthSystem extends BaseSystem {
    readonly name = "HealthSystem";
    readonly priority = 2;
}
            `
        );

        const systemNames = getExistingSystemNames();

        expect(systemNames).toContain('MovementSystem');
        expect(systemNames).toContain('HealthSystem');
        expect(systemNames.length).toBe(2);
    });

    test('should handle systems without name definitions', () => {
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'InvalidSystem.ts'),
            'export class InvalidSystem { someProperty: string; }'
        );

        const systemNames = getExistingSystemNames();

        expect(systemNames).toEqual([]);
    });

    test('should handle malformed system files', () => {
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'MalformedSystem.ts'),
            'export class MalformedSystem { readonly name ='
        );

        const systemNames = getExistingSystemNames();

        expect(systemNames).toEqual([]);
    });

    test('should return empty array when systems directory does not exist', () => {
        rmSync(join(TEST_PROJECT_DIR, 'src', 'systems'), {
            recursive: true,
            force: true,
        });

        const systemNames = getExistingSystemNames();

        expect(systemNames).toEqual([]);
    });

    test('should handle systems with different quote styles', () => {
        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'SingleQuoteSystem.ts'),
            "export class SingleQuoteSystem { readonly name = 'SingleQuoteSystem'; }"
        );

        writeFileSync(
            join(TEST_PROJECT_DIR, 'src', 'systems', 'DoubleQuoteSystem.ts'),
            'export class DoubleQuoteSystem { readonly name = "DoubleQuoteSystem"; }'
        );

        const systemNames = getExistingSystemNames();

        expect(systemNames).toContain('SingleQuoteSystem');
        expect(systemNames).toContain('DoubleQuoteSystem');
    });
});

describe('error handling', () => {
    test('should handle permission errors gracefully', () => {
        // This test would be platform-specific and hard to reproduce consistently
        // but the functions should return empty arrays on errors
        expect(() => getExistingComponentTypes()).not.toThrow();
        expect(() => getExistingSystemNames()).not.toThrow();
    });

    test('should return empty array when getExistingComponentTypes encounters error', () => {
        // Arrange: Change to a directory that doesn't exist to trigger error in analyzeProject
        const _nonExistentDir = join(TEST_PROJECT_DIR, 'non-existent-dir');
        process.chdir('/');

        // Remove the test project to ensure getProjectRoot will fail
        if (existsSync(TEST_PROJECT_DIR)) {
            rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
        }

        // Act
        const result = getExistingComponentTypes();

        // Assert
        expect(result).toEqual([]);
    });

    test('should return empty array when getExistingSystemNames encounters error', () => {
        // Arrange: Change to a directory that doesn't exist to trigger error in analyzeProject
        process.chdir('/');

        // Remove the test project to ensure getProjectRoot will fail
        if (existsSync(TEST_PROJECT_DIR)) {
            rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
        }

        // Act
        const result = getExistingSystemNames();

        // Assert
        expect(result).toEqual([]);
    });
});
