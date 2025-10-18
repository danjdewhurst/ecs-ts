import type { World } from '../ecs/World.ts';

/**
 * Base interface for all commands.
 * Commands represent deferred operations that can be queued and executed later.
 */
export interface Command {
    /**
     * Execute the command against the world.
     * @param world - The world to execute the command against
     * @returns Optional result data from command execution
     */
    execute(world: World): CommandResult;

    /**
     * Undo the command (if supported).
     * Not all commands need to be undoable.
     * @param world - The world to undo the command against
     * @returns Optional result data from undo operation
     */
    undo?(world: World): CommandResult;

    /**
     * Get a description of this command for debugging/logging
     */
    describe(): string;
}

/**
 * Result of command execution
 */
export interface CommandResult {
    /**
     * Whether the command executed successfully
     */
    success: boolean;

    /**
     * Optional error message if execution failed
     */
    error?: string;

    /**
     * Optional data returned from command execution
     */
    data?: unknown;
}

/**
 * Statistics about command buffer execution
 */
export interface CommandBufferStats {
    /**
     * Total number of commands in the buffer
     */
    totalCommands: number;

    /**
     * Number of commands successfully executed
     */
    successfulCommands: number;

    /**
     * Number of commands that failed
     */
    failedCommands: number;

    /**
     * Time taken to execute all commands (milliseconds)
     */
    executionTime: number;

    /**
     * Commands that failed with their errors
     */
    failures: Array<{
        command: string;
        error: string;
    }>;
}
