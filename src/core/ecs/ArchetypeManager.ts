export class ArchetypeManager {
    private archetypes = new Map<string, Set<number>>();
    private entityArchetypes = new Map<number, string>();

    updateEntityArchetype(entityId: number, componentTypes: string[]): void {
        const oldArchetype = this.entityArchetypes.get(entityId);
        if (oldArchetype) {
            this.archetypes.get(oldArchetype)?.delete(entityId);
            if (this.archetypes.get(oldArchetype)?.size === 0) {
                this.archetypes.delete(oldArchetype);
            }
        }

        if (componentTypes.length === 0) {
            this.entityArchetypes.delete(entityId);
            return;
        }

        const newArchetype = componentTypes.sort().join('|');
        this.entityArchetypes.set(entityId, newArchetype);

        if (!this.archetypes.has(newArchetype)) {
            this.archetypes.set(newArchetype, new Set());
        }
        this.archetypes.get(newArchetype)!.add(entityId);
    }

    queryEntities(requiredComponents: string[]): number[] {
        if (requiredComponents.length === 0) {
            return [];
        }

        const results: number[] = [];
        const requiredSet = new Set(requiredComponents);

        for (const [archetype, entities] of this.archetypes) {
            const archetypeComponents = new Set(archetype.split('|'));
            if (requiredComponents.every(comp => archetypeComponents.has(comp))) {
                results.push(...entities);
            }
        }
        return results;
    }

    getEntityArchetype(entityId: number): string | undefined {
        return this.entityArchetypes.get(entityId);
    }

    removeEntity(entityId: number): void {
        const archetype = this.entityArchetypes.get(entityId);
        if (archetype) {
            this.archetypes.get(archetype)?.delete(entityId);
            if (this.archetypes.get(archetype)?.size === 0) {
                this.archetypes.delete(archetype);
            }
            this.entityArchetypes.delete(entityId);
        }
    }

    getArchetypeStats(): Array<{ archetype: string; entityCount: number }> {
        return Array.from(this.archetypes.entries()).map(([archetype, entities]) => ({
            archetype,
            entityCount: entities.size
        }));
    }
}