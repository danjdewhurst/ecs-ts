# System Dependencies Best Practices

This guide provides best practices for using system dependencies in the ECS Game Engine.

## Table of Contents

- [When to Use Dependencies](#when-to-use-dependencies)
- [When to Use Priority](#when-to-use-priority)
- [Dependency Guidelines](#dependency-guidelines)
- [Common Patterns](#common-patterns)
- [Anti-Patterns](#anti-patterns)
- [Performance Considerations](#performance-considerations)

## When to Use Dependencies

Use **dependencies** when:

✅ **Correctness matters** - One system must run before another for correct behavior
✅ **Data flow is clear** - System B consumes data produced by System A
✅ **Logic coupling exists** - Systems have an inherent ordering requirement

### Examples

```typescript
// ✅ GOOD: Physics must update positions before collision detection
class CollisionSystem extends BaseSystem {
  readonly dependencies = ['PhysicsSystem'];
  // Collision detection needs updated positions from physics
}

// ✅ GOOD: Damage requires collision information
class DamageSystem extends BaseSystem {
  readonly dependencies = ['CollisionSystem'];
  // Damage application needs collision data
}

// ✅ GOOD: Rendering should happen after all game logic
class RenderSystem extends BaseSystem {
  readonly dependencies = ['PhysicsSystem', 'AnimationSystem'];
  // Render with final state
}
```

## When to Use Priority

Use **priority** when:

✅ **No data dependencies** - Systems are independent
✅ **Performance optimization** - Want critical systems to run first
✅ **Same dependency level** - Multiple systems depend on the same parent

### Examples

```typescript
// ✅ GOOD: Independent systems ordered by importance
class InputSystem extends BaseSystem {
  readonly priority = 0; // Highest priority (no dependencies)
}

class AISystem extends BaseSystem {
  readonly priority = 5; // Medium priority (no dependencies)
}

class DebugSystem extends BaseSystem {
  readonly priority = 100; // Lowest priority (no dependencies)
}

// ✅ GOOD: Same dependency level, different priorities
class CollisionSystem extends BaseSystem {
  readonly dependencies = ['PhysicsSystem'];
  readonly priority = 1; // More important
}

class TriggerSystem extends BaseSystem {
  readonly dependencies = ['PhysicsSystem'];
  readonly priority = 2; // Less important
}
```

## Dependency Guidelines

### Keep Dependencies Minimal

❌ **BAD** - Over-specified dependencies:
```typescript
class RenderSystem extends BaseSystem {
  readonly dependencies = [
    'PhysicsSystem',
    'CollisionSystem',
    'DamageSystem',
    'AnimationSystem',
    'ParticleSystem',
    // ... 10 more systems
  ];
}
```

✅ **GOOD** - Only direct dependencies:
```typescript
class RenderSystem extends BaseSystem {
  readonly dependencies = ['GameLogicSystem'];
  // GameLogicSystem already depends on physics, collision, etc.
}
```

### Use Transitive Dependencies

Dependencies are transitive. If A depends on B, and B depends on C, then A automatically runs after C.

```typescript
// C runs first (no dependencies)
class PhysicsSystem extends BaseSystem {
  readonly name = 'PhysicsSystem';
}

// B runs second (depends on C)
class CollisionSystem extends BaseSystem {
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem'];
}

// A runs third (depends on B, which depends on C)
class DamageSystem extends BaseSystem {
  readonly name = 'DamageSystem';
  readonly dependencies = ['CollisionSystem'];
  // Automatically runs after PhysicsSystem too!
}
```

### Name Systems Descriptively

Use clear, descriptive names that make dependencies obvious:

✅ **GOOD**:
```typescript
class PhysicsMovementSystem extends BaseSystem {}
class CollisionDetectionSystem extends BaseSystem {}
class DamageApplicationSystem extends BaseSystem {}
```

❌ **BAD**:
```typescript
class SystemA extends BaseSystem {}
class SystemB extends BaseSystem {}
class SystemC extends BaseSystem {}
```

## Common Patterns

### Game Loop Pattern

```typescript
// 1. Input (first, no dependencies)
class InputSystem extends BaseSystem {
  readonly name = 'InputSystem';
  readonly priority = 0;
}

// 2. Game Logic (depends on input)
class GameLogicSystem extends BaseSystem {
  readonly name = 'GameLogicSystem';
  readonly priority = 1;
  readonly dependencies = ['InputSystem'];
}

// 3. Physics (depends on game logic)
class PhysicsSystem extends BaseSystem {
  readonly name = 'PhysicsSystem';
  readonly priority = 2;
  readonly dependencies = ['GameLogicSystem'];
}

// 4. Rendering (last, depends on physics)
class RenderSystem extends BaseSystem {
  readonly name = 'RenderSystem';
  readonly priority = 100;
  readonly dependencies = ['PhysicsSystem'];
}
```

### Parallel Systems Pattern

Systems at the same dependency level can potentially run in parallel (future feature):

```typescript
class PhysicsSystem extends BaseSystem {
  readonly name = 'PhysicsSystem';
}

// These can run in parallel (both depend on physics only)
class CollisionSystem extends BaseSystem {
  readonly name = 'CollisionSystem';
  readonly dependencies = ['PhysicsSystem'];
  readonly priority = 1;
}

class ParticleSystem extends BaseSystem {
  readonly name = 'ParticleSystem';
  readonly dependencies = ['PhysicsSystem'];
  readonly priority = 1;
}

class SoundSystem extends BaseSystem {
  readonly name = 'SoundSystem';
  readonly dependencies = ['PhysicsSystem'];
  readonly priority = 1;
}
```

### Conditional Dependencies Pattern

Some systems may optionally depend on others:

```typescript
class DebugRenderSystem extends BaseSystem {
  readonly name = 'DebugRenderSystem';
  readonly priority = 101;

  // In production, might not have dependencies
  // In debug, depends on all game systems
  readonly dependencies = process.env.NODE_ENV === 'development'
    ? ['PhysicsSystem', 'CollisionSystem', 'RenderSystem']
    : [];
}
```

## Anti-Patterns

### ❌ Circular Dependencies

**Never** create circular dependencies:

```typescript
// ❌ BAD: Circular dependency
class SystemA extends BaseSystem {
  readonly dependencies = ['SystemB'];
}

class SystemB extends BaseSystem {
  readonly dependencies = ['SystemA']; // ERROR!
}
```

**Error message:**
```
Circular dependency detected in system execution order:
  SystemA -> SystemB -> SystemA

Systems involved:
  - SystemA (priority: 0, depends on: [SystemB])
  - SystemB (priority: 0, depends on: [SystemA])

To fix this, remove one of the dependencies to break the cycle.
```

### ❌ Using Priority for Correctness

Don't rely on priority when dependencies are needed:

```typescript
// ❌ BAD: Using priority to ensure order
class PhysicsSystem extends BaseSystem {
  readonly priority = 1; // Hoping this runs first
}

class CollisionSystem extends BaseSystem {
  readonly priority = 2; // Hoping this runs second
}

// ✅ GOOD: Using dependencies
class PhysicsSystem extends BaseSystem {
  readonly name = 'PhysicsSystem';
  readonly priority = 1;
}

class CollisionSystem extends BaseSystem {
  readonly name = 'CollisionSystem';
  readonly priority = 1; // Priority doesn't matter
  readonly dependencies = ['PhysicsSystem']; // Explicit
}
```

### ❌ Deep Dependency Chains

Avoid excessively deep dependency chains:

```typescript
// ❌ BAD: Too many levels
class SystemA extends BaseSystem {
  readonly dependencies = ['SystemB'];
}

class SystemB extends BaseSystem {
  readonly dependencies = ['SystemC'];
}

class SystemC extends BaseSystem {
  readonly dependencies = ['SystemD'];
}

class SystemD extends BaseSystem {
  readonly dependencies = ['SystemE'];
}

class SystemE extends BaseSystem {
  readonly dependencies = ['SystemF'];
}

// ✅ BETTER: Group related systems
class InputAndAISystem extends BaseSystem {
  // Combines InputSystem and AISystem
}

class PhysicsAndCollisionSystem extends BaseSystem {
  readonly dependencies = ['InputAndAISystem'];
  // Combines PhysicsSystem and CollisionSystem
}

class RenderSystem extends BaseSystem {
  readonly dependencies = ['PhysicsAndCollisionSystem'];
}
```

## Performance Considerations

### Execution Order Caching

The engine caches execution order for performance:

```typescript
// First call: Computes dependency graph (O(n + e))
world.addSystem(new PhysicsSystem());

// Subsequent calls use cached order (O(1))
world.update(deltaTime);
world.update(deltaTime);
world.update(deltaTime);

// Recomputed only when systems change
world.addSystem(new CollisionSystem()); // Invalidates cache
world.update(deltaTime); // Recomputes, then caches
```

### Validation

Validate dependencies early to catch errors:

```typescript
// ✅ GOOD: Validate during setup
const systems = [
  new PhysicsSystem(),
  new CollisionSystem(),
  new DamageSystem(),
];

const validation = world.validateSystemDependencies(systems);
if (!validation.valid) {
  console.error('Invalid dependencies:', validation.error);
  throw new Error('System configuration error');
}

// Add systems knowing they're valid
for (const system of systems) {
  world.addSystem(system);
}
```

### Introspection

Use introspection for debugging:

```typescript
// View execution order
const order = world.getSystemExecutionOrder();
console.log('Execution order:', order.map(s => s.name));

// View dependency graph
const graph = world.getSystemDependencyGraph();
console.log('Dependencies:', JSON.stringify(graph, null, 2));

// Example output:
// {
//   "systems": [
//     {
//       "name": "PhysicsSystem",
//       "priority": 1,
//       "dependencies": [],
//       "dependents": ["CollisionSystem"]
//     },
//     {
//       "name": "CollisionSystem",
//       "priority": 2,
//       "dependencies": ["PhysicsSystem"],
//       "dependents": ["DamageSystem"]
//     }
//   ],
//   "executionOrder": ["PhysicsSystem", "CollisionSystem", "DamageSystem"]
// }
```

## Summary

### Quick Reference

| Scenario | Use | Example |
|----------|-----|---------|
| Must run in specific order | `dependencies` | Physics before collision |
| Independent systems | `priority` | Input (0) vs Debug (100) |
| Same dependency level | `priority` | Multiple collision handlers |
| Optional ordering | `priority` | UI systems |
| Correctness required | `dependencies` | Damage after collision |
| Performance tuning | `priority` | Critical systems first |

### Decision Tree

```
Does SystemB need data from SystemA?
├─ YES → Use dependencies
│  └─ B.dependencies = ['A']
│
└─ NO → Are they independent?
   ├─ YES → Use priority for ordering
   │  └─ A.priority = 0, B.priority = 10
   │
   └─ NO → They're at same dependency level
      └─ Use priority within that level
```

## Further Reading

- [SystemScheduler Integration Spec](../roadmap/specs/system-scheduler-integration.md)
- [System Dependencies Example](../examples/system-dependencies-example.ts)
- [ECS Philosophy](../PHILOSOPHY.md)
