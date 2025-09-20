// Core plugin architecture

// Specialized plugin interfaces
export type {
    NetworkPlugin,
    NetworkPluginConfig,
} from './NetworkPlugin.ts';
export { BaseNetworkPlugin } from './NetworkPlugin.ts';
export type { Plugin, PluginMetadata } from './Plugin.ts';
export { PluginError, PluginManager } from './PluginManager.ts';

export type {
    LoadOptions,
    StorageMetadata,
    StorageOperation,
    StorageOptions,
    StoragePlugin,
    StoragePluginConfig,
    StorageStats,
} from './StoragePlugin.ts';
export { BaseStoragePlugin } from './StoragePlugin.ts';
