# First Game Tutorial: Space Shooter

Build a complete space shooter game from scratch using the ECS engine. This tutorial covers all essential game development concepts including player input, enemies, collision detection, and scoring.

## What We're Building

A classic space shooter with:
- 🚀 Player ship controlled with arrow keys
- 👾 Spawning enemies that move toward the player
- 💥 Bullets that destroy enemies on collision
- 🎯 Score system
- ❤️ Health system with game over

## Prerequisites

- ECS engine installed ([Installation Guide](./installation.md))
- Understanding of [core ECS concepts](./core-concepts.md)
- Basic HTML5 Canvas knowledge (for rendering)

## Project Setup

Create a new project directory:

```bash
mkdir space-shooter
cd space-shooter
bun init
bun add @danjdewhurst/ecs-ts
```

Project structure:
```
space-shooter/
├── src/
│   ├── components/
│   ├── systems/
│   ├── game.ts
│   └── index.html
└── package.json
```

## Step 1: Define Game Components

Create the data structures for our game entities.

**`src/components/index.ts`**

```typescript
import type { Component } from '@danjdewhurst/ecs-ts';

// Spatial components
export interface PositionComponent extends Component {
  readonly type: 'position';
  x: number;
  y: number;
}

export interface VelocityComponent extends Component {
  readonly type: 'velocity';
  dx: number;
  dy: number;
}

export interface SizeComponent extends Component {
  readonly type: 'size';
  width: number;
  height: number;
}

// Visual components
export interface SpriteComponent extends Component {
  readonly type: 'sprite';
  color: string;
  shape: 'rectangle' | 'circle';
}

// Gameplay components
export interface PlayerComponent extends Component {
  readonly type: 'player';
  speed: number;
}

export interface EnemyComponent extends Component {
  readonly type: 'enemy';
  speed: number;
  damage: number;
}

export interface BulletComponent extends Component {
  readonly type: 'bullet';
  damage: number;
  owner: 'player' | 'enemy';
}

export interface HealthComponent extends Component {
  readonly type: 'health';
  current: number;
  maximum: number;
}

export interface ScoreComponent extends Component {
  readonly type: 'score';
  points: number;
}

// Input handling
export interface InputComponent extends Component {
  readonly type: 'input';
  keys: Set<string>;
}

// Lifecycle
export interface TimerComponent extends Component {
  readonly type: 'timer';
  duration: number;
  elapsed: number;
}
```

## Step 2: Input System

Handle player keyboard input for movement and shooting.

**`src/systems/input-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type { InputComponent, VelocityComponent, PlayerComponent } from '../components';

export class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';

  private keys = new Set<string>();

  init(): void {
    // Set up keyboard event listeners
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  update(world: World): void {
    // Update input components with current key state
    const inputEntities = this.queryEntities(world, 'input');

    for (const entityId of inputEntities) {
      const input = world.getComponent<InputComponent>(entityId, 'input');
      if (input) {
        input.keys.clear();
        this.keys.forEach(key => input.keys.add(key));
      }
    }

    // Handle player movement
    this.queryWithComponents<InputComponent, VelocityComponent, PlayerComponent>(
      world, 'input', 'velocity', 'player',
      (entityId, input, velocity, player) => {
        velocity.dx = 0;
        velocity.dy = 0;

        if (input.keys.has('ArrowLeft')) velocity.dx = -player.speed;
        if (input.keys.has('ArrowRight')) velocity.dx = player.speed;
        if (input.keys.has('ArrowUp')) velocity.dy = -player.speed;
        if (input.keys.has('ArrowDown')) velocity.dy = player.speed;

        // Handle shooting
        if (input.keys.has('Space')) {
          this.createBullet(world, entityId);
        }
      }
    );
  }

  private createBullet(world: World, playerId: number): void {
    const position = world.getComponent<PositionComponent>(playerId, 'position');
    const size = world.getComponent<SizeComponent>(playerId, 'size');

    if (position && size) {
      const bullet = world.createEntity();

      world.addComponent(bullet, {
        type: 'position',
        x: position.x + size.width / 2,
        y: position.y
      });

      world.addComponent(bullet, {
        type: 'velocity',
        dx: 0,
        dy: -400 // Fast upward movement
      });

      world.addComponent(bullet, {
        type: 'size',
        width: 4,
        height: 8
      });

      world.addComponent(bullet, {
        type: 'sprite',
        color: '#ffff00',
        shape: 'rectangle'
      });

      world.addComponent(bullet, {
        type: 'bullet',
        damage: 10,
        owner: 'player'
      });

      // Auto-destroy bullet after 2 seconds
      world.addComponent(bullet, {
        type: 'timer',
        duration: 2000,
        elapsed: 0
      });
    }
  }
}
```

## Step 3: Movement System

Apply velocity to position for all moving entities.

**`src/systems/movement-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type { PositionComponent, VelocityComponent } from '../components';

export class MovementSystem extends BaseSystem {
  readonly priority = 2;
  readonly name = 'MovementSystem';

  update(world: World, deltaTime: number): void {
    this.queryWithComponents<PositionComponent, VelocityComponent>(
      world, 'position', 'velocity',
      (entityId, position, velocity) => {
        position.x += velocity.dx * deltaTime;
        position.y += velocity.dy * deltaTime;
      }
    );
  }
}
```

## Step 4: Enemy Spawning System

Spawn enemies at regular intervals.

**`src/systems/enemy-spawn-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type {
  PositionComponent,
  VelocityComponent,
  SizeComponent,
  SpriteComponent,
  EnemyComponent,
  HealthComponent
} from '../components';

export class EnemySpawnSystem extends BaseSystem {
  readonly priority = 3;
  readonly name = 'EnemySpawnSystem';

  private spawnTimer = 0;
  private spawnInterval = 2000; // 2 seconds
  private gameWidth = 800;

  update(world: World, deltaTime: number): void {
    this.spawnTimer += deltaTime * 1000; // Convert to milliseconds

    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnEnemy(world);
      this.spawnTimer = 0;

      // Gradually increase spawn rate
      this.spawnInterval = Math.max(500, this.spawnInterval - 50);
    }
  }

  private spawnEnemy(world: World): void {
    const enemy = world.createEntity();

    // Random spawn position at top of screen
    const x = Math.random() * (this.gameWidth - 40);

    world.addComponent(enemy, {
      type: 'position',
      x,
      y: -40
    } as PositionComponent);

    world.addComponent(enemy, {
      type: 'velocity',
      dx: 0,
      dy: 100 + Math.random() * 100 // Random speed
    } as VelocityComponent);

    world.addComponent(enemy, {
      type: 'size',
      width: 30,
      height: 30
    } as SizeComponent);

    world.addComponent(enemy, {
      type: 'sprite',
      color: '#ff0000',
      shape: 'rectangle'
    } as SpriteComponent);

    world.addComponent(enemy, {
      type: 'enemy',
      speed: 100,
      damage: 10
    } as EnemyComponent);

    world.addComponent(enemy, {
      type: 'health',
      current: 20,
      maximum: 20
    } as HealthComponent);
  }
}
```

## Step 5: Collision System

Detect and handle collisions between entities.

**`src/systems/collision-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type {
  PositionComponent,
  SizeComponent,
  BulletComponent,
  EnemyComponent,
  PlayerComponent,
  HealthComponent
} from '../components';

export class CollisionSystem extends BaseSystem {
  readonly priority = 4;
  readonly name = 'CollisionSystem';

  update(world: World): void {
    this.checkBulletEnemyCollisions(world);
    this.checkPlayerEnemyCollisions(world);
  }

  private checkBulletEnemyCollisions(world: World): void {
    const bullets = this.queryEntities(world, 'position', 'size', 'bullet');
    const enemies = this.queryEntities(world, 'position', 'size', 'enemy', 'health');

    for (const bulletId of bullets) {
      const bulletPos = world.getComponent<PositionComponent>(bulletId, 'position');
      const bulletSize = world.getComponent<SizeComponent>(bulletId, 'size');
      const bullet = world.getComponent<BulletComponent>(bulletId, 'bullet');

      if (!bulletPos || !bulletSize || !bullet || bullet.owner !== 'player') continue;

      for (const enemyId of enemies) {
        const enemyPos = world.getComponent<PositionComponent>(enemyId, 'position');
        const enemySize = world.getComponent<SizeComponent>(enemyId, 'size');
        const enemyHealth = world.getComponent<HealthComponent>(enemyId, 'health');

        if (!enemyPos || !enemySize || !enemyHealth) continue;

        if (this.isColliding(bulletPos, bulletSize, enemyPos, enemySize)) {
          // Damage enemy
          enemyHealth.current -= bullet.damage;

          // Destroy bullet
          world.destroyEntity(bulletId);

          // Destroy enemy if dead
          if (enemyHealth.current <= 0) {
            world.destroyEntity(enemyId);
            this.addScore(world, 100);
          }

          break; // Bullet can only hit one enemy
        }
      }
    }
  }

  private checkPlayerEnemyCollisions(world: World): void {
    const players = this.queryEntities(world, 'position', 'size', 'player', 'health');
    const enemies = this.queryEntities(world, 'position', 'size', 'enemy');

    for (const playerId of players) {
      const playerPos = world.getComponent<PositionComponent>(playerId, 'position');
      const playerSize = world.getComponent<SizeComponent>(playerId, 'size');
      const playerHealth = world.getComponent<HealthComponent>(playerId, 'health');

      if (!playerPos || !playerSize || !playerHealth) continue;

      for (const enemyId of enemies) {
        const enemyPos = world.getComponent<PositionComponent>(enemyId, 'position');
        const enemySize = world.getComponent<SizeComponent>(enemyId, 'size');
        const enemy = world.getComponent<EnemyComponent>(enemyId, 'enemy');

        if (!enemyPos || !enemySize || !enemy) continue;

        if (this.isColliding(playerPos, playerSize, enemyPos, enemySize)) {
          // Damage player
          playerHealth.current -= enemy.damage;

          // Destroy enemy
          world.destroyEntity(enemyId);

          // Check for game over
          if (playerHealth.current <= 0) {
            world.emit('game-over', { playerId });
          }

          break;
        }
      }
    }
  }

  private isColliding(
    pos1: PositionComponent,
    size1: SizeComponent,
    pos2: PositionComponent,
    size2: SizeComponent
  ): boolean {
    return pos1.x < pos2.x + size2.width &&
           pos1.x + size1.width > pos2.x &&
           pos1.y < pos2.y + size2.height &&
           pos1.y + size1.height > pos2.y;
  }

  private addScore(world: World, points: number): void {
    const scoreEntities = this.queryEntities(world, 'score');

    for (const entityId of scoreEntities) {
      const score = world.getComponent<ScoreComponent>(entityId, 'score');
      if (score) {
        score.points += points;
        break;
      }
    }
  }
}
```

## Step 6: Cleanup System

Remove entities that are off-screen or expired.

**`src/systems/cleanup-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type { PositionComponent, SizeComponent, TimerComponent } from '../components';

export class CleanupSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'CleanupSystem';

  private gameWidth = 800;
  private gameHeight = 600;

  update(world: World, deltaTime: number): void {
    this.cleanupOffscreenEntities(world);
    this.cleanupExpiredTimers(world, deltaTime);
  }

  private cleanupOffscreenEntities(world: World): void {
    const entities = this.queryEntities(world, 'position', 'size');

    for (const entityId of entities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');
      const size = world.getComponent<SizeComponent>(entityId, 'size');

      if (!position || !size) continue;

      // Remove entities that are completely off-screen
      if (position.x + size.width < 0 ||
          position.x > this.gameWidth ||
          position.y + size.height < 0 ||
          position.y > this.gameHeight) {
        world.destroyEntity(entityId);
      }
    }
  }

  private cleanupExpiredTimers(world: World, deltaTime: number): void {
    const entities = this.queryEntities(world, 'timer');

    for (const entityId of entities) {
      const timer = world.getComponent<TimerComponent>(entityId, 'timer');

      if (timer) {
        timer.elapsed += deltaTime * 1000; // Convert to milliseconds

        if (timer.elapsed >= timer.duration) {
          world.destroyEntity(entityId);
        }
      }
    }
  }
}
```

## Step 7: Render System

Draw all visual entities to a canvas.

**`src/systems/render-system.ts`**

```typescript
import { BaseSystem, type World } from '@danjdewhurst/ecs-ts';
import type {
  PositionComponent,
  SizeComponent,
  SpriteComponent,
  HealthComponent,
  ScoreComponent
} from '../components';

export class RenderSystem extends BaseSystem {
  readonly priority = 100; // Render last
  readonly name = 'RenderSystem';

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  update(world: World): void {
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render all sprites
    this.queryWithComponents<PositionComponent, SizeComponent, SpriteComponent>(
      world, 'position', 'size', 'sprite',
      (entityId, position, size, sprite) => {
        this.ctx.fillStyle = sprite.color;

        if (sprite.shape === 'rectangle') {
          this.ctx.fillRect(position.x, position.y, size.width, size.height);
        } else if (sprite.shape === 'circle') {
          this.ctx.beginPath();
          this.ctx.arc(
            position.x + size.width / 2,
            position.y + size.height / 2,
            size.width / 2,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        }
      }
    );

    // Render UI
    this.renderUI(world);
  }

  private renderUI(world: World): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';

    // Render score
    const scoreEntities = this.queryEntities(world, 'score');
    for (const entityId of scoreEntities) {
      const score = world.getComponent<ScoreComponent>(entityId, 'score');
      if (score) {
        this.ctx.fillText(`Score: ${score.points}`, 10, 30);
        break;
      }
    }

    // Render player health
    const playerEntities = this.queryEntities(world, 'player', 'health');
    for (const entityId of playerEntities) {
      const health = world.getComponent<HealthComponent>(entityId, 'health');
      if (health) {
        this.ctx.fillText(`Health: ${health.current}/${health.maximum}`, 10, 60);
        break;
      }
    }
  }
}
```

## Step 8: Game Loop and Setup

Tie everything together in the main game file.

**`src/game.ts`**

```typescript
import { World } from '@danjdewhurst/ecs-ts';
import { InputSystem } from './systems/input-system';
import { MovementSystem } from './systems/movement-system';
import { EnemySpawnSystem } from './systems/enemy-spawn-system';
import { CollisionSystem } from './systems/collision-system';
import { CleanupSystem } from './systems/cleanup-system';
import { RenderSystem } from './systems/render-system';
import type {
  PositionComponent,
  VelocityComponent,
  SizeComponent,
  SpriteComponent,
  PlayerComponent,
  HealthComponent,
  InputComponent,
  ScoreComponent
} from './components';

export class SpaceShooterGame {
  private world: World;
  private canvas: HTMLCanvasElement;
  private isRunning = false;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.world = new World();
    this.setupSystems();
    this.createGameEntities();
    this.setupEventListeners();
  }

  private setupSystems(): void {
    this.world.addSystem(new InputSystem());
    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new EnemySpawnSystem());
    this.world.addSystem(new CollisionSystem());
    this.world.addSystem(new CleanupSystem());
    this.world.addSystem(new RenderSystem(this.canvas));
  }

  private createGameEntities(): void {
    // Create player
    const player = this.world.createEntity();

    this.world.addComponent(player, {
      type: 'position',
      x: this.canvas.width / 2 - 25,
      y: this.canvas.height - 60
    } as PositionComponent);

    this.world.addComponent(player, {
      type: 'velocity',
      dx: 0,
      dy: 0
    } as VelocityComponent);

    this.world.addComponent(player, {
      type: 'size',
      width: 50,
      height: 40
    } as SizeComponent);

    this.world.addComponent(player, {
      type: 'sprite',
      color: '#00ff00',
      shape: 'rectangle'
    } as SpriteComponent);

    this.world.addComponent(player, {
      type: 'player',
      speed: 300
    } as PlayerComponent);

    this.world.addComponent(player, {
      type: 'health',
      current: 100,
      maximum: 100
    } as HealthComponent);

    this.world.addComponent(player, {
      type: 'input',
      keys: new Set<string>()
    } as InputComponent);

    // Create score entity
    const scoreEntity = this.world.createEntity();
    this.world.addComponent(scoreEntity, {
      type: 'score',
      points: 0
    } as ScoreComponent);
  }

  private setupEventListeners(): void {
    this.world.on('game-over', () => {
      this.gameOver();
    });
  }

  private gameOver(): void {
    this.isRunning = false;

    // Display game over screen
    const ctx = this.canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);

    ctx.font = '24px Arial';
    ctx.fillText('Press R to restart', this.canvas.width / 2, this.canvas.height / 2 + 60);

    // Listen for restart
    const handleRestart = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        window.removeEventListener('keydown', handleRestart);
        this.restart();
      }
    };
    window.addEventListener('keydown', handleRestart);
  }

  private restart(): void {
    // Clear all entities
    const allEntities = [...this.world.queryMultiple([])];
    for (const entityId of allEntities) {
      this.world.destroyEntity(entityId);
    }

    // Recreate game entities
    this.createGameEntities();
    this.start();
  }

  start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
  }

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    // Update the world
    this.world.update(deltaTime);

    // Continue the loop
    requestAnimationFrame(this.gameLoop);
  };
}
```

## Step 9: HTML Setup

Create the HTML file to host the game.

**`src/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Space Shooter - ECS Game</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            background-color: #222;
            color: white;
            font-family: Arial, sans-serif;
        }

        canvas {
            border: 2px solid #444;
            background-color: #000;
        }

        .controls {
            margin-top: 20px;
            text-align: center;
        }

        .controls h3 {
            margin-bottom: 10px;
        }

        .controls p {
            margin: 5px 0;
        }

        .stats {
            margin-top: 20px;
            background-color: #333;
            padding: 15px;
            border-radius: 8px;
            min-width: 300px;
        }
    </style>
</head>
<body>
    <h1>🚀 Space Shooter</h1>
    <canvas id="gameCanvas" width="800" height="600"></canvas>

    <div class="controls">
        <h3>Controls</h3>
        <p>Arrow Keys: Move</p>
        <p>Spacebar: Shoot</p>
        <p>R: Restart (when game over)</p>
    </div>

    <div class="stats" id="stats">
        <h3>Game Stats</h3>
        <p>Entities: <span id="entityCount">0</span></p>
        <p>Component Types: <span id="componentTypes">0</span></p>
        <p>Archetypes: <span id="archetypeCount">0</span></p>
    </div>

    <script type="module">
        import { SpaceShooterGame } from './game.js';

        const canvas = document.getElementById('gameCanvas');
        const game = new SpaceShooterGame(canvas);

        // Start the game
        game.start();

        // Update stats periodically
        setInterval(() => {
            const world = game.world; // You'd need to expose this
            if (world) {
                document.getElementById('entityCount').textContent = world.getEntityCount();
                document.getElementById('componentTypes').textContent = world.getComponentTypes().length;
                document.getElementById('archetypeCount').textContent = Object.keys(world.getArchetypeStats()).length;
            }
        }, 1000);
    </script>
</body>
</html>
```

## Step 10: Run Your Game

Start the development server:

```bash
bun --watch src/game.ts
```

Or serve the HTML file:

```bash
# Simple static server
python -m http.server 8000
# Then open http://localhost:8000/src/index.html
```

## What You've Learned

Congratulations! You've built a complete game using ECS architecture. Key concepts covered:

### 🏗️ **ECS Architecture in Practice**
- **Components**: Pure data structures (Position, Velocity, Health, etc.)
- **Systems**: Game logic processors (Input, Movement, Collision, etc.)
- **Entities**: Simple containers composed from components

### 🎮 **Game Development Patterns**
- **Game Loop**: Fixed timestep updates with requestAnimationFrame
- **Input Handling**: Event-driven keyboard input
- **Collision Detection**: AABB (Axis-Aligned Bounding Box) collision
- **Object Lifecycle**: Spawning, updating, and destroying entities

### ⚡ **Performance Considerations**
- **Query Optimization**: Efficient component-based entity filtering
- **Memory Management**: Automatic entity cleanup and object pooling
- **Rendering**: Batch drawing operations in a dedicated render system

### 🔧 **System Design**
- **Separation of Concerns**: Each system has a single responsibility
- **Event Communication**: Loose coupling between systems via events
- **Dependency Management**: System execution order via priorities

## Extensions and Improvements

Take your game further with these enhancements:

### 🌟 **Gameplay Features**
```typescript
// Power-ups
interface PowerUpComponent extends Component {
  readonly type: 'powerup';
  effect: 'rapid-fire' | 'shield' | 'multi-shot';
  duration: number;
}

// Particle effects
interface ParticleComponent extends Component {
  readonly type: 'particle';
  life: number;
  maxLife: number;
}

// Sound effects
interface AudioComponent extends Component {
  readonly type: 'audio';
  sound: string;
  volume: number;
  loop: boolean;
}
```

### 📊 **Advanced Systems**
- **ParticleSystem**: Explosion and trail effects
- **AudioSystem**: Sound effect management
- **WeaponSystem**: Different weapon types and upgrades
- **WaveSystem**: Progressive difficulty with enemy waves
- **MenuSystem**: Start screen, pause, settings

### 🎯 **Polish Features**
- **Animations**: Sprite animation system
- **Screen Shake**: Camera effects for impact
- **Background**: Scrolling starfield
- **High Scores**: Persistent score tracking
- **Mobile**: Touch controls for mobile devices

## Next Steps

- 🌐 **[Multiplayer Networking](../guides/multiplayer-networking.md)** - Add real-time multiplayer
- ⚡ **[Performance Optimization](../guides/performance-optimization.md)** - Scale to thousands of entities
- 🔌 **[Plugin Development](../guides/plugin-development.md)** - Create reusable game modules
- 📚 **[Full API Reference](../api/)** - Explore advanced ECS features

## Troubleshooting

**Game runs slowly:**
- Check system priorities and dependencies
- Use `world.getArchetypeStats()` to monitor entity distribution
- Optimize collision detection with spatial partitioning

**Entities not responding to input:**
- Verify component types match exactly in queries
- Check system execution order (InputSystem should run early)
- Ensure input components are properly updated

**Rendering issues:**
- Confirm RenderSystem has highest priority (runs last)
- Check canvas context and drawing operations
- Verify position/size components are properly set

**Memory leaks:**
- Use CleanupSystem to remove off-screen entities
- Destroy entities when no longer needed
- Remove event listeners in system cleanup

You now have a solid foundation in ECS game development. The patterns you've learned scale beautifully to much larger and more complex games!