export const SYSTEM_TEMPLATE = `import { BaseSystem } from '../core/ecs/System.ts';
import type { World } from '../core/ecs/World.ts';{{imports}}

export class {{systemName}} extends BaseSystem {
    readonly priority = {{priority}};
    readonly name = '{{systemName}}';{{dependencies}}

    initialize?(world: World): void {
        // Optional: Add initialization logic here
    }

    update(world: World, deltaTime: number): void {{updateBody}}
    }

    shutdown?(world: World): void {
        // Optional: Add cleanup logic here
    }
}`;

export const SYSTEM_TEST_TEMPLATE = `import { test, expect, describe } from 'bun:test';
import { World } from '../core/ecs/World.ts';
import { {{systemName}} } from './{{systemFile}}.ts';{{testImports}}

describe('{{systemName}}', () => {
    test('should have correct priority and name', () => {
        const system = new {{systemName}}();

        expect(system.priority).toBe({{priority}});
        expect(system.name).toBe('{{systemName}}');
    });

    test('should update without errors', () => {
        const world = new World();
        const system = new {{systemName}}();

        expect(() => {
            system.update(world, 1.0);
        }).not.toThrow();
    });{{testMethods}}
});`;

import type { TemplateVars } from '../utils/template-engine.ts';

export interface SystemTemplateVars extends TemplateVars {
    systemName: string;
    systemFile: string;
    priority: number;
    imports?: string;
    dependencies?: string;
    updateBody: string;
    testImports?: string;
    testMethods?: string;
}
