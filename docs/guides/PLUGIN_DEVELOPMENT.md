# Plugin Development Guide

This guide covers creating, distributing, and maintaining plugins for the ECS game engine, including best practices for extensible and maintainable plugin architecture.

## Plugin Architecture Overview

### Plugin Interface

All plugins must implement the Plugin interface:

```typescript
interface Plugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  initialize(world: World): Promise<void>;
  shutdown?(): Promise<void>;
}
```

### Basic Plugin Structure

```typescript
class MyGamePlugin implements Plugin {
  readonly name = 'my-game-plugin';
  readonly version = '1.0.0';
  readonly dependencies = ['physics-2d']; // Optional dependencies

  private systems: BaseSystem[] = [];
  private eventSubscriptions: Array<() => void> = [];

  async initialize(world: World): Promise<void> {
    console.log(`Initializing ${this.name} v${this.version}`);

    // Register systems
    this.systems.push(new MyGameSystem());
    this.systems.forEach(system => world.addSystem(system));

    // Subscribe to events
    const unsubscribe = world.subscribeToEvent('game-start', (event) => {
      this.handleGameStart(world, event);
    });
    this.eventSubscriptions.push(unsubscribe);

    // Emit initialization event
    world.emitEvent({
      type: 'plugin-initialized',
      timestamp: Date.now(),
      data: { pluginName: this.name, version: this.version }
    });
  }

  async shutdown(): Promise<void> {
    console.log(`Shutting down ${this.name}`);

    // Clean up event subscriptions
    this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
    this.eventSubscriptions = [];

    // Clean up systems (if needed)
    this.systems.forEach(system => {
      if (system.shutdown) {
        system.shutdown();
      }
    });
  }

  private handleGameStart(world: World, event: GameEvent): void {
    // Plugin-specific game start logic
  }
}
```

## Plugin Categories and Patterns

### Core System Plugins

Plugins that provide fundamental game systems:

```typescript
class PhysicsPlugin implements Plugin {
  readonly name = 'physics-2d';
  readonly version = '2.1.0';

  private physicsSystem: PhysicsSystem;
  private collisionSystem: CollisionSystem;

  async initialize(world: World): Promise<void> {
    // Initialize physics world
    this.physicsSystem = new PhysicsSystem();
    this.collisionSystem = new CollisionSystem();

    world.addSystem(this.physicsSystem);
    world.addSystem(this.collisionSystem);

    // Register physics component types
    this.registerPhysicsComponents(world);

    // Set up physics event handlers
    this.setupPhysicsEvents(world);
  }

  private registerPhysicsComponents(world: World): void {
    // Physics components are registered automatically when used
    // This is just for documentation and validation
    const componentTypes = [
      'rigidbody',
      'collider',
      'physics-material',
      'joint'
    ];

    world.emitEvent({
      type: 'components-registered',
      timestamp: Date.now(),
      data: {
        plugin: this.name,
        componentTypes
      }
    });
  }

  private setupPhysicsEvents(world: World): void {
    world.subscribeToEvent('collision-detected', (event) => {
      this.handleCollision(world, event.data);
    });

    world.subscribeToEvent('apply-force', (event) => {
      this.applyForce(world, event.data);
    });
  }

  private handleCollision(world: World, collisionData: any): void {
    // Emit gameplay-relevant collision events
    world.emitEvent({
      type: 'entities-collided',
      timestamp: Date.now(),
      data: {
        entityA: collisionData.entityA,
        entityB: collisionData.entityB,
        contactPoint: collisionData.contactPoint,
        impulse: collisionData.impulse
      }
    });
  }
}
```

### Feature Enhancement Plugins

Plugins that add optional features:

```typescript
class EnhancedAudioPlugin implements Plugin {
  readonly name = 'enhanced-audio';
  readonly version = '1.3.0';
  readonly dependencies = ['core-audio']; // Depends on basic audio

  private audioContext?: AudioContext;
  private spatialAudioSystem?: SpatialAudioSystem;
  private loadedSounds = new Map<string, AudioBuffer>();

  async initialize(world: World): Promise<void> {
    // Initialize Web Audio API
    this.audioContext = new AudioContext();

    // Add enhanced audio systems
    this.spatialAudioSystem = new SpatialAudioSystem(this.audioContext);
    world.addSystem(this.spatialAudioSystem);
    world.addSystem(new ReverbSystem(this.audioContext));
    world.addSystem(new DynamicMusicSystem());

    // Set up audio event handlers
    this.setupAudioEvents(world);

    // Preload common sounds
    await this.preloadAudioAssets();
  }

  private setupAudioEvents(world: World): void {
    world.subscribeToEvent('play-3d-sound', (event) => {
      this.play3DSound(event.data);
    });

    world.subscribeToEvent('music-transition', (event) => {
      this.handleMusicTransition(event.data);
    });

    world.subscribeToEvent('audio-zone-entered', (event) => {
      this.handleAudioZone(event.data);
    });
  }

  private async preloadAudioAssets(): Promise<void> {
    const soundUrls = [
      'assets/sounds/footstep.wav',
      'assets/sounds/jump.wav',
      'assets/sounds/collect.wav'
    ];

    await Promise.all(soundUrls.map(async (url) => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

        const soundName = url.split('/').pop()!.split('.')[0];
        this.loadedSounds.set(soundName, audioBuffer);
      } catch (error) {
        console.warn(`Failed to load sound ${url}:`, error);
      }
    }));
  }

  async shutdown(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
    }
  }
}
```

### UI/UX Plugins

Plugins that provide user interface enhancements:

```typescript
class DebugUIPlugin implements Plugin {
  readonly name = 'debug-ui';
  readonly version = '0.9.0';
  readonly dependencies = ['core-game'];

  private debugPanel?: HTMLElement;
  private stats = {
    fps: 0,
    entityCount: 0,
    systemPerformance: new Map<string, number>()
  };

  async initialize(world: World): Promise<void> {
    // Only initialize in development mode
    if (process.env.NODE_ENV !== 'development') {
      console.log('Debug UI disabled in production');
      return;
    }

    this.createDebugPanel();
    world.addSystem(new DebugStatsSystem(this.stats));

    // Set up debug event handlers
    this.setupDebugEvents(world);
  }

  private createDebugPanel(): void {
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'debug-panel';
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 5px;
      z-index: 9999;
      min-width: 200px;
    `;

    document.body.appendChild(this.debugPanel);
    this.updateDebugDisplay();
  }

  private setupDebugEvents(world: World): void {
    // Update debug info every second
    setInterval(() => {
      this.updateDebugDisplay();
    }, 1000);

    // Listen for performance data
    world.subscribeToEvent('system-performance', (event) => {
      this.stats.systemPerformance.set(event.data.systemName, event.data.executionTime);
    });

    // Debug commands
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        this.toggleDebugPanel();
      }
    });
  }

  private updateDebugDisplay(): void {
    if (!this.debugPanel) return;

    const html = `
      <h3>Debug Info</h3>
      <div>FPS: ${this.stats.fps}</div>
      <div>Entities: ${this.stats.entityCount}</div>
      <h4>System Performance:</h4>
      ${Array.from(this.stats.systemPerformance.entries())
        .map(([name, time]) => `<div>${name}: ${time.toFixed(2)}ms</div>`)
        .join('')}
    `;

    this.debugPanel.innerHTML = html;
  }

  private toggleDebugPanel(): void {
    if (this.debugPanel) {
      this.debugPanel.style.display =
        this.debugPanel.style.display === 'none' ? 'block' : 'none';
    }
  }

  async shutdown(): Promise<void> {
    if (this.debugPanel) {
      document.body.removeChild(this.debugPanel);
    }
  }
}
```

## Advanced Plugin Patterns

### Storage Plugins

Plugins that handle data persistence:

```typescript
class LocalStoragePlugin extends BaseStoragePlugin {
  readonly name = 'local-storage';
  readonly version = '1.2.0';

  private keyPrefix = 'ecs-game-';

  async save<T>(key: string, data: T, options?: StorageOptions): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      const fullKey = this.keyPrefix + key;

      localStorage.setItem(fullKey, serialized);

      if (options?.compress) {
        // Implement compression if needed
        console.log(`Saved ${key} (${serialized.length} bytes)`);
      }
    } catch (error) {
      throw new Error(`Failed to save ${key}: ${error.message}`);
    }
  }

  async load<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const fullKey = this.keyPrefix + key;
      const serialized = localStorage.getItem(fullKey);

      if (serialized === null) {
        return defaultValue;
      }

      return JSON.parse(serialized) as T;
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
      return defaultValue;
    }
  }

  async remove(key: string): Promise<boolean> {
    const fullKey = this.keyPrefix + key;
    const existed = localStorage.getItem(fullKey) !== null;
    localStorage.removeItem(fullKey);
    return existed;
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.keyPrefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  async getStats(): Promise<StorageStats> {
    let totalSize = 0;
    let itemCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.keyPrefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
          itemCount++;
        }
      }
    }

    return {
      totalSize,
      itemCount,
      availableSpace: this.getAvailableSpace()
    };
  }

  private getAvailableSpace(): number {
    try {
      // Estimate available localStorage space
      const testKey = 'storage-test';
      let size = 0;
      const increment = 1024; // 1KB

      while (true) {
        try {
          const testData = 'x'.repeat(increment);
          localStorage.setItem(testKey, testData);
          localStorage.removeItem(testKey);
          size += increment;
        } catch {
          break;
        }
      }

      return size;
    } catch {
      return -1; // Unknown
    }
  }
}
```

### Network Plugins

Plugins that handle networking:

```typescript
class WebSocketNetworkPlugin extends BaseNetworkPlugin {
  readonly name = 'websocket-network';
  readonly version = '2.0.0';

  private ws?: WebSocket;
  private messageQueue: NetworkMessage[] = [];
  private connected = false;

  async initialize(world: World): Promise<void> {
    world.addSystem(new NetworkSyncSystem());

    this.setupNetworkEvents(world);
    await this.connect();
  }

  async connect(url: string = 'ws://localhost:3000/ws'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        console.log('Connected to server');

        // Send queued messages
        this.flushMessageQueue();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('Disconnected from server');
        this.handleDisconnection();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  send(message: NetworkMessage): Promise<void> {
    if (!this.connected || !this.ws) {
      // Queue message for later
      this.messageQueue.push(message);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws!.send(JSON.stringify(message));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupNetworkEvents(world: World): void {
    world.subscribeToEvent('network-send', (event) => {
      this.send(event.data.message);
    });

    world.subscribeToEvent('game-state-sync', (event) => {
      if (this.connected) {
        const syncMessage: NetworkMessage = {
          type: 'game-state',
          timestamp: Date.now(),
          data: event.data
        };
        this.send(syncMessage);
      }
    });
  }

  private handleMessage(message: NetworkMessage): void {
    // Emit received message as event
    this.getWorld()?.emitEvent({
      type: 'network-message-received',
      timestamp: Date.now(),
      data: message
    });
  }

  async shutdown(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

## Plugin Configuration and Settings

### Configuration System

```typescript
interface PluginConfig {
  enabled: boolean;
  settings: Record<string, any>;
}

class ConfigurablePlugin implements Plugin {
  readonly name = 'configurable-plugin';
  readonly version = '1.0.0';

  private config: PluginConfig = {
    enabled: true,
    settings: {
      quality: 'high',
      debug: false,
      maxItems: 100
    }
  };

  async initialize(world: World): Promise<void> {
    // Load configuration
    await this.loadConfiguration();

    if (!this.config.enabled) {
      console.log(`Plugin ${this.name} is disabled`);
      return;
    }

    // Apply settings
    this.applySettings(world);

    // Set up configuration events
    this.setupConfigurationEvents(world);
  }

  private async loadConfiguration(): Promise<void> {
    try {
      // Try to load from storage plugin
      const storagePlugin = this.getStoragePlugin();
      if (storagePlugin) {
        const saved = await storagePlugin.load<PluginConfig>(`config-${this.name}`);
        if (saved) {
          this.config = { ...this.config, ...saved };
        }
      }
    } catch (error) {
      console.warn(`Failed to load configuration for ${this.name}:`, error);
    }
  }

  private applySettings(world: World): void {
    // Apply configuration to systems and components
    const quality = this.config.settings.quality;

    world.emitEvent({
      type: 'quality-setting-changed',
      timestamp: Date.now(),
      data: { quality, pluginName: this.name }
    });

    if (this.config.settings.debug) {
      world.addSystem(new DebugSystem());
    }
  }

  private setupConfigurationEvents(world: World): void {
    world.subscribeToEvent('update-plugin-config', (event) => {
      if (event.data.pluginName === this.name) {
        this.updateConfiguration(event.data.newConfig);
      }
    });
  }

  async updateConfiguration(newConfig: Partial<PluginConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Save to storage
    const storagePlugin = this.getStoragePlugin();
    if (storagePlugin) {
      await storagePlugin.save(`config-${this.name}`, this.config);
    }

    // Apply new settings
    this.applySettings(this.getWorld()!);
  }

  private getStoragePlugin(): any {
    // Get storage plugin from plugin manager
    // Implementation depends on plugin manager API
    return null; // Placeholder
  }

  private getWorld(): World | null {
    // Get world reference
    return null; // Placeholder
  }
}
```

## Plugin Distribution and Packaging

### Plugin Metadata

```typescript
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  engines: {
    'ecs-engine': string; // Compatible engine version
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

// package.json example for a plugin
const pluginPackage = {
  "name": "@mycompany/awesome-plugin",
  "version": "1.2.0",
  "description": "An awesome plugin for the ECS game engine",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "keywords": ["ecs", "game", "plugin", "graphics"],
  "engines": {
    "ecs-engine": "^1.0.0"
  },
  "peerDependencies": {
    "@danjdewhurst/ecs-ts": "^1.0.0"
  },
  "dependencies": {
    "three": "^0.155.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
};
```

### Plugin Registry

```typescript
class PluginRegistry {
  private plugins = new Map<string, PluginInfo>();

  register(plugin: Plugin, metadata: PluginMetadata): void {
    const info: PluginInfo = {
      plugin,
      metadata,
      registeredAt: Date.now(),
      status: 'registered'
    };

    this.plugins.set(plugin.name, info);
  }

  discover(packagePaths: string[]): PluginMetadata[] {
    const discovered: PluginMetadata[] = [];

    for (const packagePath of packagePaths) {
      try {
        const packageJson = require(`${packagePath}/package.json`);

        if (this.isValidPluginPackage(packageJson)) {
          discovered.push(this.extractMetadata(packageJson));
        }
      } catch (error) {
        console.warn(`Failed to read package at ${packagePath}:`, error);
      }
    }

    return discovered;
  }

  async loadFromNPM(packageName: string): Promise<Plugin> {
    try {
      // Dynamic import for ESM compatibility
      const pluginModule = await import(packageName);

      if (!pluginModule.default || !this.isValidPlugin(pluginModule.default)) {
        throw new Error(`Invalid plugin export in ${packageName}`);
      }

      return new pluginModule.default();
    } catch (error) {
      throw new Error(`Failed to load plugin ${packageName}: ${error.message}`);
    }
  }

  private isValidPluginPackage(packageJson: any): boolean {
    return (
      packageJson.keywords?.includes('ecs-plugin') ||
      packageJson.keywords?.includes('ecs-game-plugin') ||
      packageJson.engines?.['ecs-engine']
    );
  }

  private isValidPlugin(pluginClass: any): boolean {
    const instance = new pluginClass();
    return (
      typeof instance.name === 'string' &&
      typeof instance.version === 'string' &&
      typeof instance.initialize === 'function'
    );
  }
}
```

## Testing Plugin Development

### Plugin Testing Framework

```typescript
class PluginTestSuite {
  private world: World;
  private pluginManager: PluginManager;

  constructor() {
    this.world = new World();
    this.pluginManager = new PluginManager(this.world);
  }

  async testPlugin(plugin: Plugin): Promise<TestResult> {
    const result: TestResult = {
      passed: true,
      errors: [],
      warnings: [],
      coverage: {}
    };

    try {
      // Test plugin validation
      this.validatePluginInterface(plugin, result);

      // Test initialization
      await this.testInitialization(plugin, result);

      // Test functionality
      await this.testFunctionality(plugin, result);

      // Test cleanup
      await this.testShutdown(plugin, result);

    } catch (error) {
      result.passed = false;
      result.errors.push(`Critical test failure: ${error.message}`);
    }

    return result;
  }

  private validatePluginInterface(plugin: Plugin, result: TestResult): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      result.errors.push('Plugin name must be a non-empty string');
      result.passed = false;
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      result.errors.push('Plugin version must be a non-empty string');
      result.passed = false;
    }

    if (typeof plugin.initialize !== 'function') {
      result.errors.push('Plugin must implement initialize method');
      result.passed = false;
    }

    // Check semantic versioning
    const semverPattern = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
    if (!semverPattern.test(plugin.version)) {
      result.warnings.push('Plugin version should follow semantic versioning');
    }
  }

  private async testInitialization(plugin: Plugin, result: TestResult): void {
    const startTime = Date.now();

    try {
      await this.pluginManager.loadPlugin(plugin);

      const initTime = Date.now() - startTime;
      if (initTime > 1000) {
        result.warnings.push(`Plugin initialization took ${initTime}ms (consider optimizing)`);
      }

    } catch (error) {
      result.errors.push(`Initialization failed: ${error.message}`);
      result.passed = false;
    }
  }

  private async testFunctionality(plugin: Plugin, result: TestResult): void {
    // Test that systems are properly registered
    const systems = this.world.getSystems();
    const systemsCount = systems.length;

    if (systemsCount === 0) {
      result.warnings.push('Plugin did not register any systems');
    }

    // Test event handling
    let eventReceived = false;
    const unsubscribe = this.world.subscribeToEvent('test-event', () => {
      eventReceived = true;
    });

    this.world.emitEvent({
      type: 'test-event',
      timestamp: Date.now(),
      data: {}
    });

    this.world.processEvents();
    unsubscribe();

    // Add more specific functionality tests here
  }

  private async testShutdown(plugin: Plugin, result: TestResult): void {
    if (plugin.shutdown) {
      try {
        await plugin.shutdown();
      } catch (error) {
        result.errors.push(`Shutdown failed: ${error.message}`);
        result.passed = false;
      }
    }
  }
}

// Usage
const testSuite = new PluginTestSuite();
const result = await testSuite.testPlugin(new MyPlugin());

if (result.passed) {
  console.log('✅ Plugin tests passed');
} else {
  console.error('❌ Plugin tests failed:', result.errors);
}
```

### Mock Plugin for Testing

```typescript
class MockTestPlugin implements Plugin {
  readonly name = 'test-plugin';
  readonly version = '1.0.0-test';

  public initializeCalled = false;
  public shutdownCalled = false;
  public worldReference?: World;

  async initialize(world: World): Promise<void> {
    this.initializeCalled = true;
    this.worldReference = world;

    // Add test system
    world.addSystem(new TestSystem());

    // Register test event handler
    world.subscribeToEvent('test-plugin-event', (event) => {
      world.emitEvent({
        type: 'test-plugin-response',
        timestamp: Date.now(),
        data: { received: event.data }
      });
    });
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
    this.worldReference = undefined;
  }
}

class TestSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'TestSystem';

  update(world: World): void {
    // Minimal test system
  }
}
```

## Best Practices

### Plugin Development Guidelines

1. **Single Responsibility**: Each plugin should have one clear purpose
2. **Minimal Dependencies**: Avoid unnecessary dependencies
3. **Graceful Degradation**: Handle missing dependencies elegantly
4. **Resource Cleanup**: Always implement proper shutdown
5. **Event-Driven Design**: Use events for loose coupling
6. **Configuration Support**: Make plugins configurable
7. **Error Handling**: Provide clear error messages
8. **Documentation**: Include comprehensive documentation
9. **Testing**: Write tests for all plugin functionality
10. **Versioning**: Follow semantic versioning

### Performance Considerations

```typescript
class PerformantPlugin implements Plugin {
  readonly name = 'performant-plugin';
  readonly version = '1.0.0';

  private resourcePool = new ObjectPool(
    () => ({ data: null, processed: false }),
    (obj) => { obj.data = null; obj.processed = false; },
    10, 100
  );

  async initialize(world: World): Promise<void> {
    // Lazy load heavy resources
    world.subscribeToEvent('resource-needed', async (event) => {
      await this.loadResourceOnDemand(event.data.resourceId);
    });

    // Use efficient systems
    world.addSystem(new OptimizedSystem(this.resourcePool));
  }

  private async loadResourceOnDemand(resourceId: string): Promise<void> {
    // Only load when actually needed
    if (!this.hasResource(resourceId)) {
      await this.loadResource(resourceId);
    }
  }

  async shutdown(): Promise<void> {
    // Clean up resources
    this.resourcePool.clear();
  }
}
```

## See Also

- [Plugin API](../api/plugins/plugin.md) - Plugin interface reference
- [Plugin Manager API](../api/plugins/plugin-manager.md) - Plugin loading and management
- [Plugin System Demo](../examples/plugin-system-demo.md) - Complete plugin examples
- [System Development](./systems-and-scheduling.md) - Creating systems for plugins
- [Testing Strategies](./testing-strategies.md) - Testing plugin implementations