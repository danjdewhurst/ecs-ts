export class EntityManager {
    private nextId = 1;
    private recycledIds: number[] = [];
    private livingEntities = new Set<number>();

    createEntity(): number {
        const id = this.recycledIds.pop() ?? this.nextId++;
        this.livingEntities.add(id);
        return id;
    }

    destroyEntity(entityId: number): void {
        if (this.livingEntities.delete(entityId)) {
            this.recycledIds.push(entityId);
        }
    }

    isEntityAlive(entityId: number): boolean {
        return this.livingEntities.has(entityId);
    }

    getLivingEntities(): Set<number> {
        return new Set(this.livingEntities);
    }

    getEntityCount(): number {
        return this.livingEntities.size;
    }
}
