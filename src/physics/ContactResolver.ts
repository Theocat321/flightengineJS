import { Vec3 } from '../math/Vec3.js';
import { Contact } from './CollisionDetection.js';

const BAUMGARTE_BETA = 0.2;
const PENETRATION_SLOP = 0.005;

export function resolveContacts(contacts: Contact[], dt: number): void {
  const iterations = contacts.length * 2;

  for (let iter = 0; iter < iterations; iter++) {
    for (const contact of contacts) {
      resolveContact(contact, dt);
    }
  }
}

function resolveContact(contact: Contact, dt: number): void {
  const { bodyA, bodyB, point, normal, penetration } = contact;

  const rA = point.sub(bodyA.position);
  const rB = bodyB ? point.sub(bodyB.position) : Vec3.zero();

  // Relative velocity at contact point
  const vA = bodyA.velocity.add(bodyA.angularVelocity.cross(rA));
  const vB = bodyB ? bodyB.velocity.add(bodyB.angularVelocity.cross(rB)) : Vec3.zero();
  const relVel = vA.sub(vB);
  const relVelNormal = relVel.dot(normal);

  // Don't resolve if separating
  if (relVelNormal > 0) return;

  const restitution = bodyB
    ? Math.max(bodyA.restitution, bodyB.restitution)
    : bodyA.restitution;

  // Compute impulse denominator
  const invMassA = bodyA.invMass;
  const invMassB = bodyB ? bodyB.invMass : 0;

  const rACrossN = rA.cross(normal);
  const rBCrossN = bodyB ? rB.cross(normal) : Vec3.zero();

  const angularTermA = bodyA.invInertiaTensorWorld.multiplyVec3(rACrossN).cross(rA).dot(normal);
  const angularTermB = bodyB
    ? bodyB.invInertiaTensorWorld.multiplyVec3(rBCrossN).cross(rB).dot(normal)
    : 0;

  const denom = invMassA + invMassB + angularTermA + angularTermB;
  if (denom < 1e-12) return;

  // Baumgarte stabilization
  const baumgarte = (BAUMGARTE_BETA / dt) * Math.max(0, penetration - PENETRATION_SLOP);

  const j = (-(1 + restitution) * relVelNormal + baumgarte) / denom;
  const impulse = normal.scale(j);

  // Apply normal impulse
  bodyA.velocity.addMut(impulse.scale(invMassA));
  bodyA.angularVelocity.addMut(bodyA.invInertiaTensorWorld.multiplyVec3(rA.cross(impulse)));
  if (bodyB) {
    bodyB.velocity.addMut(impulse.scale(-invMassB));
    bodyB.angularVelocity.addMut(bodyB.invInertiaTensorWorld.multiplyVec3(rB.cross(impulse.negate())));
  }

  // Friction impulse
  const tangent = relVel.sub(normal.scale(relVelNormal)).normalize();
  const relVelTangent = relVel.dot(tangent);
  if (Math.abs(relVelTangent) < 1e-8) return;

  const rACrossT = rA.cross(tangent);
  const rBCrossT = bodyB ? rB.cross(tangent) : Vec3.zero();
  const angTermTA = bodyA.invInertiaTensorWorld.multiplyVec3(rACrossT).cross(rA).dot(tangent);
  const angTermTB = bodyB
    ? bodyB.invInertiaTensorWorld.multiplyVec3(rBCrossT).cross(rB).dot(tangent)
    : 0;

  const denomT = invMassA + invMassB + angTermTA + angTermTB;
  if (denomT < 1e-12) return;

  const friction = bodyB
    ? (bodyA.friction + bodyB.friction) * 0.5
    : bodyA.friction;

  const jt = Math.max(-friction * j, Math.min(friction * j, -relVelTangent / denomT));
  const frictionImpulse = tangent.scale(jt);

  bodyA.velocity.addMut(frictionImpulse.scale(invMassA));
  bodyA.angularVelocity.addMut(bodyA.invInertiaTensorWorld.multiplyVec3(rA.cross(frictionImpulse)));
  if (bodyB) {
    bodyB.velocity.addMut(frictionImpulse.scale(-invMassB));
    bodyB.angularVelocity.addMut(bodyB.invInertiaTensorWorld.multiplyVec3(rB.cross(frictionImpulse.negate())));
  }
}
