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
    COMPONENT_TEMPLATE,
    COMPONENT_TEST_TEMPLATE,
} from '../templates/component.template.ts';
import { renderTemplate } from '../utils/template-engine.ts';

const TEST_PROJECT_DIR = join(process.cwd(), 'test-component-scaffold');

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

describe('Component Template Generation', () => {
    test('should generate basic component template', () => {
        const templateVars = {
            componentName: 'HealthComponent',
            componentType: 'health',
            componentFile: 'HealthComponent',
            properties: '\n    hp: number;\n    maxHp: number;',
            factoryParams: 'hp: number, maxHp: number',
            factoryBody: '\n        hp,\n        maxHp,',
            testParams: '100, 100',
            testAssertions:
                '\n        expect(component.hp).toBe(100);\n        expect(component.maxHp).toBe(100);',
        };

        const result = renderTemplate(COMPONENT_TEMPLATE, templateVars);

        expect(result).toContain('interface HealthComponent extends Component');
        expect(result).toContain("readonly type: 'health';");
        expect(result).toContain('hp: number;');
        expect(result).toContain('maxHp: number;');
        expect(result).toContain(
            'function createHealthComponent(hp: number, maxHp: number)'
        );
        expect(result).toContain(
            "return {\n        type: 'health',\n        hp,\n        maxHp,\n    };"
        );
    });

    test('should generate component template without properties', () => {
        const templateVars = {
            componentName: 'TagComponent',
            componentType: 'tag',
            componentFile: 'TagComponent',
            properties: '',
            factoryParams: '',
            factoryBody: '',
            testParams: '',
            testAssertions: '',
        };

        const result = renderTemplate(COMPONENT_TEMPLATE, templateVars);

        expect(result).toContain('interface TagComponent extends Component');
        expect(result).toContain("readonly type: 'tag';");
        expect(result).toContain('function createTagComponent(): TagComponent');
        expect(result).toContain("return {\n        type: 'tag',\n    };");
    });

    test('should generate component template with optional properties', () => {
        const templateVars = {
            componentName: 'PositionComponent',
            componentType: 'position',
            componentFile: 'PositionComponent',
            properties: '\n    x: number;\n    y: number;\n    z?: number;',
            factoryParams: 'x: number, y: number, z?: number',
            factoryBody:
                '\n        x,\n        y,\n        ...(z !== undefined && { z }),',
            testParams: '10, 20',
            testAssertions:
                '\n        expect(component.x).toBe(10);\n        expect(component.y).toBe(20);',
        };

        const result = renderTemplate(COMPONENT_TEMPLATE, templateVars);

        expect(result).toContain('x: number;');
        expect(result).toContain('y: number;');
        expect(result).toContain('z?: number;');
        expect(result).toContain('x: number, y: number, z?: number');
        expect(result).toContain('...(z !== undefined && { z })');
    });

    test('should generate test template', () => {
        const templateVars = {
            componentName: 'HealthComponent',
            componentType: 'health',
            componentFile: 'HealthComponent',
            properties: '\n    hp: number;\n    maxHp: number;',
            factoryParams: 'hp: number, maxHp: number',
            factoryBody: '\n        hp,\n        maxHp,',
            testParams: '100, 100',
            testAssertions:
                '\n        expect(component.hp).toBe(100);\n        expect(component.maxHp).toBe(100);',
        };

        const result = renderTemplate(COMPONENT_TEST_TEMPLATE, templateVars);

        expect(result).toContain(
            "import { HealthComponent, createHealthComponent } from './HealthComponent.ts';"
        );
        expect(result).toContain("describe('HealthComponent', () => {");
        expect(result).toContain(
            'const component = createHealthComponent(100, 100);'
        );
        expect(result).toContain("expect(component.type).toBe('health');");
        expect(result).toContain('expect(component.hp).toBe(100);');
        expect(result).toContain('expect(component.maxHp).toBe(100);');
        expect(result).toContain("expect(component).toHaveProperty('type');");
    });
});

describe('Component Code Generation Integration', () => {
    test('should generate valid TypeScript component code', () => {
        const componentCode = renderTemplate(COMPONENT_TEMPLATE, {
            componentName: 'HealthComponent',
            componentType: 'health',
            componentFile: 'HealthComponent',
            properties: '\n    hp: number;\n    maxHp: number;',
            factoryParams: 'hp: number, maxHp: number',
            factoryBody: '\n        hp,\n        maxHp,',
            testParams: '',
            testAssertions: '',
        });

        // Write to file and verify it's valid
        const componentPath = join(
            TEST_PROJECT_DIR,
            'src',
            'components',
            'HealthComponent.ts'
        );
        writeFileSync(componentPath, componentCode);

        expect(existsSync(componentPath)).toBe(true);

        const content = readFileSync(componentPath, 'utf-8');
        expect(content).toContain('import type { Component }');
        expect(content).toContain('export interface HealthComponent');
        expect(content).toContain('export function createHealthComponent');

        // Check that generated code follows expected patterns
        expect(content).toMatch(/interface \w+Component extends Component/);
        expect(content).toMatch(/readonly type: '[^']+'/);
        expect(content).toMatch(/function create\w+Component/);
    });

    test('should generate valid TypeScript test code', () => {
        const testCode = renderTemplate(COMPONENT_TEST_TEMPLATE, {
            componentName: 'HealthComponent',
            componentType: 'health',
            componentFile: 'HealthComponent',
            properties: '\n    hp: number;\n    maxHp: number;',
            factoryParams: 'hp: number, maxHp: number',
            factoryBody: '\n        hp,\n        maxHp,',
            testParams: '100, 100',
            testAssertions:
                '\n        expect(component.hp).toBe(100);\n        expect(component.maxHp).toBe(100);',
        });

        const testPath = join(
            TEST_PROJECT_DIR,
            'src',
            'components',
            'HealthComponent.test.ts'
        );
        writeFileSync(testPath, testCode);

        expect(existsSync(testPath)).toBe(true);

        const content = readFileSync(testPath, 'utf-8');
        expect(content).toContain('import { test, expect, describe }');
        expect(content).toContain("describe('HealthComponent'");
        expect(content).toMatch(/test\('should create .+ with correct type'/);
        expect(content).toMatch(/test\('should follow Component interface'/);
    });

    test('should handle complex component with multiple property types', () => {
        const componentCode = renderTemplate(COMPONENT_TEMPLATE, {
            componentName: 'ComplexComponent',
            componentType: 'complex',
            componentFile: 'ComplexComponent',
            properties: `
    name: string;
    count: number;
    active: boolean;
    tags: string[];
    position: { x: number; y: number };
    optionalValue?: number;`,
            factoryParams:
                'name: string, count: number, active: boolean, tags: string[], position: { x: number; y: number }, optionalValue?: number',
            factoryBody: `
        name,
        count,
        active,
        tags,
        position,
        ...(optionalValue !== undefined && { optionalValue }),`,
            testParams: "'test', 42, true, ['tag1'], { x: 10, y: 20 }",
            testAssertions: `
        expect(component.name).toBe('test');
        expect(component.count).toBe(42);
        expect(component.active).toBe(true);`,
        });

        expect(componentCode).toContain('name: string;');
        expect(componentCode).toContain('count: number;');
        expect(componentCode).toContain('active: boolean;');
        expect(componentCode).toContain('tags: string[];');
        expect(componentCode).toContain('position: { x: number; y: number };');
        expect(componentCode).toContain('optionalValue?: number;');
        expect(componentCode).toContain(
            '...(optionalValue !== undefined && { optionalValue })'
        );
    });
});

describe('Template Validation', () => {
    test('should ensure all template variables are handled', () => {
        const minimalVars = {
            componentName: 'TestComponent',
            componentType: 'test',
            componentFile: 'TestComponent',
            properties: '',
            factoryParams: '',
            factoryBody: '',
            testParams: '',
            testAssertions: '',
        };

        // Should not throw errors with minimal variables
        expect(() =>
            renderTemplate(COMPONENT_TEMPLATE, minimalVars)
        ).not.toThrow();
        expect(() =>
            renderTemplate(COMPONENT_TEST_TEMPLATE, minimalVars)
        ).not.toThrow();
    });

    test('should generate consistent naming patterns', () => {
        const templateVars = {
            componentName: 'MyCustomComponent',
            componentType: 'my-custom',
            componentFile: 'MyCustomComponent',
            properties: '',
            factoryParams: '',
            factoryBody: '',
            testParams: '',
            testAssertions: '',
        };

        const componentCode = renderTemplate(COMPONENT_TEMPLATE, templateVars);
        const testCode = renderTemplate(COMPONENT_TEST_TEMPLATE, templateVars);

        // Component file should use consistent naming
        expect(componentCode).toContain('interface MyCustomComponent');
        expect(componentCode).toContain('function createMyCustomComponent');
        expect(componentCode).toContain("readonly type: 'my-custom'");

        // Test file should reference the same names
        expect(testCode).toContain(
            'import { MyCustomComponent, createMyCustomComponent }'
        );
        expect(testCode).toContain("expect(component.type).toBe('my-custom')");
        expect(testCode).toContain("describe('MyCustomComponent'");
    });
});
