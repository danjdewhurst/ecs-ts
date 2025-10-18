/**
 * Command Buffer System
 *
 * Provides deferred operation execution for safe structural changes during system execution.
 * Supports batch optimization, replay, and undo capabilities.
 *
 * @example
 * ```typescript
 * const buffer = new CommandBuffer({ enableUndo: true });
 *
 * // Queue commands
 * buffer.enqueue(new CreateEntityCommand());
 * buffer.enqueue(new AddComponentCommand(entityId, component));
 *
 * // Execute all commands
 * const stats = buffer.execute(world);
 * console.log(`Executed ${stats.successfulCommands} commands`);
 *
 * // Undo if needed
 * buffer.undo(world);
 * ```
 *
 * @module commands
 */

export type {
    Command,
    CommandBufferStats,
    CommandResult,
} from './Command.ts';
export { CommandBuffer, type CommandBufferOptions } from './CommandBuffer.ts';
export {
    AddComponentCommand,
    CreateEntityCommand,
    DestroyEntityCommand,
    RemoveComponentCommand,
} from './EntityCommands.ts';
