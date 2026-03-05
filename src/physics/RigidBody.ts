import { Vec3 } from '../math/Vec3.js';
import { Quat } from '../math/Quat.js';
import { Mat3 } from '../math/Mat3.js';
import { Shape, computeInertiaTensor } from './shapes.js';

let nextId = 0;

export interface AttachedSurface {
  localPosition: Vec3;
  localNormal: Vec3;
  area: number;
  cd: number;
  cl0: number;
  clSlope: number;
}

export interface GuidanceModule {
  update(body: RigidBody, dt: number): void;
}

export interface AeroProperties {
  wingArea: number;
  cd: number;        // drag coefficient
  cl0: number;       // lift at zero AoA
  clSlope: number;   // lift slope (per radian)
  thrustMagnitude: number;
}

export class RigidBody {
  readonly id: number;

  // Mass
  mass: number;
  invMass: number;

  // Inertia tensors
  inertiaTensorLocal: Mat3;      // body-space
  invInertiaTensorLocal: Mat3;   // body-space inverse
  invInertiaTensorWorld: Mat3;   // world-space inverse (updated each frame)

  // State
  position: Vec3;
  velocity: Vec3;
  orientation: Quat;
  angularVelocity: Vec3;  // world space

  // Previous state (for interpolation)
  previousPosition: Vec3;
  previousOrientation: Quat;

  // Accumulators
  force: Vec3;
  torque: Vec3;

  // Shape
  shape: Shape;

  // Aerodynamic properties
  aero: AeroProperties;

  // Material
  restitution: number;
  friction: number;
  attachedSurfaces: AttachedSurface[] = [];
  guidanceModule: GuidanceModule | null = null;

  constructor(shape: Shape, mass: number, aero?: Partial<AeroProperties>) {
    this.id = nextId++;
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;

    this.shape = shape;
    this.inertiaTensorLocal = computeInertiaTensor(shape, mass);
    this.invInertiaTensorLocal = this._invertDiagonal(this.inertiaTensorLocal);
    this.invInertiaTensorWorld = Mat3.identity();

    this.position = Vec3.zero();
    this.velocity = Vec3.zero();
    this.orientation = Quat.identity();
    this.angularVelocity = Vec3.zero();

    this.previousPosition = Vec3.zero();
    this.previousOrientation = Quat.identity();

    this.force = Vec3.zero();
    this.torque = Vec3.zero();

    this.aero = {
      wingArea: aero?.wingArea ?? 1,
      cd: aero?.cd ?? 0.1,
      cl0: aero?.cl0 ?? 0,
      clSlope: aero?.clSlope ?? 0,
      thrustMagnitude: aero?.thrustMagnitude ?? 0,
    };

    this.restitution = 0.3;
    this.friction = 0.5;
  }

  private _invertDiagonal(m: Mat3): Mat3 {
    const d = m.data;
    const inv = (v: number) => Math.abs(v) > 1e-14 ? 1 / v : 0;
    return Mat3.diagonal(inv(d[0]!), inv(d[4]!), inv(d[8]!));
  }

  updateInvInertiaWorld(): void {
    const R = Mat3.fromQuat(this.orientation);
    this.invInertiaTensorWorld = this.invInertiaTensorLocal.sandwichTransform(R);
  }

  applyForce(f: Vec3): void {
    this.force.addMut(f);
  }

  applyForceAtPoint(f: Vec3, worldPoint: Vec3): void {
    this.force.addMut(f);
    const r = worldPoint.sub(this.position);
    this.torque.addMut(r.cross(f));
  }

  applyTorque(t: Vec3): void {
    this.torque.addMut(t);
  }

  clearAccumulators(): void {
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  getForwardDir(): Vec3 {
    return this.orientation.rotateVector(new Vec3(0, 0, -1));
  }

  getUpDir(): Vec3 {
    return this.orientation.rotateVector(new Vec3(0, 1, 0));
  }

  getRightDir(): Vec3 {
    return this.orientation.rotateVector(new Vec3(1, 0, 0));
  }

  localToWorld(localVec: Vec3): Vec3 {
    return this.orientation.rotateVector(localVec).add(this.position);
  }

  worldToLocal(worldVec: Vec3): Vec3 {
    return this.orientation.conjugate().rotateVector(worldVec.sub(this.position));
  }

  savePreviousState(): void {
    this.previousPosition.copyFrom(this.position);
    this.previousOrientation = this.orientation.clone();
  }
}
