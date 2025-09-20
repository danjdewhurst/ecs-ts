# Systems and Scheduling Guide

This guide covers system architecture patterns, dependency management, and scheduling strategies for building efficient and maintainable ECS games.

## System Design Principles

### Single Responsibility Systems

Each system should have one clear purpose:

```typescript
// ✅ Good: Focused system with single responsibility
class MovementSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'MovementSystem';

  update(world: World, deltaTime: number): void {
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
}

// ❌ Bad: System handling too many concerns
class GameplaySystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // Don't mix movement, health, rendering, and input in one system
    this.handleMovement(world, deltaTime);
    this.handleHealth(world, deltaTime);
    this.handleRendering(world);
    this.handleInput(world);
  }
}
```

### Stateless System Design

Keep systems stateless when possible:

```typescript
// ✅ Good: Stateless system
class HealthRegenSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'HealthRegenSystem';

  update(world: World, deltaTime: number): void {
    const entities = this.queryEntities(world, 'health', 'regen');

    for (const entityId of entities) {
      const health = world.getComponent<HealthComponent>(entityId, 'health');
      const regen = world.getComponent<RegenComponent>(entityId, 'regen');

      if (health && regen && health.current < health.maximum) {
        health.current = Math.min(
          health.maximum,
          health.current + regen.rate * deltaTime
        );
      }
    }
  }
}

// ❌ Acceptable but less flexible: Stateful system
class TimerSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'TimerSystem';

  private gameTime = 0; // State is sometimes necessary

  update(world: World, deltaTime: number): void {
    this.gameTime += deltaTime;

    // Update timer components with global time
    const entities = this.queryEntities(world, 'timer');
    for (const entityId of entities) {
      const timer = world.getComponent<TimerComponent>(entityId, 'timer');
      if (timer) {
        timer.elapsed = this.gameTime - timer.startTime;
      }
    }
  }
}
```

## System Priority and Ordering

### Priority Guidelines

Use logical priority groupings:

```typescript
// Input and user interface (1-10)
class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';
}

class UISystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'UISystem';
}

// Game logic and AI (10-30)
class AISystem extends BaseSystem {
  readonly priority = 10;
  readonly name = 'AISystem';
}

class GameLogicSystem extends BaseSystem {
  readonly priority = 15;
  readonly name = 'GameLogicSystem';
}

// Physics and movement (30-50)
class MovementSystem extends BaseSystem {
  readonly priority = 30;
  readonly name = 'MovementSystem';
}

class PhysicsSystem extends BaseSystem {
  readonly priority = 35;
  readonly name = 'PhysicsSystem';
}

class CollisionSystem extends BaseSystem {
  readonly priority = 40;
  readonly name = 'CollisionSystem';
}

// Effects and audio (50-80)
class ParticleSystem extends BaseSystem {
  readonly priority = 50;
  readonly name = 'ParticleSystem';
}

class AudioSystem extends BaseSystem {
  readonly priority = 60;
  readonly name = 'AudioSystem';
}

// Rendering (80-100)
class SpriteSystem extends BaseSystem {
  readonly priority = 80;
  readonly name = 'SpriteSystem';
}

class RenderSystem extends BaseSystem {
  readonly priority = 100; // Always last
  readonly name = 'RenderSystem';
}
```

### Dependency-Based Ordering

Use dependencies to ensure correct execution order:

```typescript
class PhysicsSystem extends BaseSystem {
  readonly priority = 30;
  readonly name = 'PhysicsSystem';
  readonly dependencies = ['MovementSystem']; // Needs movement first
}

class CollisionSystem extends BaseSystem {
  readonly priority = 40;
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem']; // Needs physics calculations
}

class DamageSystem extends BaseSystem {
  readonly priority = 35; // Lower priority than collision
  readonly name = 'DamageSystem';
  readonly dependencies = ['CollisionSystem']; // But must wait for collisions
}

class RenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'RenderSystem';
  readonly dependencies = ['PhysicsSystem', 'CollisionSystem']; // Needs final positions
}
```

## System Communication Patterns

### Event-Driven Communication

Use events for loose coupling between systems:

```typescript
class WeaponSystem extends BaseSystem {
  readonly priority = 20;
  readonly name = 'WeaponSystem';

  update(world: World, deltaTime: number): void {
    const weapons = this.queryEntities(world, 'weapon', 'input');

    for (const entityId of weapons) {
      const weapon = world.getComponent<WeaponComponent>(entityId, 'weapon');
      const input = world.getComponent<InputComponent>(entityId, 'input');

      if (weapon && input && input.keys.has('Space') && weapon.cooldown <= 0) {
        // Emit event instead of directly creating projectile
        world.emitEvent({
          type: 'weapon-fired',
          data: {
            weaponId: entityId,
            position: world.getComponent(entityId, 'position'),
            damage: weapon.damage
          },
          timestamp: Date.now()
        });

        weapon.cooldown = weapon.cooldownDuration;
      }

      if (weapon.cooldown > 0) {
        weapon.cooldown -= deltaTime;
      }
    }
  }
}

class ProjectileSystem extends BaseSystem {
  readonly priority = 25;
  readonly name = 'ProjectileSystem';

  initialize(world: World): void {
    // Listen for weapon fire events
    world.subscribeToEvent('weapon-fired', (event) => {
      this.createProjectile(world, event.data);
    });
  }

  private createProjectile(world: World, data: any): void {
    const projectile = world.createEntity();

    world.addComponent(projectile, {
      type: 'position',
      x: data.position.x,
      y: data.position.y,
      z: 0
    });

    world.addComponent(projectile, {
      type: 'projectile',
      damage: data.damage,
      speed: 500
    });

    world.addComponent(projectile, {
      type: 'lifetime',
      remaining: 3000 // 3 seconds
    });
  }

  update(world: World, deltaTime: number): void {
    // Move projectiles
    const projectiles = this.queryEntities(world, 'projectile', 'position');

    for (const entityId of projectiles) {
      const projectile = world.getComponent<ProjectileComponent>(entityId, 'projectile');
      const position = world.getComponent<PositionComponent>(entityId, 'position');

      if (projectile && position) {
        position.y -= projectile.speed * deltaTime;
      }
    }
  }
}
```

### Direct Component Access

Use direct access for tightly coupled systems:

```typescript
class TransformHierarchySystem extends BaseSystem {
  readonly priority = 25;
  readonly name = 'TransformHierarchySystem';
  readonly dependencies = ['MovementSystem'];

  update(world: World): void {
    // Update child transforms based on parent transforms
    const entities = this.queryEntities(world, 'transform');

    // Process parents first (entities with no parent)
    const parentEntities = entities.filter(id => {
      const transform = world.getComponent<TransformComponent>(id, 'transform');
      return transform && !transform.parent;
    });

    for (const parentId of parentEntities) {
      this.updateHierarchy(world, parentId);
    }
  }

  private updateHierarchy(world: World, entityId: number): void {
    const transform = world.getComponent<TransformComponent>(entityId, 'transform');
    if (!transform) return;

    // Update children recursively
    for (const childId of transform.children) {
      const childTransform = world.getComponent<TransformComponent>(childId, 'transform');
      if (childTransform) {
        // Apply parent transform to child
        const worldPosition = this.transformPoint(childTransform.localPosition, transform);

        // Update child's world position
        if (world.hasComponent(childId, 'position')) {
          const position = world.getComponent<PositionComponent>(childId, 'position');
          if (position) {
            position.x = worldPosition.x;
            position.y = worldPosition.y;
            position.z = worldPosition.z;
          }
        }

        // Recursively update grandchildren
        this.updateHierarchy(world, childId);
      }
    }
  }
}
```

## System Lifecycle Management

### Initialization Patterns

```typescript
class ResourceSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'ResourceSystem';

  private resources = new Map<string, any>();

  initialize(world: World): void {
    // Load game resources during initialization
    this.loadTextures();
    this.loadSounds();
    this.loadConfigurations();

    console.log('ResourceSystem initialized with', this.resources.size, 'resources');
  }

  private async loadTextures(): Promise<void> {
    const textureList = ['player.png', 'enemy.png', 'bullet.png'];

    for (const texture of textureList) {
      try {
        const image = new Image();
        image.src = `assets/${texture}`;
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
        });
        this.resources.set(texture, image);
      } catch (error) {
        console.error(`Failed to load texture ${texture}:`, error);
      }
    }
  }

  update(world: World): void {
    // Minimal update logic - resources are mostly static
  }

  getResource(name: string): any {
    return this.resources.get(name);
  }

  shutdown(world: World): void {
    // Clean up resources
    this.resources.clear();
    console.log('ResourceSystem shut down');
  }
}
```

### Dynamic System Management

```typescript
class LevelManager {
  private scheduler = new SystemScheduler();
  private world = new World();
  private currentLevel: string | null = null;

  async loadLevel(levelName: string): Promise<void> {
    // Cleanup previous level
    if (this.currentLevel) {
      await this.unloadLevel();
    }

    // Load level-specific systems
    switch (levelName) {
      case 'menu':
        this.scheduler.addSystem(new MenuSystem());
        this.scheduler.addSystem(new UINavigationSystem());
        break;

      case 'gameplay':
        this.scheduler.addSystem(new InputSystem());
        this.scheduler.addSystem(new MovementSystem());
        this.scheduler.addSystem(new AISystem());
        this.scheduler.addSystem(new PhysicsSystem());
        this.scheduler.addSystem(new RenderSystem());
        break;

      case 'multiplayer':
        this.scheduler.addSystem(new InputSystem());
        this.scheduler.addSystem(new NetworkSystem());
        this.scheduler.addSystem(new SyncSystem());
        this.scheduler.addSystem(new MovementSystem());
        this.scheduler.addSystem(new PhysicsSystem());
        this.scheduler.addSystem(new RenderSystem());
        break;
    }

    // Initialize new systems
    this.scheduler.initializeSystems(this.world);
    this.currentLevel = levelName;

    console.log(`Level '${levelName}' loaded with ${this.scheduler.getSystems().length} systems`);
  }

  async unloadLevel(): Promise<void> {
    if (!this.currentLevel) return;

    // Shutdown all systems
    this.scheduler.shutdownSystems(this.world);

    // Clear systems
    const systems = this.scheduler.getSystems();
    for (const system of systems) {
      this.scheduler.removeSystem(system.name);
    }

    // Clear world entities
    this.world.clear();

    console.log(`Level '${this.currentLevel}' unloaded`);
    this.currentLevel = null;
  }

  update(deltaTime: number): void {
    if (this.currentLevel) {
      this.scheduler.update(this.world, deltaTime);
    }
  }
}
```

## Performance Optimization Patterns

### System Grouping for Cache Efficiency

```typescript
class BatchedPhysicsSystem extends BaseSystem {
  readonly priority = 30;
  readonly name = 'BatchedPhysicsSystem';

  update(world: World, deltaTime: number): void {
    // Collect all physics entities
    const entities = this.queryEntities(world, 'position', 'velocity', 'physics');

    // Batch process for better cache locality
    const positions: PositionComponent[] = [];
    const velocities: VelocityComponent[] = [];
    const physics: PhysicsComponent[] = [];

    // Collect components in arrays
    for (const entityId of entities) {
      const pos = world.getComponent<PositionComponent>(entityId, 'position');
      const vel = world.getComponent<VelocityComponent>(entityId, 'velocity');
      const phys = world.getComponent<PhysicsComponent>(entityId, 'physics');

      if (pos && vel && phys) {
        positions.push(pos);
        velocities.push(vel);
        physics.push(phys);
      }
    }

    // Process in batch (better for CPU cache)
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const vel = velocities[i];
      const phys = physics[i];

      // Apply gravity
      vel.dy += phys.gravity * deltaTime;

      // Apply velocity
      pos.x += vel.dx * deltaTime;
      pos.y += vel.dy * deltaTime;

      // Apply damping
      vel.dx *= phys.damping;
      vel.dy *= phys.damping;
    }
  }
}
```

### Selective System Updates

```typescript
class OptimizedRenderSystem extends BaseSystem {
  readonly priority = 100;
  readonly name = 'OptimizedRenderSystem';

  private lastFramePositions = new Map<number, {x: number, y: number}>();

  update(world: World): void {
    // Only render entities that moved or changed
    const renderableEntities = this.queryEntities(world, 'position', 'sprite');
    const entitiesToRender: number[] = [];

    for (const entityId of renderableEntities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const lastPos = this.lastFramePositions.get(entityId);

      if (!position) continue;

      // Check if position changed
      if (!lastPos || lastPos.x !== position.x || lastPos.y !== position.y) {
        entitiesToRender.push(entityId);
        this.lastFramePositions.set(entityId, { x: position.x, y: position.y });
      }
    }

    // Only render entities that actually moved
    if (entitiesToRender.length > 0) {
      this.renderEntities(world, entitiesToRender);
    }
  }

  private renderEntities(world: World, entities: number[]): void {
    // Actual rendering logic for changed entities
    for (const entityId of entities) {
      // Render individual entity
    }
  }
}
```

## Common System Patterns

### State Machine System

```typescript
class StateMachineSystem extends BaseSystem {
  readonly priority = 15;
  readonly name = 'StateMachineSystem';

  update(world: World, deltaTime: number): void {
    const entities = this.queryEntities(world, 'state-machine');

    for (const entityId of entities) {
      const stateMachine = world.getComponent<StateMachineComponent>(entityId, 'state-machine');

      if (stateMachine) {
        // Update state time
        stateMachine.stateTime += deltaTime;

        // Process current state
        this.processState(world, entityId, stateMachine);

        // Check for state transitions
        this.checkTransitions(world, entityId, stateMachine);
      }
    }
  }

  private processState(world: World, entityId: number, stateMachine: StateMachineComponent): void {
    switch (stateMachine.currentState) {
      case 'idle':
        this.processIdleState(world, entityId, stateMachine);
        break;
      case 'moving':
        this.processMovingState(world, entityId, stateMachine);
        break;
      case 'attacking':
        this.processAttackingState(world, entityId, stateMachine);
        break;
    }
  }

  private checkTransitions(world: World, entityId: number, stateMachine: StateMachineComponent): void {
    const validTransitions = stateMachine.transitions[stateMachine.currentState] || [];

    for (const targetState of validTransitions) {
      if (this.shouldTransition(world, entityId, stateMachine.currentState, targetState)) {
        this.transitionToState(stateMachine, targetState);
        break;
      }
    }
  }

  private transitionToState(stateMachine: StateMachineComponent, newState: string): void {
    stateMachine.previousState = stateMachine.currentState;
    stateMachine.currentState = newState;
    stateMachine.stateTime = 0;
  }
}
```

### Pooled Entity System

```typescript
class ProjectilePoolSystem extends BaseSystem {
  readonly priority = 25;
  readonly name = 'ProjectilePoolSystem';

  private projectilePool: number[] = [];
  private maxPoolSize = 100;

  initialize(world: World): void {
    // Pre-create projectile entities
    for (let i = 0; i < this.maxPoolSize; i++) {
      const entity = world.createEntity();
      world.addComponent(entity, { type: 'pooled-projectile', active: false });
      this.projectilePool.push(entity);
    }

    // Listen for projectile spawn requests
    world.subscribeToEvent('spawn-projectile', (event) => {
      this.spawnProjectile(world, event.data);
    });
  }

  private spawnProjectile(world: World, data: any): void {
    // Find inactive projectile in pool
    const projectileId = this.projectilePool.find(id => {
      const pooled = world.getComponent<PooledProjectileComponent>(id, 'pooled-projectile');
      return pooled && !pooled.active;
    });

    if (projectileId) {
      // Activate and configure projectile
      const pooled = world.getComponent<PooledProjectileComponent>(projectileId, 'pooled-projectile');
      if (pooled) {
        pooled.active = true;
      }

      // Add runtime components
      world.addComponent(projectileId, {
        type: 'position',
        x: data.x,
        y: data.y,
        z: 0
      });

      world.addComponent(projectileId, {
        type: 'velocity',
        dx: data.velocityX,
        dy: data.velocityY,
        dz: 0
      });

      world.addComponent(projectileId, {
        type: 'lifetime',
        remaining: 3000
      });
    }
  }

  update(world: World, deltaTime: number): void {
    // Return expired projectiles to pool
    const activeProjectiles = this.projectilePool.filter(id => {
      const pooled = world.getComponent<PooledProjectileComponent>(id, 'pooled-projectile');
      return pooled && pooled.active;
    });

    for (const projectileId of activeProjectiles) {
      const lifetime = world.getComponent<LifetimeComponent>(projectileId, 'lifetime');

      if (lifetime && lifetime.remaining <= 0) {
        this.returnToPool(world, projectileId);
      }
    }
  }

  private returnToPool(world: World, projectileId: number): void {
    // Deactivate
    const pooled = world.getComponent<PooledProjectileComponent>(projectileId, 'pooled-projectile');
    if (pooled) {
      pooled.active = false;
    }

    // Remove runtime components
    world.removeComponent(projectileId, 'position');
    world.removeComponent(projectileId, 'velocity');
    world.removeComponent(projectileId, 'lifetime');
  }
}
```

## Error Handling and Debugging

### Robust System Implementation

```typescript
class RobustGameSystem extends BaseSystem {
  readonly priority = 10;
  readonly name = 'RobustGameSystem';

  update(world: World, deltaTime: number): void {
    try {
      const entities = this.queryEntities(world, 'game-object');

      for (const entityId of entities) {
        try {
          this.processGameObject(world, entityId, deltaTime);
        } catch (error) {
          console.error(`Error processing entity ${entityId}:`, error);

          // Mark entity for debugging
          world.addComponent(entityId, {
            type: 'debug-error',
            error: error.message,
            timestamp: Date.now()
          });

          // Continue processing other entities
        }
      }
    } catch (critical) {
      console.error(`Critical error in ${this.name}:`, critical);

      // Emit system error event
      world.emitEvent({
        type: 'system-error',
        data: { systemName: this.name, error: critical.message },
        timestamp: Date.now()
      });
    }
  }

  private processGameObject(world: World, entityId: number, deltaTime: number): void {
    // Game object processing logic that might throw
    const gameObject = world.getComponent<GameObjectComponent>(entityId, 'game-object');

    if (!gameObject) {
      throw new Error('Entity missing required game-object component');
    }

    // Safe processing with validation
    if (typeof gameObject.health === 'number' && gameObject.health < 0) {
      throw new Error('Invalid health value');
    }
  }
}
```

### System Performance Monitoring

```typescript
class PerformanceMonitoringSystem extends BaseSystem {
  readonly priority = 1000; // Run last
  readonly name = 'PerformanceMonitoringSystem';

  private frameCount = 0;
  private lastReportTime = 0;
  private systemMetrics = new Map<string, { totalTime: number, calls: number }>();

  update(world: World, deltaTime: number): void {
    this.frameCount++;
    const currentTime = performance.now();

    // Report every second
    if (currentTime - this.lastReportTime >= 1000) {
      this.reportPerformance(world);
      this.lastReportTime = currentTime;
      this.systemMetrics.clear();
    }

    // Monitor system performance
    this.monitorSystems(world);
  }

  private monitorSystems(world: World): void {
    // This would need access to system execution times
    // In a real implementation, this could integrate with the SystemScheduler
    const fps = this.frameCount / ((performance.now() - this.lastReportTime) / 1000);

    if (fps < 30) {
      console.warn(`Low FPS detected: ${fps.toFixed(1)}`);

      world.emitEvent({
        type: 'performance-warning',
        data: { fps, frameCount: this.frameCount },
        timestamp: Date.now()
      });
    }
  }

  private reportPerformance(world: World): void {
    console.log(`Performance Report - FPS: ${this.frameCount}`);
    console.log(`Entity Count: ${world.getEntityCount()}`);

    // Reset frame count
    this.frameCount = 0;
  }
}
```

## Testing Strategies

### Unit Testing Systems

```typescript
import { test, expect, describe } from "bun:test";

describe('MovementSystem', () => {
  test('should move entities with position and velocity', () => {
    // Arrange
    const world = new World();
    const system = new MovementSystem();

    const entity = world.createEntity();
    world.addComponent(entity, { type: 'position', x: 0, y: 0, z: 0 });
    world.addComponent(entity, { type: 'velocity', dx: 100, dy: 50, dz: 0 });

    // Act
    system.update(world, 0.016); // 60fps frame

    // Assert
    const position = world.getComponent<PositionComponent>(entity, 'position');
    expect(position?.x).toBeCloseTo(1.6);
    expect(position?.y).toBeCloseTo(0.8);
  });

  test('should handle entities without velocity component', () => {
    // Arrange
    const world = new World();
    const system = new MovementSystem();

    const entity = world.createEntity();
    world.addComponent(entity, { type: 'position', x: 0, y: 0, z: 0 });
    // No velocity component

    const initialPosition = { ...world.getComponent<PositionComponent>(entity, 'position')! };

    // Act
    system.update(world, 0.016);

    // Assert
    const finalPosition = world.getComponent<PositionComponent>(entity, 'position');
    expect(finalPosition?.x).toBe(initialPosition.x);
    expect(finalPosition?.y).toBe(initialPosition.y);
  });
});
```

### Integration Testing

```typescript
describe('System Integration', () => {
  test('should handle physics and collision systems together', () => {
    // Arrange
    const world = new World();
    const scheduler = new SystemScheduler();

    scheduler.addSystem(new MovementSystem());
    scheduler.addSystem(new PhysicsSystem());
    scheduler.addSystem(new CollisionSystem());

    // Create two entities that will collide
    const entity1 = world.createEntity();
    world.addComponent(entity1, { type: 'position', x: 0, y: 0, z: 0 });
    world.addComponent(entity1, { type: 'velocity', dx: 100, dy: 0, dz: 0 });
    world.addComponent(entity1, { type: 'collider', width: 10, height: 10 });

    const entity2 = world.createEntity();
    world.addComponent(entity2, { type: 'position', x: 20, y: 0, z: 0 });
    world.addComponent(entity2, { type: 'velocity', dx: -100, dy: 0, dz: 0 });
    world.addComponent(entity2, { type: 'collider', width: 10, height: 10 });

    let collisionDetected = false;
    world.subscribeToEvent('collision', () => {
      collisionDetected = true;
    });

    // Act - simulate frames until collision
    for (let i = 0; i < 20; i++) {
      scheduler.update(world, 0.016);
      if (collisionDetected) break;
    }

    // Assert
    expect(collisionDetected).toBe(true);
  });
});
```

## See Also

- [System API](../api/core/system.md) - System interface and implementation details
- [System Scheduler](../api/core/system-scheduler.md) - Dependency resolution and execution order
- [Events and Communication](./events-and-communication.md) - Inter-system communication patterns
- [Performance Optimization](./performance-optimization.md) - System optimization strategies
- [Testing Strategies](./testing-strategies.md) - Comprehensive testing approaches