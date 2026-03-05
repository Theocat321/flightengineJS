// Math primitives
export { Vec3 } from './math/Vec3.js';
export { Quat } from './math/Quat.js';
export { Mat3 } from './math/Mat3.js';

// Shapes
export { ShapeType, computeInertiaTensor } from './physics/shapes.js';
export type { Shape, SphereShape, BoxShape } from './physics/shapes.js';

// Core physics
export { RigidBody } from './physics/RigidBody.js';
export type { AeroProperties } from './physics/RigidBody.js';
export { PhysicsWorld } from './physics/PhysicsWorld.js';

// Building blocks (power-user API)
export {
  applyGravity,
  applyThrust,
  applyAeroDrag,
  applyAeroLift,
  applyAngularDamping,
} from './physics/Forces.js';
export { integrate } from './physics/Integrator.js';
export { detectCollisions } from './physics/CollisionDetection.js';
export type { Contact } from './physics/CollisionDetection.js';
export { resolveContacts } from './physics/ContactResolver.js';
