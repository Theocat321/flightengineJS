import { Mat3 } from '../math/Mat3.js';

export enum ShapeType {
  Sphere = 'Sphere',
  Box = 'Box',
  Cylinder = 'Cylinder',
}

export interface SphereShape {
  type: ShapeType.Sphere;
  radius: number;
}

export interface BoxShape {
  type: ShapeType.Box;
  halfExtents: { x: number; y: number; z: number };
}

export interface CylinderShape {
  type: ShapeType.Cylinder;
  radius: number;
  height: number;
}

export type Shape = SphereShape | BoxShape | CylinderShape;

export function computeInertiaTensor(shape: Shape, mass: number): Mat3 {
  switch (shape.type) {
    case ShapeType.Sphere: {
      const r2 = shape.radius * shape.radius;
      const I = (2 / 5) * mass * r2;
      return Mat3.diagonal(I, I, I);
    }
    case ShapeType.Box: {
      const { x: hx, y: hy, z: hz } = shape.halfExtents;
      const ex = 2 * hx, ey = 2 * hy, ez = 2 * hz;
      const Ix = (1 / 12) * mass * (ey * ey + ez * ez);
      const Iy = (1 / 12) * mass * (ex * ex + ez * ez);
      const Iz = (1 / 12) * mass * (ex * ex + ey * ey);
      return Mat3.diagonal(Ix, Iy, Iz);
    }
    case ShapeType.Cylinder: {
      const r2 = shape.radius * shape.radius;
      const h2 = shape.height * shape.height;
      // Cylinder axis = local -Z (forward direction). Iaxial is about the spin axis.
      const Iaxial   = 0.5 * mass * r2;                       // spinning about nose-tail axis
      const Ilateral = (1 / 12) * mass * (3 * r2 + h2);      // tumbling perpendicular
      return Mat3.diagonal(Ilateral, Ilateral, Iaxial);       // Z is axial
    }
  }
}
