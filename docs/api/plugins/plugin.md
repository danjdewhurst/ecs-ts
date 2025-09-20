# Plugin

The `Plugin` interface defines the contract for all plugins in the ECS game engine. Plugins provide extensible functionality that can be loaded and unloaded at runtime, enabling modular game development and third-party extensions.

## Interface Definition

```typescript
interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  initialize(world: World): Promise<void>;
  shutdown?(): Promise<void>;
}
```

## Properties

### name

```typescript
readonly name: string
```

Unique identifier for the plugin. Must be globally unique across all loaded plugins.

#### Naming Conventions
- Use kebab-case: `my-awesome-plugin`
- Be descriptive and specific: `physics-2d` vs `physics`
- Include vendor prefix for third-party plugins: `acme-inventory-system`

#### Example
```typescript
const myPlugin: Plugin = {
  name: 'enhanced-graphics',
  // ... other properties
};
```

### version

```typescript
readonly version: string
```

Semantic version of the plugin following [SemVer](https://semver.org/) specification.

#### Version Format
- `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- Pre-release: `1.2.3-alpha.1`, `1.2.3-beta.2`, `1.2.3-rc.1`
- Build metadata: `1.2.3+20230615`

#### Example
```typescript
const myPlugin: Plugin = {
  name: 'physics-engine',
  version: '2.1.0',
  // ... other properties
};
```

### dependencies

```typescript
readonly dependencies?: string[]
```

Optional array of plugin names that this plugin requires to be loaded first. Dependencies are resolved automatically by the PluginManager.

#### Example
```typescript
const myPlugin: Plugin = {
  name: 'advanced-ai',
  version: '1.0.0',
  dependencies: ['pathfinding', 'behavior-trees'],
  // ... other properties
};
```

## Methods

### initialize

```typescript
initialize(world: World): Promise<void>
```

Called when the plugin is being loaded. This is where the plugin should register its systems, components, event handlers, and perform any necessary setup.

#### Parameters
- `world: World` - The game world instance

#### Throws
- `Error` - If initialization fails

#### Example
```typescript
class MyPlugin implements Plugin {
  readonly name = 'my-plugin';
  readonly version = '1.0.0';

  async initialize(world: World): Promise<void> {
    // Register systems
    world.addSystem(new MySystem());

    // Subscribe to events
    world.subscribeToEvent('game-started', this.handleGameStart);

    // Initialize plugin-specific resources
    await this.setupResources();

    console.log(`Plugin ${this.name} v${this.version} initialized`);
  }

  private handleGameStart = (event: GameEvent) => {
    console.log('Game started, plugin responding');
  };

  private async setupResources(): Promise<void> {
    // Load configuration, connect to services, etc.
  }
}
```

### shutdown

```typescript
shutdown?(): Promise<void>
```

Optional cleanup method called when the plugin is being unloaded. Should clean up resources, remove event listeners, and perform graceful shutdown.

#### Example
```typescript
class MyPlugin implements Plugin {
  readonly name = 'my-plugin';
  readonly version = '1.0.0';
  private unsubscribeCallbacks: Array<() => void> = [];
  private resources: MyResource[] = [];

  async initialize(world: World): Promise<void> {
    // Store unsubscribe callbacks for cleanup
    this.unsubscribeCallbacks.push(
      world.subscribeToEvent('game-started', this.handleGameStart)
    );

    this.resources.push(await this.createResource());
  }

  async shutdown(): Promise<void> {
    // Remove event listeners
    this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    this.unsubscribeCallbacks = [];

    // Cleanup resources
    await Promise.all(this.resources.map(resource => resource.cleanup()));
    this.resources = [];

    console.log(`Plugin ${this.name} shut down successfully`);
  }
}
```

## Plugin Metadata

The `PluginMetadata` interface provides introspection information about loaded plugins:

```typescript
interface PluginMetadata {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  readonly isLoaded: boolean;
  readonly loadedAt?: number;
}
```

### Example Usage
```typescript
// Get metadata for a specific plugin
const metadata = pluginManager.getPluginMetadata('my-plugin');
if (metadata) {
  console.log(`Plugin ${metadata.name} v${metadata.version}`);
  console.log(`Loaded: ${metadata.isLoaded}`);
  console.log(`Dependencies: ${metadata.dependencies.join(', ')}`);
}

// Get all plugin metadata
const allPlugins = pluginManager.getAllPluginMetadata();
allPlugins.forEach(plugin => {
  console.log(`${plugin.name}: ${plugin.isLoaded ? 'Loaded' : 'Not Loaded'}`);
});
```

## Plugin Development Patterns

### System Registration

```typescript
class GraphicsPlugin implements Plugin {
  readonly name = 'graphics-engine';
  readonly version = '1.0.0';
  readonly dependencies = ['resource-manager'];

  async initialize(world: World): Promise<void> {
    // Register rendering systems in order
    world.addSystem(new CameraSystem(), 10);
    world.addSystem(new SpriteRenderSystem(), 20);
    world.addSystem(new LightingSystem(), 30);
    world.addSystem(new PostProcessSystem(), 40);
  }
}
```

### Component Registration

```typescript
class PhysicsPlugin implements Plugin {
  readonly name = 'physics-2d';
  readonly version = '2.1.0';

  async initialize(world: World): Promise<void> {
    // Register component types (if using a component registry)
    world.registerComponentType('rigidbody', RigidBodyComponent);
    world.registerComponentType('collider', ColliderComponent);
    world.registerComponentType('physics-material', PhysicsMaterialComponent);

    // Add physics systems
    world.addSystem(new PhysicsSystem());
    world.addSystem(new CollisionDetectionSystem());
  }
}
```

### Event-Driven Plugins

```typescript
class AudioPlugin implements Plugin {
  readonly name = 'audio-engine';
  readonly version = '1.5.0';
  private audioContext: AudioContext;
  private eventHandlers: Array<() => void> = [];

  async initialize(world: World): Promise<void> {
    this.audioContext = new AudioContext();

    // Register event handlers
    this.eventHandlers.push(
      world.subscribeToEvent('play-sound', this.handlePlaySound),
      world.subscribeToEvent('stop-sound', this.handleStopSound),
      world.subscribeToEvent('set-volume', this.handleSetVolume)
    );

    // Add audio systems
    world.addSystem(new AudioSystem(this.audioContext));
  }

  async shutdown(): Promise<void> {
    // Cleanup event handlers
    this.eventHandlers.forEach(unsubscribe => unsubscribe());

    // Cleanup audio context
    await this.audioContext.close();
  }

  private handlePlaySound = (event: GameEvent) => {
    const { soundId, volume, position } = event.data;
    // Play sound logic
  };
}
```

### Configuration-Based Plugins

```typescript
interface MyPluginConfig {
  apiKey: string;
  serverUrl: string;
  timeout: number;
}

class NetworkPlugin implements Plugin {
  readonly name = 'network-client';
  readonly version = '1.0.0';

  constructor(private config: MyPluginConfig) {}

  async initialize(world: World): Promise<void> {
    // Use configuration for setup
    const client = new NetworkClient({
      url: this.config.serverUrl,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });

    await client.connect();

    world.addSystem(new NetworkSystem(client));
  }
}

// Usage
const networkPlugin = new NetworkPlugin({
  apiKey: 'your-api-key',
  serverUrl: 'wss://game.example.com',
  timeout: 5000
});
```

## Plugin Lifecycle

### Loading Sequence

1. **Validation**: Plugin interface compliance check
2. **Dependency Resolution**: Ensure all dependencies are loaded
3. **Registration**: Add to plugin registry
4. **Initialization**: Call `initialize()` method
5. **Activation**: Mark as loaded and ready

### Unloading Sequence

1. **Dependency Check**: Ensure no other plugins depend on this one
2. **Shutdown**: Call `shutdown()` method if present
3. **Cleanup**: Remove from registries
4. **Deactivation**: Mark as unloaded

### Error Handling

```typescript
class RobustPlugin implements Plugin {
  readonly name = 'robust-plugin';
  readonly version = '1.0.0';

  async initialize(world: World): Promise<void> {
    try {
      await this.criticalInitialization();
    } catch (error) {
      console.error(`Critical initialization failed: ${error.message}`);
      throw error; // Re-throw to fail plugin loading
    }

    try {
      await this.optionalInitialization();
    } catch (error) {
      console.warn(`Optional feature failed to initialize: ${error.message}`);
      // Don't re-throw, allow plugin to load with reduced functionality
    }
  }

  private async criticalInitialization(): Promise<void> {
    // Must succeed for plugin to work
  }

  private async optionalInitialization(): Promise<void> {
    // Nice to have, but not critical
  }
}
```

## Plugin Testing

### Unit Testing

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { World } from '@danjdewhurst/ecs-ts';
import { MyPlugin } from './MyPlugin';

describe('MyPlugin', () => {
  let world: World;
  let plugin: MyPlugin;

  beforeEach(() => {
    world = new World();
    plugin = new MyPlugin();
  });

  test('should initialize successfully', async () => {
    await expect(plugin.initialize(world)).resolves.not.toThrow();
  });

  test('should register systems', async () => {
    await plugin.initialize(world);

    // Verify systems were added
    const systemNames = world.getSystems().map(s => s.constructor.name);
    expect(systemNames).toContain('MySystem');
  });

  test('should handle initialization errors gracefully', async () => {
    // Mock a failure condition
    const invalidWorld = null as any;

    await expect(plugin.initialize(invalidWorld)).rejects.toThrow();
  });

  test('should cleanup on shutdown', async () => {
    await plugin.initialize(world);
    await plugin.shutdown?.();

    // Verify cleanup occurred
    expect(plugin.isCleanedUp).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { PluginManager } from '@danjdewhurst/ecs-ts';

describe('Plugin Integration', () => {
  test('should load plugins with dependencies in correct order', async () => {
    const world = new World();
    const pluginManager = new PluginManager(world);

    const basePlugin = new BasePlugin();
    const dependentPlugin = new DependentPlugin(); // depends on BasePlugin

    await pluginManager.loadPlugin(basePlugin);
    await pluginManager.loadPlugin(dependentPlugin);

    const loadOrder = pluginManager.getLoadOrder();
    expect(loadOrder).toEqual(['base-plugin', 'dependent-plugin']);
  });
});
```

## Best Practices

### Plugin Design
- **Single Responsibility**: Each plugin should have one clear purpose
- **Minimal Dependencies**: Reduce coupling between plugins
- **Graceful Degradation**: Handle missing dependencies gracefully
- **Resource Management**: Always clean up in shutdown method

### Error Handling
- **Fail Fast**: Throw errors early if critical requirements aren't met
- **Descriptive Errors**: Provide clear error messages with context
- **Logging**: Use consistent logging for debugging

### Performance
- **Lazy Loading**: Load resources only when needed
- **Cleanup**: Release resources promptly in shutdown
- **Async Operations**: Use async/await for I/O operations

### Security
- **Input Validation**: Validate all external inputs
- **Sandbox**: Limit plugin access to necessary APIs only
- **Version Checking**: Validate plugin versions for compatibility

## See Also

- [PluginManager](./plugin-manager.md) - Plugin lifecycle management
- [NetworkPlugin](./network-plugin.md) - Network-specific plugin interface
- [StoragePlugin](./storage-plugin.md) - Storage-specific plugin interface
- [World](../core/world.md) - ECS World integration