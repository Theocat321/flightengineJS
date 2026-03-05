export class Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  // Immutable ops — return new Vec3
  add(v: Vec3): Vec3 { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: Vec3): Vec3 { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  scale(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s); }
  negate(): Vec3 { return new Vec3(-this.x, -this.y, -this.z); }
  clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }

  dot(v: Vec3): number { return this.x * v.x + this.y * v.y + this.z * v.z; }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  lengthSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length(): number { return Math.sqrt(this.lengthSq()); }

  normalize(): Vec3 {
    const len = this.length();
    if (len < 1e-12) return new Vec3(0, 0, 0);
    return this.scale(1 / len);
  }

  // Mutating ops — modify in place, return this
  addMut(v: Vec3): this { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  subMut(v: Vec3): this { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  scaleMut(s: number): this { this.x *= s; this.y *= s; this.z *= s; return this; }

  set(x: number, y: number, z: number): this { this.x = x; this.y = y; this.z = z; return this; }
  copyFrom(v: Vec3): this { this.x = v.x; this.y = v.y; this.z = v.z; return this; }

  // Static factories
  static zero(): Vec3 { return new Vec3(0, 0, 0); }
  static one(): Vec3 { return new Vec3(1, 1, 1); }
  static up(): Vec3 { return new Vec3(0, 1, 0); }
  static forward(): Vec3 { return new Vec3(0, 0, -1); }
  static right(): Vec3 { return new Vec3(1, 0, 0); }

  static lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return new Vec3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
  }
}
