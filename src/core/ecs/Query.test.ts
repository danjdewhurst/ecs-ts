import { describe, expect, test } from 'bun:test';
import type { Component } from './Component.ts';
import { World } from './World.ts';

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
    hp: number;
    maxHp: number;
}

describe('Query', () => {
    describe('getEntities', () => {
        test('should return empty array for query with no matching entities', () => {
            // Arrange
            const world = new World();
            const query = world.query<PositionComponent>('position');

            // Act
            const entities = query.getEntities();

            // Assert
            expect(entities).toEqual([]);
            expect(entities.length).toBe(0);
        });

        test('should return array of entity IDs with matching component', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            const position1: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            const position2: PositionComponent = {
                type: 'position',
                x: 30,
                y: 40,
            };

            world.addComponent(entity1, position1);
            world.addComponent(entity2, position2);

            // Act
            const query = world.query<PositionComponent>('position');
            const entities = query.getEntities();

            // Assert
            expect(entities).toContain(entity1);
            expect(entities).toContain(entity2);
            expect(entities).not.toContain(entity3);
            expect(entities.length).toBe(2);
        });

        test('should return copy of entities array', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity, position);

            // Act
            const query = world.query<PositionComponent>('position');
            const entities1 = query.getEntities();
            const entities2 = query.getEntities();

            // Assert
            expect(entities1).toEqual(entities2);
            expect(entities1).not.toBe(entities2);
        });
    });

    describe('getComponents', () => {
        test('should return empty array for query with no matching entities', () => {
            // Arrange
            const world = new World();
            const query = world.query<PositionComponent>('position');

            // Act
            const components = query.getComponents();

            // Assert
            expect(components).toEqual([]);
            expect(components.length).toBe(0);
        });

        test('should return array of entityId and component pairs', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position1: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            const position2: PositionComponent = {
                type: 'position',
                x: 30,
                y: 40,
            };

            world.addComponent(entity1, position1);
            world.addComponent(entity2, position2);

            // Act
            const query = world.query<PositionComponent>('position');
            const components = query.getComponents();

            // Assert
            expect(components.length).toBe(2);
            expect(components).toContainEqual({
                entityId: entity1,
                component: position1,
            });
            expect(components).toContainEqual({
                entityId: entity2,
                component: position2,
            });
        });

        test('should handle entities with missing components gracefully', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const _entity2 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity1, position);

            const query = world.query<PositionComponent>('position');

            // Remove component after query creation
            world.removeComponent(entity1, 'position');

            // Act
            const components = query.getComponents();

            // Assert
            expect(components.length).toBe(0);
        });

        test('should return components with correct structure', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            const health: HealthComponent = {
                type: 'health',
                hp: 100,
                maxHp: 100,
            };
            world.addComponent(entity, health);

            // Act
            const query = world.query<HealthComponent>('health');
            const components = query.getComponents();

            // Assert
            expect(components.length).toBe(1);
            expect(components[0]).toHaveProperty('entityId');
            expect(components[0]).toHaveProperty('component');
            expect(components[0]?.entityId).toBe(entity);
            expect(components[0]?.component).toEqual(health);
        });
    });

    describe('forEach', () => {
        test('should not call callback for empty query', () => {
            // Arrange
            const world = new World();
            const query = world.query<PositionComponent>('position');
            let callCount = 0;

            // Act
            query.forEach(() => {
                callCount++;
            });

            // Assert
            expect(callCount).toBe(0);
        });

        test('should call callback for each entity with component', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position1: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            const position2: PositionComponent = {
                type: 'position',
                x: 30,
                y: 40,
            };

            world.addComponent(entity1, position1);
            world.addComponent(entity2, position2);

            const query = world.query<PositionComponent>('position');
            const calledWith: Array<{
                entityId: number;
                component: PositionComponent;
            }> = [];

            // Act
            query.forEach((entityId, component) => {
                calledWith.push({ entityId, component });
            });

            // Assert
            expect(calledWith.length).toBe(2);
            expect(calledWith).toContainEqual({
                entityId: entity1,
                component: position1,
            });
            expect(calledWith).toContainEqual({
                entityId: entity2,
                component: position2,
            });
        });

        test('should allow mutation of component data in callback', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity, position);

            const query = world.query<PositionComponent>('position');

            // Act
            query.forEach((_entityId, component) => {
                component.x += 5;
                component.y += 10;
            });

            // Assert
            const updated = world.getComponent<PositionComponent>(
                entity,
                'position'
            );
            expect(updated?.x).toBe(15);
            expect(updated?.y).toBe(30);
        });

        test('should skip entities with missing components', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity1, position);
            world.addComponent(entity2, position);

            const query = world.query<PositionComponent>('position');

            // Remove component from entity1
            world.removeComponent(entity1, 'position');

            let callCount = 0;

            // Act
            query.forEach((entityId) => {
                callCount++;
                expect(entityId).toBe(entity2);
            });

            // Assert
            expect(callCount).toBe(1);
        });
    });

    describe('filter', () => {
        test('should return empty query when filtering empty query', () => {
            // Arrange
            const world = new World();
            const query = world.query<PositionComponent>('position');

            // Act
            const filtered = query.filter(() => true);

            // Assert
            expect(filtered.count()).toBe(0);
            expect(filtered.isEmpty()).toBe(true);
        });

        test('should return new query with entities matching predicate', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            const position1: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            const position2: PositionComponent = {
                type: 'position',
                x: 30,
                y: 40,
            };
            const position3: PositionComponent = {
                type: 'position',
                x: 5,
                y: 10,
            };

            world.addComponent(entity1, position1);
            world.addComponent(entity2, position2);
            world.addComponent(entity3, position3);

            const query = world.query<PositionComponent>('position');

            // Act - Filter entities where x > 8
            const filtered = query.filter(
                (_entityId, component) => component.x > 8
            );

            // Assert
            const entities = filtered.getEntities();
            expect(entities).toContain(entity1);
            expect(entities).toContain(entity2);
            expect(entities).not.toContain(entity3);
            expect(entities.length).toBe(2);
        });

        test('should create independent query instance', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position1: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            const position2: PositionComponent = {
                type: 'position',
                x: 30,
                y: 40,
            };

            world.addComponent(entity1, position1);
            world.addComponent(entity2, position2);

            const query = world.query<PositionComponent>('position');

            // Act
            const filtered = query.filter(
                (_entityId, component) => component.x > 20
            );

            // Assert
            expect(query.count()).toBe(2);
            expect(filtered.count()).toBe(1);
            expect(query).not.toBe(filtered);
        });

        test('should filter based on entity ID', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };

            world.addComponent(entity1, position);
            world.addComponent(entity2, position);
            world.addComponent(entity3, position);

            const query = world.query<PositionComponent>('position');

            // Act - Filter only specific entity
            const filtered = query.filter((entityId) => entityId === entity2);

            // Assert
            const entities = filtered.getEntities();
            expect(entities).toEqual([entity2]);
            expect(entities.length).toBe(1);
        });

        test('should handle complex predicate logic', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();
            const entity4 = world.createEntity();

            world.addComponent(entity1, {
                type: 'health',
                hp: 100,
                maxHp: 100,
            } as HealthComponent);
            world.addComponent(entity2, {
                type: 'health',
                hp: 50,
                maxHp: 100,
            } as HealthComponent);
            world.addComponent(entity3, {
                type: 'health',
                hp: 0,
                maxHp: 100,
            } as HealthComponent);
            world.addComponent(entity4, {
                type: 'health',
                hp: 75,
                maxHp: 150,
            } as HealthComponent);

            const query = world.query<HealthComponent>('health');

            // Act - Filter entities with hp > 0 and hp < maxHp
            const filtered = query.filter(
                (_entityId, component) =>
                    component.hp > 0 && component.hp < component.maxHp
            );

            // Assert
            const entities = filtered.getEntities();
            expect(entities).toContain(entity2);
            expect(entities).toContain(entity4);
            expect(entities).not.toContain(entity1);
            expect(entities).not.toContain(entity3);
            expect(entities.length).toBe(2);
        });

        test('should skip entities with missing components during filtering', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position1: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            const position2: PositionComponent = {
                type: 'position',
                x: 30,
                y: 40,
            };

            world.addComponent(entity1, position1);
            world.addComponent(entity2, position2);

            const query = world.query<PositionComponent>('position');

            // Remove component from entity1 before filtering
            world.removeComponent(entity1, 'position');

            // Act
            const filtered = query.filter(() => true);

            // Assert
            expect(filtered.count()).toBe(1);
            expect(filtered.getEntities()).toEqual([entity2]);
        });

        test('should chain multiple filters', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();
            const entity4 = world.createEntity();

            world.addComponent(entity1, {
                type: 'position',
                x: 5,
                y: 5,
            } as PositionComponent);
            world.addComponent(entity2, {
                type: 'position',
                x: 15,
                y: 15,
            } as PositionComponent);
            world.addComponent(entity3, {
                type: 'position',
                x: 25,
                y: 25,
            } as PositionComponent);
            world.addComponent(entity4, {
                type: 'position',
                x: 35,
                y: 35,
            } as PositionComponent);

            const query = world.query<PositionComponent>('position');

            // Act - Chain filters
            const filtered = query
                .filter((_entityId, component) => component.x > 10)
                .filter((_entityId, component) => component.y < 30);

            // Assert
            const entities = filtered.getEntities();
            expect(entities).toContain(entity2);
            expect(entities).toContain(entity3);
            expect(entities).not.toContain(entity1);
            expect(entities).not.toContain(entity4);
            expect(entities.length).toBe(2);
        });
    });

    describe('count', () => {
        test('should return 0 for empty query', () => {
            // Arrange
            const world = new World();
            const query = world.query<PositionComponent>('position');

            // Act
            const count = query.count();

            // Assert
            expect(count).toBe(0);
        });

        test('should return correct count of entities', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };

            world.addComponent(entity1, position);
            world.addComponent(entity2, position);
            world.addComponent(entity3, position);

            // Act
            const query = world.query<PositionComponent>('position');
            const count = query.count();

            // Assert
            expect(count).toBe(3);
        });

        test('should return count of 1 for single entity', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity, position);

            // Act
            const query = world.query<PositionComponent>('position');
            const count = query.count();

            // Assert
            expect(count).toBe(1);
        });

        test('should reflect entities in query even if components are removed', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity1, position);
            world.addComponent(entity2, position);

            const query = world.query<PositionComponent>('position');

            // Act - Count is based on initial query snapshot
            const initialCount = query.count();
            world.removeComponent(entity1, 'position');
            const afterRemovalCount = query.count();

            // Assert - Query maintains snapshot of entities at creation time
            expect(initialCount).toBe(2);
            expect(afterRemovalCount).toBe(2);
        });
    });

    describe('isEmpty', () => {
        test('should return true for empty query', () => {
            // Arrange
            const world = new World();
            const query = world.query<PositionComponent>('position');

            // Act
            const empty = query.isEmpty();

            // Assert
            expect(empty).toBe(true);
        });

        test('should return false for query with entities', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity, position);

            // Act
            const query = world.query<PositionComponent>('position');
            const empty = query.isEmpty();

            // Assert
            expect(empty).toBe(false);
        });

        test('should return false for query with multiple entities', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity1, position);
            world.addComponent(entity2, position);

            // Act
            const query = world.query<PositionComponent>('position');
            const empty = query.isEmpty();

            // Assert
            expect(empty).toBe(false);
        });

        test('should return true for filtered query with no matches', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity, position);

            const query = world.query<PositionComponent>('position');

            // Act
            const filtered = query.filter(
                (_entityId, component) => component.x > 100
            );
            const empty = filtered.isEmpty();

            // Assert
            expect(empty).toBe(true);
        });
    });

    describe('Query with World integration', () => {
        test('should work with multiple component types in same world', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            world.addComponent(entity1, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);
            world.addComponent(entity2, {
                type: 'velocity',
                dx: 1,
                dy: 2,
            } as VelocityComponent);
            world.addComponent(entity3, {
                type: 'position',
                x: 30,
                y: 40,
            } as PositionComponent);
            world.addComponent(entity3, {
                type: 'velocity',
                dx: 3,
                dy: 4,
            } as VelocityComponent);

            // Act
            const positionQuery = world.query<PositionComponent>('position');
            const velocityQuery = world.query<VelocityComponent>('velocity');

            // Assert
            expect(positionQuery.count()).toBe(2);
            expect(velocityQuery.count()).toBe(2);
            expect(positionQuery.getEntities()).toContain(entity1);
            expect(positionQuery.getEntities()).toContain(entity3);
            expect(velocityQuery.getEntities()).toContain(entity2);
            expect(velocityQuery.getEntities()).toContain(entity3);
        });

        test('should query non-existent component type', () => {
            // Arrange
            const world = new World();
            const entity = world.createEntity();
            world.addComponent(entity, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);

            // Act
            const query = world.query<VelocityComponent>('velocity');

            // Assert
            expect(query.isEmpty()).toBe(true);
            expect(query.count()).toBe(0);
            expect(query.getEntities()).toEqual([]);
            expect(query.getComponents()).toEqual([]);
        });

        test('should handle entity destruction during query iteration', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity1, position);
            world.addComponent(entity2, position);
            world.addComponent(entity3, position);

            const query = world.query<PositionComponent>('position');

            // Act - Destroy entity during forEach
            const processedEntities: number[] = [];
            query.forEach((entityId) => {
                processedEntities.push(entityId);
                if (entityId === entity2) {
                    world.destroyEntity(entity2);
                }
            });

            // Assert - All entities in snapshot are attempted
            expect(processedEntities.length).toBe(3);
            expect(world.hasComponent(entity2, 'position')).toBe(false);
        });

        test('should support complex query workflows', () => {
            // Arrange
            const world = new World();
            const entities: number[] = [];

            for (let i = 0; i < 10; i++) {
                const entity = world.createEntity();
                entities.push(entity);
                world.addComponent(entity, {
                    type: 'health',
                    hp: i * 10,
                    maxHp: 100,
                } as HealthComponent);
            }

            // Act - Complex query workflow
            const query = world.query<HealthComponent>('health');
            const damagedEntities = query.filter(
                (_, c) => c.hp > 0 && c.hp < c.maxHp
            );
            const criticalEntities = damagedEntities.filter(
                (_, c) => c.hp < 30
            );

            let healedCount = 0;
            criticalEntities.forEach((_entityId, component) => {
                component.hp = Math.min(component.hp + 20, component.maxHp);
                healedCount++;
            });

            // Assert
            expect(query.count()).toBe(10);
            expect(damagedEntities.count()).toBe(9); // hp 10-90 (excludes hp=0)
            expect(criticalEntities.count()).toBe(2); // hp 10, 20 (< 30 and > 0)
            expect(healedCount).toBe(2);

            // Verify healing worked
            const entity1 = entities[1];
            const health1 =
                entity1 !== undefined
                    ? world.getComponent<HealthComponent>(entity1, 'health')
                    : undefined;
            expect(health1?.hp).toBe(30);

            const entity2 = entities[2];
            const health2 =
                entity2 !== undefined
                    ? world.getComponent<HealthComponent>(entity2, 'health')
                    : undefined;
            expect(health2?.hp).toBe(40);
        });
    });

    describe('Query edge cases', () => {
        test('should handle query on world with destroyed entities', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();
            const entity3 = world.createEntity();

            const position: PositionComponent = {
                type: 'position',
                x: 10,
                y: 20,
            };
            world.addComponent(entity1, position);
            world.addComponent(entity2, position);
            world.addComponent(entity3, position);

            world.destroyEntity(entity2);

            // Act
            const query = world.query<PositionComponent>('position');

            // Assert
            expect(query.count()).toBe(2);
            expect(query.getEntities()).toContain(entity1);
            expect(query.getEntities()).not.toContain(entity2);
            expect(query.getEntities()).toContain(entity3);
        });

        test('should handle empty filter that matches all entities', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            world.addComponent(entity1, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);
            world.addComponent(entity2, {
                type: 'position',
                x: 30,
                y: 40,
            } as PositionComponent);

            const query = world.query<PositionComponent>('position');

            // Act
            const filtered = query.filter(() => true);

            // Assert
            expect(filtered.count()).toBe(2);
            expect(filtered.getEntities()).toEqual(query.getEntities());
        });

        test('should handle filter that matches no entities', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            world.addComponent(entity1, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);
            world.addComponent(entity2, {
                type: 'position',
                x: 30,
                y: 40,
            } as PositionComponent);

            const query = world.query<PositionComponent>('position');

            // Act
            const filtered = query.filter(() => false);

            // Assert
            expect(filtered.isEmpty()).toBe(true);
            expect(filtered.count()).toBe(0);
            expect(filtered.getEntities()).toEqual([]);
        });

        test('should maintain query snapshot semantics', () => {
            // Arrange
            const world = new World();
            const entity1 = world.createEntity();
            world.addComponent(entity1, {
                type: 'position',
                x: 10,
                y: 20,
            } as PositionComponent);

            const query = world.query<PositionComponent>('position');
            expect(query.count()).toBe(1);

            // Act - Add more entities after query creation
            const entity2 = world.createEntity();
            world.addComponent(entity2, {
                type: 'position',
                x: 30,
                y: 40,
            } as PositionComponent);

            // Assert - Query maintains snapshot from creation time
            expect(query.count()).toBe(1);
            expect(query.getEntities()).toEqual([entity1]);

            // New query sees updated state
            const newQuery = world.query<PositionComponent>('position');
            expect(newQuery.count()).toBe(2);
        });
    });
});
