export const COMPONENT_TEMPLATE = `import type { Component } from '../core/ecs/Component.ts';

export interface {{componentName}} extends Component {
    readonly type: '{{componentType}}';{{properties}}
}

export function create{{componentName}}({{factoryParams}}): {{componentName}} {
    return {
        type: '{{componentType}}',{{factoryBody}}
    };
}`;

export const COMPONENT_TEST_TEMPLATE = `import { test, expect, describe } from 'bun:test';
import { {{componentName}}, create{{componentName}} } from './{{componentFile}}.ts';

describe('{{componentName}}', () => {
    test('should create {{componentName}} with correct type', () => {
        const component = create{{componentName}}({{testParams}});

        expect(component.type).toBe('{{componentType}}');{{testAssertions}}
    });

    test('should follow Component interface', () => {
        const component = create{{componentName}}({{testParams}});

        expect(component).toHaveProperty('type');
        expect(typeof component.type).toBe('string');
    });
});`;

import type { TemplateVars } from '../utils/template-engine.ts';

export interface ComponentTemplateVars extends TemplateVars {
    componentName: string;
    componentType: string;
    componentFile: string;
    properties?: string;
    factoryParams?: string;
    factoryBody?: string;
    testParams?: string;
    testAssertions?: string;
}
