import { Vec3 } from '../math/Vec3.js';
import { RigidBody } from './RigidBody.js';
import { ShapeType, CylinderShape, CapsuleShape } from './shapes.js';

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

// ── Cylinder vs Sphere ────────────────────────────────────────────────────────

/**
 * Closest point on a line segment [p0, p1] to point q, clamped to [0,1].
 */
function closestPointOnSegment(p0: Vec3, p1: Vec3, q: Vec3): Vec3 {
  const d = p1.sub(p0);
  const lenSq = d.lengthSq();
  if (lenSq < 1e-12) return p0.clone();
  const t = Math.max(0, Math.min(1, q.sub(p0).dot(d) / lenSq));
  return p0.add(d.scale(t));
}

function cylinderVsSphere(
  cyl: RigidBody, cs: CylinderShape,
  sph: RigidBody, sr: number
): Contact | null {
  const halfH = cs.height / 2;
  // Cylinder axis in world space (local -Z)
  const axis = cyl.orientation.rotateVector(new Vec3(0, 0, -1));
  const p0 = cyl.position.sub(axis.scale(halfH));
  const p1 = cyl.position.add(axis.scale(halfH));

  const closest = closestPointOnSegment(p0, p1, sph.position);
  const diff = sph.position.sub(closest);
  const distSq = diff.lengthSq();
  const totalR = cs.radius + sr;
  if (distSq >= totalR * totalR) return null;

  const dist = Math.sqrt(distSq);
  const normal = dist < 1e-8 ? new Vec3(0, 1, 0) : diff.scale(1 / dist);
  return {
    bodyA: sph,
    bodyB: cyl,
    point: closest,
    normal,
    penetration: totalR - dist,
  };
}

// ── Cylinder vs Cylinder ──────────────────────────────────────────────────────

function cylinderVsCylinder(
  a: RigidBody, sa: CylinderShape,
  b: RigidBody, sb: CylinderShape
): Contact | null {
  const halfHa = sa.height / 2;
  const halfHb = sb.height / 2;
  const axisA = a.orientation.rotateVector(new Vec3(0, 0, -1));
  const axisB = b.orientation.rotateVector(new Vec3(0, 0, -1));

  const pA0 = a.position.sub(axisA.scale(halfHa));
  const pA1 = a.position.add(axisA.scale(halfHa));
  const pB0 = b.position.sub(axisB.scale(halfHb));
  const pB1 = b.position.add(axisB.scale(halfHb));

  // Find closest points between the two axis segments
  const { ptA, ptB } = closestPointsBetweenSegments(pA0, pA1, pB0, pB1);

  const diff = ptA.sub(ptB);
  const dist = diff.length();
  const totalR = sa.radius + sb.radius;
  if (dist >= totalR) return null;

  const normal = dist < 1e-8 ? new Vec3(0, 1, 0) : diff.scale(1 / dist);
  const point = ptB.add(normal.scale(sb.radius));
  return {
    bodyA: a,
    bodyB: b,
    point,
    normal,
    penetration: totalR - dist,
  };
}

/** Closest points between two line segments. */
function closestPointsBetweenSegments(
  p0: Vec3, p1: Vec3,
  q0: Vec3, q1: Vec3
): { ptA: Vec3; ptB: Vec3 } {
  const d1 = p1.sub(p0);
  const d2 = q1.sub(q0);
  const r  = p0.sub(q0);

  const a  = d1.dot(d1);
  const e  = d2.dot(d2);
  const f  = d2.dot(r);

  let s: number, t: number;

  if (a < 1e-10 && e < 1e-10) {
    return { ptA: p0.clone(), ptB: q0.clone() };
  }
  if (a < 1e-10) {
    s = 0;
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1.dot(r);
    if (e < 1e-10) {
      t = 0;
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b   = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom > 1e-10 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
      else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  return {
    ptA: p0.add(d1.scale(s)),
    ptB: q0.add(d2.scale(t)),
  };
}

// ── Capsule vs Plane ──────────────────────────────────────────────────────────

function capsuleVsPlane(body: RigidBody, shape: CapsuleShape): Contact[] {
  const contacts: Contact[] = [];
  const axis = body.orientation.rotateVector(new Vec3(0, 0, -1));
  const tip0 = body.position.add(axis.scale(-(shape.halfHeight)));
  const tip1 = body.position.add(axis.scale(  shape.halfHeight));

  for (const tipCentre of [tip0, tip1]) {
    const pen = shape.radius - (tipCentre.y - GROUND_Y);
    if (pen > 0) {
      contacts.push({
        bodyA: body,
        bodyB: null,
        point: new Vec3(tipCentre.x, GROUND_Y, tipCentre.z),
        normal: new Vec3(0, 1, 0),
        penetration: pen,
      });
    }
  }
  return contacts;
}

// ── Capsule vs Sphere ─────────────────────────────────────────────────────────

function capsuleVsSphere(
  cap: RigidBody, cs: CapsuleShape,
  sph: RigidBody, sr: number
): Contact | null {
  const axis = cap.orientation.rotateVector(new Vec3(0, 0, -1));
  const p0 = cap.position.sub(axis.scale(cs.halfHeight));
  const p1 = cap.position.add(axis.scale(cs.halfHeight));

  const closest = closestPointOnSegment(p0, p1, sph.position);
  const diff    = sph.position.sub(closest);
  const distSq  = diff.lengthSq();
  const totalR  = cs.radius + sr;
  if (distSq >= totalR * totalR) return null;

  const dist   = Math.sqrt(distSq);
  const normal = dist < 1e-8 ? new Vec3(0, 1, 0) : diff.scale(1 / dist);
  return {
    bodyA: sph,
    bodyB: cap,
    point: closest,
    normal,
    penetration: totalR - dist,
  };
}

export function detectCollisions(bodies: RigidBody[]): Contact[] {
  const contacts: Contact[] = [];

  // Ground plane contacts
  for (const body of bodies) {
    const shape = body.shape;
    if (shape.type === ShapeType.Sphere) {
      const c = sphereVsPlane(body, shape.radius);
      if (c) contacts.push(c);
    } else if (shape.type === ShapeType.Box) {
      contacts.push(...boxVsPlane(body, shape.halfExtents));
    } else if (shape.type === ShapeType.Cylinder) {
      contacts.push(...cylinderVsPlane(body, shape));
    } else if (shape.type === ShapeType.Capsule) {
      contacts.push(...capsuleVsPlane(body, shape));
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

      } else if (sa.type === ShapeType.Cylinder && sb.type === ShapeType.Sphere) {
        const c = cylinderVsSphere(a, sa, b, sb.radius);
        if (c) contacts.push(c);
      } else if (sa.type === ShapeType.Sphere && sb.type === ShapeType.Cylinder) {
        const c = cylinderVsSphere(b, sb, a, sa.radius);
        if (c) contacts.push(c);

      } else if (sa.type === ShapeType.Cylinder && sb.type === ShapeType.Cylinder) {
        const c = cylinderVsCylinder(a, sa, b, sb);
        if (c) contacts.push(c);

      } else if (sa.type === ShapeType.Capsule && sb.type === ShapeType.Sphere) {
        const c = capsuleVsSphere(a, sa, b, sb.radius);
        if (c) contacts.push(c);
      } else if (sa.type === ShapeType.Sphere && sb.type === ShapeType.Capsule) {
        const c = capsuleVsSphere(b, sb, a, sa.radius);
        if (c) contacts.push(c);
      }
    }
  }

  return contacts;
}
