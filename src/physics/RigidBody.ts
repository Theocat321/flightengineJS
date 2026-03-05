import { Vec3 } from '../math/Vec3';
import { Quat } from '../math/Quat';
import { Mat3 } from '../math/Mat3';
import { Shape, ShapeType } from '../shapes';

export interface ThrustCurve {
  /** Times in seconds from ignition */
  times: number[];
  /** Thrust in Newtons at each time point */
  thrusts: number[];
}

export interface AeroSurface {
  /** Local-space normal of the lift surface */
  normal: Vec3;
  /** Lift coefficient */
  liftCoeff: number;
  /** Reference area for this surface (m²) */
  area: number;
}

export class RigidBody {
  // Identity
  id: string;

  // State
  position: Vec3;
  velocity: Vec3;
  orientation: Quat;
  angularVelocity: Vec3; // world space

  // Mass properties
  mass: number;
  invMass: number;
  /** Inertia tensor in body space */
  inertiaTensor: Mat3;
  /** Inverse inertia tensor in body space */
  invInertiaTensor: Mat3;

  // Accumulated forces/torques (reset each step)
  force: Vec3;
  torque: Vec3;

  // Shape
  shape: Shape;

  // Aerodynamics
  dragCoeff: number;       // dimensionless drag coefficient Cd
  referenceArea: number;   // m² for drag/lift reference area
  liftCoeff: number;       // Cl for body
  aeroSurfaces: AeroSurface[];

  // Thrust
  thrustMagnitude: number;            // constant thrust (N), used when no curve
  thrustDirection: Vec3;              // local space thrust direction
  thrustCurve?: ThrustCurve;
  thrustAge: number;                  // seconds since ignition
  thrustEnabled: boolean;

  // Guidance
  guidanceEnabled: boolean;

  // Sleep
  sleeping: boolean;
  sleepThreshold: number;            // m/s kinetic energy threshold
  _sleepTimer: number;               // seconds below threshold

  // User data
  userData: Record<string, unknown>;

  constructor(options: RigidBodyOptions) {
    this.id = options.id ?? crypto.randomUUID();
    this.shape = options.shape;
    this.mass = options.mass;
    this.invMass = options.mass > 0 ? 1 / options.mass : 0;

    this.position = options.position?.clone() ?? Vec3.zero();
    this.velocity = options.velocity?.clone() ?? Vec3.zero();
    this.orientation = options.orientation?.clone() ?? Quat.identity();
    this.angularVelocity = options.angularVelocity?.clone() ?? Vec3.zero();

    this.inertiaTensor = options.inertiaTensor ?? computeInertiaTensor(options.shape, options.mass);
    this.invInertiaTensor = this.inertiaTensor.inverse();

    this.force  = Vec3.zero();
    this.torque = Vec3.zero();

    this.dragCoeff      = options.dragCoeff      ?? 0.47;
    this.referenceArea  = options.referenceArea   ?? 1.0;
    this.liftCoeff      = options.liftCoeff       ?? 0.0;
    this.aeroSurfaces   = options.aeroSurfaces    ?? [];

    this.thrustMagnitude  = options.thrustMagnitude  ?? 0;
    this.thrustDirection  = options.thrustDirection?.clone() ?? new Vec3(0, 0, -1);
    this.thrustCurve      = options.thrustCurve;
    this.thrustAge        = 0;
    this.thrustEnabled    = options.thrustEnabled ?? true;

    this.guidanceEnabled  = options.guidanceEnabled ?? false;

    this.sleeping         = false;
    this.sleepThreshold   = options.sleepThreshold ?? 0.05;
    this._sleepTimer      = 0;

    this.userData = options.userData ?? {};
  }

  /** World-space inverse inertia tensor */
  getWorldInvInertiaTensor(): Mat3 {
    const R = Mat3.fromQuat(this.orientation);
    const Rt = R.transpose();
    return R.mul(this.invInertiaTensor).mul(Rt);
  }

  /** Apply an impulse (world space) at a world-space point */
  applyImpulse(impulse: Vec3, point?: Vec3): void {
    this.velocity.addInPlace(impulse.scale(this.invMass));
    if (point) {
      const r = point.sub(this.position);
      const angImpulse = r.cross(impulse);
      const worldInvI = this.getWorldInvInertiaTensor();
      this.angularVelocity.addInPlace(worldInvI.mulVec(angImpulse));
    }
    this.wake();
  }

  /** Add a force (world space) to accumulator */
  addForce(f: Vec3): void {
    this.force.addInPlace(f);
  }

  /** Add a torque (world space) to accumulator */
  addTorque(t: Vec3): void {
    this.torque.addInPlace(t);
  }

  /** Add a force at a world-space point, generating both force and torque */
  addForceAtPoint(f: Vec3, point: Vec3): void {
    this.force.addInPlace(f);
    const r = point.sub(this.position);
    this.torque.addInPlace(r.cross(f));
  }

  clearForces(): void {
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  wake(): void {
    if (this.sleeping) {
      this.sleeping = false;
      this._sleepTimer = 0;
    }
  }

  /** Kinetic energy (translational + rotational) */
  kineticEnergy(): number {
    const vSq = this.velocity.lengthSq();
    const wSq = this.angularVelocity.lengthSq();
    return 0.5 * this.mass * vSq + 0.5 * wSq; // approx; ignores inertia tensor for sleep check
  }

  toSnapshot(): RigidBodySnapshot {
    return {
      id: this.id,
      position: this.position.toArray(),
      velocity: this.velocity.toArray(),
      orientation: this.orientation.toArray(),
      angularVelocity: this.angularVelocity.toArray(),
      force: this.force.toArray(),
      torque: this.torque.toArray(),
      sleeping: this.sleeping,
      thrustAge: this.thrustAge,
    };
  }

  fromSnapshot(snap: RigidBodySnapshot): void {
    this.position.set(...snap.position);
    this.velocity.set(...snap.velocity);
    this.orientation.set(...snap.orientation);
    this.angularVelocity.set(...snap.angularVelocity);
    this.force.set(...snap.force);
    this.torque.set(...snap.torque);
    this.sleeping = snap.sleeping;
    this.thrustAge = snap.thrustAge;
  }
}

export interface RigidBodyOptions {
  id?: string;
  shape: Shape;
  mass: number;
  position?: Vec3;
  velocity?: Vec3;
  orientation?: Quat;
  angularVelocity?: Vec3;
  inertiaTensor?: Mat3;
  dragCoeff?: number;
  referenceArea?: number;
  liftCoeff?: number;
  aeroSurfaces?: AeroSurface[];
  thrustMagnitude?: number;
  thrustDirection?: Vec3;
  thrustCurve?: ThrustCurve;
  thrustEnabled?: boolean;
  guidanceEnabled?: boolean;
  sleepThreshold?: number;
  userData?: Record<string, unknown>;
}

export interface RigidBodySnapshot {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  orientation: [number, number, number, number];
  angularVelocity: [number, number, number];
  force: [number, number, number];
  torque: [number, number, number];
  sleeping: boolean;
  thrustAge: number;
}

/** Analytically compute inertia tensor for common shapes */
function computeInertiaTensor(shape: Shape, mass: number): Mat3 {
  switch (shape.type) {
    case ShapeType.Sphere: {
      const I = (2 / 5) * mass * shape.radius * shape.radius;
      return Mat3.diag(I, I, I);
    }
    case ShapeType.Box: {
      const [hx, hy, hz] = shape.halfExtents;
      const Ix = (1 / 3) * mass * (hy * hy + hz * hz);
      const Iy = (1 / 3) * mass * (hx * hx + hz * hz);
      const Iz = (1 / 3) * mass * (hx * hx + hy * hy);
      return Mat3.diag(Ix, Iy, Iz);
    }
    case ShapeType.Cylinder: {
      const r = shape.radius, h = shape.halfHeight * 2;
      const Iaxial = 0.5 * mass * r * r;
      const Iperp  = (1 / 12) * mass * (3 * r * r + h * h);
      // Axis along local Y
      return Mat3.diag(Iperp, Iaxial, Iperp);
    }
    case ShapeType.Capsule: {
      // Cylinder part + two hemispheres
      const r = shape.radius, hc = shape.halfHeight * 2;
      const mCyl  = mass * (hc / (hc + 4 * r / 3));
      const mHemi = (mass - mCyl) * 0.5;
      const Iaxial = 0.5 * mCyl * r * r + 2 * mHemi * (2 / 5) * r * r;
      const Iperp  = (1 / 12) * mCyl * (3 * r * r + hc * hc)
                   + 2 * mHemi * ((2 / 5) * r * r + (hc / 2 + 3 * r / 8) ** 2);
      return Mat3.diag(Iperp, Iaxial, Iperp);
    }
  }
}
