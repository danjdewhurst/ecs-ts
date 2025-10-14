# ObjectPool

The `ObjectPool` provides memory optimization for frequently created and destroyed objects. It reduces garbage collection pressure by reusing objects rather than creating new ones, leading to more consistent frame rates and better performance in real-time applications.

## Overview

ObjectPool provides:
- **Memory Efficiency**: Reuse objects instead of creating/destroying them
- **Garbage Collection Reduction**: Minimize GC pressure and stutters
- **Performance Monitoring**: Track pool efficiency and usage statistics
- **Configurable Sizing**: Control pool size and growth patterns

## Quick Example

```typescript
import { ObjectPool } from '@danjdewhurst/ecs-ts';

// Create a pool for vector objects
const vectorPool = new ObjectPool(
  () => ({ x: 0, y: 0 }),              // Create function
  (vec) => { vec.x = 0; vec.y = 0; },  // Reset function
  10,                                   // Initial size
  100                                   // Max size
);

// Use vectors from the pool
function calculateMovement(): Vector2 {
  const direction = vectorPool.acquire();
  direction.x = Math.random() - 0.5;
  direction.y = Math.random() - 0.5;

  // ... do calculations ...

  // Return to pool when done
  vectorPool.release(direction);

  return direction;
}
```

## Constructor

```typescript
new ObjectPool<T>(
  createFn: () => T,
  resetFn: (obj: T) => void,
  initialSize: number = 10,
  maxSize: number = 100
)
```

Creates a new ObjectPool for objects of type T.

### Parameters
- `createFn: () => T` - Function that creates new instances of T
- `resetFn: (obj: T) => void` - Function that resets an object to its initial state
- `initialSize: number` - Initial number of objects to create in the pool (default: 10)
- `maxSize: number` - Maximum number of objects to keep in the pool (default: 100)

### Example
```typescript
// Bullet pool for a shooter game
const bulletPool = new ObjectPool(
  () => ({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    damage: 0,
    active: false
  }),
  (bullet) => {
    bullet.position.x = 0;
    bullet.position.y = 0;
    bullet.velocity.x = 0;
    bullet.velocity.y = 0;
    bullet.damage = 0;
    bullet.active = false;
  },
  50,  // Start with 50 bullets
  200  // Max 200 bullets
);

// Particle effect pool
class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 1.0;
  color = '#ffffff';
}

const particlePool = new ObjectPool(
  () => new Particle(),
  (particle) => {
    particle.x = 0;
    particle.y = 0;
    particle.vx = 0;
    particle.vy = 0;
    particle.life = 1.0;
    particle.color = '#ffffff';
  },
  100,
  1000
);
```

## Core Operations

### acquire

```typescript
acquire(): T
```

Acquires an object from the pool. If none are available, creates a new one.

#### Returns
`T` - An object ready for use

#### Example
```typescript
// Get a bullet from the pool
const bullet = bulletPool.acquire();

// Initialize for use
bullet.position.x = playerX;
bullet.position.y = playerY;
bullet.velocity.x = Math.cos(angle) * speed;
bullet.velocity.y = Math.sin(angle) * speed;
bullet.damage = weaponDamage;
bullet.active = true;

// Add to active bullets
activeBullets.push(bullet);
```

### release

```typescript
release(obj: T): void
```

Returns an object to the pool. The object will be reset and made available for reuse.

#### Parameters
- `obj: T` - The object to return to the pool

#### Example
```typescript
// When bullet hits target or goes off-screen
function destroyBullet(bullet: Bullet): void {
  // Remove from active list
  const index = activeBullets.indexOf(bullet);
  if (index !== -1) {
    activeBullets.splice(index, 1);
  }

  // Return to pool (automatically reset)
  bulletPool.release(bullet);
}

// Batch cleanup
function cleanupExpiredParticles(): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    if (particle.life <= 0) {
      particles.splice(i, 1);
      particlePool.release(particle);
    }
  }
}
```

## Pool Management

### getAvailableCount

```typescript
getAvailableCount(): number
```

Returns the current number of available objects in the pool.

#### Example
```typescript
// Check pool availability before spawning
if (bulletPool.getAvailableCount() > 0) {
  spawnBullet();
} else {
  console.warn('Bullet pool exhausted!');
}

// Monitor pool usage
setInterval(() => {
  const available = particlePool.getAvailableCount();
  const maxSize = particlePool.getMaxSize();
  const usagePercent = ((maxSize - available) / maxSize) * 100;

  console.log(`Particle pool usage: ${usagePercent.toFixed(1)}%`);
}, 1000);
```

### getMaxSize / setMaxSize

```typescript
getMaxSize(): number
setMaxSize(newMaxSize: number): void
```

Gets or sets the maximum size of the pool.

#### Example
```typescript
// Adjust pool size based on game state
function setGameMode(mode: 'normal' | 'intense' | 'quiet'): void {
  switch (mode) {
    case 'intense':
      bulletPool.setMaxSize(500);
      particlePool.setMaxSize(2000);
      break;
    case 'quiet':
      bulletPool.setMaxSize(50);
      particlePool.setMaxSize(100);
      break;
    default:
      bulletPool.setMaxSize(200);
      particlePool.setMaxSize(1000);
  }
}

// Dynamic resizing based on performance
function adjustPoolSizes(): void {
  const fps = getCurrentFPS();

  if (fps < 30) {
    // Reduce pool sizes to improve performance
    const currentMax = particlePool.getMaxSize();
    particlePool.setMaxSize(Math.max(50, currentMax * 0.8));
  } else if (fps > 55) {
    // Increase pool sizes for better effects
    const currentMax = particlePool.getMaxSize();
    particlePool.setMaxSize(Math.min(2000, currentMax * 1.2));
  }
}
```

### clear

```typescript
clear(): void
```

Clears all objects from the pool, allowing them to be garbage collected.

#### Example
```typescript
// Level cleanup
function cleanupLevel(): void {
  // Return all active objects to pools
  for (const bullet of activeBullets) {
    bulletPool.release(bullet);
  }
  activeBullets = [];

  for (const particle of activeParticles) {
    particlePool.release(particle);
  }
  activeParticles = [];

  // Clear pools if needed
  bulletPool.clear();
  particlePool.clear();
}

// Memory management
function lowMemoryHandler(): void {
  console.log('Low memory detected, clearing object pools');

  bulletPool.clear();
  particlePool.clear();
  effectPool.clear();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}
```

### warmUp

```typescript
warmUp(count: number): void
```

Pre-creates objects up to the specified count to prepare for high usage.

#### Parameters
- `count: number` - Number of objects to pre-create

#### Example
```typescript
// Pre-warm pools before gameplay
function prepareForLevel(): void {
  // Warm up based on expected usage
  bulletPool.warmUp(100);
  particlePool.warmUp(500);
  enemyPool.warmUp(20);

  console.log('Object pools warmed up for level start');
}

// Scene-specific warming
function prepareForBossLevel(): void {
  // Boss levels need more particles and effects
  bulletPool.warmUp(200);
  particlePool.warmUp(1500);
  explosionPool.warmUp(50);
}

// Progressive warming
async function warmUpGradually(): Promise<void> {
  const warmUpStep = 20;
  const targetSize = 200;

  for (let i = 0; i < targetSize; i += warmUpStep) {
    bulletPool.warmUp(Math.min(i + warmUpStep, targetSize));

    // Allow other work to happen between warm-up steps
    await new Promise(resolve => setTimeout(resolve, 16));
  }
}
```

## Performance Monitoring

### getStats

```typescript
getStats(): {
  availableObjects: number;
  maxSize: number;
  totalCreated: number;
  totalAcquired: number;
  totalReleased: number;
  hitRate: number;
  utilizationRate: number;
}
```

Returns detailed performance statistics for the pool.

#### Example
```typescript
// Performance monitoring
function logPoolPerformance(): void {
  const bulletStats = bulletPool.getStats();
  const particleStats = particlePool.getStats();

  console.log('=== Pool Performance ===');
  console.log('Bullets:');
  console.log(`  Hit Rate: ${(bulletStats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Utilization: ${(bulletStats.utilizationRate * 100).toFixed(1)}%`);
  console.log(`  Available: ${bulletStats.availableObjects}/${bulletStats.maxSize}`);

  console.log('Particles:');
  console.log(`  Hit Rate: ${(particleStats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Utilization: ${(particleStats.utilizationRate * 100).toFixed(1)}%`);
  console.log(`  Available: ${particleStats.availableObjects}/${particleStats.maxSize}`);
}

// Automated monitoring
class PoolMonitor {
  private pools = new Map<string, ObjectPool<any>>();

  addPool(name: string, pool: ObjectPool<any>): void {
    this.pools.set(name, pool);
  }

  checkPerformance(): void {
    for (const [name, pool] of this.pools) {
      const stats = pool.getStats();

      if (stats.hitRate < 0.5) {
        console.warn(`Pool '${name}' has low hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      }

      if (stats.utilizationRate > 0.9) {
        console.warn(`Pool '${name}' is nearly full: ${(stats.utilizationRate * 100).toFixed(1)}%`);
      }
    }
  }
}
```

### isPerformingWell

```typescript
isPerformingWell(): boolean
```

Checks if the pool is performing optimally.

#### Returns
`boolean` - True if the pool has good hit rate (>50%) and utilization (<90%)

#### Example
```typescript
// Automatic tuning
function tunePoolPerformance(): void {
  if (!bulletPool.isPerformingWell()) {
    const stats = bulletPool.getStats();

    if (stats.hitRate < 0.5) {
      // Low hit rate - increase initial size
      bulletPool.warmUp(bulletPool.getMaxSize() * 0.3);
      console.log('Increased bullet pool warm-up due to low hit rate');
    }

    if (stats.utilizationRate > 0.9) {
      // High utilization - increase max size
      bulletPool.setMaxSize(bulletPool.getMaxSize() * 1.5);
      console.log('Increased bullet pool max size due to high utilization');
    }
  }
}

// Performance-based warnings
setInterval(() => {
  if (!particlePool.isPerformingWell()) {
    console.warn('Particle pool performance is suboptimal');

    // Potentially adjust game settings
    if (particlePool.getStats().utilizationRate > 0.95) {
      reduceParticleEffects();
    }
  }
}, 5000);
```

## Usage Patterns

### Game Object Pooling

```typescript
class Enemy {
  health = 100;
  position = { x: 0, y: 0 };
  velocity = { x: 0, y: 0 };
  active = false;
}

const enemyPool = new ObjectPool(
  () => new Enemy(),
  (enemy) => {
    enemy.health = 100;
    enemy.position.x = 0;
    enemy.position.y = 0;
    enemy.velocity.x = 0;
    enemy.velocity.y = 0;
    enemy.active = false;
  },
  10,
  50
);

function spawnEnemy(x: number, y: number): Enemy {
  const enemy = enemyPool.acquire();

  enemy.position.x = x;
  enemy.position.y = y;
  enemy.velocity.x = (Math.random() - 0.5) * 2;
  enemy.velocity.y = (Math.random() - 0.5) * 2;
  enemy.active = true;

  return enemy;
}

function destroyEnemy(enemy: Enemy): void {
  enemy.active = false;
  enemyPool.release(enemy);
}
```

### Event Object Pooling

```typescript
interface GameEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const eventPool = new ObjectPool<GameEvent>(
  () => ({
    type: '',
    timestamp: 0,
    data: {}
  }),
  (event) => {
    event.type = '';
    event.timestamp = 0;
    event.data = {};
  },
  20,
  100
);

function createEvent(type: string, data: Record<string, unknown>): GameEvent {
  const event = eventPool.acquire();

  event.type = type;
  event.timestamp = Date.now();
  event.data = { ...data };

  return event;
}

function processEvent(event: GameEvent): void {
  // Handle event...

  // Return to pool when done
  eventPool.release(event);
}
```

### Temporary Calculations

```typescript
// Pool for temporary calculation objects
const tempVectorPool = new ObjectPool(
  () => ({ x: 0, y: 0, z: 0 }),
  (vec) => { vec.x = 0; vec.y = 0; vec.z = 0; },
  50,
  200
);

function calculateForces(entities: Entity[]): void {
  for (const entity of entities) {
    const force = tempVectorPool.acquire();
    const acceleration = tempVectorPool.acquire();

    // Calculate physics...
    calculateGravity(entity, force);
    calculateFriction(entity, force);

    // Convert force to acceleration
    acceleration.x = force.x / entity.mass;
    acceleration.y = force.y / entity.mass;
    acceleration.z = force.z / entity.mass;

    // Apply to entity
    applyAcceleration(entity, acceleration);

    // Return temporary objects
    tempVectorPool.release(force);
    tempVectorPool.release(acceleration);
  }
}
```

## Advanced Patterns

### Typed Pool Manager

```typescript
class PoolManager {
  private pools = new Map<string, ObjectPool<any>>();

  createPool<T>(
    name: string,
    createFn: () => T,
    resetFn: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100
  ): ObjectPool<T> {
    const pool = new ObjectPool(createFn, resetFn, initialSize, maxSize);
    this.pools.set(name, pool);
    return pool;
  }

  getPool<T>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name) as ObjectPool<T>;
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStats();
    }

    return stats;
  }

  warmUpAll(): void {
    for (const pool of this.pools.values()) {
      pool.warmUp(pool.getMaxSize() * 0.5);
    }
  }

  clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }
}

// Usage
const poolManager = new PoolManager();

const bulletPool = poolManager.createPool(
  'bullets',
  () => new Bullet(),
  (bullet) => bullet.reset(),
  50,
  200
);

const particlePool = poolManager.createPool(
  'particles',
  () => new Particle(),
  (particle) => particle.reset(),
  100,
  1000
);
```

### Pool with Factory Pattern

```typescript
class PooledFactory<T> {
  private pool: ObjectPool<T>;

  constructor(
    private createFn: () => T,
    private resetFn: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this.pool = new ObjectPool(createFn, resetFn, initialSize, maxSize);
  }

  create(): T {
    return this.pool.acquire();
  }

  destroy(obj: T): void {
    this.pool.release(obj);
  }

  getStats() {
    return this.pool.getStats();
  }
}

// Specific factories
const bulletFactory = new PooledFactory(
  () => new Bullet(),
  (bullet) => bullet.reset(),
  50,
  200
);

const explosionFactory = new PooledFactory(
  () => new Explosion(),
  (explosion) => explosion.reset(),
  10,
  50
);
```

## Testing

### Mock ObjectPool

```typescript
class MockObjectPool<T> extends ObjectPool<T> {
  private acquisitionLog: T[] = [];
  private releaseLog: T[] = [];

  acquire(): T {
    const obj = super.acquire();
    this.acquisitionLog.push(obj);
    return obj;
  }

  release(obj: T): void {
    super.release(obj);
    this.releaseLog.push(obj);
  }

  getAcquisitionLog(): T[] {
    return [...this.acquisitionLog];
  }

  getReleaseLog(): T[] {
    return [...this.releaseLog];
  }

  clearLogs(): void {
    this.acquisitionLog = [];
    this.releaseLog = [];
  }
}
```

### ObjectPool Testing

```typescript
describe('ObjectPool', () => {
  let pool: ObjectPool<{ value: number }>;

  beforeEach(() => {
    pool = new ObjectPool(
      () => ({ value: 0 }),
      (obj) => { obj.value = 0; },
      2,
      5
    );
  });

  test('should reuse objects', () => {
    const obj1 = pool.acquire();
    obj1.value = 42;

    pool.release(obj1);

    const obj2 = pool.acquire();
    expect(obj2.value).toBe(0); // Should be reset
    expect(obj2).toBe(obj1); // Should be same instance
  });

  test('should track statistics correctly', () => {
    const obj1 = pool.acquire();
    const obj2 = pool.acquire();

    const stats = pool.getStats();
    expect(stats.totalAcquired).toBe(2);
    expect(stats.hitRate).toBe(1); // Used pre-created objects

    pool.release(obj1);
    pool.release(obj2);

    const obj3 = pool.acquire();
    const newStats = pool.getStats();
    expect(newStats.totalAcquired).toBe(3);
    expect(newStats.hitRate).toBeGreaterThan(0.66); // Mostly hits
  });

  test('should respect max size', () => {
    const objects = [];

    // Acquire more than max size
    for (let i = 0; i < 10; i++) {
      objects.push(pool.acquire());
    }

    // Release all
    for (const obj of objects) {
      pool.release(obj);
    }

    // Pool should not exceed max size
    expect(pool.getAvailableCount()).toBeLessThanOrEqual(5);
  });
});
```

## Performance Considerations

- **Memory Usage**: Pools prevent frequent allocations but consume memory for pooled objects
- **Hit Rate**: Aim for >70% hit rate for optimal performance
- **Pool Size**: Balance between memory usage and allocation frequency
- **Reset Function**: Keep reset operations lightweight to avoid performance bottlenecks
- **Object Lifecycle**: Ensure objects are properly released to avoid memory leaks

## Best Practices

### Pool Sizing
- Start with conservative sizes and adjust based on profiling
- Monitor hit rates and utilization to optimize sizes
- Consider peak usage when setting max sizes

### Reset Functions
- Reset all object state to prevent bugs
- Keep reset operations simple and fast
- Consider using Object.assign for complex objects

### Memory Management
- Clear pools during level transitions
- Monitor memory usage in long-running games
- Use multiple smaller pools rather than one large pool

### Error Handling
- Validate objects before returning to pool
- Handle cases where pool is exhausted
- Implement fallback strategies for critical objects

## See Also

- [DirtyTracker](./dirty-tracker.md) - Change tracking for performance optimization
- [System](../core/system.md) - System implementation patterns
- [World](../core/world.md) - ECS World integration