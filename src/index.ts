// Core ECS exports

export * from './core/ecs/ArchetypeManager.ts';
export { ArchetypeManager } from './core/ecs/ArchetypeManager.ts';
export * from './core/ecs/Component.ts';
export { type Component, ComponentStorage } from './core/ecs/Component.ts';
// Re-export everything from core modules
export * from './core/ecs/EntityManager.ts';
export { EntityManager } from './core/ecs/EntityManager.ts';
export * from './core/ecs/Query.ts';
export { Query } from './core/ecs/Query.ts';
export * from './core/ecs/System.ts';
export { BaseSystem, type System } from './core/ecs/System.ts';
export * from './core/ecs/SystemScheduler.ts';
export { SystemScheduler } from './core/ecs/SystemScheduler.ts';
export * from './core/ecs/World.ts';
export { World } from './core/ecs/World.ts';
export * from './core/events/index.ts';
// Event System exports
export {
    EventBus,
    EventComponent,
    type GameEvent,
} from './core/events/index.ts';
