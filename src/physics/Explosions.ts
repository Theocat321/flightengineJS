import { Vec3 } from '../math/Vec3.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { RigidBody } from './RigidBody.js';
import { ShapeType } from './shapes.js';

/**
 * Apply an instantaneous radial impulse to all bodies within radius.
 * Impulse at epicentre = power (N·s), falls off quadratically with distance.
 */
export function applyExplosion(
  world: PhysicsWorld,
  origin: Vec3,
  power: number,
  radius: number
): void {
  for (const body of world.bodies) {
    const diff = body.position.sub(origin);
    const dist = diff.length();
    if (dist >= radius || dist < 1e-4) continue;

    const falloff = 1 - (dist / radius);
    const impulseMag = power * falloff * falloff * body.invMass;
    const dir = diff.scale(1 / dist);
    body.velocity.addMut(dir.scale(impulseMag));
  }
}

/**
 * Apply a propagating blast wave shell.
 * Call each frame with an expanding radius. Only bodies inside
 * [radius - thickness, radius] are affected.
 */
export function applyBlastWave(
  world: PhysicsWorld,
  origin: Vec3,
  power: number,
  radius: number,
  thickness: number
): void {
  const inner = Math.max(0, radius - thickness);
  for (const body of world.bodies) {
    const diff = body.position.sub(origin);
    const dist = diff.length();
    if (dist < inner || dist > radius || dist < 1e-4) continue;

    const waveFrac = 1 - (dist - inner) / thickness;
    const impulseMag = power * waveFrac * body.invMass;
    const dir = diff.scale(1 / dist);
    body.velocity.addMut(dir.scale(impulseMag));
  }
}

/**
 * Spawn fragment debris bodies at origin with randomised outward velocities.
 * Bodies are added to world and returned.
 */
export function spawnDebris(
  world: PhysicsWorld,
  origin: Vec3,
  count: number,
  speed: number,
  overrides: { mass?: number; radius?: number } = {}
): RigidBody[] {
  const mass   = overrides.mass   ?? 0.5;
  const radius = overrides.radius ?? 0.05;
  const debris: RigidBody[] = [];

  for (let i = 0; i < count; i++) {
    const body = new RigidBody(
      { type: ShapeType.Sphere, radius },
      mass,
      { wingArea: Math.PI * radius * radius, cd: 0.47, cl0: 0, clSlope: 0, thrustMagnitude: 0 }
    );
    body.restitution = 0.3;
    body.friction    = 0.6;

    body.position.set(
      origin.x + (Math.random() - 0.5) * radius * 2,
      origin.y + (Math.random() - 0.5) * radius * 2,
      origin.z + (Math.random() - 0.5) * radius * 2
    );
    body.previousPosition.copyFrom(body.position);

    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    body.velocity.set(
      Math.sin(phi) * Math.cos(theta) * speed * (0.5 + Math.random() * 0.5),
      Math.sin(phi) * Math.sin(theta) * speed * (0.5 + Math.random() * 0.5),
      Math.cos(phi)                   * speed * (0.5 + Math.random() * 0.5)
    );

    world.addBody(body);
    debris.push(body);
  }

  return debris;
}
