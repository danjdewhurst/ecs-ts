import type { Component } from '../ecs/Component';

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface Matrix4x4 {
    elements: Float32Array;
}

export interface TransformComponent extends Component {
    readonly type: 'transform';

    localPosition: Vector3;
    localRotation: Quaternion;
    localScale: Vector3;

    worldPosition: Vector3;
    worldRotation: Quaternion;
    worldScale: Vector3;

    localMatrix: Matrix4x4;
    worldMatrix: Matrix4x4;

    parent: number | null;
    children: Set<number>;

    dirty: boolean;
}

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
    return { x, y, z };
}

export function createQuaternion(x = 0, y = 0, z = 0, w = 1): Quaternion {
    return { x, y, z, w };
}

export function createIdentityMatrix(): Matrix4x4 {
    const elements = new Float32Array(16);
    elements[0] = 1;
    elements[5] = 1;
    elements[10] = 1;
    elements[15] = 1;
    return { elements };
}

export function createTransformComponent(
    position: Vector3 = createVector3(),
    rotation: Quaternion = createQuaternion(),
    scale: Vector3 = createVector3(1, 1, 1)
): TransformComponent {
    return {
        type: 'transform',

        localPosition: { ...position },
        localRotation: { ...rotation },
        localScale: { ...scale },

        worldPosition: { ...position },
        worldRotation: { ...rotation },
        worldScale: { ...scale },

        localMatrix: createIdentityMatrix(),
        worldMatrix: createIdentityMatrix(),

        parent: null,
        children: new Set<number>(),

        dirty: true,
    };
}

export function cloneVector3(v: Vector3): Vector3 {
    return { x: v.x, y: v.y, z: v.z };
}

export function cloneQuaternion(q: Quaternion): Quaternion {
    return { x: q.x, y: q.y, z: q.z, w: q.w };
}

export function cloneMatrix4x4(m: Matrix4x4): Matrix4x4 {
    return {
        elements: new Float32Array(m.elements),
    };
}
