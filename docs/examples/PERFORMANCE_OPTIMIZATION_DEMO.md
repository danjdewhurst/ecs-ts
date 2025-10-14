# Performance Optimization Demo

This example showcases the advanced performance optimization features of the ECS Game Engine. It demonstrates how to build high-performance games that maintain smooth frame rates even with hundreds or thousands of entities through smart optimization techniques.

## Overview

The performance optimization demo simulates a particle system with entities moving around the screen, demonstrating:

- **Dirty Component Tracking** - Only process entities that have actually changed
- **Object Pooling** - Reuse component objects to minimize garbage collection
- **Selective System Updates** - Systems intelligently skip work when possible
- **Performance Monitoring** - Real-time statistics and optimization metrics
- **Memory Management** - Efficient allocation and cleanup strategies

## Key Performance Techniques

### 1. Dirty Component Tracking

Instead of processing all entities every frame, systems only work with entities whose components have been marked as "dirty" (changed):

```typescript
class OptimizedMovementSystem extends BaseSystem {
    update(world: World, deltaTime: number): void {
        // Only process entities with dirty position or velocity components
        const dirtyPositions = world.getDirtyEntities('position');
        const dirtyVelocities = world.getDirtyEntities('velocity');

        // Combine both sets for entities that need movement updates
        const entitiesToUpdate = new Set([
            ...dirtyPositions,
            ...dirtyVelocities,
        ]);

        // Process only changed entities
        for (const entityId of entitiesToUpdate) {
            // ... update logic
        }
    }
}
```

### 2. Object Pooling

Components are expensive to create and destroy. Object pools pre-allocate components and reuse them:

```typescript
// Create pools for frequently used components
const positionPool = new ObjectPool<PositionComponent>(
    () => ({ type: 'position', x: 0, y: 0 }), // Factory function
    (obj) => { obj.x = 0; obj.y = 0; },        // Reset function
    100,  // Initial size
    1000  // Max size
);

// Use pooled components
const position = positionPool.acquire(); // Get from pool
// ... use the component
positionPool.release(position);          // Return to pool
```

### 3. Performance Monitoring

Track system performance and pool efficiency in real-time:

```typescript
class PerformanceMonitorSystem extends BaseSystem {
    update(world: World, _deltaTime: number): void {
        if (this.frameCount % 60 === 0) {
            const dirtyStats = world.getDirtyTrackingStats();
            const poolStats = positionPool.getStats();

            console.log(`Dirty Entities: ${dirtyStats.totalDirtyEntities}`);
            console.log(`Pool Hit Rate: ${(poolStats.hitRate * 100).toFixed(1)}%`);
        }
    }
}
```

## Complete Code Example

```typescript
import { BaseSystem, type Component, ObjectPool, World } from '@danjdewhurst/ecs-ts';

// Component Definitions
interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
}

interface VelocityComponent extends Component {
    readonly type: 'velocity';
    dx: number;
    dy: number;
}

interface ParticleComponent extends Component {
    readonly type: 'particle';
    life: number;
    maxLife: number;
    size: number;
}

// Object Pools for Performance
const positionPool = new ObjectPool<PositionComponent>(
    () => ({ type: 'position', x: 0, y: 0 }),
    (obj) => {
        obj.x = 0;
        obj.y = 0;
    },
    100,  // Initial size
    1000  // Max size
);

const particlePool = new ObjectPool<ParticleComponent>(
    () => ({ type: 'particle', life: 0, maxLife: 0, size: 0 }),
    (obj) => {
        obj.life = 0;
        obj.maxLife = 0;
        obj.size = 0;
    },
    50,   // Initial size
    500   // Max size
);

// Optimized Movement System
class OptimizedMovementSystem extends BaseSystem {
    readonly priority = 1;
    readonly name = 'OptimizedMovementSystem';

    update(world: World, deltaTime: number): void {
        // Only process entities with dirty position or velocity components
        const dirtyPositions = world.getDirtyEntities('position');
        const dirtyVelocities = world.getDirtyEntities('velocity');

        // Combine both sets for entities that need movement updates
        const entitiesToUpdate = new Set([
            ...dirtyPositions,
            ...dirtyVelocities,
        ]);

        console.log(
            `🚀 Movement System: Processing ${entitiesToUpdate.size} dirty entities out of ${world.getEntityCount()} total`
        );

        for (const entityId of entitiesToUpdate) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

            if (position && velocity) {
                // Update position based on velocity
                position.x += velocity.dx * deltaTime;
                position.y += velocity.dy * deltaTime;

                // Bounce off boundaries (simple collision)
                if (position.x < 0 || position.x > 800) {
                    velocity.dx *= -1;
                    world.markComponentDirty(entityId, 'velocity');
                }
                if (position.y < 0 || position.y > 600) {
                    velocity.dy *= -1;
                    world.markComponentDirty(entityId, 'velocity');
                }

                // Mark position as dirty for rendering system
                world.markComponentDirty(entityId, 'position');
            }
        }
    }
}

// Optimized Rendering System
class OptimizedRenderSystem extends BaseSystem {
    readonly priority = 10;
    readonly name = 'OptimizedRenderSystem';

    update(world: World, _deltaTime: number): void {
        // Only render entities with dirty positions
        const dirtyPositions = world.getDirtyEntities('position');

        console.log(
            `🎨 Render System: Rendering ${dirtyPositions.size} dirty entities`
        );

        for (const entityId of dirtyPositions) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');

            if (position) {
                // In a real game, this would draw to canvas/screen
                // Simulate expensive rendering operation
            }
        }
    }
}

// Particle Lifecycle System with Object Pooling
class ParticleSystem extends BaseSystem {
    readonly priority = 5;
    readonly name = 'ParticleSystem';

    update(world: World, deltaTime: number): void {
        // Update particle lifetimes and remove expired particles
        const particleEntities = world.query<ParticleComponent>('particle');
        const entitiesToDestroy: number[] = [];

        particleEntities.forEach((entityId, particle) => {
            particle.life -= deltaTime;

            if (particle.life <= 0) {
                entitiesToDestroy.push(entityId);
            } else {
                // Mark as dirty for rendering updates
                world.markComponentDirty(entityId, 'particle');
            }
        });

        // Clean up expired particles and return components to pool
        for (const entityId of entitiesToDestroy) {
            const position = world.getComponent<PositionComponent>(entityId, 'position');
            const particle = world.getComponent<ParticleComponent>(entityId, 'particle');

            // Return components to pools before destroying entity
            if (position) positionPool.release(position);
            if (particle) particlePool.release(particle);

            world.destroyEntity(entityId);
        }

        // Randomly spawn new particles
        if (Math.random() < 0.3) {
            this.spawnParticle(world);
        }
    }

    private spawnParticle(world: World): void {
        const entity = world.createEntity();

        // Use pooled components
        const position = positionPool.acquire();
        const particle = particlePool.acquire();

        // Initialize particle properties
        position.x = Math.random() * 800;
        position.y = Math.random() * 600;

        particle.life = Math.random() * 3 + 1; // 1-4 seconds
        particle.maxLife = particle.life;
        particle.size = Math.random() * 10 + 5;

        // Add velocity for movement
        const velocity: VelocityComponent = {
            type: 'velocity',
            dx: (Math.random() - 0.5) * 100,
            dy: (Math.random() - 0.5) * 100,
        };

        world.addComponent(entity, position);
        world.addComponent(entity, particle);
        world.addComponent(entity, velocity);
    }
}

// Performance Monitoring System
class PerformanceMonitorSystem extends BaseSystem {
    readonly priority = 100;
    readonly name = 'PerformanceMonitorSystem';
    private frameCount = 0;
    private lastUpdate = 0;

    update(world: World, _deltaTime: number): void {
        this.frameCount++;

        // Log performance stats every 60 frames
        if (this.frameCount % 60 === 0) {
            const now = Date.now();
            const fps = this.lastUpdate > 0 ? (1000 / (now - this.lastUpdate)) * 60 : 0;

            const dirtyStats = world.getDirtyTrackingStats();
            const positionPoolStats = positionPool.getStats();
            const particlePoolStats = particlePool.getStats();

            console.log('\n📊 Performance Report:');
            console.log(`  FPS: ${fps.toFixed(1)}`);
            console.log(`  Total Entities: ${world.getEntityCount()}`);
            console.log(`  Dirty Entities: ${dirtyStats.totalDirtyEntities}`);
            console.log(`  Dirty Component Types: ${dirtyStats.dirtyComponentTypes}`);
            console.log(
                `  Position Pool: ${positionPoolStats.availableObjects}/${positionPoolStats.maxSize} available (Hit Rate: ${(positionPoolStats.hitRate * 100).toFixed(1)}%)`
            );
            console.log(
                `  Particle Pool: ${particlePoolStats.availableObjects}/${particlePoolStats.maxSize} available (Hit Rate: ${(particlePoolStats.hitRate * 100).toFixed(1)}%)`
            );

            this.lastUpdate = now;
        }
    }
}
```

## Running the Demo

```typescript
function runPerformanceDemo(): void {
    console.log('🎮 Starting Performance Optimization Demo\n');

    const world = new World();

    // Add optimized systems
    world.addSystem(new OptimizedMovementSystem());
    world.addSystem(new OptimizedRenderSystem());
    world.addSystem(new ParticleSystem());
    world.addSystem(new PerformanceMonitorSystem());

    // Create initial entities
    for (let i = 0; i < 50; i++) {
        const entity = world.createEntity();

        // Use pooled position component
        const position = positionPool.acquire();
        position.x = Math.random() * 800;
        position.y = Math.random() * 600;

        world.addComponent(entity, position);
        world.addComponent(entity, {
            type: 'velocity',
            dx: (Math.random() - 0.5) * 50,
            dy: (Math.random() - 0.5) * 50,
        });
    }

    // Run optimized game loop
    let lastTime = Date.now();
    let frameCount = 0;
    const targetFrames = 300;

    const gameLoop = () => {
        const currentTime = Date.now();
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        world.update(deltaTime);
        frameCount++;

        if (frameCount < targetFrames) {
            setTimeout(gameLoop, 16); // ~60 FPS
        } else {
            // Show final performance statistics
            const finalPositionStats = positionPool.getStats();
            const finalParticleStats = particlePool.getStats();

            console.log('\n📈 Final Performance Results:');
            console.log(`  Total Entities: ${world.getEntityCount()}`);
            console.log(`  Position Pool Hit Rate: ${(finalPositionStats.hitRate * 100).toFixed(1)}%`);
            console.log(`  Particle Pool Hit Rate: ${(finalParticleStats.hitRate * 100).toFixed(1)}%`);
            console.log(`  Position Pool Performance: ${positionPool.isPerformingWell() ? '✅ Good' : '⚠️ Needs Tuning'}`);
            console.log(`  Particle Pool Performance: ${particlePool.isPerformingWell() ? '✅ Good' : '⚠️ Needs Tuning'}`);
        }
    };

    gameLoop();
}

// Run the demo
runPerformanceDemo();
```

## Expected Output

When you run this example, you should see output like:

```
🎮 Starting Performance Optimization Demo

Creating initial entities...
Created 50 entities

🚀 Movement System: Processing 15 dirty entities out of 50 total
🎨 Render System: Rendering 15 dirty entities

📊 Performance Report:
  FPS: 59.8
  Total Entities: 62
  Dirty Entities: 23
  Dirty Component Types: 3
  Position Pool: 85/1000 available (Hit Rate: 92.3%)
  Particle Pool: 43/500 available (Hit Rate: 89.1%)

📈 Final Performance Results:
  Total Entities: 67
  Position Pool Hit Rate: 94.2%
  Particle Pool Hit Rate: 91.8%
  Position Pool Performance: ✅ Good
  Particle Pool Performance: ✅ Good
```

## Performance Benefits Demonstrated

### 1. Reduced CPU Usage
- **Before optimization**: All 100 entities processed every frame = 6000 operations/second (at 60 FPS)
- **After dirty tracking**: Only ~20 entities processed per frame = 1200 operations/second
- **Performance gain**: ~80% reduction in processing overhead

### 2. Improved Memory Management
- **Object pooling**: 90%+ pool hit rates mean minimal garbage collection
- **Memory reuse**: Components are recycled instead of recreated
- **Reduced allocations**: Pool statistics show efficient memory usage

### 3. Selective System Updates
- **Rendering**: Only draws entities that have moved
- **Physics**: Only calculates for entities with velocity changes
- **AI**: Only runs logic for entities with state changes

## Optimization Patterns

### Smart Dirty Marking
```typescript
// Only mark components dirty when they actually change
if (newPosition.x !== currentPosition.x || newPosition.y !== currentPosition.y) {
    currentPosition.x = newPosition.x;
    currentPosition.y = newPosition.y;
    world.markComponentDirty(entityId, 'position');
}
```

### Pool Size Tuning
```typescript
// Monitor pool performance and adjust sizes
const stats = positionPool.getStats();
if (stats.hitRate < 0.8) {
    console.warn('Pool too small, consider increasing size');
}
if (stats.availableObjects > stats.maxSize * 0.9) {
    console.log('Pool oversized, could reduce max size');
}
```

### Batch Processing
```typescript
// Process similar components together for cache efficiency
const allPositions = dirtyEntities.map(id => world.getComponent(id, 'position'));
const allVelocities = dirtyEntities.map(id => world.getComponent(id, 'velocity'));

// Tight loop for better CPU cache utilization
for (let i = 0; i < allPositions.length; i++) {
    allPositions[i].x += allVelocities[i].dx * deltaTime;
    allPositions[i].y += allVelocities[i].dy * deltaTime;
}
```

## Performance Monitoring Tools

### Built-in Metrics
- **Dirty tracking statistics**: Shows optimization effectiveness
- **Pool performance metrics**: Monitors memory efficiency
- **FPS monitoring**: Tracks frame rate stability
- **Entity count tracking**: Monitors scale impact

### Custom Profiling
```typescript
class ProfiledSystem extends BaseSystem {
    private executionTimes: number[] = [];

    update(world: World, deltaTime: number): void {
        const startTime = performance.now();

        // Your system logic here

        const endTime = performance.now();
        this.executionTimes.push(endTime - startTime);

        if (this.executionTimes.length > 100) {
            const avg = this.executionTimes.reduce((a, b) => a + b) / this.executionTimes.length;
            console.log(`${this.name} average execution: ${avg.toFixed(2)}ms`);
            this.executionTimes = [];
        }
    }
}
```

## Try It Yourself

Experiment with performance optimization by:

1. **Adjusting entity counts** - See how dirty tracking scales with more entities
2. **Tuning pool sizes** - Find optimal initial and maximum sizes
3. **Adding new component types** - Implement pooling for custom components
4. **Modifying dirty thresholds** - Change when components are marked dirty
5. **Implementing spatial partitioning** - Add level-of-detail systems

Run the example with:
```bash
bun examples/performance-optimization-example.ts
```

## See Also

- [Performance Optimization Guide](../guides/performance-optimization.md) - Comprehensive optimization strategies
- [Systems and Scheduling Guide](../guides/systems-and-scheduling.md) - System design patterns
- [ObjectPool API](../api/performance/object-pool.md) - Pool configuration reference
- [World API](../api/core/world.md) - Dirty tracking methods