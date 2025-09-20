/**
 * Performance Optimization Example
 *
 * This example demonstrates the performance optimization features of the ECS Game Engine:
 * 1. Dirty Component Tracking - Only process entities that have changed
 * 2. Object Pooling - Reuse objects to reduce garbage collection
 *
 * The example simulates a game with many entities where performance is critical.
 */

import { BaseSystem, type Component, ObjectPool, World } from '../src/index.ts';

// Game Components
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

interface HealthComponent extends Component {
    readonly type: 'health';
    current: number;
    max: number;
}

interface ParticleComponent extends Component {
    readonly type: 'particle';
    life: number;
    maxLife: number;
    size: number;
}

// Object Pools for frequently created/destroyed components
const positionPool = new ObjectPool<PositionComponent>(
    () => ({ type: 'position', x: 0, y: 0 }),
    (obj) => {
        obj.x = 0;
        obj.y = 0;
    },
    100, // Initial size
    1000 // Max size
);

const particlePool = new ObjectPool<ParticleComponent>(
    () => ({ type: 'particle', life: 0, maxLife: 0, size: 0 }),
    (obj) => {
        obj.life = 0;
        obj.maxLife = 0;
        obj.size = 0;
    },
    50, // Initial size
    500 // Max size
);

// Performance-optimized systems using dirty tracking
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
            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            const velocity = world.getComponent<VelocityComponent>(
                entityId,
                'velocity'
            );

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
            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );

            if (position) {
                // Simulate rendering (in a real game, this would draw to canvas/screen)
                // console.log(`Rendering entity ${entityId} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            }
        }
    }
}

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
            const position = world.getComponent<PositionComponent>(
                entityId,
                'position'
            );
            const particle = world.getComponent<ParticleComponent>(
                entityId,
                'particle'
            );

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

class HealthSystem extends BaseSystem {
    readonly priority = 3;
    readonly name = 'HealthSystem';

    update(world: World, deltaTime: number): void {
        // Only process entities with dirty health components
        const dirtyHealth = world.getDirtyEntities('health');

        for (const entityId of dirtyHealth) {
            const health = world.getComponent<HealthComponent>(
                entityId,
                'health'
            );

            if (health) {
                // Simulate health regeneration
                if (health.current < health.max) {
                    health.current = Math.min(
                        health.max,
                        health.current + 10 * deltaTime
                    );
                    world.markComponentDirty(entityId, 'health');
                }
            }
        }
    }
}

// Performance monitoring system
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
            const fps =
                this.lastUpdate > 0 ? (1000 / (now - this.lastUpdate)) * 60 : 0;

            const dirtyStats = world.getDirtyTrackingStats();
            const positionPoolStats = positionPool.getStats();
            const particlePoolStats = particlePool.getStats();

            console.log('\n📊 Performance Report:');
            console.log(`  FPS: ${fps.toFixed(1)}`);
            console.log(`  Total Entities: ${world.getEntityCount()}`);
            console.log(`  Dirty Entities: ${dirtyStats.totalDirtyEntities}`);
            console.log(
                `  Dirty Component Types: ${dirtyStats.dirtyComponentTypes}`
            );
            console.log(
                `  Position Pool: ${positionPoolStats.availableObjects}/${positionPoolStats.maxSize} available (Hit Rate: ${(positionPoolStats.hitRate * 100).toFixed(1)}%)`
            );
            console.log(
                `  Particle Pool: ${particlePoolStats.availableObjects}/${particlePoolStats.maxSize} available (Hit Rate: ${(particlePoolStats.hitRate * 100).toFixed(1)}%)`
            );
            console.log('');

            this.lastUpdate = now;
        }
    }
}

// Demo function
function runPerformanceDemo(): void {
    console.log('🎮 Starting Performance Optimization Demo\n');

    const world = new World();

    // Add systems
    world.addSystem(new OptimizedMovementSystem());
    world.addSystem(new OptimizedRenderSystem());
    world.addSystem(new ParticleSystem());
    world.addSystem(new HealthSystem());
    world.addSystem(new PerformanceMonitorSystem());

    // Create initial entities
    console.log('Creating initial entities...');

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

        // Add health to some entities
        if (Math.random() < 0.3) {
            world.addComponent(entity, {
                type: 'health',
                current: 80,
                max: 100,
            });
        }
    }

    console.log(`Created ${world.getEntityCount()} entities\n`);

    // Run simulation
    let lastTime = Date.now();
    let frameCount = 0;
    const targetFrames = 300; // Run for 300 frames

    const gameLoop = () => {
        const currentTime = Date.now();
        const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
        lastTime = currentTime;

        // Update world
        world.update(deltaTime);

        frameCount++;

        if (frameCount < targetFrames) {
            setTimeout(gameLoop, 16); // ~60 FPS
        } else {
            console.log('\n🏁 Demo completed!');
            console.log('\nPerformance Optimization Features Demonstrated:');
            console.log(
                '✅ Dirty Component Tracking - Systems only process changed entities'
            );
            console.log(
                '✅ Object Pooling - Components are reused to reduce garbage collection'
            );
            console.log(
                '✅ Efficient Memory Management - Pool statistics show memory optimization'
            );
            console.log(
                '✅ Selective System Updates - Rendering and movement only update when needed'
            );

            // Final statistics
            const _finalDirtyStats = world.getDirtyTrackingStats();
            const finalPositionStats = positionPool.getStats();
            const finalParticleStats = particlePool.getStats();

            console.log('\n📈 Final Statistics:');
            console.log(`  Total Entities: ${world.getEntityCount()}`);
            console.log(
                `  Position Pool Hit Rate: ${(finalPositionStats.hitRate * 100).toFixed(1)}%`
            );
            console.log(
                `  Particle Pool Hit Rate: ${(finalParticleStats.hitRate * 100).toFixed(1)}%`
            );
            console.log(
                `  Position Pool Performance: ${positionPool.isPerformingWell() ? '✅ Good' : '⚠️ Needs Tuning'}`
            );
            console.log(
                `  Particle Pool Performance: ${particlePool.isPerformingWell() ? '✅ Good' : '⚠️ Needs Tuning'}`
            );
        }
    };

    // Start the demo
    gameLoop();
}

// Run the demo
if (import.meta.main) {
    runPerformanceDemo();
}
