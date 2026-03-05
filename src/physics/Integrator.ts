import { RigidBody } from './RigidBody.js';

export function integrate(body: RigidBody, dt: number): void {
  if (body.invMass === 0) return;

  // Semi-implicit (symplectic) Euler
  // Linear
  const dv = body.force.scale(body.invMass * dt);
  body.velocity.addMut(dv);
  const dp = body.velocity.scale(dt);
  body.position.addMut(dp);

  // Angular
  const dOmega = body.invInertiaTensorWorld.multiplyVec3(body.torque).scale(dt);
  body.angularVelocity.addMut(dOmega);
  body.orientation = body.orientation.integrate(body.angularVelocity, dt);
}
