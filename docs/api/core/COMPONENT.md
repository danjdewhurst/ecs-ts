# Component API Reference

Components are pure data structures that define what entities possess. They follow the principle that **components are data, not behavior** - all game logic belongs in systems.

## Overview

The Component system provides:

- **Type-Safe Interface**: TypeScript interfaces for component definitions
- **Efficient Storage**: Optimized storage structures for component data
- **Cache-Friendly Layout**: Components of the same type stored together
- **Minimal Overhead**: Lightweight data structures with no behavior

Components are the foundation of entity composition, allowing flexible entity creation through data combination.

## Component Interface

### Component

The base interface that all components must extend.

```typescript
interface Component {
  readonly type: string;
}
```

**Properties:**
- `type: string` - Unique identifier for the component type (must be readonly)

**Example:**
```typescript
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
  z?: number;
}

interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}
```

## Component Design Principles

### 1. Pure Data Structures

Components should contain only data, never behavior:

```typescript
// ✅ Good: Pure data
interface VelocityComponent extends Component {
  readonly type: 'velocity';
  dx: number;
  dy: number;
  maxSpeed: number;
}

// ❌ Bad: Contains behavior
interface BadComponent extends Component {
  readonly type: 'bad';
  x: number;
  y: number;
  move(dx: number, dy: number): void;  // NO! Behavior belongs in systems
  calculateDistance(other: BadComponent): number;  // NO!
}
```

### 2. Single Responsibility

Each component should represent one coherent concept:

```typescript
// ✅ Good: Focused components
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

interface RenderComponent extends Component {
  readonly type: 'render';
  sprite: string;
  layer: number;
}

// ❌ Bad: Mixed responsibilities
interface PositionRenderComponent extends Component {
  readonly type: 'position-render';
  x: number; y: number;        // Position concerns
  sprite: string; layer: number; // Rendering concerns
}
```

### 3. Readonly Type Field

The `type` field must be readonly for performance optimization:

```typescript
// ✅ Correct
interface MyComponent extends Component {
  readonly type: 'my-component';  // Readonly required
  data: number;
}

// ❌ Incorrect
interface BadComponent extends Component {
  type: 'bad-component';  // Missing readonly
  data: number;
}
```

### 4. Serializable Data

Components should use plain data that's easy to serialize:

```typescript
// ✅ Good: Serializable types
interface GameStateComponent extends Component {
  readonly type: 'game-state';
  level: number;
  score: number;
  powerUps: string[];
  config: {
    difficulty: 'easy' | 'medium' | 'hard';
    enableSound: boolean;
  };
}

// ❌ Avoid: Non-serializable types
interface ProblematicComponent extends Component {
  readonly type: 'problematic';
  callback: () => void;          // Functions don't serialize
  domElement: HTMLElement;       // DOM references problematic
  weakMap: WeakMap<object, any>; // WeakMap doesn't serialize
}
```

## Component Creation Patterns

### Factory Functions

Create helper functions for component construction:

```typescript
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
  z?: number;
}

// Factory function for easy creation
export function createPositionComponent(
  x: number,
  y: number,
  z = 0
): PositionComponent {
  return {
    type: 'position',
    x,
    y,
    z
  };
}

// Usage
const world = new World();
const entity = world.createEntity();
world.addComponent(entity, createPositionComponent(100, 200));
```

### Default Values

Provide sensible defaults in component interfaces:

```typescript
interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

export function createHealthComponent(maximum = 100): HealthComponent {
  return {
    type: 'health',
    current: maximum,
    maximum
  };
}

interface TimerComponent extends Component {
  readonly type: 'timer';
  duration: number;
  elapsed: number;
  paused: boolean;
}

export function createTimerComponent(
  duration: number,
  paused = false
): TimerComponent {
  return {
    type: 'timer',
    duration,
    elapsed: 0,
    paused
  };
}
```

### Configuration Objects

Use configuration objects for complex components:

```typescript
interface SpriteComponent extends Component {
  readonly type: 'sprite';
  image: string;
  width: number;
  height: number;
  scale: { x: number; y: number };
  tint: { r: number; g: number; b: number; a: number };
  animations: {
    current: string;
    frame: number;
    speed: number;
  };
}

interface SpriteConfig {
  image: string;
  width?: number;
  height?: number;
  scale?: { x: number; y: number };
  tint?: { r: number; g: number; b: number; a: number };
  animation?: {
    current?: string;
    frame?: number;
    speed?: number;
  };
}

export function createSpriteComponent(config: SpriteConfig): SpriteComponent {
  return {
    type: 'sprite',
    image: config.image,
    width: config.width ?? 32,
    height: config.height ?? 32,
    scale: config.scale ?? { x: 1, y: 1 },
    tint: config.tint ?? { r: 255, g: 255, b: 255, a: 255 },
    animations: {
      current: config.animation?.current ?? 'idle',
      frame: config.animation?.frame ?? 0,
      speed: config.animation?.speed ?? 1
    }
  };
}

// Usage
world.addComponent(entity, createSpriteComponent({
  image: 'player.png',
  scale: { x: 2, y: 2 },
  animation: { current: 'walking' }
}));
```

## ComponentStorage<T>

Internal storage class for efficient component management. Typically used by the World class.

### Properties

- `private components: Map<number, T>` - Component data indexed by entity ID
- `private entitySet: Set<number>` - Fast entity lookup set

### Methods

#### add(entityId, component)

Stores a component for an entity.

```typescript
add(entityId: number, component: T): void
```

**Parameters:**
- `entityId: number` - Target entity ID
- `component: T` - Component data to store

#### get(entityId)

Retrieves a component for an entity.

```typescript
get(entityId: number): T | undefined
```

**Parameters:**
- `entityId: number` - Target entity ID

**Returns:** `T | undefined` - Component data or undefined if not found

#### has(entityId)

Checks if an entity has this component type.

```typescript
has(entityId: number): boolean
```

**Parameters:**
- `entityId: number` - Target entity ID

**Returns:** `boolean` - True if entity has component

#### remove(entityId)

Removes a component from an entity.

```typescript
remove(entityId: number): boolean
```

**Parameters:**
- `entityId: number` - Target entity ID

**Returns:** `boolean` - True if component was removed

#### getEntities()

Returns all entities that have this component type.

```typescript
getEntities(): Set<number>
```

**Returns:** `Set<number>` - Copy of entity IDs with this component

#### getAllComponents()

Returns all components of this type.

```typescript
getAllComponents(): Map<number, T>
```

**Returns:** `Map<number, T>` - Copy of entity ID to component mapping

#### clear()

Removes all components of this type.

```typescript
clear(): void
```

#### size()

Returns the number of entities with this component.

```typescript
size(): number
```

**Returns:** `number` - Count of entities with this component

## Common Component Patterns

### Spatial Components

Position, velocity, and transform components for entity location:

```typescript
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
  z?: number;
}

interface VelocityComponent extends Component {
  readonly type: 'velocity';
  dx: number;
  dy: number;
  dz?: number;
}

interface TransformComponent extends Component {
  readonly type: 'transform';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}
```

### Rendering Components

Visual representation and rendering data:

```typescript
interface SpriteComponent extends Component {
  readonly type: 'sprite';
  image: string;
  width: number;
  height: number;
  visible: boolean;
}

interface ColorComponent extends Component {
  readonly type: 'color';
  r: number;
  g: number;
  b: number;
  a: number;
}

interface LayerComponent extends Component {
  readonly type: 'layer';
  layer: number;
  sublayer: number;
}
```

### Gameplay Components

Game-specific logic data:

```typescript
interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
  invulnerable: boolean;
  lastDamageTime: number;
}

interface InventoryComponent extends Component {
  readonly type: 'inventory';
  items: Array<{
    id: string;
    quantity: number;
    metadata?: Record<string, any>;
  }>;
  capacity: number;
}

interface AIComponent extends Component {
  readonly type: 'ai';
  behavior: 'patrol' | 'chase' | 'idle' | 'flee';
  target?: number; // Entity ID
  patrolPoints: Array<{ x: number; y: number }>;
  currentPatrolIndex: number;
}
```

### Input Components

User input and control data:

```typescript
interface InputComponent extends Component {
  readonly type: 'input';
  keys: Set<string>;
  mousePosition: { x: number; y: number };
  mouseButtons: Set<number>;
}

interface PlayerControllerComponent extends Component {
  readonly type: 'player-controller';
  playerId: string;
  controlScheme: 'wasd' | 'arrows' | 'gamepad';
  sensitivity: number;
}
```

### Lifecycle Components

Timing and lifecycle management:

```typescript
interface TimerComponent extends Component {
  readonly type: 'timer';
  duration: number;
  elapsed: number;
  loop: boolean;
  paused: boolean;
}

interface LifespanComponent extends Component {
  readonly type: 'lifespan';
  maxAge: number;
  currentAge: number;
  destroyOnExpiry: boolean;
}

interface SpawnComponent extends Component {
  readonly type: 'spawn';
  spawnRate: number;
  maxSpawns: number;
  currentSpawns: number;
  lastSpawnTime: number;
}
```

## Component Composition Examples

### Creating Complex Entities

```typescript
// Player entity composition
function createPlayer(world: World, x: number, y: number): number {
  const player = world.createEntity();

  world.addComponent(player, createPositionComponent(x, y));
  world.addComponent(player, {
    type: 'velocity',
    dx: 0,
    dy: 0
  } as VelocityComponent);

  world.addComponent(player, createHealthComponent(100));
  world.addComponent(player, {
    type: 'input',
    keys: new Set(),
    mousePosition: { x: 0, y: 0 },
    mouseButtons: new Set()
  } as InputComponent);

  world.addComponent(player, createSpriteComponent({
    image: 'player.png',
    width: 32,
    height: 32
  }));

  return player;
}

// Enemy entity composition
function createEnemy(world: World, x: number, y: number): number {
  const enemy = world.createEntity();

  world.addComponent(enemy, createPositionComponent(x, y));
  world.addComponent(enemy, {
    type: 'velocity',
    dx: 0,
    dy: 0
  } as VelocityComponent);

  world.addComponent(enemy, createHealthComponent(50));
  world.addComponent(enemy, {
    type: 'ai',
    behavior: 'patrol',
    patrolPoints: [{ x: x - 50, y }, { x: x + 50, y }],
    currentPatrolIndex: 0
  } as AIComponent);

  world.addComponent(enemy, createSpriteComponent({
    image: 'enemy.png',
    tint: { r: 255, g: 100, b: 100, a: 255 }
  }));

  return enemy;
}
```

### Component Inheritance Patterns

Use composition instead of inheritance:

```typescript
// ❌ Avoid inheritance
interface BaseCreature extends Component {
  health: number;
  maxHealth: number;
}

interface Player extends BaseCreature {
  readonly type: 'player';
  experience: number;
}

// ✅ Use composition
interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

interface ExperienceComponent extends Component {
  readonly type: 'experience';
  current: number;
  level: number;
  toNextLevel: number;
}

interface PlayerComponent extends Component {
  readonly type: 'player';
  name: string;
  class: string;
}

// Create player by combining components
function createPlayerCharacter(world: World): number {
  const player = world.createEntity();

  world.addComponent(player, { type: 'player', name: 'Hero', class: 'warrior' });
  world.addComponent(player, { type: 'health', current: 100, maximum: 100 });
  world.addComponent(player, { type: 'experience', current: 0, level: 1, toNextLevel: 100 });

  return player;
}
```

## Performance Considerations

### Memory Layout

ComponentStorage stores components of the same type together for cache efficiency:

```typescript
// Each component type gets its own storage
// This creates cache-friendly access patterns
const positions = world.query<PositionComponent>('position');
positions.forEach((entityId, position) => {
  // All position components are stored contiguously
  // Very cache-friendly for bulk operations
  position.x += velocity.dx;
  position.y += velocity.dy;
});
```

### Component Size Optimization

Keep components small and focused:

```typescript
// ✅ Good: Small, focused components
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;          // 8 bytes
  y: number;          // 8 bytes
}                     // Total: ~16 bytes + overhead

interface VelocityComponent extends Component {
  readonly type: 'velocity';
  dx: number;         // 8 bytes
  dy: number;         // 8 bytes
}                     // Total: ~16 bytes + overhead

// ❌ Avoid: Large, unfocused components
interface MegaComponent extends Component {
  readonly type: 'mega';
  position: { x: number; y: number; z: number };
  velocity: { dx: number; dy: number; dz: number };
  health: { current: number; maximum: number };
  sprite: { image: string; width: number; height: number };
  // ... many more fields
}                     // Total: 200+ bytes
```

### Access Patterns

Optimize for common access patterns:

```typescript
// Movement system processes position + velocity together
// Store these components together for cache efficiency
class MovementSystem extends BaseSystem {
  update(world: World, deltaTime: number): void {
    // This query is highly optimized due to archetype storage
    const entities = this.queryEntities(world, 'position', 'velocity');

    for (const entityId of entities) {
      // Both components likely in cache due to archetype optimization
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const velocity = world.getComponent<VelocityComponent>(entityId, 'velocity');

      if (position && velocity) {
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;
      }
    }
  }
}
```

## Debugging Components

### Component Introspection

```typescript
function debugEntity(world: World, entityId: number): void {
  console.log(`Entity ${entityId}:`);

  for (const componentType of world.getComponentTypes()) {
    if (world.hasComponent(entityId, componentType)) {
      const component = world.getComponent(entityId, componentType);
      console.log(`  ${componentType}:`, component);
    }
  }
}

function debugComponentType(world: World, componentType: string): void {
  const query = world.query(componentType);
  const entities = query.getEntities();

  console.log(`Component ${componentType} (${entities.size} entities):`);
  for (const entityId of entities) {
    const component = world.getComponent(entityId, componentType);
    console.log(`  Entity ${entityId}:`, component);
  }
}
```

### Component Validation

```typescript
function validateComponent<T extends Component>(
  component: T,
  schema: Record<string, string>
): boolean {
  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in component)) {
      console.error(`Missing field: ${field}`);
      return false;
    }

    const actualType = typeof (component as any)[field];
    if (actualType !== expectedType) {
      console.error(`Field ${field}: expected ${expectedType}, got ${actualType}`);
      return false;
    }
  }

  return true;
}

// Usage
const positionSchema = {
  type: 'string',
  x: 'number',
  y: 'number'
};

const component = { type: 'position', x: 10, y: 20 };
const isValid = validateComponent(component, positionSchema);
```

## See Also

- **[World API](./world.md)** - Managing components through the World interface
- **[System Architecture](./system.md)** - How systems process component data
- **[Query System](./query.md)** - Efficiently finding entities by components
- **[Core Concepts](../../getting-started/core-concepts.md)** - Understanding ECS fundamentals
- **[Performance Guide](../../guides/performance-optimization.md)** - Optimizing component usage