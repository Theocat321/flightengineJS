import { RigidBody, AttachedSurface, AeroProperties } from '../physics/RigidBody.js';
import { Shape, ShapeType } from '../physics/shapes.js';
import { Vec3 } from '../math/Vec3.js';

export interface BodyDefinition {
  name: string;
  shape: Shape;
  mass: number;
  aero: AeroProperties;
  restitution?: number;
  friction?: number;
  attachedSurfaces?: AttachedSurface[];
}

export function createBody(def: BodyDefinition): RigidBody {
  const body = new RigidBody(def.shape, def.mass, def.aero);
  if (def.restitution !== undefined) body.restitution = def.restitution;
  if (def.friction    !== undefined) body.friction    = def.friction;
  if (def.attachedSurfaces)         body.attachedSurfaces = def.attachedSurfaces.map(s => ({ ...s }));
  return body;
}

export const MissileBody: BodyDefinition = {
  name: 'Missile',
  shape: { type: ShapeType.Cylinder, radius: 0.1, height: 2.0 },
  mass: 50,
  aero: {
    wingArea: 0.03,
    cd: 0.3,
    cl0: 0,
    clSlope: 0,
    thrustMagnitude: 2000,
  },
  restitution: 0.05,
  friction: 0.4,
  attachedSurfaces: [
    { localPosition: new Vec3( 0,    0.12, -0.8), localNormal: new Vec3( 0,  1, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
    { localPosition: new Vec3( 0,   -0.12, -0.8), localNormal: new Vec3( 0, -1, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
    { localPosition: new Vec3( 0.12,  0,   -0.8), localNormal: new Vec3( 1,  0, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
    { localPosition: new Vec3(-0.12,  0,   -0.8), localNormal: new Vec3(-1,  0, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
  ],
};

export const GliderBody: BodyDefinition = {
  name: 'Glider',
  shape: { type: ShapeType.Box, halfExtents: { x: 1, y: 0.1, z: 0.5 } },
  mass: 5,
  aero: { wingArea: 4, cd: 0.04, cl0: 0.1, clSlope: 5, thrustMagnitude: 0 },
  restitution: 0.2,
  friction: 0.6,
};

export const CannonballBody: BodyDefinition = {
  name: 'Cannonball',
  shape: { type: ShapeType.Sphere, radius: 0.1 },
  mass: 5,
  aero: { wingArea: 0.031, cd: 0.47, cl0: 0, clSlope: 0, thrustMagnitude: 0 },
  restitution: 0.2,
  friction: 0.5,
};
