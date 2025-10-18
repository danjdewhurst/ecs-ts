import type {
    Matrix4x4,
    Quaternion,
    TransformComponent,
    Vector3,
} from './TransformComponent';

export class TransformMath {
    static composeWorldTransform(
        transform: TransformComponent,
        parentWorldMatrix: Matrix4x4,
        _parentWorldPosition: Vector3,
        parentWorldRotation: Quaternion,
        parentWorldScale: Vector3
    ): void {
        TransformMath.updateLocalMatrix(transform);

        TransformMath.multiplyMatrices(
            transform.worldMatrix,
            parentWorldMatrix,
            transform.localMatrix
        );

        TransformMath.multiplyQuaternions(
            transform.worldRotation,
            parentWorldRotation,
            transform.localRotation
        );

        TransformMath.transformPoint(
            transform.worldPosition,
            transform.localPosition,
            parentWorldMatrix
        );

        transform.worldScale.x = parentWorldScale.x * transform.localScale.x;
        transform.worldScale.y = parentWorldScale.y * transform.localScale.y;
        transform.worldScale.z = parentWorldScale.z * transform.localScale.z;
    }

    static updateLocalMatrix(transform: TransformComponent): void {
        const m = transform.localMatrix.elements;
        const pos = transform.localPosition;
        const rot = transform.localRotation;
        const scale = transform.localScale;

        const x = rot.x;
        const y = rot.y;
        const z = rot.z;
        const w = rot.w;
        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;
        const xx = x * x2;
        const xy = x * y2;
        const xz = x * z2;
        const yy = y * y2;
        const yz = y * z2;
        const zz = z * z2;
        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        const sx = scale.x;
        const sy = scale.y;
        const sz = scale.z;

        m[0] = (1 - (yy + zz)) * sx;
        m[1] = (xy + wz) * sx;
        m[2] = (xz - wy) * sx;
        m[3] = 0;

        m[4] = (xy - wz) * sy;
        m[5] = (1 - (xx + zz)) * sy;
        m[6] = (yz + wx) * sy;
        m[7] = 0;

        m[8] = (xz + wy) * sz;
        m[9] = (yz - wx) * sz;
        m[10] = (1 - (xx + yy)) * sz;
        m[11] = 0;

        m[12] = pos.x;
        m[13] = pos.y;
        m[14] = pos.z;
        m[15] = 1;
    }

    static multiplyMatrices(out: Matrix4x4, a: Matrix4x4, b: Matrix4x4): void {
        const ae = a.elements;
        const be = b.elements;
        const te = out.elements;

        const a11 = ae[0]!;
        const a12 = ae[4]!;
        const a13 = ae[8]!;
        const a14 = ae[12]!;
        const a21 = ae[1]!;
        const a22 = ae[5]!;
        const a23 = ae[9]!;
        const a24 = ae[13]!;
        const a31 = ae[2]!;
        const a32 = ae[6]!;
        const a33 = ae[10]!;
        const a34 = ae[14]!;
        const a41 = ae[3]!;
        const a42 = ae[7]!;
        const a43 = ae[11]!;
        const a44 = ae[15]!;

        const b11 = be[0]!;
        const b12 = be[4]!;
        const b13 = be[8]!;
        const b14 = be[12]!;
        const b21 = be[1]!;
        const b22 = be[5]!;
        const b23 = be[9]!;
        const b24 = be[13]!;
        const b31 = be[2]!;
        const b32 = be[6]!;
        const b33 = be[10]!;
        const b34 = be[14]!;
        const b41 = be[3]!;
        const b42 = be[7]!;
        const b43 = be[11]!;
        const b44 = be[15]!;

        te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
        te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
        te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
        te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

        te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
        te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
        te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
        te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

        te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
        te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
        te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
        te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

        te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
        te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
        te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
        te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    }

    static multiplyQuaternions(
        out: Quaternion,
        a: Quaternion,
        b: Quaternion
    ): void {
        const qax = a.x;
        const qay = a.y;
        const qaz = a.z;
        const qaw = a.w;
        const qbx = b.x;
        const qby = b.y;
        const qbz = b.z;
        const qbw = b.w;

        out.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
        out.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
        out.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
        out.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    }

    static transformPoint(
        out: Vector3,
        point: Vector3,
        matrix: Matrix4x4
    ): void {
        const m = matrix.elements;
        const x = point.x;
        const y = point.y;
        const z = point.z;

        const w = 1 / (m[3]! * x + m[7]! * y + m[11]! * z + m[15]!);

        out.x = (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) * w;
        out.y = (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) * w;
        out.z = (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) * w;
    }

    static copyMatrix(out: Matrix4x4, source: Matrix4x4): void {
        out.elements.set(source.elements);
    }

    static setFromEuler(
        out: Quaternion,
        x: number,
        y: number,
        z: number
    ): void {
        const c1 = Math.cos(x / 2);
        const c2 = Math.cos(y / 2);
        const c3 = Math.cos(z / 2);
        const s1 = Math.sin(x / 2);
        const s2 = Math.sin(y / 2);
        const s3 = Math.sin(z / 2);

        out.x = s1 * c2 * c3 + c1 * s2 * s3;
        out.y = c1 * s2 * c3 - s1 * c2 * s3;
        out.z = c1 * c2 * s3 + s1 * s2 * c3;
        out.w = c1 * c2 * c3 - s1 * s2 * s3;
    }

    static normalizeQuaternion(q: Quaternion): void {
        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        if (length === 0) {
            q.x = 0;
            q.y = 0;
            q.z = 0;
            q.w = 1;
        } else {
            const invLength = 1 / length;
            q.x *= invLength;
            q.y *= invLength;
            q.z *= invLength;
            q.w *= invLength;
        }
    }

    static vectorLength(v: Vector3): number {
        return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    static normalizeVector(v: Vector3): void {
        const length = TransformMath.vectorLength(v);
        if (length > 0) {
            const invLength = 1 / length;
            v.x *= invLength;
            v.y *= invLength;
            v.z *= invLength;
        }
    }

    static addVectors(out: Vector3, a: Vector3, b: Vector3): void {
        out.x = a.x + b.x;
        out.y = a.y + b.y;
        out.z = a.z + b.z;
    }

    static subtractVectors(out: Vector3, a: Vector3, b: Vector3): void {
        out.x = a.x - b.x;
        out.y = a.y - b.y;
        out.z = a.z - b.z;
    }

    static scaleVector(out: Vector3, v: Vector3, scale: number): void {
        out.x = v.x * scale;
        out.y = v.y * scale;
        out.z = v.z * scale;
    }

    static dotProduct(a: Vector3, b: Vector3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static crossProduct(out: Vector3, a: Vector3, b: Vector3): void {
        const ax = a.x;
        const ay = a.y;
        const az = a.z;
        const bx = b.x;
        const by = b.y;
        const bz = b.z;

        out.x = ay * bz - az * by;
        out.y = az * bx - ax * bz;
        out.z = ax * by - ay * bx;
    }
}
