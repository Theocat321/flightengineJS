import { Vec3 } from '../math/Vec3.js';
import { RigidBody } from './RigidBody.js';

const GRAVITY = new Vec3(0, -9.81, 0);

export function applyGravity(body: RigidBody): void {
  body.applyForce(GRAVITY.scale(body.mass));
}

export function applyThrust(body: RigidBody): void {
  if (body.aero.thrustMagnitude <= 0) return;
  const forward = body.getForwardDir();
  body.applyForce(forward.scale(body.aero.thrustMagnitude));
}

export function applyAeroDrag(body: RigidBody, rho: number): void {
  const speed = body.velocity.length();
  if (speed < 1e-4) return;
  const vHat = body.velocity.scale(1 / speed);
  const dragMag = 0.5 * rho * body.aero.cd * body.aero.wingArea * speed * speed;
  body.applyForce(vHat.scale(-dragMag));
}

export function applyAeroLift(body: RigidBody, rho: number): void {
  const speed = body.velocity.length();
  if (speed < 1e-4) return;
  const vHat = body.velocity.scale(1 / speed);
  const bodyUp = body.getUpDir();

  // Angle of Attack: angle between velocity direction (projected) and body forward
  const forward = body.getForwardDir();
  // AoA = angle from velocity to forward in the plane of bodyUp
  const dot = Math.max(-1, Math.min(1, vHat.dot(forward)));
  // Sign from vertical component
  const alpha = Math.asin(Math.max(-1, Math.min(1, vHat.dot(bodyUp))));

  // Lift coefficient
  const clMax = body.aero.cl0 + body.aero.clSlope * (Math.PI / 6); // stall at ~30 deg
  const cl = Math.max(-clMax, Math.min(clMax, body.aero.cl0 + body.aero.clSlope * alpha));

  const liftMag = 0.5 * rho * cl * body.aero.wingArea * speed * speed;

  // Lift direction: perpendicular to velocity in the bodyUp-vHat plane
  const liftDir = bodyUp.sub(vHat.scale(bodyUp.dot(vHat))).normalize();
  const liftForce = liftDir.scale(liftMag);

  // Apply at offset to generate pitch-restoring torque (behind CG)
  const liftOffset = body.getForwardDir().scale(-0.5);
  const worldLiftPoint = body.position.add(liftOffset);
  body.applyForceAtPoint(liftForce, worldLiftPoint);
}

export function applyAngularDamping(body: RigidBody, damping: number = 0.98): void {
  body.angularVelocity.scaleMut(damping);
}
