# PluginManager

The `PluginManager` handles plugin lifecycle, dependency resolution, and loading order for the ECS game engine. It provides isolation and error handling for plugin operations, ensuring a stable and extensible plugin system.

## Quick Example

```typescript
import { World, PluginManager, Plugin } from '@danjdewhurst/ecs-ts';

const world = new World();
const pluginManager = new PluginManager(world);

// Load plugins
await pluginManager.loadPlugin(new PhysicsPlugin());
await pluginManager.loadPlugin(new GraphicsPlugin());
await pluginManager.loadPlugin(new AudioPlugin());

// Check plugin status
console.log('Loaded plugins:', pluginManager.getLoadOrder());

// Graceful shutdown
await pluginManager.shutdownAll();
```

## Constructor

```typescript
new PluginManager(world: World)
```

Creates a new PluginManager instance associated with the provided World.

### Parameters
- `world: World` - The ECS World instance that plugins will interact with

### Example
```typescript
const world = new World();
const pluginManager = new PluginManager(world);
```

## Plugin Loading

### loadPlugin

```typescript
async loadPlugin(plugin: Plugin): Promise<void>
```

Loads a plugin, resolving dependencies and initializing it in the correct order.

#### Parameters
- `plugin: Plugin` - The plugin instance to load

#### Throws
- `PluginError` - If plugin validation fails, dependencies are missing, or initialization fails

#### Example
```typescript
class MyGamePlugin implements Plugin {
  readonly name = 'my-game';
  readonly version = '1.0.0';
  readonly dependencies = ['physics-2d', 'graphics'];

  async initialize(world: World): Promise<void> {
    world.addSystem(new GameLogicSystem());
    console.log('Game plugin initialized');
  }
}

try {
  const gamePlugin = new MyGamePlugin();
  await pluginManager.loadPlugin(gamePlugin);
  console.log('Plugin loaded successfully');
} catch (error) {
  console.error('Failed to load plugin:', error.message);
}
```

#### Loading Process

1. **Validation**: Checks plugin interface compliance
2. **Duplicate Check**: Ensures plugin isn't already loaded
3. **Dependency Validation**: Verifies all dependencies are loaded
4. **Registration**: Adds plugin to internal registry
5. **Load Order Computation**: Recalculates dependency order
6. **Initialization**: Calls plugin's `initialize()` method
7. **Metadata Update**: Marks plugin as loaded with timestamp

### Dependency Resolution

The PluginManager automatically resolves dependencies using topological sorting:

```typescript
// These plugins will be loaded in dependency order
const plugins = [
  new GraphicsPlugin(),              // No dependencies
  new PhysicsPlugin(),              // No dependencies
  new AudioPlugin(),                // No dependencies
  new ParticlePlugin(),             // Depends on graphics
  new GameLogicPlugin(),            // Depends on physics, graphics
  new UIPlugin()                    // Depends on graphics, audio
];

// Load in any order - PluginManager handles dependencies
for (const plugin of plugins) {
  await pluginManager.loadPlugin(plugin);
}

// Actual load order: graphics, physics, audio, particle, game-logic, ui
console.log(pluginManager.getLoadOrder());
```

## Plugin Unloading

### unloadPlugin

```typescript
async unloadPlugin(pluginName: string): Promise<void>
```

Unloads a plugin and cleans up its resources.

#### Parameters
- `pluginName: string` - Name of the plugin to unload

#### Throws
- `PluginError` - If plugin is not found or has dependents

#### Example
```typescript
try {
  await pluginManager.unloadPlugin('debug-tools');
  console.log('Debug plugin unloaded');
} catch (error) {
  if (error.message.includes('required by')) {
    console.log('Cannot unload: other plugins depend on it');
  }
}
```

#### Unloading Process

1. **Existence Check**: Verifies plugin is loaded
2. **Dependency Check**: Ensures no other plugins depend on this one
3. **Shutdown**: Calls plugin's `shutdown()` method if present
4. **Deregistration**: Removes from registry and recalculates load order

### shutdownAll

```typescript
async shutdownAll(): Promise<void>
```

Shuts down all plugins in reverse dependency order and clears all registries.

#### Example
```typescript
// Graceful application shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down application...');

  try {
    await pluginManager.shutdownAll();
    console.log('All plugins shut down successfully');
  } catch (error) {
    console.error('Error during plugin shutdown:', error.message);
  }

  process.exit(0);
});
```

## Plugin Introspection

### getPluginMetadata

```typescript
getPluginMetadata(pluginName: string): PluginMetadata | undefined
```

Retrieves metadata for a specific plugin.

#### Returns
- `PluginMetadata | undefined` - Plugin metadata if found

#### Example
```typescript
const metadata = pluginManager.getPluginMetadata('physics-2d');
if (metadata) {
  console.log(`Plugin: ${metadata.name}`);
  console.log(`Version: ${metadata.version}`);
  console.log(`Dependencies: ${metadata.dependencies.join(', ')}`);
  console.log(`Loaded: ${metadata.isLoaded}`);

  if (metadata.loadedAt) {
    const loadTime = new Date(metadata.loadedAt);
    console.log(`Loaded at: ${loadTime.toISOString()}`);
  }
}
```

### getAllPluginMetadata

```typescript
getAllPluginMetadata(): PluginMetadata[]
```

Returns metadata for all registered plugins.

#### Example
```typescript
const allPlugins = pluginManager.getAllPluginMetadata();

console.log('Plugin Status Report:');
allPlugins.forEach(plugin => {
  const status = plugin.isLoaded ? '✓' : '✗';
  console.log(`${status} ${plugin.name} v${plugin.version}`);
});

// Filter by status
const loadedPlugins = allPlugins.filter(p => p.isLoaded);
const failedPlugins = allPlugins.filter(p => !p.isLoaded);

console.log(`${loadedPlugins.length} loaded, ${failedPlugins.length} failed`);
```

### isPluginLoaded

```typescript
isPluginLoaded(pluginName: string): boolean
```

Checks if a specific plugin is currently loaded.

#### Example
```typescript
if (pluginManager.isPluginLoaded('debug-tools')) {
  // Enable debug features
  enableDebugMode();
} else {
  console.log('Debug tools not available');
}
```

### getLoadOrder

```typescript
getLoadOrder(): string[]
```

Returns the current plugin load order based on dependency resolution.

#### Example
```typescript
const loadOrder = pluginManager.getLoadOrder();
console.log('Plugin load order:');
loadOrder.forEach((name, index) => {
  console.log(`${index + 1}. ${name}`);
});
```

## Error Handling

### PluginError

The PluginManager throws `PluginError` for all plugin-related failures:

```typescript
class PluginError extends Error {
  readonly pluginName?: string;
  readonly originalError?: Error;
}
```

#### Example Error Handling
```typescript
try {
  await pluginManager.loadPlugin(problematicPlugin);
} catch (error) {
  if (error instanceof PluginError) {
    console.error(`Plugin Error: ${error.message}`);

    if (error.pluginName) {
      console.error(`Failed plugin: ${error.pluginName}`);
    }

    if (error.originalError) {
      console.error(`Original error: ${error.originalError.message}`);
    }
  }
}
```

### Common Error Scenarios

```typescript
// Duplicate plugin loading
try {
  await pluginManager.loadPlugin(new PhysicsPlugin());
  await pluginManager.loadPlugin(new PhysicsPlugin()); // Error!
} catch (error) {
  // PluginError: Plugin 'physics-2d' is already loaded
}

// Missing dependencies
try {
  const plugin = new AdvancedPhysicsPlugin(); // Depends on 'physics-2d'
  await pluginManager.loadPlugin(plugin); // Error!
} catch (error) {
  // PluginError: Plugin 'advanced-physics' requires dependency 'physics-2d' which is not loaded
}

// Circular dependencies
try {
  const pluginA = new PluginA(); // Depends on plugin-b
  const pluginB = new PluginB(); // Depends on plugin-a
  await pluginManager.loadPlugin(pluginA);
  await pluginManager.loadPlugin(pluginB); // Error!
} catch (error) {
  // PluginError: Circular dependency detected among plugins: plugin-a, plugin-b
}

// Cannot unload with dependents
try {
  await pluginManager.loadPlugin(new BasePlugin());
  await pluginManager.loadPlugin(new DependentPlugin()); // Depends on base-plugin
  await pluginManager.unloadPlugin('base-plugin'); // Error!
} catch (error) {
  // PluginError: Cannot unload plugin 'base-plugin' because it is required by: dependent-plugin
}
```

## Advanced Usage Patterns

### Hot Reloading

```typescript
class HotReloadManager {
  constructor(private pluginManager: PluginManager) {}

  async reloadPlugin(pluginName: string, newPluginInstance: Plugin): Promise<void> {
    // Find dependents
    const dependents = this.findDependents(pluginName);

    // Unload dependents in reverse order
    for (const dependent of dependents.reverse()) {
      await this.pluginManager.unloadPlugin(dependent);
    }

    // Unload target plugin
    await this.pluginManager.unloadPlugin(pluginName);

    // Load new version
    await this.pluginManager.loadPlugin(newPluginInstance);

    // Reload dependents
    for (const dependent of dependents) {
      const dependentPlugin = this.getStoredPlugin(dependent);
      await this.pluginManager.loadPlugin(dependentPlugin);
    }
  }

  private findDependents(pluginName: string): string[] {
    return this.pluginManager.getAllPluginMetadata()
      .filter(meta => meta.dependencies.includes(pluginName))
      .map(meta => meta.name);
  }
}
```

### Plugin Registry

```typescript
class PluginRegistry {
  private availablePlugins = new Map<string, () => Plugin>();

  registerPlugin(name: string, factory: () => Plugin): void {
    this.availablePlugins.set(name, factory);
  }

  async loadPluginByName(
    pluginManager: PluginManager,
    name: string
  ): Promise<void> {
    const factory = this.availablePlugins.get(name);
    if (!factory) {
      throw new Error(`Plugin '${name}' not found in registry`);
    }

    const plugin = factory();
    await pluginManager.loadPlugin(plugin);
  }

  getAvailablePlugins(): string[] {
    return Array.from(this.availablePlugins.keys());
  }
}

// Usage
const registry = new PluginRegistry();
registry.registerPlugin('physics', () => new PhysicsPlugin());
registry.registerPlugin('graphics', () => new GraphicsPlugin());

await registry.loadPluginByName(pluginManager, 'physics');
```

### Configuration-Based Loading

```typescript
interface PluginConfig {
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

class ConfigurablePluginLoader {
  constructor(
    private pluginManager: PluginManager,
    private pluginFactories: Map<string, (config?: any) => Plugin>
  ) {}

  async loadFromConfig(configs: PluginConfig[]): Promise<void> {
    // Sort by dependencies
    const sortedConfigs = this.sortByDependencies(configs);

    for (const config of sortedConfigs) {
      if (config.enabled) {
        const factory = this.pluginFactories.get(config.name);
        if (factory) {
          const plugin = factory(config.config);
          await this.pluginManager.loadPlugin(plugin);
        }
      }
    }
  }

  private sortByDependencies(configs: PluginConfig[]): PluginConfig[] {
    // Implementation for dependency sorting
    return configs; // Simplified
  }
}
```

### Plugin Health Monitoring

```typescript
class PluginHealthMonitor {
  private healthChecks = new Map<string, () => Promise<boolean>>();

  registerHealthCheck(
    pluginName: string,
    healthCheck: () => Promise<boolean>
  ): void {
    this.healthChecks.set(pluginName, healthCheck);
  }

  async checkAllPlugins(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [pluginName, healthCheck] of this.healthChecks) {
      try {
        const isHealthy = await healthCheck();
        results.set(pluginName, isHealthy);
      } catch (error) {
        console.error(`Health check failed for ${pluginName}:`, error);
        results.set(pluginName, false);
      }
    }

    return results;
  }

  async getUnhealthyPlugins(): Promise<string[]> {
    const healthResults = await this.checkAllPlugins();
    return Array.from(healthResults.entries())
      .filter(([, isHealthy]) => !isHealthy)
      .map(([pluginName]) => pluginName);
  }
}
```

## Performance Considerations

### Plugin Load Time Optimization

```typescript
class OptimizedPluginManager extends PluginManager {
  private initializationCache = new Map<string, Promise<void>>();

  async loadPlugin(plugin: Plugin): Promise<void> {
    // Cache initialization promises to avoid duplicate work
    const cacheKey = `${plugin.name}:${plugin.version}`;

    if (this.initializationCache.has(cacheKey)) {
      return this.initializationCache.get(cacheKey)!;
    }

    const initPromise = super.loadPlugin(plugin);
    this.initializationCache.set(cacheKey, initPromise);

    try {
      await initPromise;
    } catch (error) {
      // Remove failed initialization from cache
      this.initializationCache.delete(cacheKey);
      throw error;
    }
  }
}
```

### Batch Operations

```typescript
async function loadPluginBatch(
  pluginManager: PluginManager,
  plugins: Plugin[]
): Promise<void> {
  const errors: PluginError[] = [];

  // Load in dependency order
  for (const plugin of plugins) {
    try {
      await pluginManager.loadPlugin(plugin);
    } catch (error) {
      if (error instanceof PluginError) {
        errors.push(error);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`Failed to load ${errors.length} plugins:`);
    errors.forEach(error => console.error(`- ${error.message}`));
  }
}
```

## Testing

### Mock Plugin Manager

```typescript
class MockPluginManager extends PluginManager {
  private mockPlugins = new Map<string, Plugin>();

  async loadPlugin(plugin: Plugin): Promise<void> {
    // Store plugin without actually initializing
    this.mockPlugins.set(plugin.name, plugin);
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    this.mockPlugins.delete(pluginName);
  }

  isPluginLoaded(pluginName: string): boolean {
    return this.mockPlugins.has(pluginName);
  }
}
```

### Plugin Manager Testing

```typescript
describe('PluginManager', () => {
  let world: World;
  let pluginManager: PluginManager;

  beforeEach(() => {
    world = new World();
    pluginManager = new PluginManager(world);
  });

  test('should load plugin successfully', async () => {
    const plugin = new TestPlugin();
    await pluginManager.loadPlugin(plugin);

    expect(pluginManager.isPluginLoaded('test-plugin')).toBe(true);
  });

  test('should handle dependency resolution', async () => {
    const basePlugin = new BasePlugin();
    const dependentPlugin = new DependentPlugin();

    await pluginManager.loadPlugin(dependentPlugin); // Should fail
    await expect(pluginManager.loadPlugin(dependentPlugin))
      .rejects.toThrow('requires dependency');

    await pluginManager.loadPlugin(basePlugin);
    await pluginManager.loadPlugin(dependentPlugin); // Should succeed

    const loadOrder = pluginManager.getLoadOrder();
    expect(loadOrder.indexOf('base-plugin'))
      .toBeLessThan(loadOrder.indexOf('dependent-plugin'));
  });
});
```

## See Also

- [Plugin](./plugin.md) - Base plugin interface and development patterns
- [NetworkPlugin](./network-plugin.md) - Network-specific plugin interface
- [StoragePlugin](./storage-plugin.md) - Storage-specific plugin interface
- [World](../core/world.md) - ECS World integration