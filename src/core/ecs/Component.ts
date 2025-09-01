export interface Component {
    readonly type: string;
}

export class ComponentStorage<T extends Component> {
    private components = new Map<number, T>();
    private entitySet = new Set<number>();

    add(entityId: number, component: T): void {
        this.components.set(entityId, component);
        this.entitySet.add(entityId);
    }

    get(entityId: number): T | undefined {
        return this.components.get(entityId);
    }

    has(entityId: number): boolean {
        return this.components.has(entityId);
    }

    remove(entityId: number): boolean {
        this.entitySet.delete(entityId);
        return this.components.delete(entityId);
    }

    getEntities(): Set<number> {
        return new Set(this.entitySet);
    }

    getAllComponents(): Map<number, T> {
        return new Map(this.components);
    }

    clear(): void {
        this.components.clear();
        this.entitySet.clear();
    }

    size(): number {
        return this.components.size;
    }
}