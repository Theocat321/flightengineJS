import { Vec3 } from './Vec3';
import { Quat } from './Quat';

/**
 * Column-major 3x3 matrix.
 * m[col][row] — columns are stored as Vec3 for clarity.
 * Internally: elements e[0..8] stored row-major for easy Vec3 multiply.
 * Row major: [ e0 e1 e2 ]   row0
 *            [ e3 e4 e5 ]   row1
 *            [ e6 e7 e8 ]   row2
 */
export class Mat3 {
  // Row-major storage
  e: [number, number, number, number, number, number, number, number, number];

  constructor(
    e0 = 1, e1 = 0, e2 = 0,
    e3 = 0, e4 = 1, e5 = 0,
    e6 = 0, e7 = 0, e8 = 1
  ) {
    this.e = [e0, e1, e2, e3, e4, e5, e6, e7, e8];
  }

  clone(): Mat3 {
    return new Mat3(...this.e);
  }

  /** Multiply this * v */
  mulVec(v: Vec3): Vec3 {
    const e = this.e;
    return new Vec3(
      e[0] * v.x + e[1] * v.y + e[2] * v.z,
      e[3] * v.x + e[4] * v.y + e[5] * v.z,
      e[6] * v.x + e[7] * v.y + e[8] * v.z
    );
  }

  /** Multiply this * m */
  mul(m: Mat3): Mat3 {
    const a = this.e, b = m.e;
    return new Mat3(
      a[0]*b[0]+a[1]*b[3]+a[2]*b[6],  a[0]*b[1]+a[1]*b[4]+a[2]*b[7],  a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
      a[3]*b[0]+a[4]*b[3]+a[5]*b[6],  a[3]*b[1]+a[4]*b[4]+a[5]*b[7],  a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
      a[6]*b[0]+a[7]*b[3]+a[8]*b[6],  a[6]*b[1]+a[7]*b[4]+a[8]*b[7],  a[6]*b[2]+a[7]*b[5]+a[8]*b[8]
    );
  }

  transpose(): Mat3 {
    const e = this.e;
    return new Mat3(e[0],e[3],e[6], e[1],e[4],e[7], e[2],e[5],e[8]);
  }

  det(): number {
    const e = this.e;
    return e[0]*(e[4]*e[8]-e[5]*e[7]) - e[1]*(e[3]*e[8]-e[5]*e[6]) + e[2]*(e[3]*e[7]-e[4]*e[6]);
  }

  inverse(): Mat3 {
    const e = this.e;
    const d = this.det();
    if (Math.abs(d) < 1e-15) return Mat3.identity();
    const inv = 1 / d;
    return new Mat3(
      (e[4]*e[8]-e[5]*e[7])*inv, -(e[1]*e[8]-e[2]*e[7])*inv,  (e[1]*e[5]-e[2]*e[4])*inv,
     -(e[3]*e[8]-e[5]*e[6])*inv,  (e[0]*e[8]-e[2]*e[6])*inv, -(e[0]*e[5]-e[2]*e[3])*inv,
      (e[3]*e[7]-e[4]*e[6])*inv, -(e[0]*e[7]-e[1]*e[6])*inv,  (e[0]*e[4]-e[1]*e[3])*inv
    );
  }

  scale(s: number): Mat3 {
    return new Mat3(...(this.e.map(v => v * s) as Mat3['e']));
  }

  add(m: Mat3): Mat3 {
    const a = this.e, b = m.e;
    return new Mat3(
      a[0]+b[0], a[1]+b[1], a[2]+b[2],
      a[3]+b[3], a[4]+b[4], a[5]+b[5],
      a[6]+b[6], a[7]+b[7], a[8]+b[8]
    );
  }

  /** Build rotation matrix from quaternion */
  static fromQuat(q: Quat): Mat3 {
    const { w, x, y, z } = q;
    return new Mat3(
      1-2*(y*y+z*z),   2*(x*y-w*z),     2*(x*z+w*y),
      2*(x*y+w*z),     1-2*(x*x+z*z),   2*(y*z-w*x),
      2*(x*z-w*y),     2*(y*z+w*x),     1-2*(x*x+y*y)
    );
  }

  /** Diagonal matrix */
  static diag(x: number, y: number, z: number): Mat3 {
    return new Mat3(x,0,0, 0,y,0, 0,0,z);
  }

  static identity(): Mat3 { return new Mat3(); }
  static zero(): Mat3     { return new Mat3(0,0,0, 0,0,0, 0,0,0); }

  toArray(): Mat3['e'] { return [...this.e] as Mat3['e']; }
}
