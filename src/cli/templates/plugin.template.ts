export const PLUGIN_TEMPLATE = `import type { Plugin } from './Plugin.ts';
import type { World } from '../ecs/World.ts';{{imports}}

export class {{pluginName}} implements Plugin {
    readonly name = '{{pluginName}}';
    readonly version = '{{version}}';{{dependencies}}

    private world?: World;{{privateFields}}

    initialize(world: World): void {
        console.log(\`Initializing \${this.name} v\${this.version}...\`);
        this.world = world;{{initializeBody}}
        console.log(\`✅ \${this.name} initialized successfully\`);
    }

    shutdown(): void {
        console.log(\`Shutting down \${this.name}...\`);{{shutdownBody}}
        this.world = undefined;
        console.log(\`✅ \${this.name} shutdown successfully\`);
    }{{customMethods}}
}`;

export const PLUGIN_TEST_TEMPLATE = `import { test, expect, describe } from 'bun:test';
import { World } from '../ecs/World.ts';
import { {{pluginName}} } from './{{pluginFile}}.ts';{{testImports}}

describe('{{pluginName}}', () => {
    test('should have correct name and version', () => {
        const plugin = new {{pluginName}}();

        expect(plugin.name).toBe('{{pluginName}}');
        expect(plugin.version).toBe('{{version}}');
    });

    test('should initialize and shutdown without errors', () => {
        const world = new World();
        const plugin = new {{pluginName}}();

        expect(() => {
            plugin.initialize(world);
        }).not.toThrow();

        expect(() => {
            plugin.shutdown();
        }).not.toThrow();
    });{{testMethods}}
});`;

import type { TemplateVars } from '../utils/template-engine.ts';

export interface PluginTemplateVars extends TemplateVars {
    pluginName: string;
    pluginFile: string;
    version: string;
    imports?: string;
    dependencies?: string;
    privateFields?: string;
    initializeBody: string;
    shutdownBody: string;
    customMethods?: string;
    testImports?: string;
    testMethods?: string;
}
