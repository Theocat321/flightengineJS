import { Vec3 } from '../math/Vec3.js';
import { RigidBody } from './RigidBody.js';
import { applyGravity, applyThrust, applyAeroDrag, applyAeroLift, applyAngularDamping, applyAttachedSurfaces } from './Forces.js';
import { integrate } from './Integrator.js';
import { detectCollisions, Contact } from './CollisionDetection.js';
import { resolveContacts } from './ContactResolver.js';
// Note: StageJoint imports PhysicsWorld, so this must be a type-only import
// to avoid circular module issues; the concrete class is injected at runtime.
import type { StageJoint } from './StageJoint.js';
let _StageJointClass: (new (
  world: PhysicsWorld, bodyA: RigidBody, bodyB: RigidBody, offsetA?: Vec3
) => StageJoint) | null = null;
/** @internal Called by StageJoint module to register itself */
export function _registerStageJoint(cls: NonNullable<typeof _StageJointClass>): void {
  _StageJointClass = cls;
}

// ── Minimal typed event emitter ───────────────────────────────────────────────

export type WorldEventMap = {
  /** Fired after contact resolution when contacts exist this substep */
  contact: [contacts: Contact[]];
  /** Fired when a body transitions to sleeping */
  sleep:   [body: RigidBody];
  /** Fired when a sleeping body is woken */
  wake:    [body: RigidBody];
  /** Fired when a body is added to the world */
  bodyAdded: [body: RigidBody];
};

type EventListener<K extends keyof WorldEventMap> = (...args: WorldEventMap[K]) => void;

// ── Constraint interface ──────────────────────────────────────────────────────

export interface Constraint {
  bodyA: RigidBody;
  bodyB: RigidBody | null;
  solve(dt: number): void;
  /** Called on each substep to apply pre-solve impulses (optional) */
  preSolve?(dt: number): void;
}

// ── Serialization ─────────────────────────────────────────────────────────────

export interface WorldSnapshot {
  time: number;
  gravity: [number, number, number];
  wind:    [number, number, number];
  bodies: {
    id: number;
    posX: number; posY: number; posZ: number;
    velX: number; velY: number; velZ: number;
    oriW: number; oriX: number; oriY: number; oriZ: number;
    angX: number; angY: number; angZ: number;
    sleeping: boolean;
    thrustAge: number;
  }[];
}

// ── FlightRecorder hook interface (avoids circular import) ────────────────────

export interface IFlightRecorder {
  _record(time: number): void;
  _onBodyRemoved(body: RigidBody): void;
}

// ── PhysicsWorld ──────────────────────────────────────────────────────────────

export class PhysicsWorld {
  bodies: RigidBody[] = [];

  /** Gravity vector (m/s²). Default: (0, -9.81, 0). */
  gravity: Vec3 = new Vec3(0, -9.81, 0);

  /** Ambient wind velocity (m/s). Subtracted from body velocity when computing
   *  apparent velocity for drag/lift.  Default: zero. */
  wind: Vec3 = Vec3.zero();

  constraints: Constraint[] = [];

  /** @deprecated Use world.on('contact', handler) instead */
  onContact: ((contacts: Contact[]) => void) | null = null;

  /** Total simulated time in seconds */
  time: number = 0;

  // Sleep configuration
  sleepEnabled: boolean = true;
  /** Seconds below sleepThreshold before a body sleeps */
  sleepDelay: number = 0.5;

  private readonly fixedDt: number = 1 / 120;
  private readonly maxSubsteps: number = 8;
  private accumulator: number = 0;
  substepsLastFrame: number = 0;

  private _listeners: { [K in keyof WorldEventMap]?: Set<EventListener<K>> } = {};
  private _recorders: IFlightRecorder[] = [];

  // ── Public API ─────────────────────────────────────────────────────────────

  addBody(body: RigidBody): void {
    this.bodies.push(body);
    this.emit('bodyAdded', body);
  }

  removeBody(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
    for (const r of this._recorders) r._onBodyRemoved(body);
  }

  clear(): void {
    this.bodies.length = 0;
    this.constraints.length = 0;
  }

  addConstraint(c: Constraint): void {
    this.constraints.push(c);
  }

  removeConstraint(c: Constraint): void {
    const idx = this.constraints.indexOf(c);
    if (idx >= 0) this.constraints.splice(idx, 1);
  }

  attachRecorder(recorder: IFlightRecorder): void {
    this._recorders.push(recorder);
  }

  detachRecorder(recorder: IFlightRecorder): void {
    const idx = this._recorders.indexOf(recorder);
    if (idx >= 0) this._recorders.splice(idx, 1);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  on<K extends keyof WorldEventMap>(event: K, listener: EventListener<K>): void {
    let set = this._listeners[event] as Set<EventListener<K>> | undefined;
    if (!set) {
      set = new Set();
      (this._listeners as Record<string, Set<unknown>>)[event] = set;
    }
    set.add(listener);
  }

  off<K extends keyof WorldEventMap>(event: K, listener: EventListener<K>): void {
    (this._listeners[event] as Set<EventListener<K>> | undefined)?.delete(listener);
  }

  emit<K extends keyof WorldEventMap>(event: K, ...args: WorldEventMap[K]): void {
    const set = this._listeners[event] as Set<EventListener<K>> | undefined;
    if (set) {
      for (const fn of set) (fn as (...a: WorldEventMap[K]) => void)(...args);
    }
  }

  // ── Step ───────────────────────────────────────────────────────────────────

  step(dt: number): void {
    this.accumulator += dt;
    const clampedAcc = Math.min(this.accumulator, this.fixedDt * this.maxSubsteps);
    this.accumulator = clampedAcc;
    this.substepsLastFrame = 0;

    while (this.accumulator >= this.fixedDt) {
      this._substep(this.fixedDt);
      this.accumulator -= this.fixedDt;
      this.substepsLastFrame++;
    }

    this.time += dt;

    for (const r of this._recorders) r._record(this.time);
  }

  getInterpolationAlpha(): number {
    return this.accumulator / this.fixedDt;
  }

  private _substep(dt: number): void {
    for (const body of this.bodies) {
      body.savePreviousState();
    }

    const active = this.sleepEnabled
      ? this.bodies.filter(b => !b.sleeping)
      : this.bodies;

    // Apply forces
    for (const body of active) {
      applyGravity(body, this);
      applyThrust(body, dt); // internally checks thrustEnabled
      applyAeroDrag(body, this);
      applyAeroLift(body, this);
      applyAngularDamping(body);
      if (body.guidanceModule) {
        body.guidanceModule.update(body, dt);
      }
      applyAttachedSurfaces(body, this);
      body.updateInvInertiaWorld();
    }

    // Solve constraints (pre-solve)
    for (const c of this.constraints) {
      c.preSolve?.(dt);
    }

    // Integrate
    for (const body of active) {
      integrate(body, dt);
      body.updateInvInertiaWorld();
    }

    // Solve constraints (post-integrate)
    for (const c of this.constraints) {
      c.solve(dt);
    }

    // Detect and resolve collisions (all bodies, including static)
    const contacts = detectCollisions(this.bodies);
    if (contacts.length > 0) {
      resolveContacts(contacts, dt);
      this.emit('contact', contacts);
      // Legacy callback
      this.onContact?.(contacts);
    }

    // Sleep
    if (this.sleepEnabled) {
      this._updateSleep(dt);
    }

    // Clear accumulators
    for (const body of this.bodies) {
      body.clearAccumulators();
    }
  }

  private _updateSleep(dt: number): void {
    for (const body of this.bodies) {
      if (body.invMass === 0) continue;
      const speed = body.velocity.length() + body.angularVelocity.length();
      if (speed < body.sleepThreshold) {
        body._sleepTimer += dt;
        if (body._sleepTimer >= this.sleepDelay && !body.sleeping) {
          body.sleeping = true;
          this.emit('sleep', body);
        }
      } else {
        body._sleepTimer = 0;
        if (body.sleeping) {
          body.sleeping = false;
          this.emit('wake', body);
        }
      }
    }
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  serialize(): WorldSnapshot {
    return {
      time: this.time,
      gravity: [this.gravity.x, this.gravity.y, this.gravity.z],
      wind:    [this.wind.x,    this.wind.y,    this.wind.z],
      bodies: this.bodies.map(b => ({
        id:       b.id,
        posX: b.position.x,   posY: b.position.y,   posZ: b.position.z,
        velX: b.velocity.x,   velY: b.velocity.y,   velZ: b.velocity.z,
        oriW: b.orientation.w, oriX: b.orientation.x,
        oriY: b.orientation.y, oriZ: b.orientation.z,
        angX: b.angularVelocity.x, angY: b.angularVelocity.y, angZ: b.angularVelocity.z,
        sleeping:  b.sleeping,
        thrustAge: b.thrustAge,
      })),
    };
  }

  /**
   * Weld bodyB to bodyA and return a StageJoint that can later be
   * explosively separated.
   *
   * Requires that StageJoint.ts has been imported somewhere in the app
   * (it self-registers via _registerStageJoint on import).
   */
  couple(
    bodyA: RigidBody,
    bodyB: RigidBody,
    localOffsetA: Vec3 = Vec3.zero()
  ): StageJoint {
    if (!_StageJointClass) {
      throw new Error(
        'StageJoint not registered. Import "flight-engine-js/stage-joint" or ' +
        '"flight-engine-js" (full bundle) before calling world.couple().'
      );
    }
    return new _StageJointClass(this, bodyA, bodyB, localOffsetA);
  }

  deserialize(snap: WorldSnapshot): void {
    this.time = snap.time;
    this.gravity.set(snap.gravity[0], snap.gravity[1], snap.gravity[2]);
    this.wind.set(snap.wind[0], snap.wind[1], snap.wind[2]);
    const map = new Map(this.bodies.map(b => [b.id, b]));
    for (const bs of snap.bodies) {
      const body = map.get(bs.id);
      if (!body) continue;
      body.position.set(bs.posX, bs.posY, bs.posZ);
      body.velocity.set(bs.velX, bs.velY, bs.velZ);
      body.orientation.x = bs.oriX;
      body.orientation.y = bs.oriY;
      body.orientation.z = bs.oriZ;
      body.orientation.w = bs.oriW;
      body.angularVelocity.set(bs.angX, bs.angY, bs.angZ);
      body.sleeping  = bs.sleeping;
      body.thrustAge = bs.thrustAge;
    }
  }
}
