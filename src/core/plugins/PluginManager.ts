import type { World } from '../ecs/World.ts';
import type { Plugin, PluginMetadata } from './Plugin.ts';

/**
 * Error thrown when plugin operations fail
 */
export class PluginError extends Error {
    public readonly pluginName?: string;
    public readonly originalError?: Error;

    constructor(message: string, pluginName?: string, originalError?: Error) {
        super(message);
        this.name = 'PluginError';
        this.pluginName = pluginName;
        this.originalError = originalError;
    }
}

/**
 * Manages plugin lifecycle, dependencies, and loading order.
 * Provides isolation and error handling for plugin operations.
 */
export class PluginManager {
    private plugins = new Map<string, Plugin>();
    private metadata = new Map<string, PluginMetadata>();
    private loadOrder: Plugin[] = [];
    private world: World;

    constructor(world: World) {
        this.world = world;
    }

    /**
     * Load a plugin, resolving dependencies and initializing it.
     *
     * @param plugin - The plugin to load
     * @throws {PluginError} If the plugin fails to load or has dependency issues
     */
    async loadPlugin(plugin: Plugin): Promise<void> {
        try {
            // Validate plugin
            this.validatePlugin(plugin);

            // Check if already loaded
            if (this.plugins.has(plugin.name)) {
                throw new PluginError(
                    `Plugin '${plugin.name}' is already loaded`,
                    plugin.name
                );
            }

            // Check dependencies
            await this.validateDependencies(plugin);

            // Add to registry
            this.plugins.set(plugin.name, plugin);
            this.metadata.set(plugin.name, {
                name: plugin.name,
                version: plugin.version,
                dependencies: plugin.dependencies ?? [],
                isLoaded: false,
                loadedAt: undefined,
            });

            // Recompute load order
            this.computeLoadOrder();

            // Initialize plugin in isolation
            await this.initializePlugin(plugin);

            // Update metadata
            const meta = this.metadata.get(plugin.name);
            if (!meta) {
                throw new PluginError(
                    `Plugin metadata not found for '${plugin.name}'`,
                    plugin.name
                );
            }
            this.metadata.set(plugin.name, {
                ...meta,
                isLoaded: true,
                loadedAt: Date.now(),
            });
        } catch (error) {
            // Cleanup on failure
            this.plugins.delete(plugin.name);
            this.metadata.delete(plugin.name);
            this.computeLoadOrder();

            if (error instanceof PluginError) {
                throw error;
            }
            throw new PluginError(
                `Failed to load plugin '${plugin.name}': ${error instanceof Error ? error.message : String(error)}`,
                plugin.name,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Unload a plugin and clean up its resources.
     *
     * @param pluginName - Name of the plugin to unload
     * @throws {PluginError} If the plugin cannot be unloaded
     */
    async unloadPlugin(pluginName: string): Promise<void> {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new PluginError(
                `Plugin '${pluginName}' is not loaded`,
                pluginName
            );
        }

        // Check if other plugins depend on this one
        const dependents = this.findDependents(pluginName);
        if (dependents.length > 0) {
            throw new PluginError(
                `Cannot unload plugin '${pluginName}' because it is required by: ${dependents.join(', ')}`,
                pluginName
            );
        }

        try {
            // Call shutdown if available
            if (plugin.shutdown) {
                await plugin.shutdown();
            }

            // Remove from registry
            this.plugins.delete(pluginName);
            this.metadata.delete(pluginName);
            this.computeLoadOrder();
        } catch (error) {
            throw new PluginError(
                `Failed to unload plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
                pluginName,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Get metadata for a specific plugin.
     */
    getPluginMetadata(pluginName: string): PluginMetadata | undefined {
        return this.metadata.get(pluginName);
    }

    /**
     * Get metadata for all loaded plugins.
     */
    getAllPluginMetadata(): PluginMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Check if a plugin is loaded.
     */
    isPluginLoaded(pluginName: string): boolean {
        return this.metadata.get(pluginName)?.isLoaded ?? false;
    }

    /**
     * Get the current plugin load order.
     */
    getLoadOrder(): string[] {
        return this.loadOrder.map((plugin) => plugin.name);
    }

    /**
     * Shutdown all plugins in reverse dependency order.
     */
    async shutdownAll(): Promise<void> {
        const errors: PluginError[] = [];

        // Shutdown in reverse order
        const shutdownOrder = [...this.loadOrder].reverse();

        for (const plugin of shutdownOrder) {
            try {
                if (plugin.shutdown) {
                    await plugin.shutdown();
                }
            } catch (error) {
                errors.push(
                    new PluginError(
                        `Failed to shutdown plugin '${plugin.name}': ${error instanceof Error ? error.message : String(error)}`,
                        plugin.name,
                        error instanceof Error ? error : undefined
                    )
                );
            }
        }

        // Clear all registries
        this.plugins.clear();
        this.metadata.clear();
        this.loadOrder = [];

        // If there were shutdown errors, throw them
        if (errors.length > 0) {
            throw new PluginError(
                `Failed to shutdown ${errors.length} plugin(s): ${errors.map((e) => e.message).join('; ')}`
            );
        }
    }

    private validatePlugin(plugin: Plugin): void {
        if (!plugin.name || typeof plugin.name !== 'string') {
            throw new PluginError('Plugin must have a valid name');
        }

        if (!plugin.version || typeof plugin.version !== 'string') {
            throw new PluginError(
                'Plugin must have a valid version',
                plugin.name
            );
        }

        if (typeof plugin.initialize !== 'function') {
            throw new PluginError(
                'Plugin must have an initialize method',
                plugin.name
            );
        }

        if (plugin.shutdown && typeof plugin.shutdown !== 'function') {
            throw new PluginError(
                'Plugin shutdown must be a function if provided',
                plugin.name
            );
        }
    }

    private async validateDependencies(plugin: Plugin): Promise<void> {
        if (!plugin.dependencies) {
            return;
        }

        for (const dep of plugin.dependencies) {
            if (!this.isPluginLoaded(dep)) {
                throw new PluginError(
                    `Plugin '${plugin.name}' requires dependency '${dep}' which is not loaded`,
                    plugin.name
                );
            }
        }
    }

    private computeLoadOrder(): void {
        const plugins = Array.from(this.plugins.values());

        // Topological sort using Kahn's algorithm
        const inDegree = new Map<string, number>();
        const adjacencyList = new Map<string, string[]>();

        // Initialize
        for (const plugin of plugins) {
            inDegree.set(plugin.name, 0);
            adjacencyList.set(plugin.name, []);
        }

        // Build graph
        for (const plugin of plugins) {
            if (plugin.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (this.plugins.has(dep)) {
                        adjacencyList.get(dep)?.push(plugin.name);
                        inDegree.set(
                            plugin.name,
                            (inDegree.get(plugin.name) ?? 0) + 1
                        );
                    }
                }
            }
        }

        // Topological sort
        const queue: string[] = [];
        const result: Plugin[] = [];

        // Find nodes with no incoming edges
        for (const [name, degree] of inDegree) {
            if (degree === 0) {
                queue.push(name);
            }
        }

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                throw new Error(
                    'Unexpected empty queue during topological sort'
                );
            }
            const plugin = this.plugins.get(current);
            if (!plugin) {
                throw new Error(
                    `Plugin '${current}' not found during topological sort`
                );
            }
            result.push(plugin);

            // Remove edges
            for (const neighbor of adjacencyList.get(current) ?? []) {
                const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
                inDegree.set(neighbor, newDegree);

                if (newDegree === 0) {
                    queue.push(neighbor);
                }
            }
        }

        // Check for circular dependencies
        if (result.length !== plugins.length) {
            const remaining = plugins
                .filter((p) => !result.includes(p))
                .map((p) => p.name);
            throw new PluginError(
                `Circular dependency detected among plugins: ${remaining.join(', ')}`
            );
        }

        this.loadOrder = result;
    }

    private async initializePlugin(plugin: Plugin): Promise<void> {
        try {
            await plugin.initialize(this.world);
        } catch (error) {
            if (error instanceof PluginError) {
                throw error;
            }
            throw new PluginError(
                `Plugin '${plugin.name}' initialization failed: ${error instanceof Error ? error.message : String(error)}`,
                plugin.name,
                error instanceof Error ? error : undefined
            );
        }
    }

    private findDependents(pluginName: string): string[] {
        const dependents: string[] = [];

        for (const plugin of this.plugins.values()) {
            if (plugin.dependencies?.includes(pluginName)) {
                dependents.push(plugin.name);
            }
        }

        return dependents;
    }
}
