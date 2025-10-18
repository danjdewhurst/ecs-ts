import {
    createQuaternion,
    createTransformComponent,
    createVector3,
    type TransformComponent,
    TransformSystem,
    World,
} from '../src/index.ts';

console.log('🎮 Transform Hierarchy System Example\n');
console.log('This example demonstrates:');
console.log('  - Creating entities with transform components');
console.log('  - Building parent-child hierarchies');
console.log('  - Local vs world space coordinates');
console.log('  - Transform propagation through hierarchies');
console.log('  - Hierarchy traversal and queries\n');

const world = new World();
const transformSystem = new TransformSystem(world);
const hierarchy = transformSystem.getHierarchy();

world.addSystem(transformSystem);

function printTransform(entityId: number, label: string): void {
    const transform = world.getComponent<TransformComponent>(
        entityId,
        'transform'
    );
    if (transform) {
        console.log(`${label}:`);
        console.log(
            `  Local:  pos(${transform.localPosition.x.toFixed(1)}, ${transform.localPosition.y.toFixed(1)}, ${transform.localPosition.z.toFixed(1)}) ` +
                `scale(${transform.localScale.x.toFixed(1)}, ${transform.localScale.y.toFixed(1)}, ${transform.localScale.z.toFixed(1)})`
        );
        console.log(
            `  World:  pos(${transform.worldPosition.x.toFixed(1)}, ${transform.worldPosition.y.toFixed(1)}, ${transform.worldPosition.z.toFixed(1)}) ` +
                `scale(${transform.worldScale.x.toFixed(1)}, ${transform.worldScale.y.toFixed(1)}, ${transform.worldScale.z.toFixed(1)})`
        );
    }
}

console.log('📦 Example 1: Basic Parent-Child Relationship\n');

const ship = world.createEntity();
const turret = world.createEntity();

world.addComponent(
    ship,
    createTransformComponent(
        createVector3(100, 50, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

world.addComponent(
    turret,
    createTransformComponent(
        createVector3(0, 10, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

hierarchy.addRoot(ship);
hierarchy.setParent(turret, ship);

console.log('Before transform update:');
printTransform(ship, 'Ship');
printTransform(turret, 'Turret (child of ship)');

world.update(0.016);

console.log('\nAfter transform update:');
printTransform(ship, 'Ship');
printTransform(turret, 'Turret (child of ship)');

console.log(
    `\nℹ️  The turret's world position is ship.position + turret.localPosition`
);

console.log(`\n${'='.repeat(80)}\n`);
console.log('🏗️  Example 2: Multi-Level Hierarchy (Solar System)\n');

const sun = world.createEntity();
const earth = world.createEntity();
const moon = world.createEntity();

world.addComponent(
    sun,
    createTransformComponent(
        createVector3(0, 0, 0),
        createQuaternion(),
        createVector3(5, 5, 5)
    )
);

world.addComponent(
    earth,
    createTransformComponent(
        createVector3(150, 0, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

world.addComponent(
    moon,
    createTransformComponent(
        createVector3(30, 0, 0),
        createQuaternion(),
        createVector3(0.3, 0.3, 0.3)
    )
);

hierarchy.addRoot(sun);
hierarchy.setParent(earth, sun);
hierarchy.setParent(moon, earth);

console.log('Solar system hierarchy:');
console.log('  Sun (root)');
console.log('    └─ Earth (child of Sun)');
console.log('        └─ Moon (child of Earth)');

world.update(0.016);

console.log('\nTransforms after update:');
printTransform(sun, '\nSun');
printTransform(earth, '\nEarth');
printTransform(moon, '\nMoon');

console.log('\n📊 Hierarchy Queries:');
console.log(`  Moon's root: Entity ${hierarchy.getRoot(moon)}`);
console.log(`  Moon's ancestors: [${hierarchy.getAncestors(moon).join(', ')}]`);
console.log(
    `  Sun's descendants: [${hierarchy.getDescendants(sun).join(', ')}]`
);
console.log(`  Moon's depth in hierarchy: ${hierarchy.getDepth(moon)}`);

console.log(`\n${'='.repeat(80)}\n`);
console.log('🔄 Example 3: Reparenting\n');

const vehicle = world.createEntity();
const player = world.createEntity();
const weapon = world.createEntity();

world.addComponent(
    vehicle,
    createTransformComponent(
        createVector3(200, 100, 0),
        createQuaternion(),
        createVector3(2, 2, 2)
    )
);

world.addComponent(
    player,
    createTransformComponent(
        createVector3(0, 5, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

world.addComponent(
    weapon,
    createTransformComponent(
        createVector3(2, 0, 0),
        createQuaternion(),
        createVector3(0.5, 0.5, 0.5)
    )
);

hierarchy.addRoot(vehicle);
hierarchy.setParent(player, vehicle);
hierarchy.setParent(weapon, player);

world.update(0.016);

console.log('Initial hierarchy:');
console.log('  Vehicle');
console.log('    └─ Player');
console.log('        └─ Weapon\n');

printTransform(weapon, 'Weapon (attached to player in vehicle)');

console.log('\n🚗 Player exits vehicle...\n');
hierarchy.setParent(player, null);
world.update(0.016);

console.log('After player exits:');
console.log('  Vehicle');
console.log('  Player (independent)');
console.log('    └─ Weapon\n');

printTransform(weapon, 'Weapon (still attached to player)');

console.log(`\n${'='.repeat(80)}\n`);
console.log('🌲 Example 4: Tree Structure with Siblings\n');

const root = world.createEntity();
const branch1 = world.createEntity();
const branch2 = world.createEntity();
const leaf1 = world.createEntity();
const leaf2 = world.createEntity();
const leaf3 = world.createEntity();

world.addComponent(
    root,
    createTransformComponent(
        createVector3(0, 0, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

for (const entity of [branch1, branch2, leaf1, leaf2, leaf3]) {
    world.addComponent(
        entity,
        createTransformComponent(
            createVector3(10, 10, 0),
            createQuaternion(),
            createVector3(1, 1, 1)
        )
    );
}

hierarchy.addRoot(root);
hierarchy.setParent(branch1, root);
hierarchy.setParent(branch2, root);
hierarchy.setParent(leaf1, branch1);
hierarchy.setParent(leaf2, branch1);
hierarchy.setParent(leaf3, branch2);

console.log('Tree structure:');
console.log('  Root');
console.log('    ├─ Branch1');
console.log('    │   ├─ Leaf1');
console.log('    │   └─ Leaf2');
console.log('    └─ Branch2');
console.log('        └─ Leaf3');

console.log('\n📋 Sibling queries:');
const branch1Siblings = hierarchy.getSiblings(branch1);
console.log(`  Branch1's siblings: [${branch1Siblings.join(', ')}]`);

const leaf1Siblings = hierarchy.getSiblings(leaf1);
console.log(`  Leaf1's siblings: [${leaf1Siblings.join(', ')}]`);

console.log('\n🔍 Hierarchy traversal (depth-first):');
const visited: number[] = [];
hierarchy.traverseHierarchy((entityId, depth) => {
    const indent = '  '.repeat(depth);
    visited.push(entityId);
    console.log(`${indent}Entity ${entityId} (depth: ${depth})`);
    return undefined;
});

console.log(`\nVisited ${visited.length} entities in total`);

console.log(`\n${'='.repeat(80)}\n`);
console.log('⚠️  Example 5: Cycle Prevention\n');

const nodeA = world.createEntity();
const nodeB = world.createEntity();
const nodeC = world.createEntity();

world.addComponent(nodeA, createTransformComponent());
world.addComponent(nodeB, createTransformComponent());
world.addComponent(nodeC, createTransformComponent());

hierarchy.addRoot(nodeA);
hierarchy.setParent(nodeB, nodeA);
hierarchy.setParent(nodeC, nodeB);

console.log('Current hierarchy:');
console.log('  NodeA');
console.log('    └─ NodeB');
console.log('        └─ NodeC');

console.log('\n❌ Attempting to create cycle (NodeA as child of NodeC)...');
try {
    hierarchy.setParent(nodeA, nodeC);
    console.log('  ERROR: Cycle was created!');
} catch (error) {
    if (error instanceof Error) {
        console.log(`  ✅ Prevented: ${error.message}`);
    }
}

console.log('\n❌ Attempting self-parenting (NodeA as its own parent)...');
try {
    hierarchy.setParent(nodeA, nodeA);
    console.log('  ERROR: Self-parenting was allowed!');
} catch (error) {
    if (error instanceof Error) {
        console.log(`  ✅ Prevented: ${error.message}`);
    }
}

console.log(`\n${'='.repeat(80)}\n`);
console.log('📏 Example 6: Scale Propagation\n');

const container = world.createEntity();
const item = world.createEntity();

world.addComponent(
    container,
    createTransformComponent(
        createVector3(0, 0, 0),
        createQuaternion(),
        createVector3(2, 2, 2)
    )
);

world.addComponent(
    item,
    createTransformComponent(
        createVector3(0, 0, 0),
        createQuaternion(),
        createVector3(3, 3, 3)
    )
);

hierarchy.addRoot(container);
hierarchy.setParent(item, container);

world.update(0.016);

console.log('Container scale: 2x, Item local scale: 3x');
printTransform(container, '\nContainer');
printTransform(item, '\nItem');

console.log(`\nℹ️  World scale is parent.scale * local.scale = 2 * 3 = 6`);

console.log(`\n${'='.repeat(80)}\n`);
console.log('🎯 Example 7: Practical Use Case - Robot Arm\n');

const robotBase = world.createEntity();
const shoulder = world.createEntity();
const elbow = world.createEntity();
const hand = world.createEntity();

world.addComponent(
    robotBase,
    createTransformComponent(
        createVector3(0, 0, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

world.addComponent(
    shoulder,
    createTransformComponent(
        createVector3(0, 20, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

world.addComponent(
    elbow,
    createTransformComponent(
        createVector3(0, 30, 0),
        createQuaternion(),
        createVector3(1, 1, 1)
    )
);

world.addComponent(
    hand,
    createTransformComponent(
        createVector3(0, 25, 0),
        createQuaternion(),
        createVector3(0.8, 0.8, 0.8)
    )
);

hierarchy.addRoot(robotBase);
hierarchy.setParent(shoulder, robotBase);
hierarchy.setParent(elbow, shoulder);
hierarchy.setParent(hand, elbow);

console.log('Robot arm hierarchy:');
console.log('  Base');
console.log('    └─ Shoulder (+20y)');
console.log('        └─ Elbow (+30y)');
console.log('            └─ Hand (+25y)');

world.update(0.016);

const handTransform = world.getComponent<TransformComponent>(hand, 'transform');
console.log(
    `\n📍 Hand world position: (${handTransform?.worldPosition.x.toFixed(1)}, ${handTransform?.worldPosition.y.toFixed(1)}, ${handTransform?.worldPosition.z.toFixed(1)})`
);
console.log('   Expected: 0 + 20 + 30 + 25 = 75y ✓');

console.log('\n🔧 Moving the base affects entire arm...');
const baseTransform = world.getComponent<TransformComponent>(
    robotBase,
    'transform'
);
if (baseTransform) {
    baseTransform.localPosition.x = 100;
    baseTransform.dirty = true;
}

world.update(0.016);

const updatedHandTransform = world.getComponent<TransformComponent>(
    hand,
    'transform'
);
console.log(
    `📍 Hand world position after base move: (${updatedHandTransform?.worldPosition.x.toFixed(1)}, ${updatedHandTransform?.worldPosition.y.toFixed(1)}, ${updatedHandTransform?.worldPosition.z.toFixed(1)})`
);
console.log('   All child transforms automatically updated! ✓');

console.log(`\n${'='.repeat(80)}\n`);
console.log('✅ Transform Hierarchy System Example Complete!\n');

console.log('Key takeaways:');
console.log('  ✓ Transforms support parent-child hierarchies');
console.log(
    '  ✓ World transforms are automatically calculated from local transforms'
);
console.log('  ✓ Scale and rotation propagate through the hierarchy');
console.log('  ✓ Rich query API for hierarchy traversal and relationships');
console.log('  ✓ Cycle prevention ensures valid hierarchies');
console.log(
    '  ✓ Perfect for scene graphs, skeletal animation, and spatial relationships\n'
);
