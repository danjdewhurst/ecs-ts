import type { System } from './System.ts';
import type { World } from './World.ts';

export class SystemScheduler {
    private systems: System[] = [];
    private executionOrder: System[] = [];
    private dependencyGraph = new Map<string, Set<string>>();
    private executionOrderDirty = true;

    addSystem(system: System): void {
        // Check for duplicate system names
        if (this.systems.some((s) => s.name === system.name)) {
            throw new Error(`System with name '${system.name}' already exists`);
        }

        this.systems.push(system);
        this.executionOrderDirty = true;
        this.computeExecutionOrder();
    }

    removeSystem(systemName: string): boolean {
        const index = this.systems.findIndex((s) => s.name === systemName);
        if (index === -1) {
            return false;
        }

        this.systems.splice(index, 1);
        this.executionOrderDirty = true;
        this.computeExecutionOrder();
        return true;
    }

    getSystem(systemName: string): System | undefined {
        return this.systems.find((s) => s.name === systemName);
    }

    getSystems(): readonly System[] {
        return [...this.systems];
    }

    getExecutionOrder(): readonly System[] {
        // Ensure execution order is computed
        this.computeExecutionOrder();
        return [...this.executionOrder];
    }

    update(world: World, deltaTime: number): void {
        // Ensure execution order is computed
        this.computeExecutionOrder();
        for (const system of this.executionOrder) {
            try {
                system.update(world, deltaTime);
            } catch (error) {
                console.error(`Error in system '${system.name}':`, error);
                // Continue executing other systems
            }
        }
    }

    initializeSystems(world: World): void {
        // Ensure execution order is computed
        this.computeExecutionOrder();
        for (const system of this.executionOrder) {
            try {
                system.initialize?.(world);
            } catch (error) {
                console.error(
                    `Error initializing system '${system.name}':`,
                    error
                );
            }
        }
    }

    shutdownSystems(world: World): void {
        // Ensure execution order is computed
        this.computeExecutionOrder();
        // Shutdown in reverse order
        for (let i = this.executionOrder.length - 1; i >= 0; i--) {
            const system = this.executionOrder[i];
            if (!system) continue;
            try {
                system.shutdown?.(world);
            } catch (error) {
                console.error(
                    `Error shutting down system '${system.name}':`,
                    error
                );
            }
        }
    }

    private computeExecutionOrder(): void {
        if (!this.executionOrderDirty) {
            return;
        }
        this.buildDependencyGraph();
        this.executionOrder = this.topologicalSort();
        this.executionOrderDirty = false;
    }

    private buildDependencyGraph(): void {
        this.dependencyGraph.clear();

        // Initialize all systems in the graph
        for (const system of this.systems) {
            this.dependencyGraph.set(system.name, new Set());
        }

        // Add dependencies
        for (const system of this.systems) {
            if (system.dependencies) {
                for (const dep of system.dependencies) {
                    // Verify dependency exists
                    if (!this.systems.some((s) => s.name === dep)) {
                        throw new Error(
                            `System '${system.name}' depends on '${dep}' which does not exist`
                        );
                    }
                    this.dependencyGraph.get(system.name)?.add(dep);
                }
            }
        }
    }

    private topologicalSort(): System[] {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const sorted: System[] = [];
        const path: string[] = [];

        const visit = (systemName: string): void => {
            if (visiting.has(systemName)) {
                // Build the cycle path
                const cycleStart = path.indexOf(systemName);
                const cycle = [...path.slice(cycleStart), systemName];
                this.throwCircularDependencyError(cycle);
            }
            if (visited.has(systemName)) {
                return;
            }

            visiting.add(systemName);
            path.push(systemName);
            const dependencies = this.dependencyGraph.get(systemName);
            if (!dependencies) return;

            for (const dep of dependencies) {
                visit(dep);
            }

            visiting.delete(systemName);
            path.pop();
            visited.add(systemName);

            const system = this.systems.find((s) => s.name === systemName);
            if (!system) return;
            sorted.push(system);
        };

        // Visit all systems
        for (const system of this.systems) {
            visit(system.name);
        }

        // Sort by priority within dependency constraints
        // Systems with the same dependency level are sorted by priority
        return this.sortByPriorityWithinConstraints(sorted);
    }

    private throwCircularDependencyError(cycle: string[]): never {
        const cyclePath = cycle.join(' -> ');
        const systemDetails = cycle
            .map((name) => {
                const sys = this.systems.find((s) => s.name === name);
                return `  - ${name} (priority: ${sys?.priority ?? '?'}, depends on: [${sys?.dependencies?.join(', ') ?? 'none'}])`;
            })
            .join('\n');

        throw new Error(
            `Circular dependency detected in system execution order:\n` +
                `  ${cyclePath}\n\n` +
                `Systems involved:\n` +
                `${systemDetails}\n\n` +
                `To fix this, remove one of the dependencies to break the cycle.`
        );
    }

    private sortByPriorityWithinConstraints(systems: System[]): System[] {
        // Group systems by their dependency level
        const levels = this.computeDependencyLevels();
        const levelGroups = new Map<number, System[]>();

        for (const system of systems) {
            const level = levels.get(system.name);
            if (level === undefined) continue;
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level)?.push(system);
        }

        // Sort each level by priority
        const result: System[] = [];
        for (const level of Array.from(levelGroups.keys()).sort()) {
            const levelSystems = levelGroups.get(level);
            if (!levelSystems) continue;
            levelSystems.sort((a, b) => a.priority - b.priority);
            result.push(...levelSystems);
        }

        return result;
    }

    private computeDependencyLevels(): Map<string, number> {
        const levels = new Map<string, number>();

        const computeLevel = (systemName: string): number => {
            if (levels.has(systemName)) {
                const level = levels.get(systemName);
                return level ?? 0;
            }

            const dependencies = this.dependencyGraph.get(systemName);
            if (!dependencies) {
                levels.set(systemName, 0);
                return 0;
            }
            if (dependencies.size === 0) {
                levels.set(systemName, 0);
                return 0;
            }

            let maxDepLevel = -1;
            for (const dep of dependencies) {
                maxDepLevel = Math.max(maxDepLevel, computeLevel(dep));
            }

            const level = maxDepLevel + 1;
            levels.set(systemName, level);
            return level;
        };

        for (const system of this.systems) {
            computeLevel(system.name);
        }

        return levels;
    }
}
