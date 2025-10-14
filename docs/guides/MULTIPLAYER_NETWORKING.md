# Multiplayer Networking Guide

This guide covers real-time multiplayer architecture, state synchronization, client-server communication, and optimization strategies for building responsive networked games using the built-in WebSocket infrastructure.

## Architecture Overview

### Client-Server Model

The ECS engine uses a client-server architecture with authoritative server:

```typescript
// Server setup with ECS World integration
class MultiplayerGameServer {
  private world = new World();
  private server: GameServer;
  private connectedClients = new Map<string, ClientInfo>();

  constructor() {
    this.server = new GameServer(this.world, {
      port: 3000,
      maxClients: 100,
      heartbeatInterval: 30000,
      clientTimeout: 60000
    });

    this.setupSystems();
    this.setupEventHandlers();
  }

  private setupSystems(): void {
    // Core multiplayer systems
    this.world.addSystem(new NetworkInputSystem());
    this.world.addSystem(new GameLogicSystem());
    this.world.addSystem(new PhysicsSystem());
    this.world.addSystem(new StateSnapshotSystem());
    this.world.addSystem(new NetworkSyncSystem());
  }

  private setupEventHandlers(): void {
    // Client lifecycle events
    this.world.subscribeToEvent('client_connected', (event) => {
      this.handleClientConnected(event.data);
    });

    this.world.subscribeToEvent('client_disconnected', (event) => {
      this.handleClientDisconnected(event.data);
    });

    // Input events from clients
    this.world.subscribeToEvent('player_input', (event) => {
      this.handlePlayerInput(event.data);
    });
  }

  async start(): Promise<void> {
    await this.server.start();
    console.log('Multiplayer server started');

    // Start game loop
    this.startGameLoop();
  }

  private startGameLoop(): void {
    let lastTime = Date.now();
    const targetFPS = 60;

    const loop = () => {
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Update game world
      this.world.update(deltaTime);

      // Schedule next frame
      setTimeout(loop, Math.max(0, (1000 / targetFPS) - deltaTime));
    };

    loop();
  }
}

// Start server
const gameServer = new MultiplayerGameServer();
await gameServer.start();
```

### Client Connection Management

```typescript
interface ClientInfo {
  id: string;
  playerId?: number; // Entity ID of player
  name: string;
  lastSeen: number;
  authenticated: boolean;
  latency: number;
}

class ClientManager {
  private clients = new Map<string, ClientInfo>();
  private playerEntities = new Map<string, number>(); // clientId -> entityId

  addClient(clientId: string, name: string): void {
    const client: ClientInfo = {
      id: clientId,
      name,
      lastSeen: Date.now(),
      authenticated: false,
      latency: 0
    };

    this.clients.set(clientId, client);
  }

  authenticateClient(clientId: string, world: World): number | null {
    const client = this.clients.get(clientId);
    if (!client) return null;

    // Create player entity
    const playerId = world.createEntity();

    world.addComponent(playerId, {
      type: 'player',
      clientId,
      name: client.name,
      health: 100,
      maxHealth: 100,
      score: 0
    });

    world.addComponent(playerId, {
      type: 'position',
      x: Math.random() * 800,
      y: Math.random() * 600,
      z: 0
    });

    world.addComponent(playerId, {
      type: 'network-controlled',
      clientId,
      lastInputSequence: 0
    });

    client.playerId = playerId;
    client.authenticated = true;
    this.playerEntities.set(clientId, playerId);

    return playerId;
  }

  removeClient(clientId: string, world: World): void {
    const playerId = this.playerEntities.get(clientId);
    if (playerId) {
      world.destroyEntity(playerId);
      this.playerEntities.delete(clientId);
    }

    this.clients.delete(clientId);
  }

  updateClientLatency(clientId: string, latency: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.latency = latency;
      client.lastSeen = Date.now();
    }
  }

  getPlayerEntity(clientId: string): number | undefined {
    return this.playerEntities.get(clientId);
  }
}
```

## State Synchronization

### Delta Compression

Only send what has changed since the last update:

```typescript
class DeltaCompressionSystem extends BaseSystem {
  readonly priority = 90;
  readonly name = 'DeltaCompressionSystem';

  private lastSnapshots = new Map<string, GameSnapshot>();
  private syncRate = 20; // 20 updates per second
  private lastSyncTime = 0;

  update(world: World, deltaTime: number): void {
    this.lastSyncTime += deltaTime;

    if (this.lastSyncTime >= 1000 / this.syncRate) {
      this.createAndSendDeltas(world);
      this.lastSyncTime = 0;
    }
  }

  private createAndSendDeltas(world: World): void {
    const currentSnapshot = this.createSnapshot(world);

    // Send delta to each client
    for (const [clientId, lastSnapshot] of this.lastSnapshots) {
      const delta = this.calculateDelta(lastSnapshot, currentSnapshot);

      if (delta.changes.length > 0) {
        world.emitEvent({
          type: 'send_to_client',
          timestamp: Date.now(),
          data: {
            clientId,
            message: {
              type: 'state_delta',
              timestamp: Date.now(),
              data: delta
            }
          }
        });
      }
    }

    // Update snapshots for all clients
    for (const clientId of this.getConnectedClients(world)) {
      this.lastSnapshots.set(clientId, currentSnapshot);
    }
  }

  private createSnapshot(world: World): GameSnapshot {
    const entities: EntitySnapshot[] = [];

    // Get all entities with networked components
    const networkedEntities = this.queryEntities(world, 'position');

    for (const entityId of networkedEntities) {
      const entityData: any = { id: entityId };

      // Collect networked components
      const componentTypes = ['position', 'health', 'player', 'velocity'];
      for (const componentType of componentTypes) {
        const component = world.getComponent(entityId, componentType);
        if (component) {
          entityData[componentType] = { ...component };
        }
      }

      entities.push(entityData);
    }

    return {
      timestamp: Date.now(),
      entities,
      gameState: this.getGameState(world)
    };
  }

  private calculateDelta(oldSnapshot: GameSnapshot, newSnapshot: GameSnapshot): StateDelta {
    const changes: EntityChange[] = [];

    // Create entity maps for efficient lookup
    const oldEntities = new Map(oldSnapshot.entities.map(e => [e.id, e]));
    const newEntities = new Map(newSnapshot.entities.map(e => [e.id, e]));

    // Check for new and modified entities
    for (const [entityId, newEntity] of newEntities) {
      const oldEntity = oldEntities.get(entityId);

      if (!oldEntity) {
        // New entity
        changes.push({
          type: 'create',
          entityId,
          data: newEntity
        });
      } else if (this.hasEntityChanged(oldEntity, newEntity)) {
        // Modified entity - only send changed components
        const changedComponents = this.getChangedComponents(oldEntity, newEntity);
        changes.push({
          type: 'update',
          entityId,
          data: changedComponents
        });
      }
    }

    // Check for deleted entities
    for (const [entityId] of oldEntities) {
      if (!newEntities.has(entityId)) {
        changes.push({
          type: 'delete',
          entityId,
          data: null
        });
      }
    }

    return {
      timestamp: newSnapshot.timestamp,
      sequenceNumber: this.getNextSequenceNumber(),
      changes
    };
  }

  private hasEntityChanged(oldEntity: EntitySnapshot, newEntity: EntitySnapshot): boolean {
    // Compare components for changes
    const componentTypes = ['position', 'health', 'velocity'];

    for (const componentType of componentTypes) {
      const oldComponent = oldEntity[componentType];
      const newComponent = newEntity[componentType];

      if (JSON.stringify(oldComponent) !== JSON.stringify(newComponent)) {
        return true;
      }
    }

    return false;
  }
}
```

### Client-Side Prediction

Reduce perceived latency with client-side prediction:

```typescript
class ClientPredictionSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'ClientPredictionSystem';

  private inputSequence = 0;
  private pendingInputs: Array<{sequence: number, input: PlayerInput, timestamp: number}> = [];
  private serverState?: GameSnapshot;

  update(world: World, deltaTime: number): void {
    // Process local input immediately
    this.processLocalInput(world, deltaTime);

    // Apply server corrections when received
    this.applyServerCorrections(world);
  }

  private processLocalInput(world: World, deltaTime: number): void {
    const localPlayerId = this.getLocalPlayerId(world);
    if (!localPlayerId) return;

    const input = this.gatherInput();
    if (!input.hasInput()) return;

    // Assign sequence number
    this.inputSequence++;
    const sequencedInput = {
      sequence: this.inputSequence,
      input,
      timestamp: Date.now()
    };

    // Store for later reconciliation
    this.pendingInputs.push(sequencedInput);

    // Apply input locally for immediate feedback
    this.applyInputToEntity(world, localPlayerId, input, deltaTime);

    // Send to server
    this.sendInputToServer(world, sequencedInput);

    // Clean up old inputs
    this.cleanupOldInputs();
  }

  private applyServerCorrections(world: World): void {
    if (!this.serverState) return;

    const localPlayerId = this.getLocalPlayerId(world);
    if (!localPlayerId) return;

    const serverEntity = this.serverState.entities.find(e => e.id === localPlayerId);
    if (!serverEntity) return;

    const localPosition = world.getComponent<PositionComponent>(localPlayerId, 'position');
    const serverPosition = serverEntity.position;

    if (!localPosition || !serverPosition) return;

    // Check if correction is needed
    const distance = Math.hypot(
      localPosition.x - serverPosition.x,
      localPosition.y - serverPosition.y
    );

    if (distance > 5) { // Correction threshold
      // Apply server state
      localPosition.x = serverPosition.x;
      localPosition.y = serverPosition.y;

      // Re-apply pending inputs from server timestamp
      this.replayPendingInputs(world, localPlayerId);
    }

    this.serverState = undefined;
  }

  private replayPendingInputs(world: World, playerId: number): void {
    // Sort pending inputs by sequence
    this.pendingInputs.sort((a, b) => a.sequence - b.sequence);

    // Re-apply each input
    for (const pendingInput of this.pendingInputs) {
      this.applyInputToEntity(world, playerId, pendingInput.input, 0.016);
    }
  }

  private sendInputToServer(world: World, input: any): void {
    world.emitEvent({
      type: 'send_to_server',
      timestamp: Date.now(),
      data: {
        type: 'player_input',
        data: input
      }
    });
  }

  setServerState(serverState: GameSnapshot): void {
    this.serverState = serverState;

    // Remove acknowledged inputs
    if (serverState.lastProcessedInput) {
      this.pendingInputs = this.pendingInputs.filter(
        input => input.sequence > serverState.lastProcessedInput
      );
    }
  }
}
```

## Input Handling

### Networked Input System

```typescript
interface PlayerInput {
  moveX: number;
  moveY: number;
  actions: Set<string>;
  mouseX?: number;
  mouseY?: number;
  timestamp: number;
}

class NetworkInputSystem extends BaseSystem {
  readonly priority = 5;
  readonly name = 'NetworkInputSystem';

  private inputBuffers = new Map<string, PlayerInput[]>();
  private maxBufferSize = 10;

  initialize(world: World): void {
    world.subscribeToEvent('player_input', (event) => {
      this.handlePlayerInput(event.data);
    });
  }

  update(world: World, deltaTime: number): void {
    // Process buffered inputs for each client
    for (const [clientId, inputs] of this.inputBuffers) {
      this.processClientInputs(world, clientId, inputs, deltaTime);
    }
  }

  private handlePlayerInput(inputData: any): void {
    const { clientId, input } = inputData;

    // Add to input buffer
    if (!this.inputBuffers.has(clientId)) {
      this.inputBuffers.set(clientId, []);
    }

    const buffer = this.inputBuffers.get(clientId)!;
    buffer.push(input);

    // Maintain buffer size
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }
  }

  private processClientInputs(world: World, clientId: string, inputs: PlayerInput[], deltaTime: number): void {
    const playerId = this.getPlayerEntityId(world, clientId);
    if (!playerId) return;

    // Process each input in sequence
    for (const input of inputs) {
      this.applyInputToPlayer(world, playerId, input, deltaTime);
    }

    // Clear processed inputs
    inputs.length = 0;
  }

  private applyInputToPlayer(world: World, playerId: number, input: PlayerInput, deltaTime: number): void {
    const velocity = world.getComponent<VelocityComponent>(playerId, 'velocity');
    const player = world.getComponent<PlayerComponent>(playerId, 'player');

    if (!velocity || !player) return;

    // Apply movement input
    const speed = 200; // pixels per second
    velocity.dx = input.moveX * speed;
    velocity.dy = input.moveY * speed;

    // Process actions
    for (const action of input.actions) {
      this.processPlayerAction(world, playerId, action, input);
    }

    // Mark components as dirty for synchronization
    world.markComponentDirty(playerId, 'velocity');
  }

  private processPlayerAction(world: World, playerId: number, action: string, input: PlayerInput): void {
    switch (action) {
      case 'shoot':
        this.handleShootAction(world, playerId, input);
        break;
      case 'jump':
        this.handleJumpAction(world, playerId);
        break;
      case 'interact':
        this.handleInteractAction(world, playerId);
        break;
    }
  }

  private handleShootAction(world: World, playerId: number, input: PlayerInput): void {
    const position = world.getComponent<PositionComponent>(playerId, 'position');
    if (!position || input.mouseX === undefined || input.mouseY === undefined) return;

    // Calculate shoot direction
    const dx = input.mouseX - position.x;
    const dy = input.mouseY - position.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 0) {
      const direction = { x: dx / distance, y: dy / distance };

      // Emit shoot event
      world.emitEvent({
        type: 'player_shoot',
        timestamp: Date.now(),
        data: {
          playerId,
          position: { x: position.x, y: position.y },
          direction,
          weaponType: 'basic'
        }
      });
    }
  }
}
```

### Input Lag Compensation

```typescript
class LagCompensationSystem extends BaseSystem {
  readonly priority = 6;
  readonly name = 'LagCompensationSystem';

  private stateHistory: Array<{timestamp: number, snapshot: GameSnapshot}> = [];
  private maxHistoryLength = 60; // 1 second at 60fps

  update(world: World, deltaTime: number): void {
    // Store current state
    this.storeCurrentState(world);

    // Clean old history
    this.cleanupHistory();
  }

  processDelayedAction(world: World, action: any, clientLatency: number): void {
    // Rewind to the time when the client sent the action
    const actionTime = action.timestamp - (clientLatency / 2);
    const historicState = this.getHistoricState(actionTime);

    if (historicState) {
      // Temporarily apply historic state
      this.applyHistoricState(world, historicState);

      // Process the action in the historic context
      this.processActionInHistoricContext(world, action);

      // Restore current state
      this.restoreCurrentState(world);
    } else {
      // No historic state available, process normally
      this.processActionNormally(world, action);
    }
  }

  private getHistoricState(timestamp: number): GameSnapshot | null {
    // Find the closest historic state
    let closest: GameSnapshot | null = null;
    let closestDiff = Infinity;

    for (const entry of this.stateHistory) {
      const diff = Math.abs(entry.timestamp - timestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = entry.snapshot;
      }
    }

    return closest;
  }

  private processActionInHistoricContext(world: World, action: any): void {
    switch (action.type) {
      case 'shoot':
        this.processShootAction(world, action);
        break;
      case 'melee_attack':
        this.processMeleeAction(world, action);
        break;
    }
  }

  private processShootAction(world: World, action: any): void {
    const { playerId, direction, position } = action.data;

    // Perform hit detection in the historic world state
    const hitTargets = this.performRaycast(world, position, direction);

    for (const targetId of hitTargets) {
      // Apply damage in current time
      world.emitEvent({
        type: 'damage_dealt',
        timestamp: Date.now(),
        data: {
          targetId,
          damage: 25,
          sourceId: playerId
        }
      });
    }
  }
}
```

## Anti-Cheat and Validation

### Server-Side Validation

```typescript
class ServerValidationSystem extends BaseSystem {
  readonly priority = 4;
  readonly name = 'ServerValidationSystem';

  private playerStates = new Map<number, PlayerState>();
  private suspiciousActivity = new Map<string, number>();

  update(world: World, deltaTime: number): void {
    this.validatePlayerMovement(world, deltaTime);
    this.validatePlayerActions(world);
    this.checkForSuspiciousActivity(world);
  }

  private validatePlayerMovement(world: World, deltaTime: number): void {
    const players = this.queryEntities(world, 'player', 'position', 'velocity');

    for (const playerId of players) {
      const position = world.getComponent<PositionComponent>(playerId, 'position');
      const velocity = world.getComponent<VelocityComponent>(playerId, 'velocity');
      const player = world.getComponent<PlayerComponent>(playerId, 'player');

      if (!position || !velocity || !player) continue;

      const lastState = this.playerStates.get(playerId);
      if (lastState) {
        // Check movement speed
        const expectedPosition = {
          x: lastState.position.x + velocity.dx * deltaTime,
          y: lastState.position.y + velocity.dy * deltaTime
        };

        const actualDistance = Math.hypot(
          position.x - lastState.position.x,
          position.y - lastState.position.y
        );

        const maxAllowedDistance = 250 * deltaTime; // Max speed: 250 pixels/second

        if (actualDistance > maxAllowedDistance * 1.1) { // 10% tolerance
          this.flagSuspiciousActivity(player.clientId, 'speed_hack', {
            actualSpeed: actualDistance / deltaTime,
            maxAllowedSpeed: 250
          });

          // Correct position
          position.x = expectedPosition.x;
          position.y = expectedPosition.y;
        }
      }

      // Update stored state
      this.playerStates.set(playerId, {
        position: { x: position.x, y: position.y },
        lastUpdate: Date.now()
      });
    }
  }

  private validatePlayerActions(world: World): void {
    // Validate action rates
    const players = this.queryEntities(world, 'player', 'action-cooldowns');

    for (const playerId of players) {
      const cooldowns = world.getComponent<ActionCooldownsComponent>(playerId, 'action-cooldowns');
      if (!cooldowns) continue;

      // Check if actions are performed too frequently
      for (const [action, lastTime] of cooldowns.actions) {
        const timeSinceLastAction = Date.now() - lastTime;
        const minCooldown = this.getMinimumCooldown(action);

        if (timeSinceLastAction < minCooldown) {
          const player = world.getComponent<PlayerComponent>(playerId, 'player');
          if (player) {
            this.flagSuspiciousActivity(player.clientId, 'action_spam', {
              action,
              timeSinceLastAction,
              minCooldown
            });
          }
        }
      }
    }
  }

  private flagSuspiciousActivity(clientId: string, activityType: string, data: any): void {
    const count = (this.suspiciousActivity.get(clientId) || 0) + 1;
    this.suspiciousActivity.set(clientId, count);

    console.warn(`Suspicious activity detected: ${clientId} - ${activityType}`, data);

    // Escalating responses
    if (count >= 10) {
      this.kickClient(clientId);
    } else if (count >= 5) {
      this.temporarilySlowClient(clientId);
    }
  }

  private kickClient(clientId: string): void {
    console.log(`Kicking client for suspicious activity: ${clientId}`);
    // Implementation depends on server framework
  }
}
```

### Rate Limiting

```typescript
class RateLimitingSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'RateLimitingSystem';

  private clientLimits = new Map<string, ClientRateLimit>();

  private readonly limits = {
    messages_per_second: 20,
    actions_per_second: 10,
    movement_updates_per_second: 60
  };

  initialize(world: World): void {
    world.subscribeToEvent('client_message', (event) => {
      this.checkRateLimit(event.data.clientId, 'messages');
    });

    world.subscribeToEvent('player_action', (event) => {
      this.checkRateLimit(event.data.clientId, 'actions');
    });
  }

  private checkRateLimit(clientId: string, limitType: string): boolean {
    if (!this.clientLimits.has(clientId)) {
      this.clientLimits.set(clientId, {
        messages: { count: 0, window: Date.now() },
        actions: { count: 0, window: Date.now() },
        movements: { count: 0, window: Date.now() }
      });
    }

    const limits = this.clientLimits.get(clientId)!;
    const limit = limits[limitType as keyof ClientRateLimit];
    const currentTime = Date.now();

    // Reset window if 1 second has passed
    if (currentTime - limit.window >= 1000) {
      limit.count = 0;
      limit.window = currentTime;
    }

    limit.count++;

    const maxLimit = this.getMaxLimit(limitType);
    if (limit.count > maxLimit) {
      this.handleRateLimit(clientId, limitType);
      return false;
    }

    return true;
  }

  private handleRateLimit(clientId: string, limitType: string): void {
    console.warn(`Rate limit exceeded: ${clientId} - ${limitType}`);

    // Send warning to client
    this.sendRateLimitWarning(clientId, limitType);

    // Escalate if needed
    const violations = this.getRateLimitViolations(clientId);
    if (violations > 5) {
      this.temporarilyMuteClient(clientId);
    }
  }
}
```

## Optimization Strategies

### Bandwidth Optimization

```typescript
class BandwidthOptimizer {
  private compressionThreshold = 500; // bytes
  private updatePriorities = new Map<string, number>();

  optimizeNetworkUpdate(update: NetworkUpdate): OptimizedUpdate {
    // Prioritize updates based on relevance
    const prioritized = this.prioritizeComponents(update);

    // Compress large updates
    const compressed = this.compressIfNeeded(prioritized);

    // Quantize floating point values
    const quantized = this.quantizeValues(compressed);

    return quantized;
  }

  private prioritizeComponents(update: NetworkUpdate): NetworkUpdate {
    const prioritizedComponents: any = {};

    // Sort components by priority
    const componentPriorities = [
      'position',     // High priority - visible changes
      'health',       // High priority - gameplay critical
      'velocity',     // Medium priority - affects position
      'animation',    // Low priority - visual only
      'particles'     // Lowest priority - effects
    ];

    for (const componentType of componentPriorities) {
      if (update.components[componentType]) {
        prioritizedComponents[componentType] = update.components[componentType];
      }
    }

    return { ...update, components: prioritizedComponents };
  }

  private quantizeValues(update: NetworkUpdate): NetworkUpdate {
    const quantized = { ...update };

    // Quantize position values to reduce precision
    if (quantized.components.position) {
      const pos = quantized.components.position;
      pos.x = Math.round(pos.x * 10) / 10; // 1 decimal place
      pos.y = Math.round(pos.y * 10) / 10;
    }

    // Quantize health as integers
    if (quantized.components.health) {
      const health = quantized.components.health;
      health.current = Math.round(health.current);
    }

    return quantized;
  }

  private compressIfNeeded(update: NetworkUpdate): NetworkUpdate {
    const serialized = JSON.stringify(update);

    if (serialized.length > this.compressionThreshold) {
      // Apply compression (implementation depends on environment)
      return this.compressUpdate(update);
    }

    return update;
  }
}
```

### Area of Interest (AOI)

```typescript
class AreaOfInterestSystem extends BaseSystem {
  readonly priority = 85;
  readonly name = 'AreaOfInterestSystem';

  private clientAOIs = new Map<string, {x: number, y: number, radius: number}>();
  private spatialGrid = new SpatialGrid(100); // 100 pixel cells

  update(world: World): void {
    this.updateClientAOIs(world);
    this.filterUpdatesPerClient(world);
  }

  private updateClientAOIs(world: World): void {
    const players = this.queryEntities(world, 'player', 'position');

    for (const playerId of players) {
      const player = world.getComponent<PlayerComponent>(playerId, 'player');
      const position = world.getComponent<PositionComponent>(playerId, 'position');

      if (player && position) {
        this.clientAOIs.set(player.clientId, {
          x: position.x,
          y: position.y,
          radius: 500 // AOI radius in pixels
        });
      }
    }
  }

  private filterUpdatesPerClient(world: World): void {
    for (const [clientId, aoi] of this.clientAOIs) {
      const relevantEntities = this.getEntitiesInAOI(world, aoi);
      const filteredUpdate = this.createFilteredUpdate(world, relevantEntities);

      if (filteredUpdate.entities.length > 0) {
        world.emitEvent({
          type: 'send_filtered_update',
          timestamp: Date.now(),
          data: {
            clientId,
            update: filteredUpdate
          }
        });
      }
    }
  }

  private getEntitiesInAOI(world: World, aoi: {x: number, y: number, radius: number}): number[] {
    const entitiesInArea: number[] = [];
    const allEntities = this.queryEntities(world, 'position');

    for (const entityId of allEntities) {
      const position = world.getComponent<PositionComponent>(entityId, 'position');

      if (position) {
        const distance = Math.hypot(position.x - aoi.x, position.y - aoi.y);
        if (distance <= aoi.radius) {
          entitiesInArea.push(entityId);
        }
      }
    }

    return entitiesInArea;
  }
}
```

## Testing Multiplayer Systems

### Network Simulation

```typescript
class NetworkSimulator {
  private latency = 100; // ms
  private packetLoss = 0.02; // 2%
  private jitter = 20; // ms

  simulateNetworkConditions<T>(data: T, callback: (data: T) => void): void {
    // Simulate packet loss
    if (Math.random() < this.packetLoss) {
      console.log('Packet lost');
      return;
    }

    // Calculate delay with jitter
    const delay = this.latency + (Math.random() - 0.5) * this.jitter;

    // Deliver with delay
    setTimeout(() => {
      callback(data);
    }, delay);
  }

  setNetworkConditions(latency: number, packetLoss: number, jitter: number): void {
    this.latency = latency;
    this.packetLoss = packetLoss;
    this.jitter = jitter;
  }
}

// Usage in tests
describe('Multiplayer Systems', () => {
  test('should handle network latency', async () => {
    const simulator = new NetworkSimulator();
    simulator.setNetworkConditions(200, 0.05, 50); // High latency, 5% loss

    const world = new World();
    const networkSystem = new NetworkInputSystem();

    // Simulate delayed input
    const input = { moveX: 1, moveY: 0, actions: new Set(['move']) };

    simulator.simulateNetworkConditions(input, (delayedInput) => {
      world.emitEvent({
        type: 'player_input',
        data: { clientId: 'test-client', input: delayedInput }
      });
    });

    // Wait for simulated delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify input was processed
    const playerId = getPlayerEntity(world, 'test-client');
    const velocity = world.getComponent<VelocityComponent>(playerId, 'velocity');
    expect(velocity?.dx).toBeGreaterThan(0);
  });
});
```

### Load Testing

```typescript
class MultiplayerLoadTest {
  static async testPlayerCapacity(maxPlayers: number): Promise<void> {
    const server = new GameServer(new World(), { maxClients: maxPlayers });
    await server.start();

    const clients: WebSocket[] = [];
    const connectPromises: Promise<void>[] = [];

    // Connect multiple clients
    for (let i = 0; i < maxPlayers; i++) {
      const promise = new Promise<void>((resolve) => {
        const client = new WebSocket('ws://localhost:3000/ws');
        client.onopen = () => {
          clients.push(client);
          resolve();
        };
      });
      connectPromises.push(promise);
    }

    await Promise.all(connectPromises);

    // Simulate game activity
    await this.simulateGameActivity(clients);

    // Measure performance
    const performance = await this.measurePerformance(server);

    console.log(`Load test results for ${maxPlayers} players:`, performance);

    // Cleanup
    clients.forEach(client => client.close());
    server.stop();
  }

  private static async simulateGameActivity(clients: WebSocket[]): Promise<void> {
    const duration = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      // Each client sends random input
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          const input = {
            type: 'player_input',
            data: {
              moveX: (Math.random() - 0.5) * 2,
              moveY: (Math.random() - 0.5) * 2,
              actions: Math.random() > 0.8 ? ['shoot'] : []
            }
          };
          client.send(JSON.stringify(input));
        }
      }

      // Wait between inputs
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
```

## See Also

- [GameServer API](../api/websocket/game-server.md) - Server setup and configuration
- [GameClient API](../api/websocket/game-client.md) - Client connection management
- [WebSocket Example](../examples/websocket-multiplayer.md) - Complete multiplayer example
- [Performance Optimization](./performance-optimization.md) - Network performance strategies
- [Events and Communication](./events-and-communication.md) - Event-driven networking