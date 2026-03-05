import { Vec3 } from '../math/Vec3.js';
import { RigidBody, AttachedSurface, ThrustCurve } from './RigidBody.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { airDensity } from './Atmosphere.js';

// ── Gravity ───────────────────────────────────────────────────────────────────

/** Apply gravity using world.gravity (fixes the hardcoded -9.81 bug). */
export function applyGravity(body: RigidBody, world: PhysicsWorld): void {
  body.applyForce(world.gravity.scale(body.mass));
}

// ── Thrust ────────────────────────────────────────────────────────────────────

/**
 * Apply thrust force.  If the body has a thrustCurve it is sampled and
 * thrustAge is advanced by dt; otherwise thrustMagnitude is used as a
 * constant.  Does nothing when thrustEnabled = false.
 */
export function applyThrust(body: RigidBody, dt: number): void {
  if (!body.thrustEnabled) return;

  let thrust: number;
  if (body.aero.thrustCurve) {
    thrust = sampleThrustCurve(body.aero.thrustCurve, body.thrustAge);
    body.thrustAge += dt;
  } else {
    thrust = body.aero.thrustMagnitude;
  }

  if (thrust <= 0) return;
  const forward = body.getForwardDir();
  body.applyForce(forward.scale(thrust));
}

/** Linear interpolation along a thrust curve. Returns 0 after burnout. */
export function sampleThrustCurve(curve: ThrustCurve, t: number): number {
  const { times, thrusts } = curve;
  if (times.length === 0) return 0;
  if (t <= (times[0] ?? 0)) return thrusts[0] ?? 0;
  const last = times[times.length - 1] ?? 0;
  if (t >= last) return 0;
  for (let i = 0; i < times.length - 1; i++) {
    const t0 = times[i]!, t1 = times[i + 1]!;
    if (t >= t0 && t < t1) {
      const frac = (t - t0) / (t1 - t0);
      return (thrusts[i] ?? 0) + frac * ((thrusts[i + 1] ?? 0) - (thrusts[i] ?? 0));
    }
  }
  return 0;
}

// ── Aerodynamic drag ──────────────────────────────────────────────────────────

/**
 * Apply aerodynamic drag using ISA air density at body altitude and
 * apparent velocity (velocity − wind).
 */
export function applyAeroDrag(body: RigidBody, world: PhysicsWorld): void {
  const apparentVel = body.velocity.sub(world.wind);
  const speed = apparentVel.length();
  if (speed < 1e-4) return;
  const rho = airDensity(body.position.y);
  const vHat = apparentVel.scale(1 / speed);
  const dragMag = 0.5 * rho * body.aero.cd * body.aero.wingArea * speed * speed;
  body.applyForce(vHat.scale(-dragMag));
}

// ── Aerodynamic lift ──────────────────────────────────────────────────────────

/**
 * Apply lift.  AoA is computed relative to apparent velocity so wind affects
 * lift just as it affects drag.
 */
export function applyAeroLift(body: RigidBody, world: PhysicsWorld): void {
  const apparentVel = body.velocity.sub(world.wind);
  const speed = apparentVel.length();
  if (speed < 1e-4) return;
  const vHat = apparentVel.scale(1 / speed);
  const bodyUp = body.getUpDir();

  const alpha = Math.asin(Math.max(-1, Math.min(1, vHat.dot(bodyUp))));
  const rho = airDensity(body.position.y);

  const clMax = body.aero.cl0 + body.aero.clSlope * (Math.PI / 6);
  const cl = Math.max(-clMax, Math.min(clMax, body.aero.cl0 + body.aero.clSlope * alpha));

  const liftMag = 0.5 * rho * cl * body.aero.wingArea * speed * speed;
  const liftDir = bodyUp.sub(vHat.scale(bodyUp.dot(vHat))).normalize();
  const liftForce = liftDir.scale(liftMag);

  const liftOffset = body.getForwardDir().scale(-0.5);
  const worldLiftPoint = body.position.add(liftOffset);
  body.applyForceAtPoint(liftForce, worldLiftPoint);
}

// ── Angular damping ───────────────────────────────────────────────────────────

export function applyAngularDamping(body: RigidBody, damping: number = 0.98): void {
  body.angularVelocity.scaleMut(damping);
}

// ── Attached surfaces ─────────────────────────────────────────────────────────

/**
 * Apply forces from attached lift/drag surfaces using apparent velocity and
 * ISA density at body altitude.
 */
export function applyAttachedSurfaces(body: RigidBody, world: PhysicsWorld): void {
  if (body.attachedSurfaces.length === 0) return;

  const apparentVel = body.velocity.sub(world.wind);
  const speed = apparentVel.length();
  if (speed < 1e-4) return;
  const vHat = apparentVel.scale(1 / speed);
  const rho = airDensity(body.position.y);

  for (const surface of body.attachedSurfaces) {
    _applySurface(body, surface, vHat, speed, rho);
  }
}

function _applySurface(
  body: RigidBody,
  surface: AttachedSurface,
  vHat: Vec3,
  speed: number,
  rho: number
): void {
  const worldNormal = body.orientation.rotateVector(surface.localNormal);
  const worldPos = body.orientation.rotateVector(surface.localPosition).add(body.position);

  const alpha = Math.asin(Math.max(-1, Math.min(1, vHat.dot(worldNormal))));
  const clMax = surface.cl0 + surface.clSlope * (Math.PI / 6);
  const cl = Math.max(-clMax, Math.min(clMax, surface.cl0 + surface.clSlope * alpha));

  const dynPressure = 0.5 * rho * speed * speed;

  const dragMag = dynPressure * surface.cd * surface.area;
  body.applyForceAtPoint(vHat.scale(-dragMag), worldPos);

  const liftDir = worldNormal.sub(vHat.scale(worldNormal.dot(vHat))).normalize();
  const liftMag = dynPressure * cl * surface.area;
  body.applyForceAtPoint(liftDir.scale(liftMag), worldPos);
}
