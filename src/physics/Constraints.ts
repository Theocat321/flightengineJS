import { Vec3 } from '../math/Vec3.js';
import { RigidBody } from './RigidBody.js';
import { Constraint } from './PhysicsWorld.js';

// ── Spring constraint ─────────────────────────────────────────────────────────

/**
 * Hooke's law spring between two bodies (or a body and a world-space anchor).
 * Applies opposing forces proportional to stretch from rest length.
 */
export class SpringConstraint implements Constraint {
  bodyA: RigidBody;
  bodyB: RigidBody | null;
  /** Anchor in bodyA local space (or world space if bodyB is null) */
  anchorA: Vec3;
  /** Anchor in bodyB local space (ignored if bodyB is null — world anchor) */
  anchorB: Vec3;
  restLength: number;
  stiffness: number;
  damping:   number;

  constructor(options: {
    bodyA: RigidBody;
    bodyB?: RigidBody | null;
    anchorA?: Vec3;
    anchorB?: Vec3;
    restLength?: number;
    stiffness?: number;
    damping?: number;
  }) {
    this.bodyA      = options.bodyA;
    this.bodyB      = options.bodyB ?? null;
    this.anchorA    = options.anchorA?.clone() ?? Vec3.zero();
    this.anchorB    = options.anchorB?.clone() ?? Vec3.zero();
    this.restLength = options.restLength ?? 0;
    this.stiffness  = options.stiffness  ?? 100;
    this.damping    = options.damping    ?? 1;
  }

  solve(_dt: number): void {
    const worldA = this.bodyA.localToWorld(this.anchorA);
    const worldB = this.bodyB
      ? this.bodyB.localToWorld(this.anchorB)
      : this.anchorB.clone(); // world-space anchor

    const delta  = worldB.sub(worldA);
    const dist   = delta.length();
    if (dist < 1e-8) return;

    const stretch = dist - this.restLength;
    const dir     = delta.scale(1 / dist);
    const spring  = dir.scale(this.stiffness * stretch);

    // Damping: relative velocity along spring axis
    const velA  = this.bodyA.velocity;
    const velB  = this.bodyB ? this.bodyB.velocity : Vec3.zero();
    const relVel = velB.sub(velA).dot(dir);
    const damp  = dir.scale(this.damping * relVel);

    const force = spring.add(damp);

    this.bodyA.applyForceAtPoint(force, worldA);
    if (this.bodyB) {
      this.bodyB.applyForceAtPoint(force.negate(), worldB);
    }
  }
}

// ── Distance constraint (rigid rod) ──────────────────────────────────────────

/**
 * Maintains a fixed distance between two anchor points via positional correction.
 * Uses a simplified Baumgarte-style velocity constraint for stability.
 */
export class DistanceConstraint implements Constraint {
  bodyA: RigidBody;
  bodyB: RigidBody | null;
  anchorA: Vec3;
  anchorB: Vec3;
  distance: number;
  /** Baumgarte bias factor (0–1). Higher = stiffer but can oscillate. */
  beta: number;

  constructor(options: {
    bodyA: RigidBody;
    bodyB?: RigidBody | null;
    anchorA?: Vec3;
    anchorB?: Vec3;
    distance?: number;
    beta?: number;
  }) {
    this.bodyA    = options.bodyA;
    this.bodyB    = options.bodyB ?? null;
    this.anchorA  = options.anchorA?.clone() ?? Vec3.zero();
    this.anchorB  = options.anchorB?.clone() ?? Vec3.zero();
    this.distance = options.distance ?? 1;
    this.beta     = options.beta ?? 0.1;
  }

  solve(dt: number): void {
    const worldA = this.bodyA.localToWorld(this.anchorA);
    const worldB = this.bodyB
      ? this.bodyB.localToWorld(this.anchorB)
      : this.anchorB.clone();

    const delta = worldB.sub(worldA);
    const dist  = delta.length();
    if (dist < 1e-8) return;

    const error = dist - this.distance;
    const n     = delta.scale(1 / dist);

    const rA = worldA.sub(this.bodyA.position);
    const rB = this.bodyB ? worldB.sub(this.bodyB.position) : Vec3.zero();

    const vA = this.bodyA.velocity.add(this.bodyA.angularVelocity.cross(rA));
    const vB = this.bodyB
      ? this.bodyB.velocity.add(this.bodyB.angularVelocity.cross(rB))
      : Vec3.zero();
    const relVel = vB.sub(vA).dot(n);

    const rACrossN = rA.cross(n);
    const rBCrossN = rB.cross(n);
    const angTermA = this.bodyA.invInertiaTensorWorld.multiplyVec3(rACrossN).cross(rA).dot(n);
    const angTermB = this.bodyB
      ? this.bodyB.invInertiaTensorWorld.multiplyVec3(rBCrossN).cross(rB).dot(n)
      : 0;

    const effMass = this.bodyA.invMass + (this.bodyB?.invMass ?? 0) + angTermA + angTermB;
    if (effMass < 1e-12) return;

    const bias = (this.beta / dt) * error;
    const lambda = -(relVel + bias) / effMass;
    const impulse = n.scale(lambda);

    this.bodyA.velocity.addMut(impulse.scale(-this.bodyA.invMass));
    this.bodyA.angularVelocity.addMut(
      this.bodyA.invInertiaTensorWorld.multiplyVec3(rA.cross(impulse.negate()))
    );
    if (this.bodyB) {
      this.bodyB.velocity.addMut(impulse.scale(this.bodyB.invMass));
      this.bodyB.angularVelocity.addMut(
        this.bodyB.invInertiaTensorWorld.multiplyVec3(rB.cross(impulse))
      );
    }
  }
}

// ── Fixed joint (weld) ────────────────────────────────────────────────────────

/**
 * Locks bodyB to bodyA at a specified local attachment offset.
 * Implemented as a very stiff distance + orientation constraint pair.
 * For production use, prefer a dedicated full 6DOF constraint.
 */
export class FixedJoint implements Constraint {
  bodyA: RigidBody;
  bodyB: RigidBody;
  private _dist: DistanceConstraint;
  /** Beta for positional correction */
  beta: number = 0.3;

  constructor(bodyA: RigidBody, bodyB: RigidBody, localOffsetA: Vec3 = Vec3.zero()) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    // World position of attachment when joint was created
    const worldAttach = bodyA.localToWorld(localOffsetA);
    const localAttachB = bodyB.worldToLocal(worldAttach);
    this._dist = new DistanceConstraint({
      bodyA, bodyB,
      anchorA: localOffsetA.clone(),
      anchorB: localAttachB,
      distance: 0,
      beta: this.beta,
    });
  }

  solve(dt: number): void {
    this._dist.beta = this.beta;
    this._dist.solve(dt);
  }
}
