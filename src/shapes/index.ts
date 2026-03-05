export const enum ShapeType {
  Sphere   = 'Sphere',
  Box      = 'Box',
  Cylinder = 'Cylinder',
  Capsule  = 'Capsule',
}

export interface SphereShape {
  type: ShapeType.Sphere;
  radius: number;
}

export interface BoxShape {
  type: ShapeType.Box;
  halfExtents: [number, number, number]; // hx, hy, hz
}

export interface CylinderShape {
  type: ShapeType.Cylinder;
  radius: number;
  halfHeight: number; // half the total height along local Y
}

export interface CapsuleShape {
  type: ShapeType.Capsule;
  radius: number;
  halfHeight: number; // half the cylindrical part height; total = halfHeight*2 + radius*2
}

export type Shape = SphereShape | BoxShape | CylinderShape | CapsuleShape;

// Helpers
export function makeSphere(radius: number): SphereShape {
  return { type: ShapeType.Sphere, radius };
}
export function makeBox(hx: number, hy: number, hz: number): BoxShape {
  return { type: ShapeType.Box, halfExtents: [hx, hy, hz] };
}
export function makeCylinder(radius: number, halfHeight: number): CylinderShape {
  return { type: ShapeType.Cylinder, radius, halfHeight };
}
export function makeCapsule(radius: number, halfHeight: number): CapsuleShape {
  return { type: ShapeType.Capsule, radius, halfHeight };
}
