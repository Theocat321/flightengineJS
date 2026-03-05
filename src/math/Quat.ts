import { Vec3 } from './Vec3';

/** Unit quaternion representing a rotation: (w, x, y, z) */
export class Quat {
  constructor(
    public w: number = 1,
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  clone(): Quat {
    return new Quat(this.w, this.x, this.y, this.z);
  }

  set(w: number, x: number, y: number, z: number): this {
    this.w = w; this.x = x; this.y = y; this.z = z;
    return this;
  }

  copyFrom(q: Quat): this {
    this.w = q.w; this.x = q.x; this.y = q.y; this.z = q.z;
    return this;
  }

  /** Hamilton product: this * q */
  mul(q: Quat): Quat {
    return new Quat(
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w
    );
  }

  conjugate(): Quat {
    return new Quat(this.w, -this.x, -this.y, -this.z);
  }

  normSq(): number {
    return this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;
  }

  norm(): number {
    return Math.sqrt(this.normSq());
  }

  normalize(): Quat {
    const n = this.norm();
    if (n < 1e-10) return Quat.identity();
    return new Quat(this.w / n, this.x / n, this.y / n, this.z / n);
  }

  normalizeInPlace(): this {
    const n = this.norm();
    if (n < 1e-10) { this.w = 1; this.x = this.y = this.z = 0; return this; }
    this.w /= n; this.x /= n; this.y /= n; this.z /= n;
    return this;
  }

  /** Rotate a vector by this quaternion */
  rotateVec(v: Vec3): Vec3 {
    // Optimized sandwich product: q * [0,v] * q*
    const { w, x, y, z } = this;
    const vx = v.x, vy = v.y, vz = v.z;
    const tx = 2 * (y * vz - z * vy);
    const ty = 2 * (z * vx - x * vz);
    const tz = 2 * (x * vy - y * vx);
    return new Vec3(
      vx + w * tx + y * tz - z * ty,
      vy + w * ty + z * tx - x * tz,
      vz + w * tz + x * ty - y * tx
    );
  }

  /** Inverse rotate (rotate by conjugate) */
  inverseRotateVec(v: Vec3): Vec3 {
    return this.conjugate().rotateVec(v);
  }

  /** Create from axis-angle (axis need not be normalised) */
  static fromAxisAngle(axis: Vec3, angleRad: number): Quat {
    const n = axis.normalize();
    const half = angleRad * 0.5;
    const s = Math.sin(half);
    return new Quat(Math.cos(half), n.x * s, n.y * s, n.z * s);
  }

  /** Create from Euler angles (radians, XYZ intrinsic) */
  static fromEuler(rx: number, ry: number, rz: number): Quat {
    const cx = Math.cos(rx * 0.5), sx = Math.sin(rx * 0.5);
    const cy = Math.cos(ry * 0.5), sy = Math.sin(ry * 0.5);
    const cz = Math.cos(rz * 0.5), sz = Math.sin(rz * 0.5);
    return new Quat(
      cx * cy * cz + sx * sy * sz,
      sx * cy * cz - cx * sy * sz,
      cx * sy * cz + sx * cy * sz,
      cx * cy * sz - sx * sy * cz
    );
  }

  /** Spherical linear interpolation */
  slerp(q: Quat, t: number): Quat {
    let dot = this.w * q.w + this.x * q.x + this.y * q.y + this.z * q.z;
    // Take shortest arc
    let qw = q.w, qx = q.x, qy = q.y, qz = q.z;
    if (dot < 0) { dot = -dot; qw = -qw; qx = -qx; qy = -qy; qz = -qz; }
    if (dot > 0.9995) {
      // Linear interpolation for nearly identical quaternions
      const r = new Quat(
        this.w + t * (qw - this.w),
        this.x + t * (qx - this.x),
        this.y + t * (qy - this.y),
        this.z + t * (qz - this.z)
      );
      return r.normalize();
    }
    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta = Math.sin(theta);
    const sinTheta0 = Math.sin(theta0);
    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;
    return new Quat(
      s0 * this.w + s1 * qw,
      s0 * this.x + s1 * qx,
      s0 * this.y + s1 * qy,
      s0 * this.z + s1 * qz
    );
  }

  /** Integrate angular velocity (world space) over dt */
  integrateAngularVelocity(omega: Vec3, dt: number): Quat {
    const wx = omega.x, wy = omega.y, wz = omega.z;
    const half = 0.5 * dt;
    const dq = new Quat(
      (-this.x * wx - this.y * wy - this.z * wz) * half,
      ( this.w * wx + this.y * wz - this.z * wy) * half,
      ( this.w * wy + this.z * wx - this.x * wz) * half,
      ( this.w * wz + this.x * wy - this.y * wx) * half
    );
    return new Quat(
      this.w + dq.w,
      this.x + dq.x,
      this.y + dq.y,
      this.z + dq.z
    ).normalize();
  }

  toArray(): [number, number, number, number] {
    return [this.w, this.x, this.y, this.z];
  }

  static fromArray(arr: [number, number, number, number]): Quat {
    return new Quat(arr[0], arr[1], arr[2], arr[3]);
  }

  static identity(): Quat { return new Quat(1, 0, 0, 0); }
}
