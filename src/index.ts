// Core ECS exports
export { EntityManager } from './core/ecs/EntityManager.ts';
export { ComponentStorage, type Component } from './core/ecs/Component.ts';
export { ArchetypeManager } from './core/ecs/ArchetypeManager.ts';
export { Query } from './core/ecs/Query.ts';
export { World } from './core/ecs/World.ts';
export { BaseSystem, type System } from './core/ecs/System.ts';
export { SystemScheduler } from './core/ecs/SystemScheduler.ts';

// Re-export everything from core ECS module
export * from './core/ecs/EntityManager.ts';
export * from './core/ecs/Component.ts';
export * from './core/ecs/ArchetypeManager.ts';
export * from './core/ecs/Query.ts';
export * from './core/ecs/World.ts';
export * from './core/ecs/System.ts';
export * from './core/ecs/SystemScheduler.ts';