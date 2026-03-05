export class Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  copyFrom(v: Vec3): this {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }

  add(v: Vec3): Vec3 {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  addInPlace(v: Vec3): this {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }

  sub(v: Vec3): Vec3 {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  subInPlace(v: Vec3): this {
    this.x -= v.x; this.y -= v.y; this.z -= v.z;
    return this;
  }

  scale(s: number): Vec3 {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  scaleInPlace(s: number): this {
    this.x *= s; this.y *= s; this.z *= s;
    return this;
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  normalize(): Vec3 {
    const len = this.length();
    if (len < 1e-10) return new Vec3();
    return this.scale(1 / len);
  }

  normalizeInPlace(): this {
    const len = this.length();
    if (len < 1e-10) return this;
    return this.scaleInPlace(1 / len);
  }

  negate(): Vec3 {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  distanceTo(v: Vec3): number {
    return this.sub(v).length();
  }

  lerp(v: Vec3, t: number): Vec3 {
    return new Vec3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  /** Component-wise multiply */
  mul(v: Vec3): Vec3 {
    return new Vec3(this.x * v.x, this.y * v.y, this.z * v.z);
  }

  equals(v: Vec3, eps = 1e-6): boolean {
    return (
      Math.abs(this.x - v.x) < eps &&
      Math.abs(this.y - v.y) < eps &&
      Math.abs(this.z - v.z) < eps
    );
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  static fromArray(arr: [number, number, number]): Vec3 {
    return new Vec3(arr[0], arr[1], arr[2]);
  }

  static zero(): Vec3 { return new Vec3(0, 0, 0); }
  static one(): Vec3  { return new Vec3(1, 1, 1); }
  static up(): Vec3   { return new Vec3(0, 1, 0); }
  static forward(): Vec3 { return new Vec3(0, 0, -1); }
  static right(): Vec3   { return new Vec3(1, 0, 0); }
}
