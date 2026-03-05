import { Vec3 } from '../math/Vec3.js';
import { RigidBody } from './RigidBody.js';
import { PhysicsWorld, _registerStageJoint } from './PhysicsWorld.js';
import { FixedJoint } from './Constraints.js';

/**
 * A welded connection between two bodies that can be explosively separated.
 *
 * Create via `world.couple(bodyA, bodyB, localOffsetA)` or directly:
 * ```ts
 * const joint = new StageJoint(world, booster, payload, new Vec3(0, 0.5, 0));
 * // later:
 * joint.separate(500); // 500 N·s separation impulse
 * ```
 */
export class StageJoint {
  readonly bodyA: RigidBody;
  readonly bodyB: RigidBody;

  private _world:     PhysicsWorld;
  private _joint:     FixedJoint;
  private _separated: boolean = false;

  constructor(
    world: PhysicsWorld,
    bodyA: RigidBody,
    bodyB: RigidBody,
    localOffsetA: Vec3 = Vec3.zero()
  ) {
    this.bodyA  = bodyA;
    this.bodyB  = bodyB;
    this._world = world;
    this._joint = new FixedJoint(bodyA, bodyB, localOffsetA);
    world.addConstraint(this._joint);
  }

  get separated(): boolean {
    return this._separated;
  }

  /**
   * Remove the weld constraint and apply equal-and-opposite separation impulses
   * along bodyA's forward axis.
   *
   * @param separationImpulse  Magnitude in N·s. Default: 0 (just release).
   */
  separate(separationImpulse: number = 0): void {
    if (this._separated) return;
    this._separated = true;

    this._world.removeConstraint(this._joint);

    if (separationImpulse > 0) {
      const dir = this.bodyA.getForwardDir();
      // bodyA gets pushed backward, bodyB gets pushed forward
      this.bodyA.velocity.addMut(dir.negate().scale(separationImpulse * this.bodyA.invMass));
      this.bodyB.velocity.addMut(dir.scale(separationImpulse * this.bodyB.invMass));
    }
  }
}

// Self-register with PhysicsWorld so world.couple() works after this module loads.
_registerStageJoint(StageJoint);
