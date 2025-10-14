# StoragePlugin

The `StoragePlugin` interface extends the base Plugin interface with persistent storage functionality. It provides a standardized API for saving, loading, and managing game data across different storage backends like files, databases, and cloud storage.

## Interface Definition

```typescript
interface StoragePlugin extends Plugin {
  save(key: string, data: unknown, options?: StorageOptions): Promise<void>;
  load<T = unknown>(key: string, options?: LoadOptions): Promise<T | undefined>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  listKeys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
  getMetadata(key: string): Promise<StorageMetadata | undefined>;
  transaction(operations: StorageOperation[]): Promise<void>;
  getStats(): Promise<StorageStats>;
}
```

## Quick Example

```typescript
import { BaseStoragePlugin, StoragePluginConfig } from '@danjdewhurst/ecs-ts';

class FileStoragePlugin extends BaseStoragePlugin {
  readonly name = 'file-storage';
  readonly version = '1.0.0';

  constructor(config: StoragePluginConfig) {
    super(config);
  }

  async initialize(world: World): Promise<void> {
    // Set up file system storage
    await this.ensureStorageDirectory();
    console.log('File storage plugin initialized');
  }

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    this.validateKey(key);

    const serialized = this.serialize(data);
    const filePath = this.getFilePath(key);

    await Bun.write(filePath, serialized);
  }

  async load<T>(key: string, options?: LoadOptions): Promise<T | undefined> {
    this.validateKey(key);

    const filePath = this.getFilePath(key);

    try {
      const content = await Bun.file(filePath).text();
      return this.deserialize<T>(content);
    } catch (error) {
      if (options?.defaultValue !== undefined) {
        return options.defaultValue as T;
      }
      return undefined;
    }
  }

  // ... implement other required methods
}
```

## Configuration

### StoragePluginConfig

```typescript
interface StoragePluginConfig {
  backend: 'memory' | 'file' | 'sqlite' | 'redis' | 'custom';
  connectionString?: string;
  maxSize?: number;
  defaultTtl?: number;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  encryptionKey?: string;
  cleanupInterval?: number;
  poolSize?: number;
}
```

#### Configuration Options
- **backend**: Storage backend type
- **connectionString**: Connection string or file path
- **maxSize**: Maximum storage size in bytes (default: 100MB)
- **defaultTtl**: Default TTL for stored items in milliseconds (default: 0 = no expiration)
- **enableCompression**: Enable compression by default (default: false)
- **enableEncryption**: Enable encryption by default (default: false)
- **encryptionKey**: Encryption key for data encryption
- **cleanupInterval**: Auto-cleanup interval in milliseconds (default: 1 hour)
- **poolSize**: Connection pool size for database backends (default: 10)

#### Example
```typescript
const storageConfig: StoragePluginConfig = {
  backend: 'sqlite',
  connectionString: './game_data.db',
  maxSize: 1024 * 1024 * 500, // 500MB
  defaultTtl: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableCompression: true,
  enableEncryption: true,
  encryptionKey: process.env.STORAGE_ENCRYPTION_KEY,
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  poolSize: 20
};

const storagePlugin = new SQLiteStoragePlugin(storageConfig);
```

## Core Storage Operations

### save

```typescript
async save(key: string, data: unknown, options?: StorageOptions): Promise<void>
```

Saves data to storage with the given key.

#### Parameters
- `key: string` - Unique identifier for the data
- `data: unknown` - The data to store (must be serializable)
- `options?: StorageOptions` - Optional storage options

#### StorageOptions
```typescript
interface StorageOptions {
  ttl?: number;                    // Time-to-live in milliseconds
  compression?: number;            // Compression level (0-9)
  encrypt?: boolean;               // Whether to encrypt the data
  metadata?: Record<string, unknown>; // Custom metadata
  overwrite?: boolean;             // Whether to overwrite existing data
}
```

#### Example
```typescript
// Save player data
await storagePlugin.save('player:123', {
  name: 'Alice',
  level: 42,
  experience: 15000,
  inventory: ['sword', 'potion', 'key']
}, {
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
  encrypt: true,
  metadata: { lastSaved: Date.now(), version: '1.0' }
});

// Save game state with compression
await storagePlugin.save('game:world-state', largeWorldData, {
  compression: 9, // Maximum compression
  metadata: { saveType: 'auto', checkpoint: true }
});
```

### load

```typescript
async load<T = unknown>(key: string, options?: LoadOptions): Promise<T | undefined>
```

Loads data from storage by key.

#### Parameters
- `key: string` - Unique identifier for the data
- `options?: LoadOptions` - Optional load options

#### LoadOptions
```typescript
interface LoadOptions {
  decrypt?: boolean;        // Whether to decrypt the data
  defaultValue?: unknown;   // Default value if key not found
  updateAccessTime?: boolean; // Whether to update last accessed time
}
```

#### Example
```typescript
// Load player data
const playerData = await storagePlugin.load<PlayerData>('player:123');
if (playerData) {
  console.log(`Welcome back, ${playerData.name}!`);
} else {
  console.log('New player detected');
}

// Load with default value
const settings = await storagePlugin.load<GameSettings>('settings:graphics', {
  defaultValue: {
    resolution: '1920x1080',
    quality: 'medium',
    vsync: true
  }
});

// Load encrypted data
const sensitiveData = await storagePlugin.load<SensitiveData>('secure:data', {
  decrypt: true,
  updateAccessTime: true
});
```

### delete

```typescript
async delete(key: string): Promise<boolean>
```

Deletes data from storage by key.

#### Returns
`boolean` - True if data was deleted, false if not found

#### Example
```typescript
// Delete old save file
const deleted = await storagePlugin.delete('player:old-save');
if (deleted) {
  console.log('Old save deleted successfully');
} else {
  console.log('Save file not found');
}

// Cleanup temporary data
const tempKeys = await storagePlugin.listKeys('temp:');
for (const key of tempKeys) {
  await storagePlugin.delete(key);
}
```

### exists

```typescript
async exists(key: string): Promise<boolean>
```

Checks if data exists in storage.

#### Example
```typescript
// Check if player save exists
const hasSave = await storagePlugin.exists('player:123');
if (hasSave) {
  showContinueGameOption();
} else {
  showNewGameOption();
}

// Validate cache
const isCached = await storagePlugin.exists('cache:level-data');
if (!isCached) {
  await loadAndCacheLevel();
}
```

### listKeys

```typescript
async listKeys(prefix?: string): Promise<string[]>
```

Lists all keys in storage, optionally with a prefix filter.

#### Example
```typescript
// List all player saves
const playerKeys = await storagePlugin.listKeys('player:');
console.log(`Found ${playerKeys.length} player saves`);

// List all cache entries
const cacheKeys = await storagePlugin.listKeys('cache:');
const expiredKeys = [];

for (const key of cacheKeys) {
  const metadata = await storagePlugin.getMetadata(key);
  if (metadata?.expiresAt && metadata.expiresAt < Date.now()) {
    expiredKeys.push(key);
  }
}

// Cleanup expired cache
for (const key of expiredKeys) {
  await storagePlugin.delete(key);
}
```

### clear

```typescript
async clear(): Promise<void>
```

Clears all data from storage. Use with caution!

#### Example
```typescript
// Development: Reset all data
if (isDevelopment) {
  await storagePlugin.clear();
  console.log('All storage cleared for development');
}

// Game reset function
async function resetGame(): Promise<void> {
  const confirmed = await confirmAction('Reset all game data?');
  if (confirmed) {
    await storagePlugin.clear();
    initializeNewGame();
  }
}
```

## Advanced Features

### getMetadata

```typescript
async getMetadata(key: string): Promise<StorageMetadata | undefined>
```

Retrieves metadata about stored data.

#### StorageMetadata
```typescript
interface StorageMetadata {
  size: number;              // Size in bytes
  createdAt: number;         // Creation timestamp
  modifiedAt: number;        // Last modification timestamp
  lastAccessedAt?: number;   // Last access timestamp
  expiresAt?: number;        // TTL expiration timestamp
  compressed: boolean;       // Whether data is compressed
  encrypted: boolean;        // Whether data is encrypted
  metadata?: Record<string, unknown>; // Custom metadata
}
```

#### Example
```typescript
const metadata = await storagePlugin.getMetadata('player:123');
if (metadata) {
  console.log(`Save file size: ${formatBytes(metadata.size)}`);
  console.log(`Created: ${new Date(metadata.createdAt).toLocaleDateString()}`);
  console.log(`Last modified: ${new Date(metadata.modifiedAt).toLocaleDateString()}`);

  if (metadata.expiresAt) {
    const expiresIn = metadata.expiresAt - Date.now();
    console.log(`Expires in: ${formatDuration(expiresIn)}`);
  }

  if (metadata.metadata?.version) {
    console.log(`Save version: ${metadata.metadata.version}`);
  }
}
```

### transaction

```typescript
async transaction(operations: StorageOperation[]): Promise<void>
```

Performs multiple storage operations atomically - all succeed or all fail.

#### StorageOperation
```typescript
interface StorageOperation {
  type: 'save' | 'delete';
  key: string;
  data?: unknown;
  options?: StorageOptions;
}
```

#### Example
```typescript
// Atomic player data update
await storagePlugin.transaction([
  {
    type: 'save',
    key: 'player:123:profile',
    data: updatedProfile
  },
  {
    type: 'save',
    key: 'player:123:inventory',
    data: updatedInventory
  },
  {
    type: 'delete',
    key: 'player:123:temp-data'
  }
]);

// Transfer items between players atomically
await storagePlugin.transaction([
  {
    type: 'save',
    key: 'player:from:inventory',
    data: fromPlayerInventory
  },
  {
    type: 'save',
    key: 'player:to:inventory',
    data: toPlayerInventory
  }
]);
```

### getStats

```typescript
async getStats(): Promise<StorageStats>
```

Returns storage statistics and health information.

#### StorageStats
```typescript
interface StorageStats {
  itemCount: number;        // Total number of items
  totalSize: number;        // Total storage size in bytes
  availableSpace?: number;  // Available space in bytes
  backendType: string;      // Storage backend type
  isHealthy: boolean;       // Whether storage is healthy
  lastError?: string;       // Last error message
  performance: {
    avgReadTime: number;    // Average read time in milliseconds
    avgWriteTime: number;   // Average write time in milliseconds
    operationCount: number; // Number of operations performed
  };
}
```

#### Example
```typescript
const stats = await storagePlugin.getStats();

console.log(`Storage: ${stats.backendType}`);
console.log(`Items: ${stats.itemCount}`);
console.log(`Size: ${formatBytes(stats.totalSize)}`);

if (stats.availableSpace) {
  console.log(`Available: ${formatBytes(stats.availableSpace)}`);
}

console.log(`Health: ${stats.isHealthy ? 'OK' : 'ERROR'}`);

if (stats.lastError) {
  console.error(`Last error: ${stats.lastError}`);
}

console.log(`Performance:`);
console.log(`  Read: ${stats.performance.avgReadTime.toFixed(2)}ms`);
console.log(`  Write: ${stats.performance.avgWriteTime.toFixed(2)}ms`);
console.log(`  Operations: ${stats.performance.operationCount}`);
```

## BaseStoragePlugin

The `BaseStoragePlugin` abstract class provides utilities for implementing storage plugins:

```typescript
abstract class BaseStoragePlugin implements StoragePlugin {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  protected config: Required<Omit<StoragePluginConfig, 'encryptionKey'>> & {
    encryptionKey?: string;
  };

  constructor(config: StoragePluginConfig) {
    this.config = {
      backend: config.backend,
      connectionString: config.connectionString ?? '',
      maxSize: config.maxSize ?? 1024 * 1024 * 100,
      defaultTtl: config.defaultTtl ?? 0,
      enableCompression: config.enableCompression ?? false,
      enableEncryption: config.enableEncryption ?? false,
      encryptionKey: config.encryptionKey,
      cleanupInterval: config.cleanupInterval ?? 3600000,
      poolSize: config.poolSize ?? 10
    };
  }

  // Utility methods
  protected validateKey(key: string): void;
  protected serialize(data: unknown): string;
  protected deserialize<T>(data: string): T;
}
```

## Implementation Examples

### File Storage Plugin

```typescript
class FileStoragePlugin extends BaseStoragePlugin {
  readonly name = 'file-storage';
  readonly version = '1.0.0';

  private basePath: string;

  constructor(config: StoragePluginConfig) {
    super(config);
    this.basePath = config.connectionString || './storage';
  }

  async initialize(world: World): Promise<void> {
    await this.ensureDirectory(this.basePath);
  }

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    this.validateKey(key);

    const filePath = this.getFilePath(key);
    await this.ensureDirectory(path.dirname(filePath));

    let serialized = this.serialize(data);

    if (options?.compress || this.config.enableCompression) {
      serialized = await this.compress(serialized);
    }

    if (options?.encrypt || this.config.enableEncryption) {
      serialized = await this.encrypt(serialized);
    }

    await Bun.write(filePath, serialized);

    // Save metadata
    const metadata = {
      size: serialized.length,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      compressed: !!(options?.compress || this.config.enableCompression),
      encrypted: !!(options?.encrypt || this.config.enableEncryption),
      metadata: options?.metadata
    };

    await this.saveMetadata(key, metadata);
  }

  async load<T>(key: string, options?: LoadOptions): Promise<T | undefined> {
    this.validateKey(key);

    const filePath = this.getFilePath(key);

    try {
      let content = await Bun.file(filePath).text();

      const metadata = await this.loadMetadata(key);

      if (metadata?.encrypted && (options?.decrypt ?? this.config.enableEncryption)) {
        content = await this.decrypt(content);
      }

      if (metadata?.compressed) {
        content = await this.decompress(content);
      }

      if (options?.updateAccessTime) {
        await this.updateAccessTime(key);
      }

      return this.deserialize<T>(content);
    } catch (error) {
      return options?.defaultValue as T;
    }
  }

  private getFilePath(key: string): string {
    return path.join(this.basePath, key.replace(/[:/]/g, '_') + '.json');
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    // Implementation to create directories
  }

  private async compress(data: string): Promise<string> {
    // Implementation using gzip or similar
  }

  private async encrypt(data: string): Promise<string> {
    // Implementation using encryption algorithm
  }
}
```

### SQLite Storage Plugin

```typescript
class SQLiteStoragePlugin extends BaseStoragePlugin {
  readonly name = 'sqlite-storage';
  readonly version = '1.0.0';

  private db: Database | null = null;

  async initialize(world: World): Promise<void> {
    this.db = new Database(this.config.connectionString);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        modified_at INTEGER NOT NULL,
        accessed_at INTEGER,
        expires_at INTEGER
      )
    `);

    // Create index for prefix queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_key_prefix ON storage(key)
    `);
  }

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    this.validateKey(key);

    const serialized = this.serialize(data);
    const now = Date.now();
    const expiresAt = options?.ttl ? now + options.ttl : null;

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO storage
      (key, data, metadata, created_at, modified_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      key,
      serialized,
      JSON.stringify(options?.metadata || {}),
      now,
      now,
      expiresAt
    );
  }

  async load<T>(key: string, options?: LoadOptions): Promise<T | undefined> {
    this.validateKey(key);

    const stmt = this.db!.prepare(`
      SELECT data, expires_at FROM storage
      WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
    `);

    const row = stmt.get(key, Date.now()) as any;

    if (!row) {
      return options?.defaultValue as T;
    }

    if (options?.updateAccessTime) {
      const updateStmt = this.db!.prepare(`
        UPDATE storage SET accessed_at = ? WHERE key = ?
      `);
      updateStmt.run(Date.now(), key);
    }

    return this.deserialize<T>(row.data);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const stmt = prefix
      ? this.db!.prepare(`
          SELECT key FROM storage
          WHERE key LIKE ? AND (expires_at IS NULL OR expires_at > ?)
        `)
      : this.db!.prepare(`
          SELECT key FROM storage
          WHERE expires_at IS NULL OR expires_at > ?
        `);

    const rows = prefix
      ? stmt.all(`${prefix}%`, Date.now())
      : stmt.all(Date.now());

    return (rows as any[]).map(row => row.key);
  }

  async transaction(operations: StorageOperation[]): Promise<void> {
    const transaction = this.db!.transaction(() => {
      for (const op of operations) {
        if (op.type === 'save') {
          this.saveSync(op.key, op.data, op.options);
        } else if (op.type === 'delete') {
          this.deleteSync(op.key);
        }
      }
    });

    transaction();
  }

  private saveSync(key: string, data: unknown, options?: StorageOptions): void {
    // Synchronous version of save for transactions
  }

  private deleteSync(key: string): void {
    // Synchronous version of delete for transactions
  }
}
```

### Redis Storage Plugin

```typescript
class RedisStoragePlugin extends BaseStoragePlugin {
  readonly name = 'redis-storage';
  readonly version = '1.0.0';

  private client: Redis | null = null;

  async initialize(world: World): Promise<void> {
    this.client = new Redis(this.config.connectionString);
    await this.client.ping();
  }

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    this.validateKey(key);

    const serialized = this.serialize(data);
    const redis = this.client!;

    if (options?.ttl || this.config.defaultTtl) {
      const ttlSeconds = Math.floor((options?.ttl || this.config.defaultTtl) / 1000);
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }

    // Store metadata separately
    if (options?.metadata) {
      await redis.hset(`meta:${key}`, options.metadata);
    }
  }

  async load<T>(key: string, options?: LoadOptions): Promise<T | undefined> {
    this.validateKey(key);

    const data = await this.client!.get(key);
    if (!data) {
      return options?.defaultValue as T;
    }

    return this.deserialize<T>(data);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const pattern = prefix ? `${prefix}*` : '*';
    return await this.client!.keys(pattern);
  }

  async transaction(operations: StorageOperation[]): Promise<void> {
    const multi = this.client!.multi();

    for (const op of operations) {
      if (op.type === 'save') {
        const serialized = this.serialize(op.data);
        if (op.options?.ttl) {
          const ttlSeconds = Math.floor(op.options.ttl / 1000);
          multi.setex(op.key, ttlSeconds, serialized);
        } else {
          multi.set(op.key, serialized);
        }
      } else if (op.type === 'delete') {
        multi.del(op.key);
      }
    }

    await multi.exec();
  }
}
```

## Game Integration Patterns

### Player Data Management

```typescript
class PlayerDataSystem extends BaseSystem {
  constructor(private storage: StoragePlugin) {
    super();
  }

  async savePlayer(entityId: number, world: World): Promise<void> {
    const player = world.getComponent(entityId, 'player');
    const position = world.getComponent(entityId, 'position');
    const inventory = world.getComponent(entityId, 'inventory');

    const playerData = {
      profile: player,
      position: position,
      inventory: inventory,
      lastSaved: Date.now()
    };

    await this.storage.save(`player:${player.userId}`, playerData, {
      ttl: 90 * 24 * 60 * 60 * 1000, // 90 days
      metadata: { version: '1.0', entityId }
    });
  }

  async loadPlayer(userId: string): Promise<PlayerData | null> {
    return await this.storage.load<PlayerData>(`player:${userId}`);
  }
}
```

### World State Persistence

```typescript
class WorldPersistenceSystem extends BaseSystem {
  private autosaveInterval: Timer;

  constructor(private storage: StoragePlugin) {
    super();
    this.autosaveInterval = setInterval(() => this.autosave(), 300000); // 5 minutes
  }

  async saveWorldState(world: World): Promise<void> {
    const entities = world.getAllEntities();
    const worldData = {
      entities: entities.map(entityId => ({
        id: entityId,
        components: world.getEntityComponents(entityId)
      })),
      metadata: {
        saveTime: Date.now(),
        playerCount: this.getPlayerCount(world),
        gameTime: world.getGameTime()
      }
    };

    await this.storage.save('world:current', worldData, {
      compression: 9,
      metadata: { type: 'world-state', version: '1.0' }
    });
  }

  private async autosave(): Promise<void> {
    try {
      await this.saveWorldState(this.world);
      console.log('World autosaved successfully');
    } catch (error) {
      console.error('Autosave failed:', error);
    }
  }
}
```

### Configuration Management

```typescript
class ConfigurationManager {
  constructor(private storage: StoragePlugin) {}

  async loadConfig<T>(key: string, defaultConfig: T): Promise<T> {
    return await this.storage.load<T>(`config:${key}`, {
      defaultValue: defaultConfig
    });
  }

  async saveConfig<T>(key: string, config: T): Promise<void> {
    await this.storage.save(`config:${key}`, config, {
      metadata: { lastUpdated: Date.now() }
    });
  }

  async resetConfig(key: string): Promise<void> {
    await this.storage.delete(`config:${key}`);
  }
}
```

## Testing

### Mock Storage Plugin

```typescript
class MockStoragePlugin extends BaseStoragePlugin {
  readonly name = 'mock-storage';
  readonly version = '1.0.0';

  private data = new Map<string, { value: unknown; metadata: StorageMetadata }>();

  async initialize(world: World): Promise<void> {
    // Mock initialization
  }

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    this.validateKey(key);

    const metadata: StorageMetadata = {
      size: JSON.stringify(data).length,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      compressed: false,
      encrypted: false,
      metadata: options?.metadata
    };

    this.data.set(key, { value: data, metadata });
  }

  async load<T>(key: string, options?: LoadOptions): Promise<T | undefined> {
    const item = this.data.get(key);
    return item ? item.value as T : options?.defaultValue as T;
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    return prefix ? keys.filter(key => key.startsWith(prefix)) : keys;
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  // Test utilities
  getStoredData(): Map<string, any> {
    return new Map(this.data);
  }

  setData(key: string, value: unknown): void {
    this.save(key, value);
  }
}
```

### Storage Plugin Testing

```typescript
describe('StoragePlugin', () => {
  let storagePlugin: MockStoragePlugin;

  beforeEach(() => {
    storagePlugin = new MockStoragePlugin({
      backend: 'memory'
    });
  });

  test('should save and load data', async () => {
    const testData = { name: 'Test', value: 42 };

    await storagePlugin.save('test-key', testData);
    const loaded = await storagePlugin.load('test-key');

    expect(loaded).toEqual(testData);
  });

  test('should handle non-existent keys', async () => {
    const result = await storagePlugin.load('non-existent');
    expect(result).toBeUndefined();

    const resultWithDefault = await storagePlugin.load('non-existent', {
      defaultValue: 'default'
    });
    expect(resultWithDefault).toBe('default');
  });

  test('should list keys with prefix', async () => {
    await storagePlugin.save('user:1', { name: 'Alice' });
    await storagePlugin.save('user:2', { name: 'Bob' });
    await storagePlugin.save('config:setting', { value: 'test' });

    const userKeys = await storagePlugin.listKeys('user:');
    expect(userKeys).toHaveLength(2);
    expect(userKeys).toContain('user:1');
    expect(userKeys).toContain('user:2');
  });

  test('should perform atomic transactions', async () => {
    await storagePlugin.save('balance:1', 100);
    await storagePlugin.save('balance:2', 50);

    // Transfer 25 from account 1 to account 2
    await storagePlugin.transaction([
      { type: 'save', key: 'balance:1', data: 75 },
      { type: 'save', key: 'balance:2', data: 75 }
    ]);

    const balance1 = await storagePlugin.load('balance:1');
    const balance2 = await storagePlugin.load('balance:2');

    expect(balance1).toBe(75);
    expect(balance2).toBe(75);
  });
});
```

## Performance Optimization

### Caching Layer

```typescript
class CachedStoragePlugin extends BaseStoragePlugin {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private cacheTimeout = 300000; // 5 minutes

  async load<T>(key: string, options?: LoadOptions): Promise<T | undefined> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }

    // Load from storage
    const data = await super.load<T>(key, options);

    // Cache the result
    if (data !== undefined) {
      this.cache.set(key, { data, timestamp: Date.now() });
    }

    return data;
  }

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    await super.save(key, data, options);

    // Update cache
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async delete(key: string): Promise<boolean> {
    const result = await super.delete(key);

    // Remove from cache
    this.cache.delete(key);

    return result;
  }
}
```

### Batch Operations

```typescript
class BatchingStoragePlugin extends BaseStoragePlugin {
  private pendingOperations: StorageOperation[] = [];
  private batchTimer: Timer | null = null;

  async save(key: string, data: unknown, options?: StorageOptions): Promise<void> {
    this.pendingOperations.push({ type: 'save', key, data, options });
    this.scheduleBatch();
  }

  async delete(key: string): Promise<boolean> {
    this.pendingOperations.push({ type: 'delete', key });
    this.scheduleBatch();
    return true; // Assume success for batched operations
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(async () => {
      if (this.pendingOperations.length > 0) {
        await this.transaction([...this.pendingOperations]);
        this.pendingOperations = [];
      }
      this.batchTimer = null;
    }, 100); // Batch every 100ms
  }
}
```

## See Also

- [Plugin](./plugin.md) - Base plugin interface
- [PluginManager](./plugin-manager.md) - Plugin lifecycle management
- [NetworkPlugin](./network-plugin.md) - Network-specific plugin interface
- [World](../core/world.md) - ECS World integration