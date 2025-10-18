import type { World } from '../ecs/World';
import type { TransformComponent } from './TransformComponent';
import { TransformMath } from './TransformMath';

export interface HierarchyTraversalOptions {
    includeInactive?: boolean;
    depthFirst?: boolean;
    maxDepth?: number;
}

export class TransformHierarchy {
    private world: World;
    private roots: Set<number> = new Set();

    constructor(world: World) {
        this.world = world;
    }

    setParent(entityId: number, parentId: number | null): void {
        const transform = this.world.getComponent<TransformComponent>(
            entityId,
            'transform'
        );
        if (!transform) {
            throw new Error(
                `Entity ${entityId} does not have a Transform component`
            );
        }

        if (parentId !== null) {
            const parentTransform = this.world.getComponent<TransformComponent>(
                parentId,
                'transform'
            );
            if (!parentTransform) {
                throw new Error(
                    `Parent entity ${parentId} does not have a Transform component`
                );
            }

            if (this.wouldCreateCycle(entityId, parentId)) {
                throw new Error(
                    `Setting parent would create a cycle in the hierarchy`
                );
            }
        }

        this.detachFromParent(entityId);

        if (parentId !== null) {
            const parentTransform = this.world.getComponent<TransformComponent>(
                parentId,
                'transform'
            );
            if (parentTransform) {
                parentTransform.children.add(entityId);
                transform.parent = parentId;
                this.roots.delete(entityId);
            }
        } else {
            transform.parent = null;
            this.roots.add(entityId);
        }

        transform.dirty = true;
    }

    detachFromParent(entityId: number): void {
        const transform = this.world.getComponent<TransformComponent>(
            entityId,
            'transform'
        );
        if (!transform || transform.parent === null) {
            return;
        }

        const parentTransform = this.world.getComponent<TransformComponent>(
            transform.parent,
            'transform'
        );
        if (parentTransform) {
            parentTransform.children.delete(entityId);
        }

        transform.parent = null;
        this.roots.add(entityId);
        transform.dirty = true;
    }

    getParent(entityId: number): number | null {
        const transform = this.world.getComponent<TransformComponent>(
            entityId,
            'transform'
        );
        return transform?.parent ?? null;
    }

    getChildren(entityId: number): ReadonlySet<number> {
        const transform = this.world.getComponent<TransformComponent>(
            entityId,
            'transform'
        );
        return transform?.children ?? new Set();
    }

    getRoot(entityId: number): number {
        let current = entityId;
        let parent = this.getParent(current);

        while (parent !== null) {
            current = parent;
            parent = this.getParent(current);
        }

        return current;
    }

    getRoots(): ReadonlySet<number> {
        return this.roots;
    }

    getAncestors(entityId: number): number[] {
        const ancestors: number[] = [];
        let current = this.getParent(entityId);

        while (current !== null) {
            ancestors.push(current);
            current = this.getParent(current);
        }

        return ancestors;
    }

    getDescendants(
        entityId: number,
        options: HierarchyTraversalOptions = {}
    ): number[] {
        const { depthFirst = true, maxDepth = Number.POSITIVE_INFINITY } =
            options;
        const descendants: number[] = [];

        if (depthFirst) {
            this.traverseDepthFirst(entityId, descendants, 0, maxDepth);
        } else {
            this.traverseBreadthFirst(entityId, descendants, maxDepth);
        }

        return descendants;
    }

    traverseHierarchy(
        callback: (entityId: number, depth: number) => boolean | undefined,
        options: HierarchyTraversalOptions = {}
    ): void {
        const { depthFirst = true } = options;

        for (const rootId of this.roots) {
            if (depthFirst) {
                this.traverseEntityDepthFirst(rootId, callback, 0);
            } else {
                this.traverseEntityBreadthFirst(rootId, callback);
            }
        }
    }

    isAncestorOf(ancestorId: number, descendantId: number): boolean {
        let current = this.getParent(descendantId);

        while (current !== null) {
            if (current === ancestorId) {
                return true;
            }
            current = this.getParent(current);
        }

        return false;
    }

    getSiblings(entityId: number): number[] {
        const parent = this.getParent(entityId);
        if (parent === null) {
            return Array.from(this.roots).filter((id) => id !== entityId);
        }

        const parentChildren = this.getChildren(parent);
        return Array.from(parentChildren).filter((id) => id !== entityId);
    }

    getDepth(entityId: number): number {
        let depth = 0;
        let current = this.getParent(entityId);

        while (current !== null) {
            depth++;
            current = this.getParent(current);
        }

        return depth;
    }

    updateWorldTransforms(): void {
        for (const rootId of this.roots) {
            this.updateEntityWorldTransform(rootId);
        }
    }

    addRoot(entityId: number): void {
        this.roots.add(entityId);
    }

    removeRoot(entityId: number): void {
        this.roots.delete(entityId);
    }

    clear(): void {
        this.roots.clear();
    }

    private wouldCreateCycle(
        entityId: number,
        potentialParentId: number
    ): boolean {
        if (entityId === potentialParentId) {
            return true;
        }

        return this.isAncestorOf(entityId, potentialParentId);
    }

    private traverseDepthFirst(
        entityId: number,
        result: number[],
        currentDepth: number,
        maxDepth: number
    ): void {
        if (currentDepth >= maxDepth) {
            return;
        }

        const children = this.getChildren(entityId);
        for (const childId of children) {
            result.push(childId);
            this.traverseDepthFirst(
                childId,
                result,
                currentDepth + 1,
                maxDepth
            );
        }
    }

    private traverseBreadthFirst(
        entityId: number,
        result: number[],
        maxDepth: number
    ): void {
        const queue: Array<{ id: number; depth: number }> = [];
        const children = this.getChildren(entityId);

        for (const childId of children) {
            queue.push({ id: childId, depth: 1 });
        }

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            result.push(id);

            if (depth < maxDepth) {
                const childChildren = this.getChildren(id);
                for (const childId of childChildren) {
                    queue.push({ id: childId, depth: depth + 1 });
                }
            }
        }
    }

    private traverseEntityDepthFirst(
        entityId: number,
        callback: (entityId: number, depth: number) => boolean | undefined,
        depth: number
    ): void {
        const shouldContinue = callback(entityId, depth);
        if (shouldContinue === false) {
            return;
        }

        const children = this.getChildren(entityId);
        for (const childId of children) {
            this.traverseEntityDepthFirst(childId, callback, depth + 1);
        }
    }

    private traverseEntityBreadthFirst(
        rootId: number,
        callback: (entityId: number, depth: number) => boolean | undefined
    ): void {
        const queue: Array<{ id: number; depth: number }> = [
            { id: rootId, depth: 0 },
        ];

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            const shouldContinue = callback(id, depth);

            if (shouldContinue === false) {
                continue;
            }

            const children = this.getChildren(id);
            for (const childId of children) {
                queue.push({ id: childId, depth: depth + 1 });
            }
        }
    }

    private updateEntityWorldTransform(entityId: number): void {
        const transform = this.world.getComponent<TransformComponent>(
            entityId,
            'transform'
        );
        if (!transform) {
            return;
        }

        const parent = transform.parent;
        if (parent !== null) {
            const parentTransform = this.world.getComponent<TransformComponent>(
                parent,
                'transform'
            );
            if (parentTransform) {
                TransformMath.composeWorldTransform(
                    transform,
                    parentTransform.worldMatrix,
                    parentTransform.worldPosition,
                    parentTransform.worldRotation,
                    parentTransform.worldScale
                );
            }
        } else {
            TransformMath.updateLocalMatrix(transform);
            TransformMath.copyMatrix(
                transform.worldMatrix,
                transform.localMatrix
            );
            transform.worldPosition = { ...transform.localPosition };
            transform.worldRotation = { ...transform.localRotation };
            transform.worldScale = { ...transform.localScale };
        }

        transform.dirty = false;

        const children = transform.children;
        for (const childId of children) {
            this.updateEntityWorldTransform(childId);
        }
    }
}
