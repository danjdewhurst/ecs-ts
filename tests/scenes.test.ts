import { describe, expect, test, beforeEach } from 'bun:test';
import {
    Scene,
    SceneState,
    SceneManager,
    SceneTransition,
    TransitionPhase,
    type SceneLifecycleHooks,
    type TransitionCallbacks,
} from '../src/index.ts';

describe('Scene', () => {
    test('should initialize with unloaded state', () => {
        const scene = new Scene({ name: 'TestScene' });

        expect(scene.getState()).toBe(SceneState.UNLOADED);
        expect(scene.isLoaded()).toBe(false);
        expect(scene.isActive()).toBe(false);
    });

    test('should generate unique ID if not provided', () => {
        const scene1 = new Scene({ name: 'Scene1' });
        const scene2 = new Scene({ name: 'Scene2' });

        expect(scene1.id).toBeDefined();
        expect(scene2.id).toBeDefined();
        expect(scene1.id).not.toBe(scene2.id);
    });

    test('should use provided ID', () => {
        const customId = 'custom-id-123';
        const scene = new Scene({ name: 'TestScene', id: customId });

        expect(scene.id).toBe(customId);
    });

    test('should provide access to World instance', () => {
        const scene = new Scene({ name: 'TestScene' });
        const world = scene.getWorld();

        expect(world).toBeDefined();
        expect(world.getEntityCount()).toBe(0);
    });

    test('should load scene and call onLoad hook', async () => {
        let hookCalled = false;
        const lifecycle: SceneLifecycleHooks = {
            onLoad: async (world) => {
                hookCalled = true;
                world.createEntity();
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });
        await scene.load();

        expect(scene.isLoaded()).toBe(true);
        expect(scene.getState()).toBe(SceneState.LOADED);
        expect(hookCalled).toBe(true);
        expect(scene.getWorld().getEntityCount()).toBe(1);
    });

    test('should not reload already loaded scene', async () => {
        let loadCount = 0;
        const lifecycle: SceneLifecycleHooks = {
            onLoad: async () => {
                loadCount++;
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });
        await scene.load();
        await scene.load();

        expect(loadCount).toBe(1);
    });

    test('should handle load errors gracefully', async () => {
        const lifecycle: SceneLifecycleHooks = {
            onLoad: async () => {
                throw new Error('Load failed');
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });

        await expect(scene.load()).rejects.toThrow('Failed to load scene "TestScene"');
        expect(scene.getState()).toBe(SceneState.UNLOADED);
    });

    test('should track load progress', async () => {
        const scene = new Scene({ name: 'TestScene' });

        expect(scene.getLoadProgress().percentage).toBe(0);

        scene.updateProgress(50, 100, 'Loading assets...');
        const progress = scene.getLoadProgress();

        expect(progress.loaded).toBe(50);
        expect(progress.total).toBe(100);
        expect(progress.percentage).toBe(50);
        expect(progress.message).toBe('Loading assets...');
    });

    test('should enter scene and transition to active state', async () => {
        let enterCalled = false;
        const lifecycle: SceneLifecycleHooks = {
            onEnter: async () => {
                enterCalled = true;
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });
        await scene.load();
        await scene.enter();

        expect(scene.isActive()).toBe(true);
        expect(scene.getState()).toBe(SceneState.ACTIVE);
        expect(enterCalled).toBe(true);
    });

    test('should not enter unloaded scene', async () => {
        const scene = new Scene({ name: 'TestScene' });

        await expect(scene.enter()).rejects.toThrow(
            'Cannot enter scene "TestScene" - scene must be loaded first'
        );
    });

    test('should exit scene and transition to loaded state', async () => {
        let exitCalled = false;
        const lifecycle: SceneLifecycleHooks = {
            onExit: async () => {
                exitCalled = true;
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });
        await scene.load();
        await scene.enter();
        await scene.exit();

        expect(scene.isActive()).toBe(false);
        expect(scene.getState()).toBe(SceneState.LOADED);
        expect(exitCalled).toBe(true);
    });

    test('should pause and resume active scene', async () => {
        let pauseCalled = false;
        let resumeCalled = false;
        const lifecycle: SceneLifecycleHooks = {
            onPause: async () => {
                pauseCalled = true;
            },
            onResume: async () => {
                resumeCalled = true;
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });
        await scene.load();
        await scene.enter();
        await scene.pause();

        expect(scene.isPaused()).toBe(true);
        expect(pauseCalled).toBe(true);

        await scene.resume();

        expect(scene.isActive()).toBe(true);
        expect(resumeCalled).toBe(true);
    });

    test('should unload scene and call onUnload hook', async () => {
        let unloadCalled = false;
        const lifecycle: SceneLifecycleHooks = {
            onUnload: async () => {
                unloadCalled = true;
            },
        };

        const scene = new Scene({ name: 'TestScene', lifecycle });
        await scene.load();
        await scene.unload();

        expect(scene.getState()).toBe(SceneState.UNLOADED);
        expect(unloadCalled).toBe(true);
    });

    test('should preserve world for persistent scenes', async () => {
        const scene = new Scene({ name: 'TestScene', persistent: true });
        await scene.load();

        const world = scene.getWorld();
        const entityId = world.createEntity();

        await scene.unload();
        await scene.load();

        expect(scene.getWorld()).toBe(world);
        expect(world.getEntityCount()).toBe(1);
    });

    test('should reset world for non-persistent scenes', async () => {
        const scene = new Scene({ name: 'TestScene', persistent: false });
        await scene.load();

        const world = scene.getWorld();
        world.createEntity();

        await scene.unload();
        await scene.load();

        expect(scene.getWorld()).not.toBe(world);
        expect(scene.getWorld().getEntityCount()).toBe(0);
    });

    test('should update world only when active', async () => {
        let updateCount = 0;
        const scene = new Scene({
            name: 'TestScene',
            lifecycle: {
                onLoad: (world) => {
                    world.addSystem({
                        name: 'TestSystem',
                        priority: 1,
                        update: () => {
                            updateCount++;
                        },
                    });
                },
            },
        });

        await scene.load();
        scene.update(16);
        expect(updateCount).toBe(0);

        await scene.enter();
        scene.update(16);
        expect(updateCount).toBe(1);

        await scene.pause();
        scene.update(16);
        expect(updateCount).toBe(1);

        await scene.resume();
        scene.update(16);
        expect(updateCount).toBe(2);
    });
});

describe('SceneTransition', () => {
    test('should initialize in NONE phase', () => {
        const transition = new SceneTransition();
        const state = transition.getState();

        expect(state.phase).toBe(TransitionPhase.NONE);
        expect(state.progress).toBe(0);
        expect(transition.isActive()).toBe(false);
    });

    test('should execute all transition phases', async () => {
        const phases: TransitionPhase[] = [];
        const callbacks: TransitionCallbacks = {
            onFadeOut: async () => {
                phases.push(TransitionPhase.FADE_OUT);
            },
            onTransition: async () => {
                phases.push(TransitionPhase.TRANSITION);
            },
            onFadeIn: async () => {
                phases.push(TransitionPhase.FADE_IN);
            },
            onComplete: async () => {
                phases.push(TransitionPhase.COMPLETE);
            },
        };

        const transition = new SceneTransition({
            duration: 100,
            callbacks,
        });

        const scene1 = new Scene({ name: 'Scene1' });
        const scene2 = new Scene({ name: 'Scene2' });

        await transition.execute(scene1, scene2);

        expect(phases).toContain(TransitionPhase.FADE_OUT);
        expect(phases).toContain(TransitionPhase.TRANSITION);
        expect(phases).toContain(TransitionPhase.FADE_IN);
        expect(phases).toContain(TransitionPhase.COMPLETE);
        expect(transition.isActive()).toBe(false);
    });

    test('should report progress during fade out', async () => {
        const progressValues: number[] = [];
        const callbacks: TransitionCallbacks = {
            onFadeOut: async (progress) => {
                progressValues.push(progress);
            },
        };

        const transition = new SceneTransition({
            fadeOutDuration: 50,
            fadeInDuration: 0,
            callbacks,
        });

        await transition.execute(undefined, undefined);

        expect(progressValues.length).toBeGreaterThan(1);
        expect(progressValues[0]).toBe(0);
        expect(progressValues[progressValues.length - 1]).toBe(1);
    });

    test('should handle transitions without callbacks', async () => {
        const transition = new SceneTransition({ duration: 10 });
        await expect(transition.execute(undefined, undefined)).resolves.toBeUndefined();
    });

    test('should handle errors during transition', async () => {
        const callbacks: TransitionCallbacks = {
            onTransition: async () => {
                throw new Error('Transition failed');
            },
        };

        const transition = new SceneTransition({ duration: 10, callbacks });

        await expect(transition.execute(undefined, undefined)).rejects.toThrow('Transition failed');
        expect(transition.getState().phase).toBe(TransitionPhase.NONE);
    });
});

describe('SceneManager', () => {
    let manager: SceneManager;

    beforeEach(() => {
        manager = new SceneManager();
    });

    test('should register new scene', () => {
        const scene = manager.registerScene({ name: 'TestScene' });

        expect(scene).toBeDefined();
        expect(scene.name).toBe('TestScene');
        expect(manager.hasScene('TestScene')).toBe(true);
        expect(manager.getScene('TestScene')).toBe(scene);
    });

    test('should not register duplicate scene names', () => {
        manager.registerScene({ name: 'TestScene' });

        expect(() => manager.registerScene({ name: 'TestScene' })).toThrow(
            'Scene "TestScene" is already registered'
        );
    });

    test('should unregister scene', () => {
        manager.registerScene({ name: 'TestScene' });
        const result = manager.unregisterScene('TestScene');

        expect(result).toBe(true);
        expect(manager.hasScene('TestScene')).toBe(false);
    });

    test('should not unregister active scene', async () => {
        manager.registerScene({ name: 'TestScene' });
        await manager.switchTo('TestScene');

        expect(() => manager.unregisterScene('TestScene')).toThrow(
            'Cannot unregister active scene "TestScene"'
        );
    });

    test('should return false when unregistering non-existent scene', () => {
        const result = manager.unregisterScene('NonExistent');
        expect(result).toBe(false);
    });

    test('should list all scene names', () => {
        manager.registerScene({ name: 'Scene1' });
        manager.registerScene({ name: 'Scene2' });
        manager.registerScene({ name: 'Scene3' });

        const names = manager.getSceneNames();

        expect(names).toHaveLength(3);
        expect(names).toContain('Scene1');
        expect(names).toContain('Scene2');
        expect(names).toContain('Scene3');
    });

    test('should switch to scene and make it active', async () => {
        manager.registerScene({ name: 'TestScene' });
        await manager.switchTo('TestScene');

        const activeScene = manager.getActiveScene();
        expect(activeScene).toBeDefined();
        expect(activeScene?.name).toBe('TestScene');
        expect(activeScene?.isActive()).toBe(true);
    });

    test('should switch between scenes', async () => {
        let scene1Exited = false;
        let scene2Entered = false;

        manager.registerScene({
            name: 'Scene1',
            lifecycle: {
                onExit: async () => {
                    scene1Exited = true;
                },
            },
        });

        manager.registerScene({
            name: 'Scene2',
            lifecycle: {
                onEnter: async () => {
                    scene2Entered = true;
                },
            },
        });

        await manager.switchTo('Scene1');
        await manager.switchTo('Scene2');

        expect(scene1Exited).toBe(true);
        expect(scene2Entered).toBe(true);
        expect(manager.getActiveScene()?.name).toBe('Scene2');
    });

    test('should not switch to same scene', async () => {
        let loadCount = 0;
        manager.registerScene({
            name: 'TestScene',
            lifecycle: {
                onLoad: async () => {
                    loadCount++;
                },
            },
        });

        await manager.switchTo('TestScene');
        await manager.switchTo('TestScene');

        expect(loadCount).toBe(1);
    });

    test('should throw error when switching to non-existent scene', async () => {
        await expect(manager.switchTo('NonExistent')).rejects.toThrow(
            'Scene "NonExistent" not found'
        );
    });

    test('should prevent concurrent transitions', async () => {
        manager.registerScene({ name: 'Scene1' });
        manager.registerScene({ name: 'Scene2' });

        const transition1 = manager.switchTo('Scene1', {
            duration: 100,
            callbacks: {
                onTransition: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                },
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(() => manager.switchTo('Scene2')).toThrow(
            'A scene transition is already in progress'
        );

        await transition1;
    });

    test('should preload scene without activating it', async () => {
        let loaded = false;
        manager.registerScene({
            name: 'TestScene',
            lifecycle: {
                onLoad: async () => {
                    loaded = true;
                },
            },
        });

        await manager.preloadScene('TestScene');

        expect(loaded).toBe(true);
        expect(manager.isSceneLoaded('TestScene')).toBe(true);
        expect(manager.getActiveScene()).toBeUndefined();
    });

    test('should auto-preload scenes with preload flag', async () => {
        let loaded = false;
        manager.registerScene({
            name: 'TestScene',
            preload: true,
            lifecycle: {
                onLoad: async () => {
                    loaded = true;
                },
            },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(loaded).toBe(true);
        expect(manager.isSceneLoaded('TestScene')).toBe(true);
    });

    test('should preload multiple scenes', async () => {
        manager.registerScene({ name: 'Scene1' });
        manager.registerScene({ name: 'Scene2' });
        manager.registerScene({ name: 'Scene3' });

        await manager.preloadScenes(['Scene1', 'Scene2', 'Scene3']);

        expect(manager.isSceneLoaded('Scene1')).toBe(true);
        expect(manager.isSceneLoaded('Scene2')).toBe(true);
        expect(manager.isSceneLoaded('Scene3')).toBe(true);
    });

    test('should unload scene', async () => {
        let unloaded = false;
        manager.registerScene({
            name: 'TestScene',
            lifecycle: {
                onUnload: async () => {
                    unloaded = true;
                },
            },
        });

        await manager.preloadScene('TestScene');
        await manager.unloadScene('TestScene');

        expect(unloaded).toBe(true);
        expect(manager.isSceneLoaded('TestScene')).toBe(false);
    });

    test('should not unload active scene', async () => {
        manager.registerScene({ name: 'TestScene' });
        await manager.switchTo('TestScene');

        await expect(manager.unloadScene('TestScene')).rejects.toThrow(
            'Cannot unload active scene "TestScene"'
        );
    });

    test('should unload inactive scenes', async () => {
        manager.registerScene({ name: 'Scene1' });
        manager.registerScene({ name: 'Scene2' });
        manager.registerScene({ name: 'Scene3' });

        await manager.preloadScenes(['Scene1', 'Scene2', 'Scene3']);
        await manager.switchTo('Scene1');
        await manager.unloadInactiveScenes();

        expect(manager.isSceneLoaded('Scene1')).toBe(true);
        expect(manager.isSceneLoaded('Scene2')).toBe(false);
        expect(manager.isSceneLoaded('Scene3')).toBe(false);
    });

    test('should not unload persistent scenes', async () => {
        manager.registerScene({ name: 'Scene1', persistent: true });
        manager.registerScene({ name: 'Scene2' });

        await manager.preloadScenes(['Scene1', 'Scene2']);
        await manager.switchTo('Scene2');
        await manager.unloadInactiveScenes();

        expect(manager.isSceneLoaded('Scene1')).toBe(true);
        expect(manager.isSceneLoaded('Scene2')).toBe(true);
    });

    test('should except scenes from unload', async () => {
        manager.registerScene({ name: 'Scene1' });
        manager.registerScene({ name: 'Scene2' });
        manager.registerScene({ name: 'Scene3' });

        await manager.preloadScenes(['Scene1', 'Scene2', 'Scene3']);
        await manager.switchTo('Scene1');
        await manager.unloadInactiveScenes(['Scene2']);

        expect(manager.isSceneLoaded('Scene1')).toBe(true);
        expect(manager.isSceneLoaded('Scene2')).toBe(true);
        expect(manager.isSceneLoaded('Scene3')).toBe(false);
    });

    test('should update active scene', async () => {
        let updateCount = 0;
        manager.registerScene({
            name: 'TestScene',
            lifecycle: {
                onLoad: (world) => {
                    world.addSystem({
                        name: 'TestSystem',
                        priority: 1,
                        update: () => {
                            updateCount++;
                        },
                    });
                },
            },
        });

        await manager.switchTo('TestScene');
        manager.update(16);

        expect(updateCount).toBe(1);
    });

    test('should pause and resume active scene', async () => {
        let pauseCalled = false;
        let resumeCalled = false;

        manager.registerScene({
            name: 'TestScene',
            lifecycle: {
                onPause: async () => {
                    pauseCalled = true;
                },
                onResume: async () => {
                    resumeCalled = true;
                },
            },
        });

        await manager.switchTo('TestScene');
        await manager.pauseActiveScene();

        expect(pauseCalled).toBe(true);
        expect(manager.getActiveScene()?.isPaused()).toBe(true);

        await manager.resumeActiveScene();

        expect(resumeCalled).toBe(true);
        expect(manager.getActiveScene()?.isActive()).toBe(true);
    });

    test('should track load progress', async () => {
        const progressUpdates: Array<{ scene: string; progress: number }> = [];

        manager.onLoadProgress((sceneName, progress) => {
            progressUpdates.push({ scene: sceneName, progress });
        });

        manager.registerScene({
            name: 'TestScene',
            lifecycle: {
                onLoad: async (world) => {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                },
            },
        });

        await manager.switchTo('TestScene');

        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates.some((u) => u.scene === 'TestScene')).toBe(true);
    });

    test('should return scene manager stats', async () => {
        manager.registerScene({ name: 'Scene1', preload: true });
        manager.registerScene({ name: 'Scene2' });
        manager.registerScene({ name: 'Scene3', persistent: true, preload: true });

        await manager.preloadScenes(['Scene1', 'Scene3']);
        await manager.switchTo('Scene1');

        const stats = manager.getStats();

        expect(stats.totalScenes).toBe(3);
        expect(stats.loadedScenes).toBe(2);
        expect(stats.activeScene).toBe('Scene1');
        expect(stats.preloadedScenes).toContain('Scene3');
    });

    test('should shutdown and cleanup all scenes', async () => {
        let scene1Unloaded = false;
        let scene2Unloaded = false;

        manager.registerScene({
            name: 'Scene1',
            lifecycle: {
                onUnload: async () => {
                    scene1Unloaded = true;
                },
            },
        });

        manager.registerScene({
            name: 'Scene2',
            lifecycle: {
                onUnload: async () => {
                    scene2Unloaded = true;
                },
            },
        });

        await manager.preloadScenes(['Scene1', 'Scene2']);
        await manager.switchTo('Scene1');
        await manager.shutdown();

        expect(scene1Unloaded).toBe(true);
        expect(scene2Unloaded).toBe(true);
        expect(manager.getActiveScene()).toBeUndefined();
        expect(manager.getSceneNames()).toHaveLength(0);
    });

    test('should use custom transition config', async () => {
        let customCallbackCalled = false;

        manager.registerScene({ name: 'Scene1' });
        manager.registerScene({ name: 'Scene2' });

        await manager.switchTo('Scene1');
        await manager.switchTo('Scene2', {
            onTransition: async () => {
                customCallbackCalled = true;
            },
        });

        expect(customCallbackCalled).toBe(true);
    });

    test('should use default transition config', async () => {
        let defaultCallbackCalled = false;

        const managerWithDefaults = new SceneManager({
            defaultTransition: {
                callbacks: {
                    onTransition: async () => {
                        defaultCallbackCalled = true;
                    },
                },
            },
        });

        managerWithDefaults.registerScene({ name: 'Scene1' });
        managerWithDefaults.registerScene({ name: 'Scene2' });

        await managerWithDefaults.switchTo('Scene1');
        await managerWithDefaults.switchTo('Scene2');

        expect(defaultCallbackCalled).toBe(true);
    });
});
