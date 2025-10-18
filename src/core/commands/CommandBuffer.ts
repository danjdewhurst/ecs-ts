import type { World } from '../ecs/World.ts';
import type { Command, CommandBufferStats } from './Command.ts';

/**
 * CommandBuffer queues operations for deferred execution.
 * This allows safe structural changes during system execution and supports
 * batch optimization, replay, and undo capabilities.
 */
export class CommandBuffer {
    private commands: Command[] = [];
    private executedCommands: Command[] = [];
    private readonly enableUndo: boolean;

    constructor(options: CommandBufferOptions = {}) {
        this.enableUndo = options.enableUndo ?? false;
    }

    /**
     * Add a command to the buffer for later execution
     */
    enqueue(command: Command): void {
        this.commands.push(command);
    }

    /**
     * Execute all queued commands against the world
     * @param world - The world to execute commands against
     * @returns Statistics about the execution
     */
    execute(world: World): CommandBufferStats {
        const startTime = performance.now();
        const stats: CommandBufferStats = {
            totalCommands: this.commands.length,
            successfulCommands: 0,
            failedCommands: 0,
            executionTime: 0,
            failures: [],
        };

        for (const command of this.commands) {
            const result = command.execute(world);

            if (result.success) {
                stats.successfulCommands++;
                if (this.enableUndo) {
                    this.executedCommands.push(command);
                }
            } else {
                stats.failedCommands++;
                stats.failures.push({
                    command: command.describe(),
                    error: result.error ?? 'Unknown error',
                });
            }
        }

        stats.executionTime = performance.now() - startTime;

        // Clear the command queue after execution
        this.commands = [];

        return stats;
    }

    /**
     * Undo all previously executed commands (if undo is enabled)
     * @param world - The world to undo commands against
     * @returns Statistics about the undo operation
     */
    undo(world: World): CommandBufferStats {
        if (!this.enableUndo) {
            return {
                totalCommands: 0,
                successfulCommands: 0,
                failedCommands: 0,
                executionTime: 0,
                failures: [
                    {
                        command: 'undo',
                        error: 'Undo is not enabled for this command buffer',
                    },
                ],
            };
        }

        const startTime = performance.now();
        const stats: CommandBufferStats = {
            totalCommands: this.executedCommands.length,
            successfulCommands: 0,
            failedCommands: 0,
            executionTime: 0,
            failures: [],
        };

        // Undo commands in reverse order
        for (let i = this.executedCommands.length - 1; i >= 0; i--) {
            const command = this.executedCommands[i];
            if (!command) continue;

            if (command.undo) {
                const result = command.undo(world);

                if (result.success) {
                    stats.successfulCommands++;
                } else {
                    stats.failedCommands++;
                    stats.failures.push({
                        command: command.describe(),
                        error: result.error ?? 'Unknown error',
                    });
                }
            } else {
                stats.failedCommands++;
                stats.failures.push({
                    command: command.describe(),
                    error: 'Command does not support undo',
                });
            }
        }

        stats.executionTime = performance.now() - startTime;

        // Keep executed commands in history for potential replay
        // Use clearHistory() to explicitly clear if needed

        return stats;
    }

    /**
     * Replay previously executed commands
     * @param world - The world to replay commands against
     * @returns Statistics about the replay operation
     */
    replay(world: World): CommandBufferStats {
        if (!this.enableUndo) {
            return {
                totalCommands: 0,
                successfulCommands: 0,
                failedCommands: 0,
                executionTime: 0,
                failures: [
                    {
                        command: 'replay',
                        error: 'Undo must be enabled to replay commands',
                    },
                ],
            };
        }

        const startTime = performance.now();
        const stats: CommandBufferStats = {
            totalCommands: this.executedCommands.length,
            successfulCommands: 0,
            failedCommands: 0,
            executionTime: 0,
            failures: [],
        };

        for (const command of this.executedCommands) {
            const result = command.execute(world);

            if (result.success) {
                stats.successfulCommands++;
            } else {
                stats.failedCommands++;
                stats.failures.push({
                    command: command.describe(),
                    error: result.error ?? 'Unknown error',
                });
            }
        }

        stats.executionTime = performance.now() - startTime;

        return stats;
    }

    /**
     * Clear all queued commands without executing them
     */
    clear(): void {
        this.commands = [];
    }

    /**
     * Clear the history of executed commands
     */
    clearHistory(): void {
        this.executedCommands = [];
    }

    /**
     * Get the number of queued commands
     */
    getQueuedCount(): number {
        return this.commands.length;
    }

    /**
     * Get the number of executed commands in history
     */
    getHistoryCount(): number {
        return this.executedCommands.length;
    }

    /**
     * Check if the buffer has any queued commands
     */
    hasCommands(): boolean {
        return this.commands.length > 0;
    }

    /**
     * Check if the buffer has any command history
     */
    hasHistory(): boolean {
        return this.executedCommands.length > 0;
    }

    /**
     * Get descriptions of all queued commands (for debugging)
     */
    describeQueue(): string[] {
        return this.commands.map((cmd) => cmd.describe());
    }

    /**
     * Get descriptions of all executed commands (for debugging)
     */
    describeHistory(): string[] {
        return this.executedCommands.map((cmd) => cmd.describe());
    }
}

/**
 * Options for CommandBuffer creation
 */
export interface CommandBufferOptions {
    /**
     * Enable undo/replay functionality.
     * When enabled, executed commands are stored in history.
     * Default: false
     */
    enableUndo?: boolean;
}
