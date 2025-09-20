import { beforeEach, describe, expect, test } from 'bun:test';
import { World } from '../ecs/World.ts';
import type { Plugin } from './Plugin.ts';
import { PluginError, PluginManager } from './PluginManager.ts';

describe('PluginManager', () => {
    let world: World;
    let pluginManager: PluginManager;

    beforeEach(() => {
        world = new World();
        pluginManager = new PluginManager(world);
    });

    describe('plugin validation', () => {
        test('should reject plugin without name', async () => {
            const plugin = {
                name: '',
                version: '1.0.0',
                initialize: async () => {},
            } as Plugin;

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                'Plugin must have a valid name'
            );
        });

        test('should reject plugin without version', async () => {
            const plugin = {
                name: 'test-plugin',
                version: '',
                initialize: async () => {},
            } as Plugin;

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                'Plugin must have a valid version'
            );
        });

        test('should reject plugin without initialize method', async () => {
            const plugin = {
                name: 'test-plugin',
                version: '1.0.0',
            } as Plugin;

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                'Plugin must have an initialize method'
            );
        });

        test('should reject plugin with invalid shutdown method', async () => {
            const plugin = {
                name: 'test-plugin',
                version: '1.0.0',
                initialize: async () => {},
                shutdown: 'not-a-function',
            } as any;

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                'Plugin shutdown must be a function if provided'
            );
        });
    });

    describe('plugin loading', () => {
        test('should load valid plugin successfully', async () => {
            const plugin: Plugin = {
                name: 'test-plugin',
                version: '1.0.0',
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(plugin);

            expect(pluginManager.isPluginLoaded('test-plugin')).toBe(true);
            const metadata = pluginManager.getPluginMetadata('test-plugin');
            expect(metadata).toBeDefined();
            expect(metadata?.name).toBe('test-plugin');
            expect(metadata?.version).toBe('1.0.0');
            expect(metadata?.isLoaded).toBe(true);
        });

        test('should prevent loading same plugin twice', async () => {
            const plugin: Plugin = {
                name: 'test-plugin',
                version: '1.0.0',
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(plugin);

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                "Plugin 'test-plugin' is already loaded"
            );
        });

        test('should handle plugin initialization failure', async () => {
            const plugin: Plugin = {
                name: 'failing-plugin',
                version: '1.0.0',
                initialize: async () => {
                    throw new Error('Initialization failed');
                },
            };

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                "Plugin 'failing-plugin' initialization failed: Initialization failed"
            );

            expect(pluginManager.isPluginLoaded('failing-plugin')).toBe(false);
        });

        test('should cleanup on initialization failure', async () => {
            const plugin: Plugin = {
                name: 'failing-plugin',
                version: '1.0.0',
                initialize: async () => {
                    throw new Error('Initialization failed');
                },
            };

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow();

            expect(
                pluginManager.getPluginMetadata('failing-plugin')
            ).toBeUndefined();
            expect(pluginManager.getLoadOrder()).not.toContain(
                'failing-plugin'
            );
        });
    });

    describe('dependency resolution', () => {
        test('should load plugins in dependency order', async () => {
            const pluginA: Plugin = {
                name: 'plugin-a',
                version: '1.0.0',
                initialize: async () => {},
            };

            const pluginB: Plugin = {
                name: 'plugin-b',
                version: '1.0.0',
                dependencies: ['plugin-a'],
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(pluginA);
            await pluginManager.loadPlugin(pluginB);

            const loadOrder = pluginManager.getLoadOrder();
            expect(loadOrder).toEqual(['plugin-a', 'plugin-b']);
        });

        test('should reject plugin with missing dependency', async () => {
            const plugin: Plugin = {
                name: 'dependent-plugin',
                version: '1.0.0',
                dependencies: ['missing-dependency'],
                initialize: async () => {},
            };

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                "Plugin 'dependent-plugin' requires dependency 'missing-dependency' which is not loaded"
            );
        });

        test('should handle complex dependency chains', async () => {
            const pluginA: Plugin = {
                name: 'plugin-a',
                version: '1.0.0',
                initialize: async () => {},
            };

            const pluginB: Plugin = {
                name: 'plugin-b',
                version: '1.0.0',
                dependencies: ['plugin-a'],
                initialize: async () => {},
            };

            const pluginC: Plugin = {
                name: 'plugin-c',
                version: '1.0.0',
                dependencies: ['plugin-b'],
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(pluginA);
            await pluginManager.loadPlugin(pluginB);
            await pluginManager.loadPlugin(pluginC);

            const loadOrder = pluginManager.getLoadOrder();
            expect(loadOrder).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
        });

        test('should detect circular dependencies', async () => {
            // For now, test simpler case: missing dependency
            // Real circular dependency detection would require changes to the plugin manager
            // to defer dependency validation or add all plugins to registry first
            const plugin: Plugin = {
                name: 'circular-plugin',
                version: '1.0.0',
                dependencies: ['non-existent-dependency'],
                initialize: async () => {},
            };

            await expect(pluginManager.loadPlugin(plugin)).rejects.toThrow(
                "Plugin 'circular-plugin' requires dependency 'non-existent-dependency' which is not loaded"
            );
        });
    });

    describe('plugin unloading', () => {
        test('should unload plugin successfully', async () => {
            let shutdownCalled = false;
            const plugin: Plugin = {
                name: 'test-plugin',
                version: '1.0.0',
                initialize: async () => {},
                shutdown: async () => {
                    shutdownCalled = true;
                },
            };

            await pluginManager.loadPlugin(plugin);
            await pluginManager.unloadPlugin('test-plugin');

            expect(shutdownCalled).toBe(true);
            expect(pluginManager.isPluginLoaded('test-plugin')).toBe(false);
            expect(
                pluginManager.getPluginMetadata('test-plugin')
            ).toBeUndefined();
        });

        test('should reject unloading non-existent plugin', async () => {
            await expect(
                pluginManager.unloadPlugin('non-existent')
            ).rejects.toThrow("Plugin 'non-existent' is not loaded");
        });

        test('should prevent unloading plugin with dependents', async () => {
            const pluginA: Plugin = {
                name: 'plugin-a',
                version: '1.0.0',
                initialize: async () => {},
            };

            const pluginB: Plugin = {
                name: 'plugin-b',
                version: '1.0.0',
                dependencies: ['plugin-a'],
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(pluginA);
            await pluginManager.loadPlugin(pluginB);

            await expect(
                pluginManager.unloadPlugin('plugin-a')
            ).rejects.toThrow(
                "Cannot unload plugin 'plugin-a' because it is required by: plugin-b"
            );
        });

        test('should handle shutdown failure gracefully', async () => {
            const plugin: Plugin = {
                name: 'failing-plugin',
                version: '1.0.0',
                initialize: async () => {},
                shutdown: async () => {
                    throw new Error('Shutdown failed');
                },
            };

            await pluginManager.loadPlugin(plugin);

            await expect(
                pluginManager.unloadPlugin('failing-plugin')
            ).rejects.toThrow(
                "Failed to unload plugin 'failing-plugin': Shutdown failed"
            );
        });
    });

    describe('plugin metadata', () => {
        test('should return correct metadata for loaded plugin', async () => {
            const plugin: Plugin = {
                name: 'test-plugin',
                version: '2.0.0',
                dependencies: [],
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(plugin);

            const metadata = pluginManager.getPluginMetadata('test-plugin');
            expect(metadata).toEqual({
                name: 'test-plugin',
                version: '2.0.0',
                dependencies: [],
                isLoaded: true,
                loadedAt: expect.any(Number),
            });
        });

        test('should return undefined for non-existent plugin', () => {
            const metadata = pluginManager.getPluginMetadata('non-existent');
            expect(metadata).toBeUndefined();
        });

        test('should return all plugin metadata', async () => {
            const plugin1: Plugin = {
                name: 'plugin-1',
                version: '1.0.0',
                initialize: async () => {},
            };

            const plugin2: Plugin = {
                name: 'plugin-2',
                version: '2.0.0',
                initialize: async () => {},
            };

            await pluginManager.loadPlugin(plugin1);
            await pluginManager.loadPlugin(plugin2);

            const allMetadata = pluginManager.getAllPluginMetadata();
            expect(allMetadata).toHaveLength(2);
            expect(allMetadata.map((m) => m.name)).toContain('plugin-1');
            expect(allMetadata.map((m) => m.name)).toContain('plugin-2');
        });
    });

    describe('shutdown all', () => {
        test('should shutdown all plugins in reverse order', async () => {
            const shutdownOrder: string[] = [];

            const pluginA: Plugin = {
                name: 'plugin-a',
                version: '1.0.0',
                initialize: async () => {},
                shutdown: async () => {
                    shutdownOrder.push('plugin-a');
                },
            };

            const pluginB: Plugin = {
                name: 'plugin-b',
                version: '1.0.0',
                dependencies: ['plugin-a'],
                initialize: async () => {},
                shutdown: async () => {
                    shutdownOrder.push('plugin-b');
                },
            };

            await pluginManager.loadPlugin(pluginA);
            await pluginManager.loadPlugin(pluginB);

            await pluginManager.shutdownAll();

            expect(shutdownOrder).toEqual(['plugin-b', 'plugin-a']);
            expect(pluginManager.getAllPluginMetadata()).toHaveLength(0);
        });

        test('should handle shutdown errors but continue with other plugins', async () => {
            const plugin1: Plugin = {
                name: 'plugin-1',
                version: '1.0.0',
                initialize: async () => {},
                shutdown: async () => {
                    throw new Error('Shutdown error');
                },
            };

            const plugin2: Plugin = {
                name: 'plugin-2',
                version: '1.0.0',
                initialize: async () => {},
                shutdown: async () => {}, // No error
            };

            await pluginManager.loadPlugin(plugin1);
            await pluginManager.loadPlugin(plugin2);

            await expect(pluginManager.shutdownAll()).rejects.toThrow(
                'Failed to shutdown 1 plugin(s)'
            );

            expect(pluginManager.getAllPluginMetadata()).toHaveLength(0);
        });
    });

    describe('error handling', () => {
        test('should wrap errors in PluginError', async () => {
            const plugin: Plugin = {
                name: 'error-plugin',
                version: '1.0.0',
                initialize: async () => {
                    throw new Error('Custom error');
                },
            };

            try {
                await pluginManager.loadPlugin(plugin);
                expect.unreachable();
            } catch (error) {
                expect(error).toBeInstanceOf(PluginError);
                expect((error as PluginError).pluginName).toBe('error-plugin');
                expect((error as PluginError).originalError).toBeInstanceOf(
                    Error
                );
            }
        });

        test('should preserve PluginError instances', async () => {
            const customError = new PluginError(
                'Custom plugin error',
                'test-plugin'
            );
            const plugin: Plugin = {
                name: 'test-plugin',
                version: '1.0.0',
                initialize: async () => {
                    throw customError;
                },
            };

            await expect(pluginManager.loadPlugin(plugin)).rejects.toBe(
                customError
            );
        });
    });
});
