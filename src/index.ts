// Core ECS exports

// Asset Management exports
export * from './core/assets/index.ts';
export {
    Asset,
    AssetError,
    AssetErrorCode,
    AssetManager,
    AssetReference,
    AssetState,
    BaseAssetLoader,
    BinaryLoader,
    JSONLoader,
    ScopedAssetReference,
    TextLoader,
} from './core/assets/index.ts';
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
// Performance Optimization exports
export * from './core/performance/index.ts';
export {
    DirtyTracker,
    ObjectPool,
} from './core/performance/index.ts';
// Scene Management exports
export * from './core/scenes/index.ts';
export {
    Scene,
    SceneManager,
    SceneState,
    SceneTransition,
    TransitionPhase,
} from './core/scenes/index.ts';
// Serialization exports
export * from './core/serialization/index.ts';
export {
    BinaryFormat,
    createEmptySnapshot,
    isVersionCompatible,
    JSONFormat,
    SERIALIZATION_VERSION,
    WorldSerializer,
} from './core/serialization/index.ts';
// Transform Hierarchy exports
export * from './core/transform/index.ts';
export {
    cloneMatrix4x4,
    cloneQuaternion,
    cloneVector3,
    createIdentityMatrix,
    createQuaternion,
    createTransformComponent,
    createVector3,
    type HierarchyTraversalOptions,
    type Matrix4x4,
    type Quaternion,
    TransformHierarchy,
    TransformMath,
    TransformSystem,
    type TransformSystemConfig,
    type Vector3,
} from './core/transform/index.ts';
