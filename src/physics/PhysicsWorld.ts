import { RigidBody } from './RigidBody.js';
import { applyGravity, applyThrust, applyAeroDrag, applyAeroLift, applyAngularDamping } from './Forces.js';
import { integrate } from './Integrator.js';
import { detectCollisions } from './CollisionDetection.js';
import { resolveContacts } from './ContactResolver.js';

export class PhysicsWorld {
  bodies: RigidBody[] = [];
  gravity: number = 9.81;
  rho: number = 1.225;  // air density kg/m³
  thrustActiveIds: Set<number> = new Set();

  private readonly fixedDt: number = 1 / 120;
  private readonly maxSubsteps: number = 8;
  private accumulator: number = 0;
  substepsLastFrame: number = 0;

  addBody(body: RigidBody): void {
    this.bodies.push(body);
  }

  removeBody(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
  }

  clear(): void {
    this.bodies.length = 0;
    this.thrustActiveIds.clear();
  }

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
  }

  getInterpolationAlpha(): number {
    return this.accumulator / this.fixedDt;
  }

  private _substep(dt: number): void {
    // Save previous state
    for (const body of this.bodies) {
      body.savePreviousState();
    }

    // Apply forces
    for (const body of this.bodies) {
      applyGravity(body);
      if (this.thrustActiveIds.has(body.id)) {
        applyThrust(body);
      }
      applyAeroDrag(body, this.rho);
      applyAeroLift(body, this.rho);
      applyAngularDamping(body);
      body.updateInvInertiaWorld();
    }

    // Detect collisions
    const contacts = detectCollisions(this.bodies);

    // Resolve contacts
    resolveContacts(contacts, dt);

    // Integrate
    for (const body of this.bodies) {
      integrate(body, dt);
      body.updateInvInertiaWorld();
    }

    // Clear accumulators
    for (const body of this.bodies) {
      body.clearAccumulators();
    }
  }
}
