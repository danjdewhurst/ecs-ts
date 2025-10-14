# Entities and Components Guide

This guide covers entity and component design patterns, composition strategies, and best practices for building maintainable ECS game systems.

## Component Design Principles

### Pure Data Components

Components should contain only data, no logic:

```typescript
// ✅ Good: Pure data component
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
  z: number;
}

// ❌ Bad: Component with logic
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
  z: number;

  // Don't do this - logic belongs in systems
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }
}
```

### Small, Focused Components

Keep components focused on a single aspect:

```typescript
// ✅ Good: Focused components
interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

interface ArmorComponent extends Component {
  readonly type: 'armor';
  value: number;
  durability: number;
}

// ❌ Bad: Monolithic component
interface CombatComponent extends Component {
  readonly type: 'combat';
  health: number;
  maxHealth: number;
  armor: number;
  armorDurability: number;
  weapon: string;
  ammo: number;
  shield: number;
  // ... too many concerns
}
```

## Entity Composition Patterns

### Trait-Based Composition

Build entities by combining small components:

```typescript
// Create a player entity
const player = world.createEntity();
world.addComponent(player, { type: 'position', x: 0, y: 0, z: 0 });
world.addComponent(player, { type: 'health', current: 100, maximum: 100 });
world.addComponent(player, { type: 'velocity', x: 0, y: 0, z: 0 });
world.addComponent(player, { type: 'sprite', texture: 'player.png', layer: 1 });
world.addComponent(player, { type: 'input', keys: new Set() });

// Create an enemy with different composition
const enemy = world.createEntity();
world.addComponent(enemy, { type: 'position', x: 100, y: 100, z: 0 });
world.addComponent(enemy, { type: 'health', current: 50, maximum: 50 });
world.addComponent(enemy, { type: 'velocity', x: 0, y: 0, z: 0 });
world.addComponent(enemy, { type: 'sprite', texture: 'enemy.png', layer: 1 });
world.addComponent(enemy, { type: 'ai', state: 'patrol', target: null });
```

### Template-Based Creation

Use factories for common entity types:

```typescript
class EntityFactory {
  static createPlayer(world: World, x: number, y: number): number {
    const entity = world.createEntity();

    world.addComponent(entity, { type: 'position', x, y, z: 0 });
    world.addComponent(entity, { type: 'health', current: 100, maximum: 100 });
    world.addComponent(entity, { type: 'velocity', x: 0, y: 0, z: 0 });
    world.addComponent(entity, { type: 'sprite', texture: 'player.png', layer: 1 });
    world.addComponent(entity, { type: 'input', keys: new Set() });
    world.addComponent(entity, { type: 'inventory', items: [], capacity: 10 });

    return entity;
  }

  static createBullet(world: World, x: number, y: number, direction: Vector2): number {
    const entity = world.createEntity();

    world.addComponent(entity, { type: 'position', x, y, z: 0 });
    world.addComponent(entity, { type: 'velocity', x: direction.x * 500, y: direction.y * 500, z: 0 });
    world.addComponent(entity, { type: 'sprite', texture: 'bullet.png', layer: 2 });
    world.addComponent(entity, { type: 'lifetime', remaining: 3000 }); // 3 seconds
    world.addComponent(entity, { type: 'damage', value: 25 });

    return entity;
  }
}
```

## Common Component Patterns

### Transform Hierarchy

For parent-child relationships:

```typescript
interface TransformComponent extends Component {
  readonly type: 'transform';
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  parent?: number; // Entity ID of parent
  children: number[]; // Entity IDs of children
}

// Usage
const car = world.createEntity();
world.addComponent(car, {
  type: 'transform',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
  children: []
});

const wheel = world.createEntity();
world.addComponent(wheel, {
  type: 'transform',
  position: { x: 1, y: 0, z: -0.5 }, // Relative to parent
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
  parent: car,
  children: []
});

// Update parent's children list
const carTransform = world.getComponent(car, 'transform');
carTransform.children.push(wheel);
```

### State Machines

For complex behavior states:

```typescript
interface StateMachineComponent extends Component {
  readonly type: 'state-machine';
  currentState: string;
  previousState?: string;
  stateTime: number;
  transitions: Record<string, string[]>; // Valid transitions
}

// AI state example
world.addComponent(enemy, {
  type: 'state-machine',
  currentState: 'idle',
  stateTime: 0,
  transitions: {
    'idle': ['patrol', 'alert'],
    'patrol': ['idle', 'alert', 'chase'],
    'alert': ['idle', 'chase'],
    'chase': ['patrol', 'attack'],
    'attack': ['chase', 'patrol']
  }
});
```

### Resource References

For shared resources:

```typescript
interface SpriteComponent extends Component {
  readonly type: 'sprite';
  textureId: string; // Reference to texture resource
  frame: number;
  layer: number;
  visible: boolean;
}

interface AudioComponent extends Component {
  readonly type: 'audio';
  soundId: string; // Reference to sound resource
  volume: number;
  loop: boolean;
  playing: boolean;
}
```

## Entity Archetypes

### Movement Entities

Entities that can move:

```typescript
// Required: position, velocity
// Optional: acceleration, friction, collision

const movingEntity = world.createEntity();
world.addComponent(movingEntity, { type: 'position', x: 0, y: 0, z: 0 });
world.addComponent(movingEntity, { type: 'velocity', x: 0, y: 0, z: 0 });
world.addComponent(movingEntity, { type: 'acceleration', x: 0, y: 0, z: 0 });
```

### Renderable Entities

Entities that can be drawn:

```typescript
// Required: position, sprite
// Optional: animation, tint, layer

const renderableEntity = world.createEntity();
world.addComponent(renderableEntity, { type: 'position', x: 0, y: 0, z: 0 });
world.addComponent(renderableEntity, { type: 'sprite', texture: 'entity.png', layer: 1 });
```

### Interactive Entities

Entities that can be interacted with:

```typescript
// Required: position, collider
// Optional: interaction, tooltip

const interactiveEntity = world.createEntity();
world.addComponent(interactiveEntity, { type: 'position', x: 0, y: 0, z: 0 });
world.addComponent(interactiveEntity, { type: 'collider', width: 32, height: 32 });
world.addComponent(interactiveEntity, { type: 'interaction', prompt: 'Press E to use' });
```

## Component Lifecycle Management

### Initialization Components

For one-time setup:

```typescript
interface InitializableComponent extends Component {
  readonly type: 'initializable';
  initialized: boolean;
  initFunction: string; // Name of initialization function
}

class InitializationSystem extends BaseSystem {
  update(world: World): void {
    const entities = world.getEntitiesWithComponent('initializable');

    for (const entity of entities) {
      const init = world.getComponent(entity, 'initializable');

      if (!init.initialized) {
        this.runInitialization(entity, init.initFunction);
        init.initialized = true;
      }
    }
  }
}
```

### Cleanup Components

For automatic cleanup:

```typescript
interface LifetimeComponent extends Component {
  readonly type: 'lifetime';
  remaining: number; // Milliseconds
  onExpire?: 'destroy' | 'disable' | 'respawn';
}

class LifetimeSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    const entities = world.getEntitiesWithComponent('lifetime');

    for (const entity of entities) {
      const lifetime = world.getComponent(entity, 'lifetime');
      lifetime.remaining -= deltaTime;

      if (lifetime.remaining <= 0) {
        this.handleExpiration(world, entity, lifetime.onExpire);
      }
    }
  }
}
```

## Performance Considerations

### Component Pooling

Reuse component objects:

```typescript
class ComponentPool {
  private pools = new Map<string, ObjectPool<Component>>();

  getComponent<T extends Component>(type: string): T {
    let pool = this.pools.get(type);

    if (!pool) {
      pool = new ObjectPool(
        () => this.createComponent(type),
        (component) => this.resetComponent(component),
        10,
        100
      );
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
}
```

### Sparse Component Storage

Store components efficiently:

```typescript
class SparseComponentStorage<T extends Component> {
  private components = new Map<number, T>();
  private packed: T[] = [];
  private dense = new Map<number, number>(); // entity -> index

  add(entityId: number, component: T): void {
    if (this.components.has(entityId)) {
      this.remove(entityId);
    }

    const index = this.packed.length;
    this.packed.push(component);
    this.dense.set(entityId, index);
    this.components.set(entityId, component);
  }

  get(entityId: number): T | undefined {
    return this.components.get(entityId);
  }

  getAllPacked(): T[] {
    return this.packed;
  }
}
```

## Testing Patterns

### Component Testing

```typescript
describe('Component System', () => {
  test('should handle component composition', () => {
    const world = new World();
    const entity = world.createEntity();

    world.addComponent(entity, { type: 'position', x: 0, y: 0, z: 0 });
    world.addComponent(entity, { type: 'velocity', x: 1, y: 1, z: 0 });

    const position = world.getComponent(entity, 'position');
    const velocity = world.getComponent(entity, 'velocity');

    expect(position).toBeDefined();
    expect(velocity).toBeDefined();
    expect(world.hasComponent(entity, 'position')).toBe(true);
    expect(world.hasComponent(entity, 'health')).toBe(false);
  });

  test('should handle entity archetypes', () => {
    const world = new World();
    const player = EntityFactory.createPlayer(world, 0, 0);

    expect(world.hasComponent(player, 'position')).toBe(true);
    expect(world.hasComponent(player, 'health')).toBe(true);
    expect(world.hasComponent(player, 'input')).toBe(true);
  });
});
```

## See Also

- [Systems and Scheduling](./systems-and-scheduling.md) - System implementation patterns
- [Performance Optimization](./performance-optimization.md) - Performance best practices
- [World API](../api/core/world.md) - World entity management