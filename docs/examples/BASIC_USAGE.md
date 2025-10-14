# Basic Usage Example

This example demonstrates the fundamental concepts of the ECS game engine by building a simple game with moving entities, collision detection, and basic gameplay mechanics.

## Complete Example

```typescript
import { World, BaseSystem, Component } from '@danjdewhurst/ecs-ts';

// Define component interfaces
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

interface VelocityComponent extends Component {
  readonly type: 'velocity';
  x: number;
  y: number;
}

interface SpriteComponent extends Component {
  readonly type: 'sprite';
  texture: string;
  width: number;
  height: number;
}

interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

interface PlayerComponent extends Component {
  readonly type: 'player';
  score: number;
}

// Movement System
class MovementSystem extends BaseSystem {
  readonly name = 'MovementSystem';
  readonly priority = 1;

  update(world: World, deltaTime: number): void {
    const entities = world.getEntitiesWithComponent('position', 'velocity');

    for (const entityId of entities) {
      const position = world.getComponent(entityId, 'position') as PositionComponent;
      const velocity = world.getComponent(entityId, 'velocity') as VelocityComponent;

      // Update position based on velocity
      position.x += velocity.x * deltaTime / 1000;
      position.y += velocity.y * deltaTime / 1000;

      // Boundary check
      if (position.x < 0) position.x = 0;
      if (position.x > 800) position.x = 800;
      if (position.y < 0) position.y = 0;
      if (position.y > 600) position.y = 600;
    }
  }
}

// Collision System
class CollisionSystem extends BaseSystem {
  readonly name = 'CollisionSystem';
  readonly priority = 2;

  update(world: World): void {
    const entities = world.getEntitiesWithComponent('position', 'sprite');

    // Simple collision detection
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        if (this.checkCollision(world, entities[i], entities[j])) {
          this.handleCollision(world, entities[i], entities[j]);
        }
      }
    }
  }

  private checkCollision(world: World, entity1: number, entity2: number): boolean {
    const pos1 = world.getComponent(entity1, 'position') as PositionComponent;
    const sprite1 = world.getComponent(entity1, 'sprite') as SpriteComponent;
    const pos2 = world.getComponent(entity2, 'position') as PositionComponent;
    const sprite2 = world.getComponent(entity2, 'sprite') as SpriteComponent;

    return (
      pos1.x < pos2.x + sprite2.width &&
      pos1.x + sprite1.width > pos2.x &&
      pos1.y < pos2.y + sprite2.height &&
      pos1.y + sprite1.height > pos2.y
    );
  }

  private handleCollision(world: World, entity1: number, entity2: number): void {
    const isPlayer1 = world.hasComponent(entity1, 'player');
    const isPlayer2 = world.hasComponent(entity2, 'player');

    if (isPlayer1 || isPlayer2) {
      const playerId = isPlayer1 ? entity1 : entity2;
      const otherId = isPlayer1 ? entity2 : entity1;

      // Damage player
      const health = world.getComponent(playerId, 'health') as HealthComponent;
      if (health) {
        health.current -= 10;

        if (health.current <= 0) {
          console.log('Game Over!');
          world.destroyEntity(playerId);
        }
      }

      // Destroy other entity
      world.destroyEntity(otherId);
    }
  }
}

// Game initialization
function createGame(): World {
  const world = new World();

  // Add systems
  world.addSystem(new MovementSystem());
  world.addSystem(new CollisionSystem());

  // Create player
  const player = world.createEntity();
  world.addComponent(player, { type: 'position', x: 400, y: 300 } as PositionComponent);
  world.addComponent(player, { type: 'velocity', x: 0, y: 0 } as VelocityComponent);
  world.addComponent(player, { type: 'sprite', texture: 'player.png', width: 32, height: 32 } as SpriteComponent);
  world.addComponent(player, { type: 'health', current: 100, maximum: 100 } as HealthComponent);
  world.addComponent(player, { type: 'player', score: 0 } as PlayerComponent);

  // Create some enemies
  for (let i = 0; i < 5; i++) {
    const enemy = world.createEntity();
    world.addComponent(enemy, {
      type: 'position',
      x: Math.random() * 800,
      y: Math.random() * 600
    } as PositionComponent);
    world.addComponent(enemy, {
      type: 'velocity',
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100
    } as VelocityComponent);
    world.addComponent(enemy, {
      type: 'sprite',
      texture: 'enemy.png',
      width: 24,
      height: 24
    } as SpriteComponent);
  }

  return world;
}

// Game loop
function gameLoop() {
  const world = createGame();
  let lastTime = Date.now();

  function update() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Update world
    world.update(deltaTime);

    // Continue loop
    setTimeout(update, 16); // ~60 FPS
  }

  update();
}

// Start the game
gameLoop();
```

## Step-by-Step Breakdown

### 1. Define Components

```typescript
// Components are pure data containers
interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

interface VelocityComponent extends Component {
  readonly type: 'velocity';
  x: number;
  y: number;
}
```

### 2. Create Systems

```typescript
class MovementSystem extends BaseSystem {
  readonly name = 'MovementSystem';
  readonly priority = 1; // Lower number = higher priority

  update(world: World, deltaTime: number): void {
    // Get all entities with both position and velocity
    const entities = world.getEntitiesWithComponent('position', 'velocity');

    for (const entityId of entities) {
      // Get components
      const position = world.getComponent(entityId, 'position');
      const velocity = world.getComponent(entityId, 'velocity');

      // Update position
      position.x += velocity.x * deltaTime / 1000;
      position.y += velocity.y * deltaTime / 1000;
    }
  }
}
```

### 3. Initialize World

```typescript
const world = new World();

// Add systems (they run in priority order)
world.addSystem(new MovementSystem());
world.addSystem(new CollisionSystem());
```

### 4. Create Entities

```typescript
// Create player entity
const player = world.createEntity();
world.addComponent(player, { type: 'position', x: 400, y: 300 });
world.addComponent(player, { type: 'velocity', x: 0, y: 0 });
world.addComponent(player, { type: 'player', score: 0 });

// Create enemy entity
const enemy = world.createEntity();
world.addComponent(enemy, { type: 'position', x: 100, y: 100 });
world.addComponent(enemy, { type: 'velocity', x: 50, y: 25 });
```

### 5. Game Loop

```typescript
function gameLoop() {
  let lastTime = Date.now();

  function update() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Update all systems
    world.update(deltaTime);

    // Schedule next frame
    requestAnimationFrame(update);
  }

  update();
}
```

## Adding Input Handling

```typescript
interface InputComponent extends Component {
  readonly type: 'input';
  keys: Set<string>;
}

class InputSystem extends BaseSystem {
  readonly name = 'InputSystem';
  readonly priority = 0; // Process input first

  private keys = new Set<string>();

  constructor() {
    super();

    // Setup keyboard listeners
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  update(world: World): void {
    const entities = world.getEntitiesWithComponent('input', 'velocity');

    for (const entityId of entities) {
      const velocity = world.getComponent(entityId, 'velocity') as VelocityComponent;

      // Reset velocity
      velocity.x = 0;
      velocity.y = 0;

      // Apply input
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) {
        velocity.x = -200;
      }
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) {
        velocity.x = 200;
      }
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) {
        velocity.y = -200;
      }
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) {
        velocity.y = 200;
      }
    }
  }
}

// Add input component to player
world.addComponent(player, { type: 'input', keys: new Set() } as InputComponent);
```

## Adding Events

```typescript
import { EventComponent } from '@danjdewhurst/ecs-ts';

// Add event handling to collision system
class CollisionSystem extends BaseSystem {
  private handleCollision(world: World, entity1: number, entity2: number): void {
    // Emit collision event
    world.emitEvent({
      type: 'collision-detected',
      timestamp: Date.now(),
      data: {
        entity1,
        entity2,
        position: world.getComponent(entity1, 'position')
      }
    });
  }
}

// Listen for events
world.subscribeToEvent('collision-detected', (event) => {
  console.log('Collision at:', event.data.position);

  // Play sound effect
  playSound('collision.wav');

  // Create particle effect
  createParticles(event.data.position.x, event.data.position.y);
});
```

## Running the Example

1. **Install dependencies**:
   ```bash
   bun install @danjdewhurst/ecs-ts
   ```

2. **Create the game file**:
   ```typescript
   // Save as game.ts
   import { World, BaseSystem } from '@danjdewhurst/ecs-ts';
   // ... copy the example code above
   ```

3. **Run the game**:
   ```bash
   bun run game.ts
   ```

## Next Steps

- Add rendering with a graphics library
- Implement more complex AI behaviors
- Add audio and particle effects
- Create a proper asset loading system
- Add networking for multiplayer

## See Also

- [Event System Demo](./event-system-demo.md) - Event-driven architecture
- [WebSocket Multiplayer](./websocket-multiplayer.md) - Real-time multiplayer
- [Performance Optimization Demo](./performance-optimization-demo.md) - Optimization techniques