import { Vec3 } from '../math/Vec3';
import { RigidBody } from './RigidBody';
import { Contact, detectCollisions } from './Collision';
import { resolveContacts } from './ContactResolver';
import { applyAllForces } from './Forces';
import { integrateBody } from './Integrator';
import { GuidanceModule } from '../guidance/GuidanceModule';
import { Constraint } from './Constraints';
import { WorldEventEmitter } from '../events/EventEmitter';
import { FlightRecorder } from './FlightRecorder';

export interface PhysicsWorldOptions {
  gravity?: Vec3;
  wind?: Vec3;
  substeps?: number;
  sleepEnabled?: boolean;
  sleepDelay?: number; // seconds below threshold before sleeping
}

export class PhysicsWorld {
  bodies: RigidBody[] = [];
  gravity: Vec3;
  wind: Vec3;
  time: number = 0;

  substeps: number;
  sleepEnabled: boolean;
  sleepDelay: number;

  constraints: Constraint[] = [];
  guidanceModules: Map<string, GuidanceModule> = new Map();
  recorders: FlightRecorder[] = [];

  events: WorldEventEmitter = new WorldEventEmitter();

  /** Last contacts from collision detection */
  lastContacts: Contact[] = [];

  constructor(options: PhysicsWorldOptions = {}) {
    this.gravity       = options.gravity     ?? new Vec3(0, -9.81, 0);
    this.wind          = options.wind        ?? Vec3.zero();
    this.substeps      = options.substeps    ?? 1;
    this.sleepEnabled  = options.sleepEnabled ?? true;
    this.sleepDelay    = options.sleepDelay   ?? 0.5;
  }

  addBody(body: RigidBody): void {
    this.bodies.push(body);
    this.events.emit('bodyAdded', body);
  }

  removeBody(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) this.bodies.splice(idx, 1);
    this.guidanceModules.delete(body.id);
    this.recorders.forEach(r => r._onBodyRemoved(body));
  }

  addConstraint(c: Constraint): void {
    this.constraints.push(c);
  }

  removeConstraint(c: Constraint): void {
    const idx = this.constraints.indexOf(c);
    if (idx !== -1) this.constraints.splice(idx, 1);
  }

  attachGuidance(body: RigidBody, module: GuidanceModule): void {
    this.guidanceModules.set(body.id, module);
  }

  attachRecorder(recorder: FlightRecorder): void {
    this.recorders.push(recorder);
  }

  step(dt: number): void {
    const subDt = dt / this.substeps;

    for (let sub = 0; sub < this.substeps; sub++) {
      this._subStep(subDt);
    }
    this.time += dt;

    // Record frames
    for (const recorder of this.recorders) {
      recorder._record(this.time);
    }
  }

  private _subStep(dt: number): void {
    const activeBodies = this.sleepEnabled
      ? this.bodies.filter(b => !b.sleeping)
      : this.bodies;

    // 1. Run guidance modules
    for (const body of activeBodies) {
      const gm = this.guidanceModules.get(body.id);
      if (gm && body.guidanceEnabled) {
        gm.update(body, this, dt);
      }
    }

    // 2. Apply forces
    for (const body of activeBodies) {
      applyAllForces(body, this, dt);
    }

    // 3. Integrate
    for (const body of activeBodies) {
      integrateBody(body, dt);
    }

    // 4. Solve constraints
    for (const constraint of this.constraints) {
      constraint.solve(dt);
    }

    // 5. Collision detection
    this.lastContacts = detectCollisions(this.bodies);

    // 6. Contact resolution
    if (this.lastContacts.length > 0) {
      resolveContacts(this.lastContacts);
      this.events.emit('contact', this.lastContacts);
    }

    // 7. Sleep system
    if (this.sleepEnabled) {
      this._updateSleep(dt);
    }

    // 8. Clear forces
    for (const body of this.bodies) {
      body.clearForces();
    }
  }

  private _updateSleep(dt: number): void {
    for (const body of this.bodies) {
      if (body.invMass === 0) continue; // static bodies don't sleep
      const speed = body.velocity.length() + body.angularVelocity.length();
      if (speed < body.sleepThreshold) {
        body._sleepTimer += dt;
        if (body._sleepTimer >= this.sleepDelay && !body.sleeping) {
          body.sleeping = true;
          this.events.emit('sleep', body);
        }
      } else {
        body._sleepTimer = 0;
        if (body.sleeping) {
          body.sleeping = false;
          this.events.emit('wake', body);
        }
      }
    }
  }

  serialize(): WorldSnapshot {
    return {
      time: this.time,
      gravity: this.gravity.toArray(),
      wind: this.wind.toArray(),
      bodies: this.bodies.map(b => b.toSnapshot()),
    };
  }

  deserialize(snap: WorldSnapshot): void {
    this.time = snap.time;
    this.gravity.set(...snap.gravity);
    this.wind.set(...snap.wind);
    const map = new Map(this.bodies.map(b => [b.id, b]));
    for (const bs of snap.bodies) {
      const body = map.get(bs.id);
      if (body) body.fromSnapshot(bs);
    }
  }
}

export interface WorldSnapshot {
  time: number;
  gravity: [number, number, number];
  wind: [number, number, number];
  bodies: import('./RigidBody').RigidBodySnapshot[];
}
