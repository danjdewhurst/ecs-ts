import type { World } from '../ecs/World.ts';

/**
 * Base interface for all plugins in the ECS game engine.
 * Plugins provide extensible functionality that can be loaded and unloaded at runtime.
 */
export interface Plugin {
    /** Unique identifier for this plugin */
    readonly name: string;

    /** Semantic version of this plugin */
    readonly version: string;

    /** Optional list of plugin names that this plugin depends on */
    readonly dependencies?: string[];

    /**
     * Called when the plugin is being loaded.
     * This is where the plugin should register its systems, components, and event handlers.
     *
     * @param world - The game world instance
     * @throws {Error} If initialization fails
     */
    initialize(world: World): Promise<void>;

    /**
     * Optional cleanup method called when the plugin is being unloaded.
     * This should clean up any resources, remove event listeners, etc.
     */
    shutdown?(): Promise<void>;
}

/**
 * Metadata about a plugin for introspection
 */
export interface PluginMetadata {
    readonly name: string;
    readonly version: string;
    readonly dependencies: string[];
    readonly isLoaded: boolean;
    readonly loadedAt?: number;
}
