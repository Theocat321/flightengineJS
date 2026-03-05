import { Vec3 } from '../math/Vec3.js';
import { RigidBody } from './RigidBody.js';
import { ShapeType, CylinderShape } from './shapes.js';

export interface Contact {
  bodyA: RigidBody;
  bodyB: RigidBody | null;  // null = ground plane
  point: Vec3;
  normal: Vec3;             // points from B to A (away from ground for ground contacts)
  penetration: number;
}

const GROUND_Y = 0;

function sphereVsPlane(body: RigidBody, radius: number): Contact | null {
  const pen = radius - (body.position.y - GROUND_Y);
  if (pen <= 0) return null;
  return {
    bodyA: body,
    bodyB: null,
    point: new Vec3(body.position.x, GROUND_Y, body.position.z),
    normal: new Vec3(0, 1, 0),
    penetration: pen,
  };
}

function boxVsPlane(body: RigidBody, halfExtents: { x: number; y: number; z: number }): Contact[] {
  const contacts: Contact[] = [];
  const corners = [
    [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
    [1, -1, -1],  [1, -1, 1],  [1, 1, -1],  [1, 1, 1],
  ] as [number, number, number][];

  for (const [sx, sy, sz] of corners) {
    const local = new Vec3(
      sx * halfExtents.x,
      sy * halfExtents.y,
      sz * halfExtents.z
    );
    const world = body.orientation.rotateVector(local).add(body.position);
    const pen = -(world.y - GROUND_Y);
    if (pen > 0) {
      contacts.push({
        bodyA: body,
        bodyB: null,
        point: new Vec3(world.x, GROUND_Y, world.z),
        normal: new Vec3(0, 1, 0),
        penetration: pen,
      });
    }
  }
  return contacts;
}

function sphereVsSphere(a: RigidBody, ra: number, b: RigidBody, rb: number): Contact | null {
  const diff = a.position.sub(b.position);
  const dist = diff.length();
  const minDist = ra + rb;
  if (dist >= minDist) return null;
  const normal = dist < 1e-8 ? new Vec3(0, 1, 0) : diff.scale(1 / dist);
  return {
    bodyA: a,
    bodyB: b,
    point: b.position.add(normal.scale(rb)),
    normal,
    penetration: minDist - dist,
  };
}

function boxVsSphere(box: RigidBody, halfExtents: { x: number; y: number; z: number }, sphere: RigidBody, radius: number): Contact | null {
  // Transform sphere center into box local space
  const localSphere = box.orientation.conjugate().rotateVector(sphere.position.sub(box.position));
  // Closest point on box to sphere center (clamped to halfExtents)
  const closest = new Vec3(
    Math.max(-halfExtents.x, Math.min(halfExtents.x, localSphere.x)),
    Math.max(-halfExtents.y, Math.min(halfExtents.y, localSphere.y)),
    Math.max(-halfExtents.z, Math.min(halfExtents.z, localSphere.z))
  );
  const localDiff = localSphere.sub(closest);
  const distSq = localDiff.lengthSq();
  if (distSq >= radius * radius) return null;
  const dist = Math.sqrt(distSq);
  const localNormal = dist < 1e-8 ? new Vec3(0, 1, 0) : localDiff.scale(1 / dist);
  const worldNormal = box.orientation.rotateVector(localNormal);
  const worldClosest = box.orientation.rotateVector(closest).add(box.position);
  return {
    bodyA: sphere,
    bodyB: box,
    point: worldClosest,
    normal: worldNormal,
    penetration: radius - dist,
  };
}

function cylinderVsPlane(body: RigidBody, shape: CylinderShape): Contact[] {
  const contacts: Contact[] = [];
  const halfH = shape.height / 2;
  const r = shape.radius;

  // Cylinder axis = forward direction (local -Z rotated to world).
  // With orientation rotateX(PI/2) this gives world +Y — missile stands upright.
  const axisWorld = body.orientation.rotateVector(new Vec3(0, 0, -1));

  const caps = [
    body.position.add(axisWorld.scale(halfH)),
    body.position.sub(axisWorld.scale(halfH)),
  ];

  // Perpendicular basis for rim sampling
  const tmp   = Math.abs(axisWorld.y) < 0.9 ? new Vec3(0, 1, 0) : new Vec3(1, 0, 0);
  const perp1 = axisWorld.cross(tmp).normalize();
  const perp2 = axisWorld.cross(perp1).normalize();

  const RIM_SAMPLES = 8;
  for (const capCentre of caps) {
    // Cap centre itself
    const pen0 = -(capCentre.y - GROUND_Y);
    if (pen0 > 0) {
      contacts.push({ bodyA: body, bodyB: null, point: new Vec3(capCentre.x, GROUND_Y, capCentre.z), normal: new Vec3(0, 1, 0), penetration: pen0 });
    }
    // Rim points
    for (let i = 0; i < RIM_SAMPLES; i++) {
      const angle = (i / RIM_SAMPLES) * Math.PI * 2;
      const rimPoint = capCentre
        .add(perp1.scale(Math.cos(angle) * r))
        .add(perp2.scale(Math.sin(angle) * r));
      const pen = -(rimPoint.y - GROUND_Y);
      if (pen > 0) {
        contacts.push({ bodyA: body, bodyB: null, point: new Vec3(rimPoint.x, GROUND_Y, rimPoint.z), normal: new Vec3(0, 1, 0), penetration: pen });
      }
    }
  }
  return contacts;
}

export function detectCollisions(bodies: RigidBody[]): Contact[] {
  const contacts: Contact[] = [];

  for (const body of bodies) {
    const shape = body.shape;
    if (shape.type === ShapeType.Sphere) {
      const c = sphereVsPlane(body, shape.radius);
      if (c) contacts.push(c);
    } else if (shape.type === ShapeType.Box) {
      contacts.push(...boxVsPlane(body, shape.halfExtents));
    } else if (shape.type === ShapeType.Cylinder) {
      contacts.push(...cylinderVsPlane(body, shape));
    }
  }

  // Body vs body
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;
      const sa = a.shape;
      const sb = b.shape;

      if (sa.type === ShapeType.Sphere && sb.type === ShapeType.Sphere) {
        const c = sphereVsSphere(a, sa.radius, b, sb.radius);
        if (c) contacts.push(c);
      } else if (sa.type === ShapeType.Box && sb.type === ShapeType.Sphere) {
        const c = boxVsSphere(a, sa.halfExtents, b, sb.radius);
        if (c) contacts.push(c);
      } else if (sa.type === ShapeType.Sphere && sb.type === ShapeType.Box) {
        const c = boxVsSphere(b, sb.halfExtents, a, sa.radius);
        if (c) contacts.push(c);
      }
    }
  }

  return contacts;
}
