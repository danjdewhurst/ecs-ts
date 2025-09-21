import { beforeEach, describe, expect, test } from 'bun:test';
import type { Component } from '../ecs/Component.ts';
import { BaseSystem } from '../ecs/System.ts';
import { World } from '../ecs/World.ts';
import type { Plugin } from './Plugin.ts';
import { PluginManager } from './PluginManager.ts';

describe('Plugin System Integration', () => {
    let world: World;
    let pluginManager: PluginManager;

    beforeEach(() => {
        world = new World();
        pluginManager = new PluginManager(world);
    });

    describe('plugin integration with ECS', () => {
        interface TestComponent extends Component {
            readonly type: 'test';
            value: number;
        }

        class TestSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'TestSystem';

            update(world: World, deltaTime: number): void {
                const entities = world.queryMultiple(['test']);
                for (const entityId of entities) {
                    const component = world.getComponent<TestComponent>(
                        entityId,
                        'test'
                    );
                    if (component) {
                        component.value += deltaTime;
                    }
                }
            }
        }

        class TestPlugin implements Plugin {
            readonly name = 'test-plugin';
            readonly version = '1.0.0';

            private system = new TestSystem();

            async initialize(world: World): Promise<void> {
                // Register system with the world
                world.addSystem(this.system);

                // Create test entity with component
                const entity = world.createEntity();
                world.addComponent<TestComponent>(entity, {
                    type: 'test',
                    value: 0,
                });
            }

            async shutdown(): Promise<void> {
                // Cleanup would go here
            }
        }

        test('should integrate plugin with ECS world', async () => {
            const plugin = new TestPlugin();
            await pluginManager.loadPlugin(plugin);

            // Verify system was added
            const entities = world.queryMultiple(['test']);
            expect(entities).toHaveLength(1);

            // Update world and verify system runs
            world.update(10);

            const entity = entities[0];
            if (!entity) {
                throw new Error('Expected entity to exist');
            }
            const component = world.getComponent<TestComponent>(entity, 'test');
            expect(component?.value).toBe(10);
        });
    });

    describe('plugin event integration', () => {
        class EventTestPlugin implements Plugin {
            readonly name = 'event-test-plugin';
            readonly version = '1.0.0';

            private eventCount = 0;

            async initialize(world: World): Promise<void> {
                // Subscribe to events
                world.subscribeToEvent('test-event', (_event) => {
                    this.eventCount++;
                });

                // Emit a test event
                world.emitEvent({
                    type: 'test-event',
                    timestamp: Date.now(),
                    data: { message: 'Plugin initialized' },
                });
            }

            getEventCount(): number {
                return this.eventCount;
            }
        }

        test('should handle events in plugin initialization', async () => {
            const plugin = new EventTestPlugin();
            await pluginManager.loadPlugin(plugin);

            // Process events
            world.update(0);

            expect(plugin.getEventCount()).toBe(1);
        });
    });

    describe('complex plugin interactions', () => {
        class CorePlugin implements Plugin {
            readonly name = 'core-plugin';
            readonly version = '1.0.0';

            async initialize(world: World): Promise<void> {
                // Core functionality initialization
                world.emitEvent({
                    type: 'core-initialized',
                    timestamp: Date.now(),
                    data: { message: 'Core is ready' },
                });
            }
        }

        class ExtensionPlugin implements Plugin {
            readonly name = 'extension-plugin';
            readonly version = '1.0.0';
            readonly dependencies = ['core-plugin'];

            private coreReady = false;

            async initialize(world: World): Promise<void> {
                // Listen for core initialization
                world.subscribeToEvent('core-initialized', () => {
                    this.coreReady = true;
                });

                // Add extension functionality
                world.emitEvent({
                    type: 'extension-loaded',
                    timestamp: Date.now(),
                    data: { message: 'Extension is ready' },
                });
            }

            isCoreReady(): boolean {
                return this.coreReady;
            }
        }

        test('should handle plugin dependencies and communication', async () => {
            const corePlugin = new CorePlugin();
            const extensionPlugin = new ExtensionPlugin();

            // Load in correct order
            await pluginManager.loadPlugin(corePlugin);
            await pluginManager.loadPlugin(extensionPlugin);

            // Verify load order
            const loadOrder = pluginManager.getLoadOrder();
            expect(loadOrder).toEqual(['core-plugin', 'extension-plugin']);

            // Process events to ensure communication
            world.update(0);

            expect(extensionPlugin.isCoreReady()).toBe(true);
        });
    });

    describe('plugin error isolation', () => {
        class FailingPlugin implements Plugin {
            readonly name = 'failing-plugin';
            readonly version = '1.0.0';

            async initialize(): Promise<void> {
                throw new Error('Plugin initialization failed');
            }
        }

        class StablePlugin implements Plugin {
            readonly name = 'stable-plugin';
            readonly version = '1.0.0';

            async initialize(): Promise<void> {
                // Successful initialization
            }
        }

        test('should isolate plugin failures', async () => {
            const stablePlugin = new StablePlugin();
            const failingPlugin = new FailingPlugin();

            // Load stable plugin first
            await pluginManager.loadPlugin(stablePlugin);
            expect(pluginManager.isPluginLoaded('stable-plugin')).toBe(true);

            // Failing plugin should not affect stable plugin
            await expect(
                pluginManager.loadPlugin(failingPlugin)
            ).rejects.toThrow('Plugin initialization failed');

            expect(pluginManager.isPluginLoaded('stable-plugin')).toBe(true);
            expect(pluginManager.isPluginLoaded('failing-plugin')).toBe(false);
        });
    });

    describe('plugin lifecycle with world updates', () => {
        interface CounterComponent extends Component {
            readonly type: 'counter';
            value: number;
        }

        class CounterSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'CounterSystem';

            update(world: World): void {
                const entities = world.queryMultiple(['counter']);
                for (const entityId of entities) {
                    const component = world.getComponent<CounterComponent>(
                        entityId,
                        'counter'
                    );
                    if (component) {
                        component.value++;
                    }
                }
            }
        }

        class CounterPlugin implements Plugin {
            readonly name = 'counter-plugin';
            readonly version = '1.0.0';

            private entities: number[] = [];
            private system = new CounterSystem();

            async initialize(world: World): Promise<void> {
                world.addSystem(this.system);

                // Create test entities
                for (let i = 0; i < 3; i++) {
                    const entity = world.createEntity();
                    world.addComponent<CounterComponent>(entity, {
                        type: 'counter',
                        value: 0,
                    });
                    this.entities.push(entity);
                }
            }

            async shutdown(): Promise<void> {
                // Cleanup entities
                for (const entityId of this.entities) {
                    world.destroyEntity(entityId);
                }
                world.removeSystem(this.system.name);
            }

            getEntities(): number[] {
                return [...this.entities];
            }
        }

        test('should handle full plugin lifecycle', async () => {
            const plugin = new CounterPlugin();

            // Load plugin
            await pluginManager.loadPlugin(plugin);
            expect(pluginManager.isPluginLoaded('counter-plugin')).toBe(true);

            const entities = plugin.getEntities();
            expect(entities).toHaveLength(3);

            // Run world updates
            world.update(0);
            world.update(0);
            world.update(0);

            // Verify system worked
            for (const entityId of entities) {
                const component = world.getComponent<CounterComponent>(
                    entityId,
                    'counter'
                );
                expect(component?.value).toBe(3);
            }

            // Unload plugin
            await pluginManager.unloadPlugin('counter-plugin');
            expect(pluginManager.isPluginLoaded('counter-plugin')).toBe(false);

            // Verify cleanup - entities should be gone
            for (const entityId of entities) {
                const component = world.getComponent<CounterComponent>(
                    entityId,
                    'counter'
                );
                expect(component).toBeUndefined();
            }
        });
    });

    describe('plugin manager shutdown', () => {
        class ShutdownTestPlugin implements Plugin {
            readonly version = '1.0.0';

            public shutdownCalled = false;

            constructor(public readonly name: string) {}

            async initialize(): Promise<void> {
                // Simple initialization
            }

            async shutdown(): Promise<void> {
                this.shutdownCalled = true;
            }
        }

        test('should shutdown all plugins when plugin manager shuts down', async () => {
            const plugin1 = new ShutdownTestPlugin('plugin-1');
            const plugin2 = new ShutdownTestPlugin('plugin-2');

            await pluginManager.loadPlugin(plugin1);
            await pluginManager.loadPlugin(plugin2);

            expect(pluginManager.getAllPluginMetadata()).toHaveLength(2);

            await pluginManager.shutdownAll();

            expect(plugin1.shutdownCalled).toBe(true);
            expect(plugin2.shutdownCalled).toBe(true);
            expect(pluginManager.getAllPluginMetadata()).toHaveLength(0);
        });
    });
});
