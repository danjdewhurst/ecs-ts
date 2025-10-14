import { describe, expect, test } from 'bun:test';
import type { Component } from './Component.ts';
import { BaseSystem } from './System.ts';
import { World } from './World.ts';

interface TestPositionComponent extends Component {
    readonly type: 'test-position';
    x: number;
    y: number;
}

interface TestVelocityComponent extends Component {
    readonly type: 'test-velocity';
    dx: number;
    dy: number;
}

interface TestHealthComponent extends Component {
    readonly type: 'test-health';
    hp: number;
}

class MinimalTestSystem extends BaseSystem {
    readonly priority = 5;
    readonly name = 'MinimalTestSystem';

    updateCalls = 0;
    lastWorld: World | undefined;
    lastDeltaTime = 0;

    update(world: World, deltaTime: number): void {
        this.updateCalls++;
        this.lastWorld = world;
        this.lastDeltaTime = deltaTime;
    }
}

class SystemWithDependencies extends BaseSystem {
    readonly priority = 10;
    readonly name = 'SystemWithDependencies';
    override dependencies = ['PhysicsSystem', 'RenderSystem'];

    updateCalls = 0;

    override update(_world: World, _deltaTime: number): void {
        this.updateCalls++;
    }
}

class SystemWithInitializeShutdown extends BaseSystem {
    readonly priority = 1;
    readonly name = 'SystemWithInitializeShutdown';

    initializeCalls = 0;
    shutdownCalls = 0;
    updateCalls = 0;
    lastInitWorld: World | undefined;
    lastShutdownWorld: World | undefined;

    override initialize(world: World): void {
        this.initializeCalls++;
        this.lastInitWorld = world;
    }

    override shutdown(world: World): void {
        this.shutdownCalls++;
        this.lastShutdownWorld = world;
    }

    override update(_world: World, _deltaTime: number): void {
        this.updateCalls++;
    }
}

class QueryTestSystem extends BaseSystem {
    readonly priority = 3;
    readonly name = 'QueryTestSystem';

    processedEntities: number[] = [];
    processedComponents: TestPositionComponent[] = [];

    update(world: World, _deltaTime: number): void {
        this.processedEntities = this.queryEntities(
            world,
            'test-position',
            'test-velocity'
        );

        this.processedComponents = [];
        this.queryWithComponents<TestPositionComponent>(
            world,
            'test-position',
            (_entityId, component) => {
                this.processedComponents.push({ ...component });
            }
        );
    }
}

class SystemWithBaseLifecycle extends BaseSystem {
    readonly priority = 1;
    readonly name = 'SystemWithBaseLifecycle';

    initCalled = false;
    shutdownCalled = false;

    override initialize(world: World): void {
        super.initialize?.(world);
        this.initCalled = true;
    }

    override shutdown(world: World): void {
        super.shutdown?.(world);
        this.shutdownCalled = true;
    }

    update(_world: World, _deltaTime: number): void {
        // No-op
    }
}

class MultiComponentQuerySystem extends BaseSystem {
    readonly priority = 2;
    readonly name = 'MultiComponentQuerySystem';

    queriedEntities: number[] = [];

    update(world: World, _deltaTime: number): void {
        this.queriedEntities = this.queryEntities(
            world,
            'test-position',
            'test-velocity',
            'test-health'
        );
    }
}

class SingleComponentQuerySystem extends BaseSystem {
    readonly priority = 4;
    readonly name = 'SingleComponentQuerySystem';

    queriedEntities: number[] = [];

    update(world: World, _deltaTime: number): void {
        this.queriedEntities = this.queryEntities(world, 'test-health');
    }
}

describe('System Interface', () => {
    test('should define required System interface properties', () => {
        const system = new MinimalTestSystem();

        expect(system.priority).toBeDefined();
        expect(system.name).toBeDefined();
        expect(typeof system.priority).toBe('number');
        expect(typeof system.name).toBe('string');
        expect(typeof system.update).toBe('function');
    });

    test('should support optional dependencies property', () => {
        const systemWithoutDeps = new MinimalTestSystem();
        const systemWithDeps = new SystemWithDependencies();

        expect(systemWithoutDeps.dependencies).toBeDefined();
        expect(systemWithDeps.dependencies).toEqual([
            'PhysicsSystem',
            'RenderSystem',
        ]);
    });
});

describe('BaseSystem Abstract Class', () => {
    test('should create concrete system instance', () => {
        const system = new MinimalTestSystem();

        expect(system).toBeInstanceOf(BaseSystem);
        expect(system.priority).toBe(5);
        expect(system.name).toBe('MinimalTestSystem');
    });

    test('should have default empty dependencies array', () => {
        const system = new MinimalTestSystem();

        expect(system.dependencies).toBeDefined();
        expect(Array.isArray(system.dependencies)).toBe(true);
        expect(system.dependencies?.length).toBe(0);
    });

    test('should allow custom dependencies array', () => {
        const system = new SystemWithDependencies();

        expect(system.dependencies).toBeDefined();
        expect(system.dependencies?.length).toBe(2);
        expect(system.dependencies).toContain('PhysicsSystem');
        expect(system.dependencies).toContain('RenderSystem');
    });

    test('should have initialize and shutdown methods available', () => {
        const system = new MinimalTestSystem();

        expect(typeof system.initialize).toBe('function');
        expect(typeof system.shutdown).toBe('function');
    });
});

describe('BaseSystem.update()', () => {
    test('should call update with world and deltaTime', () => {
        const world = new World();
        const system = new MinimalTestSystem();
        const deltaTime = 16.67;

        system.update(world, deltaTime);

        expect(system.updateCalls).toBe(1);
        expect(system.lastWorld).toBe(world);
        expect(system.lastDeltaTime).toBe(deltaTime);
    });

    test('should call update multiple times correctly', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        system.update(world, 16.67);
        system.update(world, 33.33);
        system.update(world, 8.33);

        expect(system.updateCalls).toBe(3);
        expect(system.lastDeltaTime).toBe(8.33);
    });

    test('should handle zero deltaTime', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        system.update(world, 0);

        expect(system.updateCalls).toBe(1);
        expect(system.lastDeltaTime).toBe(0);
    });

    test('should handle negative deltaTime', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        system.update(world, -10);

        expect(system.updateCalls).toBe(1);
        expect(system.lastDeltaTime).toBe(-10);
    });

    test('should handle very large deltaTime values', () => {
        const world = new World();
        const system = new MinimalTestSystem();
        const largeDelta = 1000000;

        system.update(world, largeDelta);

        expect(system.updateCalls).toBe(1);
        expect(system.lastDeltaTime).toBe(largeDelta);
    });
});

describe('BaseSystem.initialize()', () => {
    test('should call initialize when defined', () => {
        const world = new World();
        const system = new SystemWithInitializeShutdown();

        expect(system.initialize).toBeDefined();
        system.initialize?.(world);

        expect(system.initializeCalls).toBe(1);
        expect(system.lastInitWorld).toBe(world);
    });

    test('should not throw when initialize is not overridden', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        expect(() => system.initialize?.(world)).not.toThrow();
    });

    test('should execute default initialize implementation', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        // Explicitly call the base implementation
        if (system.initialize) {
            system.initialize(world);
        }

        // Should not throw and should complete successfully
        expect(system.updateCalls).toBe(0);
    });

    test('should call base class initialize via super', () => {
        const world = new World();
        const system = new SystemWithBaseLifecycle();

        system.initialize(world);

        expect(system.initCalled).toBe(true);
    });

    test('should call initialize multiple times if called explicitly', () => {
        const world = new World();
        const system = new SystemWithInitializeShutdown();

        system.initialize?.(world);
        system.initialize?.(world);
        system.initialize?.(world);

        expect(system.initializeCalls).toBe(3);
    });

    test('should receive correct world instance in initialize', () => {
        const world1 = new World();
        const world2 = new World();
        const system = new SystemWithInitializeShutdown();

        system.initialize?.(world1);
        expect(system.lastInitWorld).toBe(world1);

        system.initialize?.(world2);
        expect(system.lastInitWorld).toBe(world2);
    });
});

describe('BaseSystem.shutdown()', () => {
    test('should call shutdown when defined', () => {
        const world = new World();
        const system = new SystemWithInitializeShutdown();

        expect(system.shutdown).toBeDefined();
        system.shutdown?.(world);

        expect(system.shutdownCalls).toBe(1);
        expect(system.lastShutdownWorld).toBe(world);
    });

    test('should not throw when shutdown is not overridden', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        expect(() => system.shutdown?.(world)).not.toThrow();
    });

    test('should execute default shutdown implementation', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        // Explicitly call the base implementation
        if (system.shutdown) {
            system.shutdown(world);
        }

        // Should not throw and should complete successfully
        expect(system.updateCalls).toBe(0);
    });

    test('should call base class shutdown via super', () => {
        const world = new World();
        const system = new SystemWithBaseLifecycle();

        system.shutdown(world);

        expect(system.shutdownCalled).toBe(true);
    });

    test('should call shutdown multiple times if called explicitly', () => {
        const world = new World();
        const system = new SystemWithInitializeShutdown();

        system.shutdown?.(world);
        system.shutdown?.(world);

        expect(system.shutdownCalls).toBe(2);
    });

    test('should receive correct world instance in shutdown', () => {
        const world1 = new World();
        const world2 = new World();
        const system = new SystemWithInitializeShutdown();

        system.shutdown?.(world1);
        expect(system.lastShutdownWorld).toBe(world1);

        system.shutdown?.(world2);
        expect(system.lastShutdownWorld).toBe(world2);
    });
});

describe('BaseSystem Lifecycle', () => {
    test('should handle complete lifecycle: initialize -> update -> shutdown', () => {
        const world = new World();
        const system = new SystemWithInitializeShutdown();

        system.initialize?.(world);
        expect(system.initializeCalls).toBe(1);

        system.update(world, 16.67);
        system.update(world, 16.67);
        expect(system.updateCalls).toBe(2);

        system.shutdown?.(world);
        expect(system.shutdownCalls).toBe(1);
    });

    test('should handle update without initialize or shutdown', () => {
        const world = new World();
        const system = new MinimalTestSystem();

        expect(() => {
            system.update(world, 16.67);
        }).not.toThrow();

        expect(system.updateCalls).toBe(1);
    });

    test('should maintain independent state across multiple systems', () => {
        const world = new World();
        const system1 = new MinimalTestSystem();
        const system2 = new MinimalTestSystem();

        system1.update(world, 10);
        system2.update(world, 20);

        expect(system1.updateCalls).toBe(1);
        expect(system1.lastDeltaTime).toBe(10);
        expect(system2.updateCalls).toBe(1);
        expect(system2.lastDeltaTime).toBe(20);
    });
});

describe('BaseSystem.queryEntities()', () => {
    test('should query entities with multiple component types', () => {
        const world = new World();
        const system = new QueryTestSystem();

        const entity1 = world.createEntity();
        const entity2 = world.createEntity();
        const entity3 = world.createEntity();

        const position1: TestPositionComponent = {
            type: 'test-position',
            x: 10,
            y: 20,
        };
        const position2: TestPositionComponent = {
            type: 'test-position',
            x: 30,
            y: 40,
        };
        const position3: TestPositionComponent = {
            type: 'test-position',
            x: 50,
            y: 60,
        };
        const velocity1: TestVelocityComponent = {
            type: 'test-velocity',
            dx: 1,
            dy: 2,
        };
        const velocity2: TestVelocityComponent = {
            type: 'test-velocity',
            dx: 3,
            dy: 4,
        };

        world.addComponent(entity1, position1);
        world.addComponent(entity1, velocity1);
        world.addComponent(entity2, position2);
        world.addComponent(entity2, velocity2);
        world.addComponent(entity3, position3);

        system.update(world, 0);

        expect(system.processedEntities.length).toBe(2);
        expect(system.processedEntities).toContain(entity1);
        expect(system.processedEntities).toContain(entity2);
        expect(system.processedEntities).not.toContain(entity3);
    });

    test('should return empty array when no entities match query', () => {
        const world = new World();
        const system = new QueryTestSystem();

        const entity = world.createEntity();
        const health: TestHealthComponent = { type: 'test-health', hp: 100 };
        world.addComponent(entity, health);

        system.update(world, 0);

        expect(system.processedEntities.length).toBe(0);
    });

    test('should query entities with single component type', () => {
        const world = new World();
        const system = new SingleComponentQuerySystem();

        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        const health1: TestHealthComponent = { type: 'test-health', hp: 100 };
        const health2: TestHealthComponent = { type: 'test-health', hp: 50 };

        world.addComponent(entity1, health1);
        world.addComponent(entity2, health2);

        system.update(world, 0);

        expect(system.queriedEntities.length).toBe(2);
        expect(system.queriedEntities).toContain(entity1);
        expect(system.queriedEntities).toContain(entity2);
    });

    test('should handle query with three component types', () => {
        const world = new World();
        const system = new MultiComponentQuerySystem();

        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        const position1: TestPositionComponent = {
            type: 'test-position',
            x: 10,
            y: 20,
        };
        const velocity1: TestVelocityComponent = {
            type: 'test-velocity',
            dx: 1,
            dy: 2,
        };
        const health1: TestHealthComponent = { type: 'test-health', hp: 100 };

        world.addComponent(entity1, position1);
        world.addComponent(entity1, velocity1);
        world.addComponent(entity1, health1);
        world.addComponent(entity2, position1);

        system.update(world, 0);

        expect(system.queriedEntities.length).toBe(1);
        expect(system.queriedEntities).toContain(entity1);
        expect(system.queriedEntities).not.toContain(entity2);
    });

    test('should update query results when components are added', () => {
        const world = new World();
        const system = new QueryTestSystem();

        const entity = world.createEntity();
        const position: TestPositionComponent = {
            type: 'test-position',
            x: 10,
            y: 20,
        };

        world.addComponent(entity, position);
        system.update(world, 0);
        expect(system.processedEntities.length).toBe(0);

        const velocity: TestVelocityComponent = {
            type: 'test-velocity',
            dx: 1,
            dy: 2,
        };
        world.addComponent(entity, velocity);
        system.update(world, 0);
        expect(system.processedEntities.length).toBe(1);
    });

    test('should update query results when components are removed', () => {
        const world = new World();
        const system = new QueryTestSystem();

        const entity = world.createEntity();
        const position: TestPositionComponent = {
            type: 'test-position',
            x: 10,
            y: 20,
        };
        const velocity: TestVelocityComponent = {
            type: 'test-velocity',
            dx: 1,
            dy: 2,
        };

        world.addComponent(entity, position);
        world.addComponent(entity, velocity);
        system.update(world, 0);
        expect(system.processedEntities.length).toBe(1);

        world.removeComponent(entity, 'test-velocity');
        system.update(world, 0);
        expect(system.processedEntities.length).toBe(0);
    });
});

describe('BaseSystem.queryWithComponents()', () => {
    test('should iterate over entities with callback', () => {
        const world = new World();
        const system = new QueryTestSystem();

        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        const position1: TestPositionComponent = {
            type: 'test-position',
            x: 10,
            y: 20,
        };
        const position2: TestPositionComponent = {
            type: 'test-position',
            x: 30,
            y: 40,
        };

        world.addComponent(entity1, position1);
        world.addComponent(entity2, position2);

        system.update(world, 0);

        expect(system.processedComponents.length).toBe(2);
        expect(system.processedComponents[0]?.x).toBe(10);
        expect(system.processedComponents[0]?.y).toBe(20);
        expect(system.processedComponents[1]?.x).toBe(30);
        expect(system.processedComponents[1]?.y).toBe(40);
    });

    test('should receive entity ID and component in callback', () => {
        const world = new World();
        const receivedEntityIds: number[] = [];
        const receivedComponents: TestPositionComponent[] = [];

        class CallbackTestSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'CallbackTestSystem';

            update(world: World, _deltaTime: number): void {
                this.queryWithComponents<TestPositionComponent>(
                    world,
                    'test-position',
                    (entityId, component) => {
                        receivedEntityIds.push(entityId);
                        receivedComponents.push(component);
                    }
                );
            }
        }

        const system = new CallbackTestSystem();
        const entity = world.createEntity();
        const position: TestPositionComponent = {
            type: 'test-position',
            x: 100,
            y: 200,
        };

        world.addComponent(entity, position);
        system.update(world, 0);

        expect(receivedEntityIds.length).toBe(1);
        expect(receivedEntityIds[0]).toBe(entity);
        expect(receivedComponents[0]).toEqual(position);
    });

    test('should not call callback when no entities match', () => {
        const world = new World();
        let callbackCalls = 0;

        class NoMatchSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'NoMatchSystem';

            update(world: World, _deltaTime: number): void {
                this.queryWithComponents<TestPositionComponent>(
                    world,
                    'test-position',
                    (_entityId, _component) => {
                        callbackCalls++;
                    }
                );
            }
        }

        const system = new NoMatchSystem();
        system.update(world, 0);

        expect(callbackCalls).toBe(0);
    });

    test('should allow component mutation in callback', () => {
        const world = new World();

        class MutationSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'MutationSystem';

            update(world: World, _deltaTime: number): void {
                this.queryWithComponents<TestPositionComponent>(
                    world,
                    'test-position',
                    (_entityId, component) => {
                        component.x += 10;
                        component.y += 20;
                    }
                );
            }
        }

        const system = new MutationSystem();
        const entity = world.createEntity();
        const position: TestPositionComponent = {
            type: 'test-position',
            x: 5,
            y: 10,
        };

        world.addComponent(entity, position);
        system.update(world, 0);

        const updatedPosition = world.getComponent<TestPositionComponent>(
            entity,
            'test-position'
        );
        expect(updatedPosition?.x).toBe(15);
        expect(updatedPosition?.y).toBe(30);
    });
});

describe('BaseSystem Priority and Dependencies', () => {
    test('should maintain priority value', () => {
        const system1 = new MinimalTestSystem();
        const system2 = new SystemWithInitializeShutdown();
        const system3 = new SystemWithDependencies();

        expect(system1.priority).toBe(5);
        expect(system2.priority).toBe(1);
        expect(system3.priority).toBe(10);
    });

    test('should maintain system name', () => {
        const system1 = new MinimalTestSystem();
        const system2 = new SystemWithDependencies();

        expect(system1.name).toBe('MinimalTestSystem');
        expect(system2.name).toBe('SystemWithDependencies');
    });

    test('should store multiple dependencies', () => {
        const system = new SystemWithDependencies();

        expect(system.dependencies).toBeDefined();
        expect(system.dependencies?.length).toBe(2);
        expect(system.dependencies?.[0]).toBe('PhysicsSystem');
        expect(system.dependencies?.[1]).toBe('RenderSystem');
    });

    test('should allow modifying dependencies after construction', () => {
        const system = new MinimalTestSystem();

        expect(system.dependencies?.length).toBe(0);

        system.dependencies = ['NewDependency'];
        expect(system.dependencies?.length).toBe(1);
        expect(system.dependencies?.[0]).toBe('NewDependency');
    });
});

describe('BaseSystem Edge Cases', () => {
    test('should handle multiple systems querying same entities', () => {
        const world = new World();
        const system1 = new QueryTestSystem();
        const system2 = new QueryTestSystem();

        const entity = world.createEntity();
        const position: TestPositionComponent = {
            type: 'test-position',
            x: 10,
            y: 20,
        };
        const velocity: TestVelocityComponent = {
            type: 'test-velocity',
            dx: 1,
            dy: 2,
        };

        world.addComponent(entity, position);
        world.addComponent(entity, velocity);

        system1.update(world, 0);
        system2.update(world, 0);

        expect(system1.processedEntities).toEqual(system2.processedEntities);
        expect(system1.processedComponents.length).toBe(
            system2.processedComponents.length
        );
    });

    test('should handle entity destruction during system iteration', () => {
        const world = new World();

        class DestructionSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'DestructionSystem';
            destroyedCount = 0;

            update(world: World, _deltaTime: number): void {
                const entities = this.queryEntities(world, 'test-health');
                for (const entityId of entities) {
                    const health = world.getComponent<TestHealthComponent>(
                        entityId,
                        'test-health'
                    );
                    if (health && health.hp <= 0) {
                        world.destroyEntity(entityId);
                        this.destroyedCount++;
                    }
                }
            }
        }

        const system = new DestructionSystem();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        world.addComponent(entity1, { type: 'test-health', hp: 0 });
        world.addComponent(entity2, { type: 'test-health', hp: 100 });

        system.update(world, 0);

        expect(system.destroyedCount).toBe(1);
        expect(world.getEntityCount()).toBe(1);
    });

    test('should handle empty world queries', () => {
        const world = new World();
        const system = new QueryTestSystem();

        system.update(world, 0);

        expect(system.processedEntities.length).toBe(0);
        expect(system.processedComponents.length).toBe(0);
    });

    test('should handle systems with no state', () => {
        class StatelessSystem extends BaseSystem {
            readonly priority = 1;
            readonly name = 'StatelessSystem';

            update(_world: World, _deltaTime: number): void {
                // Stateless operation
            }
        }

        const world = new World();
        const system = new StatelessSystem();

        expect(() => {
            system.update(world, 16.67);
            system.update(world, 16.67);
        }).not.toThrow();
    });
});
