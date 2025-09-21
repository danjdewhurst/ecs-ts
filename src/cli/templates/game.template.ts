export const GAME_TEMPLATE = `import { BaseSystem, type Component, World } from '../src/index.ts';

// Game: {{gameName}} - {{gameDescription}}

{{componentDefinitions}}

{{systemDefinitions}}

class {{gameName}}Game {
    private world: World;
    private lastTime: number = 0;
    private running: boolean = false;

    constructor() {
        this.world = new World();
        this.setupSystems();
        this.setupEntities();
    }

    private setupSystems(): void {
{{systemSetup}}
    }

    private setupEntities(): void {
        console.log('🎮 Setting up game entities...');
{{entitySetup}}
        console.log(\`✅ Created \${this.world.getEntityCount()} entities\`);
    }

    start(): void {
        console.log('🚀 Starting {{gameName}}...\\n');
        this.running = true;
        this.lastTime = Date.now();
        this.gameLoop();
    }

    stop(): void {
        console.log('\\n⏹️ Stopping {{gameName}}...');
        this.running = false;
    }

    private gameLoop(): void {
        if (!this.running) return;

        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Update game world
        this.world.update(deltaTime);

        // Schedule next frame
        setTimeout(() => this.gameLoop(), {{frameDelay}});
    }

    getWorld(): World {
        return this.world;
    }
}

// Example usage
function main(): void {
    console.log('🎮 {{gameName}} - {{gameDescription}}\\n');

    const game = new {{gameName}}Game();

    // Show initial state
    console.log('📊 Initial Game State:');
    console.log('Component types:', game.getWorld().getComponentTypes());
    console.log('Archetype stats:', game.getWorld().getArchetypeStats());
    console.log('');

    // Start the game
    game.start();

    // Stop the game after {{duration}} seconds
    setTimeout(() => {
        game.stop();
        console.log('\\n🎯 {{gameName}} demo completed!');
        process.exit(0);
    }, {{duration}} * 1000);
}

// Run the game if this file is executed directly
if (import.meta.main) {
    main();
}`;

import type { TemplateVars } from '../utils/template-engine.ts';

export interface GameTemplateVars extends TemplateVars {
    gameName: string;
    gameDescription: string;
    componentDefinitions: string;
    systemDefinitions: string;
    systemSetup: string;
    entitySetup: string;
    frameDelay: number;
    duration: number;
}
