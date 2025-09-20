# Performance Optimization Guide

This guide covers performance optimization strategies, profiling techniques, and best practices for building high-performance ECS applications that maintain smooth frame rates even with thousands of entities.

## Core Performance Principles

### Data-Driven Design

ECS architecture naturally promotes performance through data locality:

```typescript
// ✅ Good: Process similar components together for cache efficiency
class BatchedPhysicsSystem extends BaseSystem {
  readonly priority = 30;
  readonly name = 'BatchedPhysicsSystem';

  update(world: World, deltaTime: number): void {
    // Get all entities with physics components
    const entities = this.queryEntities(world, 'position', 'velocity', 'mass');

    // Batch process for better CPU cache utilization
    const positions: PositionComponent[] = [];
    const velocities: VelocityComponent[] = [];
    const masses: MassComponent[] = [];

    // Collect components in arrays
    for (const entityId of entities) {
      const pos = world.getComponent<PositionComponent>(entityId, 'position');
      const vel = world.getComponent<VelocityComponent>(entityId, 'velocity');
      const mass = world.getComponent<MassComponent>(entityId, 'mass');

      if (pos && vel && mass) {
        positions.push(pos);
        velocities.push(vel);
        masses.push(mass);
      }
    }

    // Process in tight loops (better for CPU cache)
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const vel = velocities[i];
      const mass = masses[i];

      // Apply physics
      vel.dy += 980 * deltaTime; // Gravity
      pos.x += vel.dx * deltaTime;
      pos.y += vel.dy * deltaTime;

      // Apply damping
      vel.dx *= mass.damping;
      vel.dy *= mass.damping;
    }
  }
}

// ❌ Bad: Random memory access patterns
class SlowPhysicsSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      // Each iteration accesses different memory locations
      const pos = world.getComponent(entityId, 'position');
      const vel = world.getComponent(entityId, 'velocity');
      const mass = world.getComponent(entityId, 'mass'); // Might not exist
      const health = world.getComponent(entityId, 'health'); // Different component

      // Scattered processing reduces cache efficiency
      this.updatePosition(pos, vel);
      this.checkHealth(health);
      this.updateMass(mass);
    }
  }
}
```

### Selective Updates with Dirty Tracking

Only process entities that have actually changed:

```typescript
class OptimizedRenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'OptimizedRenderSystem';

  private lastRenderedPositions = new Map<number, {x: number, y: number}>();

  update(world: World): void {
    // Only render entities that moved or changed appearance
    const dirtyPositions = world.getDirtyEntities('position');
    const dirtySprites = world.getDirtyEntities('sprite');
    const dirtyAnimations = world.getDirtyEntities('animation');

    // Combine all dirty entities
    const entitiesToRender = new Set([
      ...dirtyPositions,
      ...dirtySprites,
      ...dirtyAnimations
    ]);

    console.log(`Rendering ${entitiesToRender.size} entities out of ${world.getEntityCount()} total`);

    // Clear previous render if needed
    if (entitiesToRender.size > 0) {
      this.clearDirtyRegions(entitiesToRender);
    }

    // Render only changed entities
    for (const entityId of entitiesToRender) {
      if (this.isVisible(world, entityId)) {
        this.renderEntity(world, entityId);
        this.updateLastRenderedPosition(world, entityId);
      }
    }
  }

  private clearDirtyRegions(entities: Set<number>): void {
    // Only clear regions that need rerendering
    for (const entityId of entities) {
      const lastPos = this.lastRenderedPositions.get(entityId);
      if (lastPos) {
        this.clearRegion(lastPos.x, lastPos.y, 32, 32);
      }
    }
  }

  private isVisible(world: World, entityId: number): boolean {
    const position = world.getComponent<PositionComponent>(entityId, 'position');
    const sprite = world.getComponent<SpriteComponent>(entityId, 'sprite');

    if (!position || !sprite) return false;

    // Simple viewport culling
    return position.x >= -32 && position.x <= 832 &&
           position.y >= -32 && position.y <= 632;
  }
}
```

## Memory Optimization

### Object Pooling for Frequent Allocations

Reduce garbage collection pressure with object pools:

```typescript
class PooledProjectileSystem extends BaseSystem {
  readonly priority = 25;
  readonly name = 'PooledProjectileSystem';

  private projectilePool = new ObjectPool<ProjectileData>(
    () => ({
      id: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      damage: 0,
      lifetime: 0,
      active: false
    }),
    (projectile) => {
      projectile.id = 0;
      projectile.x = 0;
      projectile.y = 0;
      projectile.vx = 0;
      projectile.vy = 0;
      projectile.damage = 0;
      projectile.lifetime = 0;
      projectile.active = false;
    },
    100, // Initial pool size
    500  // Maximum pool size
  );

  private activeProjectiles = new Set<ProjectileData>();

  initialize(world: World): void {
    // Pre-warm the pool for better performance
    this.projectilePool.warmUp(50);

    world.subscribeToEvent('weapon-fired', (event) => {
      this.spawnProjectile(world, event.data);
    });
  }

  private spawnProjectile(world: World, weaponData: any): void {
    // Get projectile from pool instead of creating new object
    const projectile = this.projectilePool.acquire();

    // Initialize projectile data
    projectile.id = world.createEntity();
    projectile.x = weaponData.x;
    projectile.y = weaponData.y;
    projectile.vx = weaponData.velocityX;
    projectile.vy = weaponData.velocityY;
    projectile.damage = weaponData.damage;
    projectile.lifetime = 3000; // 3 seconds
    projectile.active = true;

    // Add to world
    world.addComponent(projectile.id, {
      type: 'position',
      x: projectile.x,
      y: projectile.y,
      z: 0
    });

    world.addComponent(projectile.id, {
      type: 'projectile',
      damage: projectile.damage,
      lifetime: projectile.lifetime
    });

    this.activeProjectiles.add(projectile);
  }

  update(world: World, deltaTime: number): void {
    // Update active projectiles
    for (const projectile of this.activeProjectiles) {
      projectile.x += projectile.vx * deltaTime;
      projectile.y += projectile.vy * deltaTime;
      projectile.lifetime -= deltaTime * 1000;

      // Update world position
      const position = world.getComponent<PositionComponent>(projectile.id, 'position');
      if (position) {
        position.x = projectile.x;
        position.y = projectile.y;
      }

      // Check for expiration
      if (projectile.lifetime <= 0 || this.isOutOfBounds(projectile)) {
        this.destroyProjectile(world, projectile);
      }
    }
  }

  private destroyProjectile(world: World, projectile: ProjectileData): void {
    // Remove from world
    world.destroyEntity(projectile.id);

    // Remove from active list
    this.activeProjectiles.delete(projectile);

    // Return to pool (automatically reset)
    this.projectilePool.release(projectile);
  }

  shutdown(): void {
    // Clean up all projectiles and clear pool
    for (const projectile of this.activeProjectiles) {
      this.projectilePool.release(projectile);
    }
    this.activeProjectiles.clear();
    this.projectilePool.clear();
  }
}
```

### Component Pooling

```typescript
class ComponentPoolManager {
  private pools = new Map<string, ObjectPool<Component>>();

  getComponent<T extends Component>(type: string): T {
    let pool = this.pools.get(type);

    if (!pool) {
      pool = this.createPoolForType(type);
      this.pools.set(type, pool);
    }

    return pool.acquire() as T;
  }

  releaseComponent(component: Component): void {
    const pool = this.pools.get(component.type);
    if (pool) {
      pool.release(component);
    }
  }

  private createPoolForType(type: string): ObjectPool<Component> {
    switch (type) {
      case 'position':
        return new ObjectPool(
          () => ({ type: 'position', x: 0, y: 0, z: 0 }),
          (comp: any) => { comp.x = 0; comp.y = 0; comp.z = 0; },
          50, 200
        );

      case 'velocity':
        return new ObjectPool(
          () => ({ type: 'velocity', dx: 0, dy: 0, dz: 0 }),
          (comp: any) => { comp.dx = 0; comp.dy = 0; comp.dz = 0; },
          50, 200
        );

      case 'health':
        return new ObjectPool(
          () => ({ type: 'health', current: 100, maximum: 100 }),
          (comp: any) => { comp.current = 100; comp.maximum = 100; },
          30, 100
        );

      default:
        return new ObjectPool(
          () => ({ type }),
          () => {},
          10, 50
        );
    }
  }

  getPoolStats(): Map<string, any> {
    const stats = new Map();
    for (const [type, pool] of this.pools) {
      stats.set(type, pool.getStats());
    }
    return stats;
  }
}
```

## CPU Optimization Strategies

### Spatial Partitioning for Collision Detection

```typescript
class SpatialHashGrid {
  private cellSize: number;
  private grid = new Map<string, Set<number>>();

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.grid.clear();
  }

  addEntity(entityId: number, x: number, y: number, width: number, height: number): void {
    const cells = this.getCellsForBounds(x, y, width, height);

    for (const cellKey of cells) {
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, new Set());
      }
      this.grid.get(cellKey)!.add(entityId);
    }
  }

  getNearbyEntities(x: number, y: number, width: number, height: number): Set<number> {
    const nearby = new Set<number>();
    const cells = this.getCellsForBounds(x, y, width, height);

    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const entityId of cell) {
          nearby.add(entityId);
        }
      }
    }

    return nearby;
  }

  private getCellsForBounds(x: number, y: number, width: number, height: number): string[] {
    const cells: string[] = [];

    const minCellX = Math.floor(x / this.cellSize);
    const maxCellX = Math.floor((x + width) / this.cellSize);
    const minCellY = Math.floor(y / this.cellSize);
    const maxCellY = Math.floor((y + height) / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        cells.push(`${cellX},${cellY}`);
      }
    }

    return cells;
  }
}

class OptimizedCollisionSystem extends BaseSystem {
  readonly priority = 40;
  readonly name = 'OptimizedCollisionSystem';

  private spatialGrid = new SpatialHashGrid(64);

  update(world: World): void {
    // Clear and rebuild spatial grid only for entities that moved
    this.spatialGrid.clear();

    const collidableEntities = this.queryEntities(world, 'position', 'collider');

    // Populate spatial grid
    for (const entityId of collidableEntities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const collider = world.getComponent<ColliderComponent>(entityId, 'collider');

      if (position && collider) {
        this.spatialGrid.addEntity(
          entityId,
          position.x - collider.width / 2,
          position.y - collider.height / 2,
          collider.width,
          collider.height
        );
      }
    }

    // Check collisions only between nearby entities
    const checkedPairs = new Set<string>();

    for (const entityId of collidableEntities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const collider = world.getComponent<ColliderComponent>(entityId, 'collider');

      if (!position || !collider) continue;

      // Get only nearby entities instead of checking all entities
      const nearbyEntities = this.spatialGrid.getNearbyEntities(
        position.x - collider.width / 2,
        position.y - collider.height / 2,
        collider.width,
        collider.height
      );

      for (const otherId of nearbyEntities) {
        if (entityId === otherId) continue;

        const pairKey = entityId < otherId ? `${entityId}-${otherId}` : `${otherId}-${entityId}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        if (this.checkCollision(world, entityId, otherId)) {
          this.handleCollision(world, entityId, otherId);
        }
      }
    }
  }

  private checkCollision(world: World, entityA: number, entityB: number): boolean {
    const posA = world.getComponent<PositionComponent>(entityA, 'position');
    const colA = world.getComponent<ColliderComponent>(entityA, 'collider');
    const posB = world.getComponent<PositionComponent>(entityB, 'position');
    const colB = world.getComponent<ColliderComponent>(entityB, 'collider');

    if (!posA || !colA || !posB || !colB) return false;

    // AABB collision detection
    return posA.x < posB.x + colB.width &&
           posA.x + colA.width > posB.x &&
           posA.y < posB.y + colB.height &&
           posA.y + colA.height > posB.y;
  }
}
```

### System Update Frequency Optimization

```typescript
class VariableUpdateSystem extends BaseSystem {
  readonly priority = 15;
  readonly name = 'VariableUpdateSystem';

  private updateIntervals = new Map<string, number>();
  private lastUpdateTimes = new Map<string, number>();

  constructor() {
    super();

    // Different systems can run at different frequencies
    this.updateIntervals.set('ai', 100);           // AI updates every 100ms
    this.updateIntervals.set('pathfinding', 200);  // Pathfinding every 200ms
    this.updateIntervals.set('ui', 50);            // UI updates every 50ms
    this.updateIntervals.set('physics', 16);       // Physics at 60fps
  }

  update(world: World, deltaTime: number): void {
    const currentTime = Date.now();

    // Update each subsystem based on its frequency
    if (this.shouldUpdate('physics', currentTime)) {
      this.updatePhysics(world, deltaTime);
    }

    if (this.shouldUpdate('ai', currentTime)) {
      this.updateAI(world, deltaTime);
    }

    if (this.shouldUpdate('pathfinding', currentTime)) {
      this.updatePathfinding(world);
    }

    if (this.shouldUpdate('ui', currentTime)) {
      this.updateUI(world);
    }
  }

  private shouldUpdate(systemName: string, currentTime: number): boolean {
    const interval = this.updateIntervals.get(systemName) || 16;
    const lastUpdate = this.lastUpdateTimes.get(systemName) || 0;

    if (currentTime - lastUpdate >= interval) {
      this.lastUpdateTimes.set(systemName, currentTime);
      return true;
    }

    return false;
  }

  private updatePhysics(world: World, deltaTime: number): void {
    // High-frequency physics updates
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (position && velocity) {
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;
      }
    }
  }

  private updateAI(world: World, deltaTime: number): void {
    // Lower-frequency AI updates
    const aiEntities = this.queryEntities(world, 'ai', 'position');

    for (const entityId of aiEntities) {
      const ai = world.getComponent<AIComponent>(entityId, 'ai');

      if (ai) {
        // Expensive AI calculations
        this.calculateAIBehavior(world, entityId, ai);
      }
    }
  }
}
```

## Query Optimization

### Archetype-Based Entity Queries

```typescript
class OptimizedQuerySystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'OptimizedQuerySystem';

  // Cache query results for better performance
  private queryCache = new Map<string, number[]>();
  private cacheTimeout = 100; // Cache for 100ms
  private lastCacheUpdate = 0;

  update(world: World): void {
    const currentTime = Date.now();

    // Invalidate cache periodically or when entities change
    if (currentTime - this.lastCacheUpdate > this.cacheTimeout) {
      this.queryCache.clear();
      this.lastCacheUpdate = currentTime;
    }

    // Use cached queries when possible
    const movingEntities = this.getCachedQuery(world, 'moving', 'position', 'velocity');
    const renderableEntities = this.getCachedQuery(world, 'renderable', 'position', 'sprite');
    const aiEntities = this.getCachedQuery(world, 'ai', 'position', 'ai');

    // Process different entity types
    this.processMovement(world, movingEntities);
    this.processRendering(world, renderableEntities);
    this.processAI(world, aiEntities);
  }

  private getCachedQuery(world: World, cacheKey: string, ...componentTypes: string[]): number[] {
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)!;
    }

    const entities = this.queryEntities(world, ...componentTypes);
    this.queryCache.set(cacheKey, entities);

    return entities;
  }

  private processMovement(world: World, entities: number[]): void {
    // Batch process movement entities
    for (const entityId of entities) {
      // Movement logic
    }
  }

  private processRendering(world: World, entities: number[]): void {
    // Sort entities by render layer for better batching
    const sortedEntities = entities.sort((a, b) => {
      const spriteA = world.getComponent<SpriteComponent>(a, 'sprite');
      const spriteB = world.getComponent<SpriteComponent>(b, 'sprite');

      return (spriteA?.layer || 0) - (spriteB?.layer || 0);
    });

    for (const entityId of sortedEntities) {
      // Render logic
    }
  }
}
```

### Specialized Component Queries

```typescript
class SpecializedQuerySystem extends BaseSystem {
  update(world: World): void {
    // Use specialized queries for better performance
    this.updateDamagedEntities(world);
    this.updateMovingPlayers(world);
    this.updateActiveProjectiles(world);
  }

  private updateDamagedEntities(world: World): void {
    // Only entities that took damage this frame
    const damagedEntities = world.query<HealthComponent>('health')
      .filter(([entityId, health]) => health.current < health.maximum)
      .map(([entityId]) => entityId);

    for (const entityId of damagedEntities) {
      this.processDamageEffects(world, entityId);
    }
  }

  private updateMovingPlayers(world: World): void {
    // Specific query for player entities that are moving
    const movingPlayers = this.queryEntities(world, 'player', 'velocity')
      .filter(entityId => {
        const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');
        return velocity && (velocity.dx !== 0 || velocity.dy !== 0);
      });

    for (const playerId of movingPlayers) {
      this.updatePlayerMovement(world, playerId);
    }
  }

  private updateActiveProjectiles(world: World): void {
    // Query projectiles with remaining lifetime
    const activeProjectiles = this.queryEntities(world, 'projectile', 'lifetime')
      .filter(entityId => {
        const lifetime = world.getComponent<LifetimeComponent>(entityId, 'lifetime');
        return lifetime && lifetime.remaining > 0;
      });

    for (const projectileId of activeProjectiles) {
      this.updateProjectile(world, projectileId);
    }
  }
}
```

## Performance Monitoring

### System Performance Profiler

```typescript
class PerformanceProfiler {
  private systemTimes = new Map<string, number[]>();
  private frameTime = 0;
  private frameCount = 0;
  private lastReportTime = 0;

  startFrame(): void {
    this.frameTime = performance.now();
  }

  endFrame(): void {
    this.frameCount++;
    const frameEnd = performance.now();
    const frameDuration = frameEnd - this.frameTime;

    // Report performance every second
    if (frameEnd - this.lastReportTime >= 1000) {
      this.reportPerformance();
      this.lastReportTime = frameEnd;
      this.frameCount = 0;
    }
  }

  startSystem(systemName: string): void {
    if (!this.systemTimes.has(systemName)) {
      this.systemTimes.set(systemName, []);
    }

    this.systemTimes.get(systemName)!.push(performance.now());
  }

  endSystem(systemName: string): void {
    const times = this.systemTimes.get(systemName);
    if (times && times.length > 0) {
      const startTime = times[times.length - 1];
      const duration = performance.now() - startTime;
      times[times.length - 1] = duration;

      // Keep only recent measurements
      if (times.length > 60) {
        times.shift();
      }
    }
  }

  private reportPerformance(): void {
    console.log('=== Performance Report ===');
    console.log(`FPS: ${this.frameCount}`);

    for (const [systemName, times] of this.systemTimes) {
      if (times.length > 0) {
        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        console.log(`${systemName}:`);
        console.log(`  Avg: ${avgTime.toFixed(2)}ms`);
        console.log(`  Max: ${maxTime.toFixed(2)}ms`);
        console.log(`  Min: ${minTime.toFixed(2)}ms`);

        if (avgTime > 16) {
          console.warn(`⚠️  ${systemName} is slow (avg: ${avgTime.toFixed(2)}ms)`);
        }
      }
    }
  }

  getSystemStats(systemName: string): { avg: number; max: number; min: number } | null {
    const times = this.systemTimes.get(systemName);
    if (!times || times.length === 0) return null;

    return {
      avg: times.reduce((sum, time) => sum + time, 0) / times.length,
      max: Math.max(...times),
      min: Math.min(...times)
    };
  }
}

// Usage in game loop
const profiler = new PerformanceProfiler();

class PerformanceAwareWorld extends World {
  update(deltaTime: number): void {
    profiler.startFrame();

    for (const system of this.systems) {
      profiler.startSystem(system.name);
      system.update(this, deltaTime);
      profiler.endSystem(system.name);
    }

    profiler.endFrame();
  }
}
```

### Memory Usage Monitoring

```typescript
class MemoryMonitor {
  private lastMemoryCheck = 0;
  private memoryCheckInterval = 5000; // Check every 5 seconds

  update(): void {
    const currentTime = Date.now();

    if (currentTime - this.lastMemoryCheck >= this.memoryCheckInterval) {
      this.checkMemoryUsage();
      this.lastMemoryCheck = currentTime;
    }
  }

  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;

      const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);

      console.log(`Memory Usage: ${usedMB}MB / ${totalMB}MB (Limit: ${limitMB}MB)`);

      const usagePercent = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (usagePercent > 0.8) {
        console.warn(`🔥 High memory usage: ${(usagePercent * 100).toFixed(1)}%`);
        this.suggestMemoryOptimizations();
      }
    }
  }

  private suggestMemoryOptimizations(): void {
    console.log('Memory optimization suggestions:');
    console.log('- Clear unused object pools');
    console.log('- Reduce entity count');
    console.log('- Check for memory leaks in event listeners');
    console.log('- Consider reducing texture/audio cache size');
  }

  getMemoryStats(): any {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usagePercent: memory.usedJSHeapSize / memory.jsHeapSizeLimit
      };
    }
    return null;
  }
}
```

## Optimization Patterns

### Level of Detail (LOD) System

```typescript
class LODSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'LODSystem';

  private cameraPosition = { x: 400, y: 300 }; // Camera center

  update(world: World): void {
    const entities = this.queryEntities(world, 'position', 'lod');

    for (const entityId of entities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const lod = world.getComponent<LODComponent>(entityId, 'lod');

      if (position && lod) {
        const distance = this.calculateDistance(position, this.cameraPosition);
        const newLevel = this.calculateLODLevel(distance);

        if (newLevel !== lod.currentLevel) {
          this.updateLODLevel(world, entityId, lod, newLevel);
        }
      }
    }
  }

  private calculateDistance(pos1: {x: number, y: number}, pos2: {x: number, y: number}): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateLODLevel(distance: number): number {
    if (distance < 100) return 0; // High detail
    if (distance < 300) return 1; // Medium detail
    if (distance < 600) return 2; // Low detail
    return 3; // Very low detail or culled
  }

  private updateLODLevel(world: World, entityId: number, lod: LODComponent, newLevel: number): void {
    lod.currentLevel = newLevel;

    // Adjust entity components based on LOD level
    switch (newLevel) {
      case 0: // High detail
        this.enableComponent(world, entityId, 'detailed-sprite');
        this.enableComponent(world, entityId, 'animation');
        this.enableComponent(world, entityId, 'particle-effects');
        break;

      case 1: // Medium detail
        this.enableComponent(world, entityId, 'simple-sprite');
        this.disableComponent(world, entityId, 'detailed-sprite');
        this.disableComponent(world, entityId, 'particle-effects');
        break;

      case 2: // Low detail
        this.enableComponent(world, entityId, 'billboard');
        this.disableComponent(world, entityId, 'simple-sprite');
        this.disableComponent(world, entityId, 'animation');
        break;

      case 3: // Culled
        this.disableComponent(world, entityId, 'renderable');
        this.disableComponent(world, entityId, 'ai');
        break;
    }
  }
}
```

### Adaptive Quality System

```typescript
class AdaptiveQualitySystem extends BaseSystem {
  readonly priority = 999; // Run last
  readonly name = 'AdaptiveQualitySystem';

  private targetFPS = 60;
  private minFPS = 30;
  private frameTimeHistory: number[] = [];
  private qualityLevel = 1.0; // 0.0 = lowest, 1.0 = highest

  update(world: World, deltaTime: number): void {
    this.recordFrameTime(deltaTime);

    if (this.frameTimeHistory.length >= 60) { // Check every 60 frames
      const avgFPS = this.calculateAverageFPS();
      this.adjustQuality(world, avgFPS);
      this.frameTimeHistory = [];
    }
  }

  private recordFrameTime(deltaTime: number): void {
    this.frameTimeHistory.push(deltaTime);
  }

  private calculateAverageFPS(): number {
    const avgDeltaTime = this.frameTimeHistory.reduce((sum, dt) => sum + dt, 0) / this.frameTimeHistory.length;
    return 1 / avgDeltaTime;
  }

  private adjustQuality(world: World, currentFPS: number): void {
    if (currentFPS < this.minFPS && this.qualityLevel > 0.1) {
      // Reduce quality
      this.qualityLevel = Math.max(0.1, this.qualityLevel - 0.1);
      this.applyQualitySettings(world);
      console.log(`🔻 Quality reduced to ${(this.qualityLevel * 100).toFixed(0)}%`);

    } else if (currentFPS > this.targetFPS && this.qualityLevel < 1.0) {
      // Increase quality
      this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.05);
      this.applyQualitySettings(world);
      console.log(`🔺 Quality increased to ${(this.qualityLevel * 100).toFixed(0)}%`);
    }
  }

  private applyQualitySettings(world: World): void {
    // Adjust particle counts
    world.emitEvent({
      type: 'quality-changed',
      timestamp: Date.now(),
      data: {
        qualityLevel: this.qualityLevel,
        maxParticles: Math.floor(1000 * this.qualityLevel),
        enableShadows: this.qualityLevel > 0.7,
        enableReflections: this.qualityLevel > 0.8,
        textureQuality: this.qualityLevel > 0.5 ? 'high' : 'medium'
      }
    });
  }
}
```

## Best Practices

### Entity Lifecycle Management

```typescript
class OptimizedEntityManager {
  private recycledEntityIds: number[] = [];
  private nextEntityId = 1;

  createEntity(): number {
    // Reuse recycled IDs when possible
    if (this.recycledEntityIds.length > 0) {
      return this.recycledEntityIds.pop()!;
    }

    return this.nextEntityId++;
  }

  destroyEntity(entityId: number): void {
    // Add to recycling pool instead of losing the ID
    this.recycledEntityIds.push(entityId);

    // Keep recycling pool from growing too large
    if (this.recycledEntityIds.length > 1000) {
      this.recycledEntityIds.splice(0, 500); // Remove oldest half
    }
  }

  getEntityCount(): number {
    return this.nextEntityId - 1 - this.recycledEntityIds.length;
  }

  getRecycledCount(): number {
    return this.recycledEntityIds.length;
  }
}
```

### Component Storage Optimization

```typescript
class OptimizedComponentStorage<T extends Component> {
  private components = new Map<number, T>();
  private packedComponents: T[] = [];
  private denseIndex = new Map<number, number>(); // entity -> packed index
  private sparseIndex: number[] = []; // packed index -> entity

  add(entityId: number, component: T): void {
    if (this.has(entityId)) {
      this.remove(entityId);
    }

    // Add to packed array
    const index = this.packedComponents.length;
    this.packedComponents.push(component);

    // Update indices
    this.denseIndex.set(entityId, index);
    this.sparseIndex[index] = entityId;
    this.components.set(entityId, component);
  }

  remove(entityId: number): boolean {
    const index = this.denseIndex.get(entityId);
    if (index === undefined) return false;

    // Swap with last element
    const lastIndex = this.packedComponents.length - 1;
    if (index !== lastIndex) {
      const lastComponent = this.packedComponents[lastIndex];
      const lastEntityId = this.sparseIndex[lastIndex];

      this.packedComponents[index] = lastComponent;
      this.sparseIndex[index] = lastEntityId;
      this.denseIndex.set(lastEntityId, index);
    }

    // Remove last element
    this.packedComponents.pop();
    this.sparseIndex.pop();
    this.denseIndex.delete(entityId);
    this.components.delete(entityId);

    return true;
  }

  get(entityId: number): T | undefined {
    return this.components.get(entityId);
  }

  has(entityId: number): boolean {
    return this.components.has(entityId);
  }

  // Iterate over packed array for better cache performance
  getAllPacked(): T[] {
    return this.packedComponents;
  }

  getEntitiesPacked(): number[] {
    return this.sparseIndex.slice();
  }
}
```

## Debugging Performance Issues

### Performance Regression Testing

```typescript
class PerformanceTest {
  static async benchmarkSystem(system: BaseSystem, world: World, iterations: number = 1000): Promise<number> {
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      system.update(world, 0.016); // 60fps
    }

    const endTime = performance.now();
    return (endTime - startTime) / iterations;
  }

  static async profileEntityCount(world: World, maxEntities: number = 10000): Promise<void> {
    const results: Array<{count: number, frameTime: number}> = [];

    for (let count = 100; count <= maxEntities; count += 100) {
      // Create entities
      for (let i = 0; i < 100; i++) {
        const entity = world.createEntity();
        world.addComponent(entity, { type: 'position', x: Math.random() * 800, y: Math.random() * 600 });
        world.addComponent(entity, { type: 'velocity', dx: Math.random() * 100, dy: Math.random() * 100 });
      }

      // Measure frame time
      const startTime = performance.now();
      world.update(0.016);
      const frameTime = performance.now() - startTime;

      results.push({ count, frameTime });

      if (frameTime > 16) {
        console.warn(`Performance degraded at ${count} entities: ${frameTime.toFixed(2)}ms`);
        break;
      }
    }

    console.log('Entity Count Performance Profile:');
    results.forEach(result => {
      console.log(`${result.count} entities: ${result.frameTime.toFixed(2)}ms`);
    });
  }
}
```

### Memory Leak Detection

```typescript
class MemoryLeakDetector {
  private baselineMemory: number = 0;
  private checkCount = 0;

  startMonitoring(): void {
    if ('memory' in performance) {
      this.baselineMemory = (performance as any).memory.usedJSHeapSize;
      console.log(`Memory leak detection started. Baseline: ${(this.baselineMemory / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  checkForLeaks(): void {
    if ('memory' in performance) {
      this.checkCount++;
      const currentMemory = (performance as any).memory.usedJSHeapSize;
      const memoryGrowth = currentMemory - this.baselineMemory;
      const growthMB = memoryGrowth / 1024 / 1024;

      console.log(`Memory check #${this.checkCount}: +${growthMB.toFixed(2)}MB from baseline`);

      if (growthMB > 50) { // More than 50MB growth
        console.warn(`🚨 Potential memory leak detected: ${growthMB.toFixed(2)}MB growth`);
        this.suggestDebuggingSteps();
      }
    }
  }

  private suggestDebuggingSteps(): void {
    console.log('Memory leak debugging suggestions:');
    console.log('1. Check for unremoved event listeners');
    console.log('2. Verify object pools are releasing objects');
    console.log('3. Look for circular references');
    console.log('4. Check if entities are being properly destroyed');
    console.log('5. Monitor component storage for growth');
  }
}
```

## See Also

- [Dirty Tracker API](../api/performance/dirty-tracker.md) - Component change tracking
- [Object Pool API](../api/performance/object-pool.md) - Memory optimization through pooling
- [System Scheduling](./systems-and-scheduling.md) - System execution optimization
- [Performance Demo](../examples/performance-optimization-demo.md) - Working performance examples
- [Testing Strategies](./testing-strategies.md) - Performance testing approaches