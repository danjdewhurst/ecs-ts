import { describe, expect, test, beforeEach } from 'bun:test';
import {
    World,
    createTransformComponent,
    createVector3,
    createQuaternion,
    TransformSystem,
    TransformHierarchy,
    TransformMath,
    type TransformComponent,
} from '../src/index.ts';

describe('TransformComponent', () => {
    test('should create transform with default values', () => {
        const transform = createTransformComponent();

        expect(transform.type).toBe('transform');
        expect(transform.localPosition).toEqual({ x: 0, y: 0, z: 0 });
        expect(transform.localRotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
        expect(transform.localScale).toEqual({ x: 1, y: 1, z: 1 });
        expect(transform.parent).toBeNull();
        expect(transform.children.size).toBe(0);
        expect(transform.dirty).toBe(true);
    });

    test('should create transform with custom values', () => {
        const position = createVector3(1, 2, 3);
        const rotation = createQuaternion(0, 0, 0, 1);
        const scale = createVector3(2, 2, 2);

        const transform = createTransformComponent(position, rotation, scale);

        expect(transform.localPosition).toEqual({ x: 1, y: 2, z: 3 });
        expect(transform.localRotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
        expect(transform.localScale).toEqual({ x: 2, y: 2, z: 2 });
    });

    test('should not mutate input vectors', () => {
        const position = createVector3(1, 2, 3);
        const rotation = createQuaternion(0, 0, 0, 1);
        const scale = createVector3(2, 2, 2);

        const transform = createTransformComponent(position, rotation, scale);

        position.x = 999;
        rotation.x = 999;
        scale.x = 999;

        expect(transform.localPosition.x).toBe(1);
        expect(transform.localRotation.x).toBe(0);
        expect(transform.localScale.x).toBe(2);
    });
});

describe('TransformHierarchy', () => {
    let world: World;
    let hierarchy: TransformHierarchy;

    beforeEach(() => {
        world = new World();
        hierarchy = new TransformHierarchy(world);
    });

    describe('Parent-Child Relationships', () => {
        test('should set parent-child relationship', () => {
            const parent = world.createEntity();
            const child = world.createEntity();

            world.addComponent(parent, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            hierarchy.addRoot(parent);

            hierarchy.setParent(child, parent);

            expect(hierarchy.getParent(child)).toBe(parent);
            expect(hierarchy.getChildren(parent).has(child)).toBe(true);
        });

        test('should detach from parent', () => {
            const parent = world.createEntity();
            const child = world.createEntity();

            world.addComponent(parent, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            hierarchy.addRoot(parent);

            hierarchy.setParent(child, parent);
            hierarchy.detachFromParent(child);

            expect(hierarchy.getParent(child)).toBeNull();
            expect(hierarchy.getChildren(parent).has(child)).toBe(false);
        });

        test('should handle multiple children', () => {
            const parent = world.createEntity();
            const child1 = world.createEntity();
            const child2 = world.createEntity();
            const child3 = world.createEntity();

            world.addComponent(parent, createTransformComponent());
            world.addComponent(child1, createTransformComponent());
            world.addComponent(child2, createTransformComponent());
            world.addComponent(child3, createTransformComponent());
            hierarchy.addRoot(parent);

            hierarchy.setParent(child1, parent);
            hierarchy.setParent(child2, parent);
            hierarchy.setParent(child3, parent);

            const children = hierarchy.getChildren(parent);
            expect(children.size).toBe(3);
            expect(children.has(child1)).toBe(true);
            expect(children.has(child2)).toBe(true);
            expect(children.has(child3)).toBe(true);
        });

        test('should prevent cycle creation', () => {
            const entity1 = world.createEntity();
            const entity2 = world.createEntity();

            world.addComponent(entity1, createTransformComponent());
            world.addComponent(entity2, createTransformComponent());
            hierarchy.addRoot(entity1);

            hierarchy.setParent(entity2, entity1);

            expect(() => {
                hierarchy.setParent(entity1, entity2);
            }).toThrow('would create a cycle');
        });

        test('should prevent self-parenting', () => {
            const entity = world.createEntity();
            world.addComponent(entity, createTransformComponent());
            hierarchy.addRoot(entity);

            expect(() => {
                hierarchy.setParent(entity, entity);
            }).toThrow('would create a cycle');
        });

        test('should reparent entity', () => {
            const parent1 = world.createEntity();
            const parent2 = world.createEntity();
            const child = world.createEntity();

            world.addComponent(parent1, createTransformComponent());
            world.addComponent(parent2, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            hierarchy.addRoot(parent1);
            hierarchy.addRoot(parent2);

            hierarchy.setParent(child, parent1);
            hierarchy.setParent(child, parent2);

            expect(hierarchy.getParent(child)).toBe(parent2);
            expect(hierarchy.getChildren(parent1).has(child)).toBe(false);
            expect(hierarchy.getChildren(parent2).has(child)).toBe(true);
        });
    });

    describe('Hierarchy Queries', () => {
        test('should get root entity', () => {
            const root = world.createEntity();
            const child = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child, root);
            hierarchy.setParent(grandchild, child);

            expect(hierarchy.getRoot(grandchild)).toBe(root);
            expect(hierarchy.getRoot(child)).toBe(root);
            expect(hierarchy.getRoot(root)).toBe(root);
        });

        test('should get all ancestors', () => {
            const root = world.createEntity();
            const child = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child, root);
            hierarchy.setParent(grandchild, child);

            const ancestors = hierarchy.getAncestors(grandchild);
            expect(ancestors).toEqual([child, root]);
        });

        test('should get all descendants depth-first', () => {
            const root = world.createEntity();
            const child1 = world.createEntity();
            const child2 = world.createEntity();
            const grandchild1 = world.createEntity();
            const grandchild2 = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child1, createTransformComponent());
            world.addComponent(child2, createTransformComponent());
            world.addComponent(grandchild1, createTransformComponent());
            world.addComponent(grandchild2, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child1, root);
            hierarchy.setParent(child2, root);
            hierarchy.setParent(grandchild1, child1);
            hierarchy.setParent(grandchild2, child2);

            const descendants = hierarchy.getDescendants(root, { depthFirst: true });
            expect(descendants.length).toBe(4);
            expect(descendants).toContain(child1);
            expect(descendants).toContain(child2);
            expect(descendants).toContain(grandchild1);
            expect(descendants).toContain(grandchild2);
        });

        test('should get descendants breadth-first', () => {
            const root = world.createEntity();
            const child1 = world.createEntity();
            const child2 = world.createEntity();
            const grandchild1 = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child1, createTransformComponent());
            world.addComponent(child2, createTransformComponent());
            world.addComponent(grandchild1, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child1, root);
            hierarchy.setParent(child2, root);
            hierarchy.setParent(grandchild1, child1);

            const descendants = hierarchy.getDescendants(root, { depthFirst: false });
            expect(descendants).toEqual([child1, child2, grandchild1]);
        });

        test('should respect maxDepth in getDescendants', () => {
            const root = world.createEntity();
            const child = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child, root);
            hierarchy.setParent(grandchild, child);

            const descendants = hierarchy.getDescendants(root, { maxDepth: 1 });
            expect(descendants).toEqual([child]);
        });

        test('should check ancestor relationship', () => {
            const root = world.createEntity();
            const child = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child, root);
            hierarchy.setParent(grandchild, child);

            expect(hierarchy.isAncestorOf(root, grandchild)).toBe(true);
            expect(hierarchy.isAncestorOf(child, grandchild)).toBe(true);
            expect(hierarchy.isAncestorOf(grandchild, root)).toBe(false);
        });

        test('should get siblings', () => {
            const parent = world.createEntity();
            const child1 = world.createEntity();
            const child2 = world.createEntity();
            const child3 = world.createEntity();

            world.addComponent(parent, createTransformComponent());
            world.addComponent(child1, createTransformComponent());
            world.addComponent(child2, createTransformComponent());
            world.addComponent(child3, createTransformComponent());
            hierarchy.addRoot(parent);

            hierarchy.setParent(child1, parent);
            hierarchy.setParent(child2, parent);
            hierarchy.setParent(child3, parent);

            const siblings = hierarchy.getSiblings(child1);
            expect(siblings.length).toBe(2);
            expect(siblings).toContain(child2);
            expect(siblings).toContain(child3);
        });

        test('should get depth', () => {
            const root = world.createEntity();
            const child = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child, root);
            hierarchy.setParent(grandchild, child);

            expect(hierarchy.getDepth(root)).toBe(0);
            expect(hierarchy.getDepth(child)).toBe(1);
            expect(hierarchy.getDepth(grandchild)).toBe(2);
        });
    });

    describe('Hierarchy Traversal', () => {
        test('should traverse hierarchy depth-first', () => {
            const root = world.createEntity();
            const child1 = world.createEntity();
            const child2 = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child1, createTransformComponent());
            world.addComponent(child2, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child1, root);
            hierarchy.setParent(child2, root);
            hierarchy.setParent(grandchild, child1);

            const visited: number[] = [];
            hierarchy.traverseHierarchy((entityId) => {
                visited.push(entityId);
                return undefined;
            });

            expect(visited).toContain(root);
            expect(visited).toContain(child1);
            expect(visited).toContain(child2);
            expect(visited).toContain(grandchild);
        });

        test('should stop traversal when callback returns false', () => {
            const root = world.createEntity();
            const child = world.createEntity();
            const grandchild = world.createEntity();

            world.addComponent(root, createTransformComponent());
            world.addComponent(child, createTransformComponent());
            world.addComponent(grandchild, createTransformComponent());
            hierarchy.addRoot(root);

            hierarchy.setParent(child, root);
            hierarchy.setParent(grandchild, child);

            const visited: number[] = [];
            hierarchy.traverseHierarchy((entityId) => {
                visited.push(entityId);
                if (entityId === child) {
                    return false;
                }
            });

            expect(visited).toContain(root);
            expect(visited).toContain(child);
            expect(visited).not.toContain(grandchild);
        });
    });

    describe('Error Handling', () => {
        test('should throw when setting parent on entity without transform', () => {
            const parent = world.createEntity();
            const child = world.createEntity();
            world.addComponent(parent, createTransformComponent());

            expect(() => {
                hierarchy.setParent(child, parent);
            }).toThrow('does not have a Transform component');
        });

        test('should throw when setting non-existent parent', () => {
            const child = world.createEntity();
            world.addComponent(child, createTransformComponent());

            expect(() => {
                hierarchy.setParent(child, 99999);
            }).toThrow('does not have a Transform component');
        });
    });
});

describe('TransformMath', () => {
    test('should normalize quaternion', () => {
        const q = createQuaternion(1, 1, 1, 1);
        TransformMath.normalizeQuaternion(q);

        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        expect(Math.abs(length - 1)).toBeLessThan(0.0001);
    });

    test('should handle zero-length quaternion normalization', () => {
        const q = createQuaternion(0, 0, 0, 0);
        TransformMath.normalizeQuaternion(q);

        expect(q.x).toBe(0);
        expect(q.y).toBe(0);
        expect(q.z).toBe(0);
        expect(q.w).toBe(1);
    });

    test('should calculate vector length', () => {
        const v = createVector3(3, 4, 0);
        const length = TransformMath.vectorLength(v);

        expect(length).toBe(5);
    });

    test('should normalize vector', () => {
        const v = createVector3(3, 4, 0);
        TransformMath.normalizeVector(v);

        const length = TransformMath.vectorLength(v);
        expect(Math.abs(length - 1)).toBeLessThan(0.0001);
    });

    test('should add vectors', () => {
        const a = createVector3(1, 2, 3);
        const b = createVector3(4, 5, 6);
        const result = createVector3();

        TransformMath.addVectors(result, a, b);

        expect(result).toEqual({ x: 5, y: 7, z: 9 });
    });

    test('should subtract vectors', () => {
        const a = createVector3(4, 5, 6);
        const b = createVector3(1, 2, 3);
        const result = createVector3();

        TransformMath.subtractVectors(result, a, b);

        expect(result).toEqual({ x: 3, y: 3, z: 3 });
    });

    test('should scale vector', () => {
        const v = createVector3(1, 2, 3);
        const result = createVector3();

        TransformMath.scaleVector(result, v, 2);

        expect(result).toEqual({ x: 2, y: 4, z: 6 });
    });

    test('should calculate dot product', () => {
        const a = createVector3(1, 2, 3);
        const b = createVector3(4, 5, 6);

        const dot = TransformMath.dotProduct(a, b);

        expect(dot).toBe(32);
    });

    test('should calculate cross product', () => {
        const a = createVector3(1, 0, 0);
        const b = createVector3(0, 1, 0);
        const result = createVector3();

        TransformMath.crossProduct(result, a, b);

        expect(result).toEqual({ x: 0, y: 0, z: 1 });
    });

    test('should multiply quaternions', () => {
        const q1 = createQuaternion(0, 0, 0, 1);
        const q2 = createQuaternion(0, 0, 0, 1);
        const result = createQuaternion();

        TransformMath.multiplyQuaternions(result, q1, q2);

        expect(result.w).toBeCloseTo(1, 5);
    });

    test('should set quaternion from euler angles', () => {
        const q = createQuaternion();
        TransformMath.setFromEuler(q, 0, 0, 0);

        expect(q.x).toBeCloseTo(0, 5);
        expect(q.y).toBeCloseTo(0, 5);
        expect(q.z).toBeCloseTo(0, 5);
        expect(q.w).toBeCloseTo(1, 5);
    });
});

describe('TransformSystem', () => {
    let world: World;
    let system: TransformSystem;

    beforeEach(() => {
        world = new World();
        system = new TransformSystem(world);
    });

    test('should initialize with default config', () => {
        expect(system.name).toBe('TransformSystem');
        expect(system.priority).toBe(0);
    });

    test('should use custom priority', () => {
        const customSystem = new TransformSystem(world, { priority: 10 });
        expect(customSystem.priority).toBe(10);
    });

    test('should provide access to hierarchy', () => {
        const hierarchy = system.getHierarchy();
        expect(hierarchy).toBeInstanceOf(TransformHierarchy);
    });

    test('should update world transforms', () => {
        const parent = world.createEntity();
        const child = world.createEntity();

        const parentTransform = createTransformComponent(
            createVector3(10, 0, 0),
            createQuaternion(),
            createVector3(1, 1, 1)
        );
        const childTransform = createTransformComponent(
            createVector3(5, 0, 0),
            createQuaternion(),
            createVector3(1, 1, 1)
        );

        world.addComponent(parent, parentTransform);
        world.addComponent(child, childTransform);

        const hierarchy = system.getHierarchy();
        hierarchy.addRoot(parent);
        hierarchy.setParent(child, parent);

        system.update(world, 0.016);

        const updatedChild = world.getComponent<TransformComponent>(child, 'transform');
        expect(updatedChild?.worldPosition.x).toBeCloseTo(15, 1);
    });

    test('should handle multi-level hierarchy', () => {
        const root = world.createEntity();
        const child = world.createEntity();
        const grandchild = world.createEntity();

        world.addComponent(
            root,
            createTransformComponent(createVector3(10, 0, 0), createQuaternion(), createVector3(2, 2, 2))
        );
        world.addComponent(
            child,
            createTransformComponent(createVector3(5, 0, 0), createQuaternion(), createVector3(1, 1, 1))
        );
        world.addComponent(
            grandchild,
            createTransformComponent(createVector3(3, 0, 0), createQuaternion(), createVector3(1, 1, 1))
        );

        const hierarchy = system.getHierarchy();
        hierarchy.addRoot(root);
        hierarchy.setParent(child, root);
        hierarchy.setParent(grandchild, child);

        system.update(world, 0.016);

        const updatedGrandchild = world.getComponent<TransformComponent>(grandchild, 'transform');
        expect(updatedGrandchild?.worldScale.x).toBe(2);
    });

    test('should clear hierarchy on shutdown', () => {
        const entity = world.createEntity();
        world.addComponent(entity, createTransformComponent());

        const hierarchy = system.getHierarchy();
        hierarchy.addRoot(entity);

        system.shutdown();

        expect(hierarchy.getRoots().size).toBe(0);
    });
});
