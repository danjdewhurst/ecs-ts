# Events and Communication Guide

This guide covers decoupled communication patterns, event-driven architecture, and best practices for inter-system communication in ECS applications.

## Event-Driven Architecture Principles

### Decoupled System Communication

Events enable loose coupling between systems without direct dependencies:

```typescript
// ✅ Good: Event-driven communication
class HealthSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'HealthSystem';

  update(world: World, deltaTime: number): void {
    const entities = this.queryEntities(world, 'health');

    for (const entityId of entities) {
      const health = world.getComponent<HealthComponent>(entityId, 'health');

      if (health && health.current <= 0) {
        // Emit event for other systems to handle
        world.emitEvent({
          type: 'entity-died',
          timestamp: Date.now(),
          source: this.name,
          data: {
            entityId,
            cause: 'health-depletion',
            position: world.getComponent(entityId, 'position')
          }
        });
      }
    }
  }
}

class ScoreSystem extends BaseSystem {
  readonly priority = 10;
  readonly name = 'ScoreSystem';

  initialize(world: World): void {
    // Respond to death events without knowing about HealthSystem
    world.subscribeToEvent('entity-died', (event) => {
      if (this.isEnemy(world, event.data.entityId)) {
        this.awardPoints(world, 100);
      }
    });
  }

  private isEnemy(world: World, entityId: number): boolean {
    return world.hasComponent(entityId, 'enemy');
  }

  private awardPoints(world: World, points: number): void {
    // Award points and emit score change event
    world.emitEvent({
      type: 'score-changed',
      timestamp: Date.now(),
      source: this.name,
      data: { pointsAwarded: points, newTotal: this.getTotalScore() }
    });
  }
}

// ❌ Bad: Direct system coupling
class BadScoreSystem extends BaseSystem {
  constructor(private healthSystem: HealthSystem) { // Direct dependency
    super();
  }

  update(world: World): void {
    // Polling other systems is inefficient and creates coupling
    const deadEntities = this.healthSystem.getDeadEntities();
    for (const entity of deadEntities) {
      this.awardPoints(100);
    }
  }
}
```

### Event Flow and Processing

Events follow a predictable flow through the system:

```typescript
class GameLoop {
  private world = new World();
  private systems: BaseSystem[] = [];

  update(deltaTime: number): void {
    // 1. Process events from previous frame
    this.world.processEvents();

    // 2. Update all systems (may emit new events)
    for (const system of this.systems) {
      system.update(this.world, deltaTime);
    }

    // 3. Process events generated during this frame
    this.world.processEvents();

    // 4. Handle end-of-frame events
    this.emitFrameEndEvent(deltaTime);
  }

  private emitFrameEndEvent(deltaTime: number): void {
    this.world.emitEvent({
      type: 'frame-end',
      timestamp: Date.now(),
      data: { deltaTime, frameNumber: this.getFrameNumber() }
    });
  }
}
```

## Event Types and Patterns

### Game State Events

```typescript
interface GameStateData {
  oldState: string;
  newState: string;
  timestamp: number;
}

class GameStateManager extends BaseSystem {
  readonly priority = 1;
  readonly name = 'GameStateManager';

  private currentState: 'menu' | 'playing' | 'paused' | 'game-over' = 'menu';

  initialize(world: World): void {
    // Listen for state change requests
    world.subscribeToEvent('request-state-change', (event) => {
      this.handleStateChangeRequest(world, event.data.newState);
    });

    world.subscribeToEvent('player-died', () => {
      this.changeState(world, 'game-over');
    });

    world.subscribeToEvent('level-complete', () => {
      this.changeState(world, 'paused');
    });
  }

  private changeState(world: World, newState: typeof this.currentState): void {
    const oldState = this.currentState;
    this.currentState = newState;

    world.emitEvent({
      type: 'game-state-changed',
      timestamp: Date.now(),
      source: this.name,
      data: { oldState, newState, timestamp: Date.now() }
    });
  }

  update(world: World): void {
    // State-specific logic
    if (this.currentState === 'playing') {
      this.updateGameplayState(world);
    }
  }
}

class UISystem extends BaseSystem {
  initialize(world: World): void {
    world.subscribeToEvent('game-state-changed', (event) => {
      this.updateUI(event.data.newState);
    });
  }

  private updateUI(state: string): void {
    document.body.className = `game-state-${state}`;

    switch (state) {
      case 'menu':
        this.showMainMenu();
        break;
      case 'playing':
        this.showGameUI();
        break;
      case 'paused':
        this.showPauseScreen();
        break;
      case 'game-over':
        this.showGameOverScreen();
        break;
    }
  }
}
```

### Combat and Damage Events

```typescript
interface DamageEventData {
  targetId: number;
  sourceId?: number;
  damage: number;
  damageType: 'physical' | 'magic' | 'fire' | 'ice';
  isCritical: boolean;
}

class CombatSystem extends BaseSystem {
  readonly priority = 15;
  readonly name = 'CombatSystem';

  initialize(world: World): void {
    world.subscribeToEvent('attack-request', (event) => {
      this.processAttack(world, event.data);
    });

    world.subscribeToEvent('collision', (event) => {
      this.handleCombatCollision(world, event.data);
    });
  }

  private processAttack(world: World, attackData: any): void {
    const { attackerId, targetId, weaponType } = attackData;

    const damage = this.calculateDamage(world, attackerId, targetId, weaponType);
    const isCritical = this.rollCritical();

    world.emitEvent({
      type: 'damage-dealt',
      timestamp: Date.now(),
      source: this.name,
      data: {
        targetId,
        sourceId: attackerId,
        damage: isCritical ? damage * 2 : damage,
        damageType: this.getDamageType(weaponType),
        isCritical
      } as DamageEventData
    });

    // Visual feedback event
    world.emitEvent({
      type: 'combat-visual',
      timestamp: Date.now(),
      source: this.name,
      data: {
        attackerId,
        targetId,
        effectType: isCritical ? 'critical-hit' : 'normal-hit',
        position: world.getComponent(targetId, 'position')
      }
    });
  }

  private calculateDamage(world: World, attackerId: number, targetId: number, weaponType: string): number {
    // Complex damage calculation logic
    return 25;
  }

  private rollCritical(): boolean {
    return Math.random() < 0.15; // 15% critical chance
  }
}

class HealthSystem extends BaseSystem {
  readonly priority = 20; // After combat
  readonly name = 'HealthSystem';

  initialize(world: World): void {
    world.subscribeToEvent('damage-dealt', (event) => {
      this.applyDamage(world, event.data as DamageEventData);
    });

    world.subscribeToEvent('heal-applied', (event) => {
      this.applyHealing(world, event.data);
    });
  }

  private applyDamage(world: World, damageData: DamageEventData): void {
    const health = world.getComponent<HealthComponent>(damageData.targetId, 'health');

    if (health) {
      const finalDamage = this.calculateResistance(world, damageData);
      health.current = Math.max(0, health.current - finalDamage);

      // Emit health change event
      world.emitEvent({
        type: 'health-changed',
        timestamp: Date.now(),
        source: this.name,
        data: {
          entityId: damageData.targetId,
          oldHealth: health.current + finalDamage,
          newHealth: health.current,
          maxHealth: health.maximum,
          cause: 'damage'
        }
      });

      // Check for death
      if (health.current <= 0) {
        world.emitEvent({
          type: 'entity-died',
          timestamp: Date.now(),
          source: this.name,
          data: {
            entityId: damageData.targetId,
            killer: damageData.sourceId,
            cause: damageData.damageType
          }
        });
      }
    }
  }

  private calculateResistance(world: World, damageData: DamageEventData): number {
    const armor = world.getComponent<ArmorComponent>(damageData.targetId, 'armor');
    let finalDamage = damageData.damage;

    if (armor) {
      const resistance = armor.resistances[damageData.damageType] || 0;
      finalDamage = Math.max(1, finalDamage * (1 - resistance));
    }

    return finalDamage;
  }
}
```

### Player Input Events

```typescript
class InputSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'InputSystem';

  private keyStates = new Map<string, boolean>();
  private previousKeyStates = new Map<string, boolean>();

  initialize(world: World): void {
    window.addEventListener('keydown', (e) => {
      this.keyStates.set(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this.keyStates.set(e.code, false);
    });
  }

  update(world: World): void {
    // Check for key presses (not held)
    for (const [key, isPressed] of this.keyStates) {
      const wasPressed = this.previousKeyStates.get(key) || false;

      if (isPressed && !wasPressed) {
        this.emitKeyEvent(world, 'key-pressed', key);
      } else if (!isPressed && wasPressed) {
        this.emitKeyEvent(world, 'key-released', key);
      }
    }

    // Update movement based on held keys
    this.updateMovementInput(world);

    // Copy current state for next frame
    this.previousKeyStates = new Map(this.keyStates);
  }

  private emitKeyEvent(world: World, eventType: string, key: string): void {
    world.emitEvent({
      type: eventType,
      timestamp: Date.now(),
      source: this.name,
      data: { key, action: this.getActionForKey(key) }
    });
  }

  private updateMovementInput(world: World): void {
    const players = this.queryEntities(world, 'player', 'input');

    for (const playerId of players) {
      const input = world.getComponent<InputComponent>(playerId, 'input');

      if (input) {
        // Update input component with current key states
        input.left = this.keyStates.get('ArrowLeft') || this.keyStates.get('KeyA') || false;
        input.right = this.keyStates.get('ArrowRight') || this.keyStates.get('KeyD') || false;
        input.up = this.keyStates.get('ArrowUp') || this.keyStates.get('KeyW') || false;
        input.down = this.keyStates.get('ArrowDown') || this.keyStates.get('KeyS') || false;
        input.action = this.keyStates.get('Space') || false;

        // Emit movement events for complex input handling
        if (input.left || input.right || input.up || input.down) {
          world.emitEvent({
            type: 'player-movement-input',
            timestamp: Date.now(),
            source: this.name,
            data: {
              playerId,
              direction: this.getMovementDirection(input),
              intensity: this.getMovementIntensity(input)
            }
          });
        }
      }
    }
  }

  private getActionForKey(key: string): string {
    const actionMap: Record<string, string> = {
      'Space': 'jump',
      'KeyE': 'interact',
      'KeyF': 'attack',
      'Escape': 'pause'
    };
    return actionMap[key] || 'unknown';
  }
}

class PlayerControllerSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'PlayerControllerSystem';

  initialize(world: World): void {
    world.subscribeToEvent('key-pressed', (event) => {
      this.handleKeyPress(world, event.data);
    });

    world.subscribeToEvent('player-movement-input', (event) => {
      this.handleMovementInput(world, event.data);
    });
  }

  private handleKeyPress(world: World, data: any): void {
    switch (data.action) {
      case 'jump':
        this.handleJump(world);
        break;
      case 'interact':
        this.handleInteraction(world);
        break;
      case 'attack':
        this.handleAttack(world);
        break;
      case 'pause':
        world.emitEvent({
          type: 'request-state-change',
          timestamp: Date.now(),
          source: this.name,
          data: { newState: 'paused' }
        });
        break;
    }
  }

  private handleMovementInput(world: World, data: any): void {
    const { playerId, direction, intensity } = data;
    const velocity = world.getComponent<VelocityComponent>(playerId, 'velocity');

    if (velocity) {
      const speed = 200 * intensity;
      velocity.dx = direction.x * speed;
      velocity.dy = direction.y * speed;
    }
  }
}
```

## Advanced Communication Patterns

### Event Chaining and Cascading

```typescript
class WeaponSystem extends BaseSystem {
  initialize(world: World): void {
    // Chain: weapon fire → projectile spawn → collision → damage → death → explosion
    world.subscribeToEvent('weapon-fired', (event) => {
      this.createProjectile(world, event.data);
    });

    world.subscribeToEvent('projectile-hit', (event) => {
      this.handleProjectileImpact(world, event.data);
    });
  }

  private createProjectile(world: World, weaponData: any): void {
    const projectile = world.createEntity();

    // Add projectile components...

    // Emit projectile creation event
    world.emitEvent({
      type: 'projectile-spawned',
      timestamp: Date.now(),
      source: this.name,
      data: {
        projectileId: projectile,
        weaponId: weaponData.weaponId,
        trajectory: weaponData.trajectory
      }
    });
  }

  private handleProjectileImpact(world: World, impactData: any): void {
    const { projectileId, targetId, impactPoint } = impactData;

    // Get weapon data from projectile
    const projectileData = world.getComponent(projectileId, 'projectile');

    // Emit damage event
    world.emitEvent({
      type: 'damage-dealt',
      timestamp: Date.now(),
      source: this.name,
      data: {
        targetId,
        sourceId: projectileData?.sourceId,
        damage: projectileData?.damage || 25,
        damageType: 'physical',
        isCritical: false
      }
    });

    // Emit visual effect event
    world.emitEvent({
      type: 'impact-effect',
      timestamp: Date.now(),
      source: this.name,
      data: {
        effectType: 'bullet-impact',
        position: impactPoint,
        intensity: 'medium'
      }
    });

    // Destroy projectile
    world.destroyEntity(projectileId);
  }
}

class ExplosiveSystem extends BaseSystem {
  initialize(world: World): void {
    world.subscribeToEvent('entity-died', (event) => {
      if (this.isExplosive(world, event.data.entityId)) {
        this.createExplosion(world, event.data);
      }
    });
  }

  private createExplosion(world: World, deathData: any): void {
    const position = world.getComponent(deathData.entityId, 'position');
    const explosiveData = world.getComponent(deathData.entityId, 'explosive');

    if (position && explosiveData) {
      // Find entities in blast radius
      const affectedEntities = this.getEntitiesInRadius(world, position, explosiveData.radius);

      // Emit explosion event
      world.emitEvent({
        type: 'explosion',
        timestamp: Date.now(),
        source: this.name,
        data: {
          center: position,
          radius: explosiveData.radius,
          damage: explosiveData.damage,
          affectedEntities
        }
      });

      // Damage each affected entity
      for (const entityId of affectedEntities) {
        const distance = this.getDistance(world, entityId, position);
        const damageMultiplier = Math.max(0, 1 - (distance / explosiveData.radius));

        world.emitEvent({
          type: 'damage-dealt',
          timestamp: Date.now(),
          source: this.name,
          data: {
            targetId: entityId,
            damage: explosiveData.damage * damageMultiplier,
            damageType: 'explosive',
            isCritical: false
          }
        });
      }
    }
  }
}
```

### Event Filtering and Conditional Processing

```typescript
class EventFilterSystem extends BaseSystem {
  readonly priority = 0; // Run first to filter events
  readonly name = 'EventFilterSystem';

  private gameSettings = {
    soundEnabled: true,
    effectsEnabled: true,
    debugMode: false
  };

  initialize(world: World): void {
    // Intercept all events for filtering
    world.subscribeToEvent('sound-request', (event) => {
      if (this.gameSettings.soundEnabled) {
        this.forwardEvent(world, 'sound-play', event.data);
      }
    });

    world.subscribeToEvent('effect-request', (event) => {
      if (this.gameSettings.effectsEnabled) {
        this.forwardEvent(world, 'effect-create', event.data);
      }
    });

    world.subscribeToEvent('debug-info', (event) => {
      if (this.gameSettings.debugMode) {
        console.log('Debug:', event.data);
      }
    });
  }

  private forwardEvent(world: World, eventType: string, data: any): void {
    world.emitEvent({
      type: eventType,
      timestamp: Date.now(),
      source: this.name,
      data
    });
  }
}

class ConditionalResponseSystem extends BaseSystem {
  initialize(world: World): void {
    world.subscribeToEvent('player-level-up', (event) => {
      const playerLevel = event.data.newLevel;

      // Different responses based on level milestones
      if (playerLevel % 10 === 0) {
        this.handleMajorLevelUp(world, event.data);
      } else if (playerLevel % 5 === 0) {
        this.handleMinorLevelUp(world, event.data);
      } else {
        this.handleRegularLevelUp(world, event.data);
      }
    });

    world.subscribeToEvent('enemy-spawned', (event) => {
      const playerCount = this.getPlayerCount(world);

      // Scale enemy based on player count
      if (playerCount > 1) {
        this.scaleEnemyForMultiplayer(world, event.data.enemyId, playerCount);
      }
    });
  }

  private handleMajorLevelUp(world: World, levelData: any): void {
    // Major milestone - unlock new abilities
    world.emitEvent({
      type: 'ability-unlocked',
      timestamp: Date.now(),
      source: this.name,
      data: {
        playerId: levelData.playerId,
        abilityType: this.getNewAbility(levelData.newLevel)
      }
    });
  }
}
```

### Event Batching and Optimization

```typescript
class EventBatchingSystem extends BaseSystem {
  readonly priority = 999; // Run last to batch events
  readonly name = 'EventBatchingSystem';

  private damageBatch: Array<{ entityId: number; totalDamage: number }> = [];
  private batchTimeout = 100; // milliseconds
  private lastBatchTime = 0;

  initialize(world: World): void {
    world.subscribeToEvent('damage-dealt', (event) => {
      this.addToBatch(event.data);
    });
  }

  update(world: World): void {
    const currentTime = Date.now();

    if (this.damageBatch.length > 0 && currentTime - this.lastBatchTime > this.batchTimeout) {
      this.processDamageBatch(world);
    }
  }

  private addToBatch(damageData: any): void {
    const existing = this.damageBatch.find(entry => entry.entityId === damageData.targetId);

    if (existing) {
      existing.totalDamage += damageData.damage;
    } else {
      this.damageBatch.push({
        entityId: damageData.targetId,
        totalDamage: damageData.damage
      });
    }

    this.lastBatchTime = Date.now();
  }

  private processDamageBatch(world: World): void {
    // Process all batched damage at once
    for (const batch of this.damageBatch) {
      world.emitEvent({
        type: 'damage-batch-applied',
        timestamp: Date.now(),
        source: this.name,
        data: batch
      });
    }

    this.damageBatch.length = 0;
  }
}

class PerformanceOptimizedEventSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'PerformanceOptimizedEventSystem';

  private eventCounts = new Map<string, number>();

  update(world: World): void {
    // Only emit expensive debug events if someone is listening
    const eventBus = world.getEventBus();

    if (eventBus.getListenerCount('performance-stats') > 0) {
      const stats = this.calculatePerformanceStats(world);
      world.emitEvent({
        type: 'performance-stats',
        timestamp: Date.now(),
        source: this.name,
        data: stats
      });
    }

    // Throttle frequent events
    if (this.shouldEmitFrameEvent()) {
      world.emitEvent({
        type: 'frame-update',
        timestamp: Date.now(),
        source: this.name,
        data: { frame: this.getFrameNumber() }
      });
    }
  }

  private shouldEmitFrameEvent(): boolean {
    // Only emit every 60 frames (once per second at 60fps)
    return this.getFrameNumber() % 60 === 0;
  }

  private calculatePerformanceStats(world: World): any {
    return {
      entityCount: world.getEntityCount(),
      systemCount: world.getSystemCount(),
      frameRate: this.getCurrentFPS()
    };
  }
}
```

## Component-Based Event Emission

```typescript
class EventEmitterComponent extends Component {
  readonly type = 'event-emitter';

  private pendingEvents: GameEvent[] = [];

  queueEvent(eventType: string, data: any, source?: string): void {
    this.pendingEvents.push({
      type: eventType,
      timestamp: Date.now(),
      source: source || 'EventEmitterComponent',
      data
    });
  }

  flushEvents(world: World): GameEvent[] {
    const events = [...this.pendingEvents];
    this.pendingEvents.length = 0;

    // Emit all queued events
    for (const event of events) {
      world.emitEvent(event);
    }

    return events;
  }

  hasQueuedEvents(): boolean {
    return this.pendingEvents.length > 0;
  }
}

class EventEmissionSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'EventEmissionSystem';

  update(world: World): void {
    // Process all entities with event emitter components
    const entities = this.queryEntities(world, 'event-emitter');

    for (const entityId of entities) {
      const emitter = world.getComponent<EventEmitterComponent>(entityId, 'event-emitter');

      if (emitter && emitter.hasQueuedEvents()) {
        emitter.flushEvents(world);
      }
    }
  }
}

// Usage example
class InteractableSystem extends BaseSystem {
  update(world: World): void {
    const interactables = this.queryEntities(world, 'interactable', 'position');

    for (const entityId of interactables) {
      if (this.isPlayerNearby(world, entityId)) {
        const emitter = world.getComponent<EventEmitterComponent>(entityId, 'event-emitter');

        if (emitter) {
          emitter.queueEvent('show-interaction-prompt', {
            entityId,
            promptText: 'Press E to interact',
            position: world.getComponent(entityId, 'position')
          });
        }
      }
    }
  }
}
```

## Error Handling and Debugging

### Event Error Recovery

```typescript
class RobustEventHandlingSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'RobustEventHandlingSystem';

  private errorCounts = new Map<string, number>();
  private maxErrors = 5;

  initialize(world: World): void {
    world.subscribeToEvent('critical-event', (event) => {
      try {
        this.handleCriticalEvent(world, event);
      } catch (error) {
        this.handleEventError(world, 'critical-event', error);
      }
    });

    world.subscribeToEvent('recoverable-event', (event) => {
      try {
        this.handleRecoverableEvent(world, event);
      } catch (error) {
        this.handleEventError(world, 'recoverable-event', error);
      }
    });
  }

  private handleEventError(world: World, eventType: string, error: Error): void {
    const errorCount = (this.errorCounts.get(eventType) || 0) + 1;
    this.errorCounts.set(eventType, errorCount);

    console.error(`Event handling error for '${eventType}' (${errorCount}/${this.maxErrors}):`, error);

    if (errorCount >= this.maxErrors) {
      console.warn(`Too many errors for event type '${eventType}', disabling handler`);

      // Emit system health warning
      world.emitEvent({
        type: 'system-health-warning',
        timestamp: Date.now(),
        source: this.name,
        data: {
          eventType,
          errorCount,
          action: 'handler-disabled'
        }
      });
    }
  }

  private handleCriticalEvent(world: World, event: GameEvent): void {
    // Critical event handling that might throw
    if (!event.data.required) {
      throw new Error('Missing required data');
    }
  }
}
```

### Event Debugging Tools

```typescript
class EventDebugSystem extends BaseSystem {
  readonly priority = 1000; // Run last for monitoring
  readonly name = 'EventDebugSystem';

  private eventHistory: GameEvent[] = [];
  private maxHistorySize = 100;
  private debugMode = false;

  initialize(world: World): void {
    // Monitor all events when debug mode is enabled
    world.subscribeToEvent('enable-debug', () => {
      this.debugMode = true;
      console.log('Event debugging enabled');
    });

    world.subscribeToEvent('disable-debug', () => {
      this.debugMode = false;
      console.log('Event debugging disabled');
    });

    // Log all events in debug mode
    this.interceptAllEvents(world);
  }

  private interceptAllEvents(world: World): void {
    const eventBus = world.getEventBus();
    const originalEmit = eventBus.emit.bind(eventBus);

    eventBus.emit = (event: GameEvent) => {
      this.logEvent(event);
      originalEmit(event);
    };
  }

  private logEvent(event: GameEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Debug logging
    if (this.debugMode) {
      console.log(`Event: ${event.type}`, {
        source: event.source,
        data: event.data,
        timestamp: new Date(event.timestamp).toISOString()
      });
    }
  }

  getEventHistory(eventType?: string): GameEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  getEventStats(): Map<string, number> {
    const stats = new Map<string, number>();

    for (const event of this.eventHistory) {
      stats.set(event.type, (stats.get(event.type) || 0) + 1);
    }

    return stats;
  }
}
```

## Testing Event-Driven Systems

### Unit Testing Event Handlers

```typescript
import { test, expect, describe } from "bun:test";

describe('EventDrivenSystems', () => {
  test('should handle damage events correctly', () => {
    // Arrange
    const world = new World();
    const healthSystem = new HealthSystem();
    const combatSystem = new CombatSystem();

    world.addSystem(healthSystem);
    world.addSystem(combatSystem);

    const entity = world.createEntity();
    world.addComponent(entity, { type: 'health', current: 100, maximum: 100 });

    let deathEventEmitted = false;
    world.subscribeToEvent('entity-died', () => {
      deathEventEmitted = true;
    });

    // Act
    world.emitEvent({
      type: 'damage-dealt',
      timestamp: Date.now(),
      data: { targetId: entity, damage: 100, damageType: 'physical', isCritical: false }
    });

    world.update(16);

    // Assert
    const health = world.getComponent<HealthComponent>(entity, 'health');
    expect(health?.current).toBe(0);
    expect(deathEventEmitted).toBe(true);
  });

  test('should chain events correctly', () => {
    // Arrange
    const world = new World();
    const weaponSystem = new WeaponSystem();
    const explosiveSystem = new ExplosiveSystem();

    world.addSystem(weaponSystem);
    world.addSystem(explosiveSystem);

    const explosiveEntity = world.createEntity();
    world.addComponent(explosiveEntity, { type: 'explosive', radius: 50, damage: 30 });
    world.addComponent(explosiveEntity, { type: 'position', x: 100, y: 100 });

    let explosionEventEmitted = false;
    world.subscribeToEvent('explosion', () => {
      explosionEventEmitted = true;
    });

    // Act
    world.emitEvent({
      type: 'entity-died',
      timestamp: Date.now(),
      data: { entityId: explosiveEntity }
    });

    world.update(16);

    // Assert
    expect(explosionEventEmitted).toBe(true);
  });
});
```

### Integration Testing Event Flows

```typescript
describe('EventFlow Integration', () => {
  test('should handle complete combat scenario', () => {
    // Arrange
    const world = new World();
    const systems = [
      new InputSystem(),
      new CombatSystem(),
      new HealthSystem(),
      new ScoreSystem(),
      new UISystem()
    ];

    systems.forEach(system => world.addSystem(system));

    const player = world.createEntity();
    world.addComponent(player, { type: 'player' });
    world.addComponent(player, { type: 'health', current: 100, maximum: 100 });

    const enemy = world.createEntity();
    world.addComponent(enemy, { type: 'enemy' });
    world.addComponent(enemy, { type: 'health', current: 50, maximum: 50 });

    let finalScore = 0;
    world.subscribeToEvent('score-changed', (event) => {
      finalScore = event.data.newTotal;
    });

    // Act - Simulate player killing enemy
    world.emitEvent({
      type: 'damage-dealt',
      timestamp: Date.now(),
      data: { targetId: enemy, sourceId: player, damage: 50, damageType: 'physical', isCritical: false }
    });

    world.update(16);

    // Assert
    const enemyHealth = world.getComponent<HealthComponent>(enemy, 'health');
    expect(enemyHealth?.current).toBe(0);
    expect(finalScore).toBeGreaterThan(0);
  });
});
```

## Performance Considerations

### Event Frequency Management

```typescript
class EventThrottlingSystem extends BaseSystem {
  private eventCounts = new Map<string, number>();
  private lastResetTime = Date.now();
  private resetInterval = 1000; // Reset counters every second
  private eventLimits = new Map([
    ['player-moved', 60], // Max 60 movement events per second
    ['ui-update', 30],    // Max 30 UI updates per second
    ['debug-info', 10]    // Max 10 debug events per second
  ]);

  initialize(world: World): void {
    // Intercept high-frequency events
    world.subscribeToEvent('player-moved', (event) => {
      if (this.shouldAllowEvent('player-moved')) {
        this.forwardEvent(world, 'player-moved-throttled', event.data);
      }
    });
  }

  update(world: World): void {
    const currentTime = Date.now();

    if (currentTime - this.lastResetTime > this.resetInterval) {
      this.eventCounts.clear();
      this.lastResetTime = currentTime;
    }
  }

  private shouldAllowEvent(eventType: string): boolean {
    const currentCount = this.eventCounts.get(eventType) || 0;
    const limit = this.eventLimits.get(eventType) || Number.MAX_SAFE_INTEGER;

    if (currentCount < limit) {
      this.eventCounts.set(eventType, currentCount + 1);
      return true;
    }

    return false;
  }
}
```

## See Also

- [Event Bus API](../api/events/event-bus.md) - EventBus implementation details
- [Game Event Types](../api/events/game-event.md) - Built-in and custom event types
- [Systems and Scheduling](./systems-and-scheduling.md) - System architecture patterns
- [Event System Demo](../examples/event-system-demo.md) - Working examples
- [Performance Optimization](./performance-optimization.md) - Event system optimization