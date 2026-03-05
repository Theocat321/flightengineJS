import { Vec3 } from './Vec3.js';
import { Mat3 } from './Mat3.js';

export class Quat {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  multiply(q: Quat): Quat {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;
    return new Quat(
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz
    );
  }

  rotateVector(v: Vec3): Vec3 {
    const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
    const ix = qw * v.x + qy * v.z - qz * v.y;
    const iy = qw * v.y + qz * v.x - qx * v.z;
    const iz = qw * v.z + qx * v.y - qy * v.x;
    const iw = -qx * v.x - qy * v.y - qz * v.z;
    return new Vec3(
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx
    );
  }

  conjugate(): Quat {
    return new Quat(-this.x, -this.y, -this.z, this.w);
  }

  normalize(): Quat {
    const len = Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
    if (len < 1e-12) return new Quat(0, 0, 0, 1);
    const inv = 1 / len;
    return new Quat(this.x * inv, this.y * inv, this.z * inv, this.w * inv);
  }

  static fromAxisAngle(axis: Vec3, angle: number): Quat {
    const half = angle * 0.5;
    const s = Math.sin(half);
    const n = axis.normalize();
    return new Quat(n.x * s, n.y * s, n.z * s, Math.cos(half));
  }

  toMat3(): Mat3 {
    return Mat3.fromQuat(this);
  }

  // Integrate angular velocity over dt using first-order approximation:
  // q_new = normalize(q + 0.5 * dt * omega_quat * q)
  integrate(omega: Vec3, dt: number): Quat {
    const omegaQuat = new Quat(omega.x, omega.y, omega.z, 0);
    const dq = omegaQuat.multiply(this);
    return new Quat(
      this.x + 0.5 * dt * dq.x,
      this.y + 0.5 * dt * dq.y,
      this.z + 0.5 * dt * dq.z,
      this.w + 0.5 * dt * dq.w
    ).normalize();
  }

  static slerp(a: Quat, b: Quat, t: number): Quat {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    if (dot < 0) {
      dot = -dot; bx = -bx; by = -by; bz = -bz; bw = -bw;
    }
    let scale0: number, scale1: number;
    if (dot > 0.9995) {
      scale0 = 1 - t; scale1 = t;
    } else {
      const theta = Math.acos(dot);
      const sinTheta = Math.sin(theta);
      scale0 = Math.sin((1 - t) * theta) / sinTheta;
      scale1 = Math.sin(t * theta) / sinTheta;
    }
    return new Quat(
      scale0 * a.x + scale1 * bx,
      scale0 * a.y + scale1 * by,
      scale0 * a.z + scale1 * bz,
      scale0 * a.w + scale1 * bw
    );
  }

  clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w);
  }

  static identity(): Quat {
    return new Quat(0, 0, 0, 1);
  }
}
