import {
    BaseSystem,
    type Component,
    type SceneLifecycleHooks,
    SceneManager,
    type World,
} from '../src/index.ts';

interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface HealthComponent extends Component {
    readonly type: 'health';
    current: number;
    max: number;
}

interface EnemyComponent extends Component {
    readonly type: 'enemy';
    difficulty: number;
}

class RenderSystem extends BaseSystem {
    readonly name = 'RenderSystem';
    readonly priority = 10;

    update(world: World, _deltaTime: number): void {
        const entities = world.queryMultiple(['position']);

        if (entities.length > 0) {
            console.log(`  Rendering ${entities.length} entities`);

            for (const entityId of entities.slice(0, 3)) {
                const pos = world.getComponent<PositionComponent>(
                    entityId,
                    'position'
                );
                if (pos) {
                    console.log(
                        `    - Entity ${entityId} at (${pos.x}, ${pos.y})`
                    );
                }
            }
        }
    }
}

class GameLogicSystem extends BaseSystem {
    readonly name = 'GameLogicSystem';
    readonly priority = 5;

    update(world: World, _deltaTime: number): void {
        const enemies = world.queryMultiple(['enemy', 'health']);

        if (enemies.length > 0) {
            console.log(`  Processing ${enemies.length} enemies`);
        }
    }
}

const createMainMenuScene = (): SceneLifecycleHooks => ({
    onLoad: async (world: World) => {
        console.log('  Loading main menu assets...');
        await new Promise((resolve) => setTimeout(resolve, 500));

        world.addSystem(new RenderSystem());

        const titleEntity = world.createEntity();
        world.addComponent<PositionComponent>(titleEntity, {
            type: 'position',
            x: 400,
            y: 100,
        });

        console.log('  Main menu loaded!');
    },
    onEnter: async () => {
        console.log('  Entering main menu...');
    },
    onExit: async () => {
        console.log('  Exiting main menu...');
    },
    onUnload: async () => {
        console.log('  Unloading main menu...');
    },
});

const createGameScene = (): SceneLifecycleHooks => ({
    onLoad: async (world: World) => {
        console.log('  Loading game level...');
        await new Promise((resolve) => setTimeout(resolve, 800));

        world.addSystem(new RenderSystem());
        world.addSystem(new GameLogicSystem());

        const player = world.createEntity();
        world.addComponent<PositionComponent>(player, {
            type: 'position',
            x: 100,
            y: 100,
        });
        world.addComponent<HealthComponent>(player, {
            type: 'health',
            current: 100,
            max: 100,
        });

        for (let i = 0; i < 5; i++) {
            const enemy = world.createEntity();
            world.addComponent<PositionComponent>(enemy, {
                type: 'position',
                x: 200 + i * 50,
                y: 300,
            });
            world.addComponent<EnemyComponent>(enemy, {
                type: 'enemy',
                difficulty: 1 + i,
            });
            world.addComponent<HealthComponent>(enemy, {
                type: 'health',
                current: 50,
                max: 50,
            });
        }

        console.log('  Game level loaded!');
    },
    onEnter: async () => {
        console.log('  Starting game...');
    },
    onExit: async () => {
        console.log('  Pausing game...');
    },
    onPause: async () => {
        console.log('  Game paused');
    },
    onResume: async () => {
        console.log('  Game resumed');
    },
    onUnload: async () => {
        console.log('  Unloading game level...');
    },
});

const createPauseMenuScene = (): SceneLifecycleHooks => ({
    onLoad: async (world: World) => {
        console.log('  Loading pause menu...');
        await new Promise((resolve) => setTimeout(resolve, 200));

        world.addSystem(new RenderSystem());

        const menuEntity = world.createEntity();
        world.addComponent<PositionComponent>(menuEntity, {
            type: 'position',
            x: 400,
            y: 300,
        });

        console.log('  Pause menu loaded!');
    },
    onEnter: async () => {
        console.log('  Showing pause menu...');
    },
    onExit: async () => {
        console.log('  Hiding pause menu...');
    },
});

async function main() {
    console.log('=== Scene Management Example ===\n');

    const sceneManager = new SceneManager({
        defaultTransition: {
            duration: 300,
            callbacks: {
                onFadeOut: async (progress) => {
                    if (progress === 0) {
                        console.log('  [Transition] Fading out...');
                    }
                },
                onTransition: async () => {
                    console.log('  [Transition] Switching scenes...');
                },
                onFadeIn: async (progress) => {
                    if (progress === 0) {
                        console.log('  [Transition] Fading in...');
                    }
                },
            },
        },
    });

    sceneManager.onLoadProgress((sceneName, progress, message) => {
        if (progress % 20 === 0 || progress === 100) {
            console.log(
                `  [Loading] ${sceneName}: ${progress.toFixed(0)}% ${message || ''}`
            );
        }
    });

    console.log('1. Registering scenes...\n');
    sceneManager.registerScene({
        name: 'MainMenu',
        lifecycle: createMainMenuScene(),
    });

    sceneManager.registerScene({
        name: 'Game',
        lifecycle: createGameScene(),
        persistent: true,
    });

    sceneManager.registerScene({
        name: 'PauseMenu',
        lifecycle: createPauseMenuScene(),
        preload: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    console.log('\n2. Switching to Main Menu...\n');
    await sceneManager.switchTo('MainMenu');

    console.log('\n3. Running main menu for 2 frames...\n');
    sceneManager.update(16);
    sceneManager.update(16);

    console.log('\n4. Starting game (switching to Game scene)...\n');
    await sceneManager.switchTo('Game');

    console.log('\n5. Running game for 2 frames...\n');
    sceneManager.update(16);
    sceneManager.update(16);

    console.log('\n6. Opening pause menu...\n');
    await sceneManager.pauseActiveScene();
    await sceneManager.switchTo('PauseMenu');

    console.log('\n7. Running pause menu for 1 frame...\n');
    sceneManager.update(16);

    console.log('\n8. Returning to game...\n');
    await sceneManager.switchTo('Game');
    await sceneManager.resumeActiveScene();

    console.log('\n9. Running game for 2 more frames...\n');
    sceneManager.update(16);
    sceneManager.update(16);

    console.log('\n10. Checking scene manager stats...\n');
    const stats = sceneManager.getStats();
    console.log('  Scene Stats:');
    console.log(`    - Total scenes: ${stats.totalScenes}`);
    console.log(`    - Loaded scenes: ${stats.loadedScenes}`);
    console.log(`    - Active scene: ${stats.activeScene}`);
    console.log(
        `    - Preloaded scenes: ${stats.preloadedScenes.join(', ') || 'none'}`
    );

    console.log('\n11. Preloading multiple scenes for next level...\n');
    sceneManager.registerScene({
        name: 'Level2',
        lifecycle: {
            onLoad: async (world) => {
                console.log('  Loading Level 2...');
                await new Promise((resolve) => setTimeout(resolve, 400));
                world.addSystem(new RenderSystem());
            },
        },
    });

    sceneManager.registerScene({
        name: 'Level3',
        lifecycle: {
            onLoad: async (world) => {
                console.log('  Loading Level 3...');
                await new Promise((resolve) => setTimeout(resolve, 400));
                world.addSystem(new RenderSystem());
            },
        },
    });

    await sceneManager.preloadScenes(['Level2', 'Level3']);

    console.log('\n12. Unloading inactive scenes (except persistent)...\n');
    await sceneManager.unloadInactiveScenes();

    const finalStats = sceneManager.getStats();
    console.log('  Final Scene Stats:');
    console.log(`    - Loaded scenes: ${finalStats.loadedScenes}`);
    console.log(`    - Active scene: ${finalStats.activeScene}`);

    console.log('\n13. Shutting down scene manager...\n');
    await sceneManager.shutdown();

    console.log('=== Example Complete ===');
}

main().catch(console.error);
