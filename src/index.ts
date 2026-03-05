// ── Math primitives ───────────────────────────────────────────────────────────
export { Vec3 } from './math/Vec3.js';
export { Quat } from './math/Quat.js';
export { Mat3 } from './math/Mat3.js';

// ── Shapes ────────────────────────────────────────────────────────────────────
export { ShapeType, computeInertiaTensor } from './physics/shapes.js';
export type { Shape, SphereShape, BoxShape, CylinderShape } from './physics/shapes.js';

// ── Core physics ──────────────────────────────────────────────────────────────
export { RigidBody } from './physics/RigidBody.js';
export type { AeroProperties, AttachedSurface, GuidanceModule } from './physics/RigidBody.js';
export { PhysicsWorld } from './physics/PhysicsWorld.js';

// ── Force functions (power-user API) ─────────────────────────────────────────
export {
  applyGravity,
  applyThrust,
  applyAeroDrag,
  applyAeroLift,
  applyAttachedSurfaces,
  applyAngularDamping,
} from './physics/Forces.js';

// ── Integrator ────────────────────────────────────────────────────────────────
export { integrate } from './physics/Integrator.js';

// ── Collision ─────────────────────────────────────────────────────────────────
export { detectCollisions } from './physics/CollisionDetection.js';
export type { Contact } from './physics/CollisionDetection.js';
export { resolveContacts } from './physics/ContactResolver.js';

// ── Explosions ────────────────────────────────────────────────────────────────
export { applyExplosion, applyBlastWave, spawnDebris } from './physics/Explosions.js';

// ── Body definitions ──────────────────────────────────────────────────────────
export { createBody, MissileBody, GliderBody, CannonballBody } from './bodies/index.js';
export type { BodyDefinition } from './bodies/index.js';
