export const EXAMPLE_TEMPLATE = `import { BaseSystem, type Component, World } from '../src/index.ts';

// Define example components for {{exampleName}}
{{componentDefinitions}}

// Define example systems for {{exampleName}}
{{systemDefinitions}}

// Example usage
function run{{exampleName}}(): void {
    console.log('🎮 {{exampleDescription}}\\n');

    // Create a world
    const world = new World();

    // Add systems
{{systemRegistration}}

    // Create example entities
{{entityCreation}}

    console.log(\`Created \${world.getEntityCount()} entities\`);
    console.log('Component types:', world.getComponentTypes());
    console.log('Archetype stats:', world.getArchetypeStats());
    console.log('');

    // Simulate game loop
    const deltaTime = {{deltaTime}};

    for (let i = 0; i < {{iterations}}; i++) {
        console.log(\`--- Update \${i + 1} ---\`);
        world.update(deltaTime);
        console.log('');
    }

{{queries}}

    console.log('\\n🎯 {{exampleName}} example completed successfully!');
}

// Run the example if this file is executed directly
if (import.meta.main) {
    run{{exampleName}}();
}`;

import type { TemplateVars } from '../utils/template-engine.ts';

export interface ExampleTemplateVars extends TemplateVars {
    exampleName: string;
    exampleDescription: string;
    componentDefinitions: string;
    systemDefinitions: string;
    systemRegistration: string;
    entityCreation: string;
    deltaTime: number;
    iterations: number;
    queries: string;
}
