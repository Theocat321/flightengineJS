import { Vec3 } from './Vec3.js';
import type { Quat } from './Quat.js';

// Column-major 3x3 matrix stored as Float64Array[9]
// Indices: [col0row0, col0row1, col0row2, col1row0, col1row1, col1row2, col2row0, col2row1, col2row2]
export class Mat3 {
  readonly data: Float64Array;

  constructor(data?: Float64Array) {
    this.data = data ?? new Float64Array(9);
  }

  static identity(): Mat3 {
    const m = new Mat3();
    m.data[0] = 1; m.data[4] = 1; m.data[8] = 1;
    return m;
  }

  static diagonal(x: number, y: number, z: number): Mat3 {
    const m = new Mat3();
    m.data[0] = x; m.data[4] = y; m.data[8] = z;
    return m;
  }

  static fromQuat(q: Quat): Mat3 {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const m = new Mat3();
    const d = m.data;
    d[0] = 1 - (yy + zz); d[1] = xy + wz;       d[2] = xz - wy;
    d[3] = xy - wz;       d[4] = 1 - (xx + zz); d[5] = yz + wx;
    d[6] = xz + wy;       d[7] = yz - wx;       d[8] = 1 - (xx + yy);
    return m;
  }

  multiply(b: Mat3): Mat3 {
    const a = this.data, bd = b.data;
    const r = new Mat3();
    const rd = r.data;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        rd[col * 3 + row] =
          a[0 * 3 + row]! * bd[col * 3 + 0]! +
          a[1 * 3 + row]! * bd[col * 3 + 1]! +
          a[2 * 3 + row]! * bd[col * 3 + 2]!;
      }
    }
    return r;
  }

  multiplyVec3(v: Vec3): Vec3 {
    const d = this.data;
    return new Vec3(
      d[0]! * v.x + d[3]! * v.y + d[6]! * v.z,
      d[1]! * v.x + d[4]! * v.y + d[7]! * v.z,
      d[2]! * v.x + d[5]! * v.y + d[8]! * v.z
    );
  }

  transpose(): Mat3 {
    const d = this.data;
    const r = new Mat3();
    const rd = r.data;
    rd[0] = d[0]!; rd[1] = d[3]!; rd[2] = d[6]!;
    rd[3] = d[1]!; rd[4] = d[4]!; rd[5] = d[7]!;
    rd[6] = d[2]!; rd[7] = d[5]!; rd[8] = d[8]!;
    return r;
  }

  // Computes R * M * R^T  (transforms an inertia tensor to world space)
  sandwichTransform(R: Mat3): Mat3 {
    return R.multiply(this).multiply(R.transpose());
  }

  clone(): Mat3 {
    return new Mat3(new Float64Array(this.data));
  }
}
