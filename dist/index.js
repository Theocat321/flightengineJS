// src/math/Vec3.ts
var Vec3 = class _Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  // Immutable ops — return new Vec3
  add(v) {
    return new _Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v) {
    return new _Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  scale(s) {
    return new _Vec3(this.x * s, this.y * s, this.z * s);
  }
  negate() {
    return new _Vec3(-this.x, -this.y, -this.z);
  }
  clone() {
    return new _Vec3(this.x, this.y, this.z);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new _Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    const len = this.length();
    if (len < 1e-12) return new _Vec3(0, 0, 0);
    return this.scale(1 / len);
  }
  // Mutating ops — modify in place, return this
  addMut(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  subMut(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  scaleMut(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copyFrom(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  // Static factories
  static zero() {
    return new _Vec3(0, 0, 0);
  }
  static one() {
    return new _Vec3(1, 1, 1);
  }
  static up() {
    return new _Vec3(0, 1, 0);
  }
  static forward() {
    return new _Vec3(0, 0, -1);
  }
  static right() {
    return new _Vec3(1, 0, 0);
  }
  static lerp(a, b, t) {
    return new _Vec3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
  }
};

// src/math/Mat3.ts
var Mat3 = class _Mat3 {
  constructor(data) {
    this.data = data ?? new Float64Array(9);
  }
  static identity() {
    const m = new _Mat3();
    m.data[0] = 1;
    m.data[4] = 1;
    m.data[8] = 1;
    return m;
  }
  static diagonal(x, y, z) {
    const m = new _Mat3();
    m.data[0] = x;
    m.data[4] = y;
    m.data[8] = z;
    return m;
  }
  static fromQuat(q) {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const m = new _Mat3();
    const d = m.data;
    d[0] = 1 - (yy + zz);
    d[1] = xy + wz;
    d[2] = xz - wy;
    d[3] = xy - wz;
    d[4] = 1 - (xx + zz);
    d[5] = yz + wx;
    d[6] = xz + wy;
    d[7] = yz - wx;
    d[8] = 1 - (xx + yy);
    return m;
  }
  multiply(b) {
    const a = this.data, bd = b.data;
    const r = new _Mat3();
    const rd = r.data;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        rd[col * 3 + row] = a[0 * 3 + row] * bd[col * 3 + 0] + a[1 * 3 + row] * bd[col * 3 + 1] + a[2 * 3 + row] * bd[col * 3 + 2];
      }
    }
    return r;
  }
  multiplyVec3(v) {
    const d = this.data;
    return new Vec3(
      d[0] * v.x + d[3] * v.y + d[6] * v.z,
      d[1] * v.x + d[4] * v.y + d[7] * v.z,
      d[2] * v.x + d[5] * v.y + d[8] * v.z
    );
  }
  transpose() {
    const d = this.data;
    const r = new _Mat3();
    const rd = r.data;
    rd[0] = d[0];
    rd[1] = d[3];
    rd[2] = d[6];
    rd[3] = d[1];
    rd[4] = d[4];
    rd[5] = d[7];
    rd[6] = d[2];
    rd[7] = d[5];
    rd[8] = d[8];
    return r;
  }
  // Computes R * M * R^T  (transforms an inertia tensor to world space)
  sandwichTransform(R) {
    return R.multiply(this).multiply(R.transpose());
  }
  clone() {
    return new _Mat3(new Float64Array(this.data));
  }
};

// src/math/Quat.ts
var Quat = class _Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  multiply(q) {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;
    return new _Quat(
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz
    );
  }
  rotateVector(v) {
    const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
    const ix = qw * v.x + qy * v.z - qz * v.y;
    const iy = qw * v.y + qz * v.x - qx * v.z;
    const iz = qw * v.z + qx * v.y - qy * v.x;
    const iw = -qx * v.x - qy * v.y - qz * v.z;
    return new Vec3(
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx
    );
  }
  conjugate() {
    return new _Quat(-this.x, -this.y, -this.z, this.w);
  }
  normalize() {
    const len = Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
    if (len < 1e-12) return new _Quat(0, 0, 0, 1);
    const inv = 1 / len;
    return new _Quat(this.x * inv, this.y * inv, this.z * inv, this.w * inv);
  }
  static fromAxisAngle(axis, angle) {
    const half = angle * 0.5;
    const s = Math.sin(half);
    const n = axis.normalize();
    return new _Quat(n.x * s, n.y * s, n.z * s, Math.cos(half));
  }
  toMat3() {
    return Mat3.fromQuat(this);
  }
  // Integrate angular velocity over dt using first-order approximation:
  // q_new = normalize(q + 0.5 * dt * omega_quat * q)
  integrate(omega, dt) {
    const omegaQuat = new _Quat(omega.x, omega.y, omega.z, 0);
    const dq = omegaQuat.multiply(this);
    return new _Quat(
      this.x + 0.5 * dt * dq.x,
      this.y + 0.5 * dt * dq.y,
      this.z + 0.5 * dt * dq.z,
      this.w + 0.5 * dt * dq.w
    ).normalize();
  }
  static slerp(a, b, t) {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    if (dot < 0) {
      dot = -dot;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }
    let scale0, scale1;
    if (dot > 0.9995) {
      scale0 = 1 - t;
      scale1 = t;
    } else {
      const theta = Math.acos(dot);
      const sinTheta = Math.sin(theta);
      scale0 = Math.sin((1 - t) * theta) / sinTheta;
      scale1 = Math.sin(t * theta) / sinTheta;
    }
    return new _Quat(
      scale0 * a.x + scale1 * bx,
      scale0 * a.y + scale1 * by,
      scale0 * a.z + scale1 * bz,
      scale0 * a.w + scale1 * bw
    );
  }
  clone() {
    return new _Quat(this.x, this.y, this.z, this.w);
  }
  static identity() {
    return new _Quat(0, 0, 0, 1);
  }
};

// src/physics/shapes.ts
var ShapeType = /* @__PURE__ */ ((ShapeType2) => {
  ShapeType2["Sphere"] = "Sphere";
  ShapeType2["Box"] = "Box";
  return ShapeType2;
})(ShapeType || {});
function computeInertiaTensor(shape, mass) {
  switch (shape.type) {
    case "Sphere" /* Sphere */: {
      const r2 = shape.radius * shape.radius;
      const I = 2 / 5 * mass * r2;
      return Mat3.diagonal(I, I, I);
    }
    case "Box" /* Box */: {
      const { x: hx, y: hy, z: hz } = shape.halfExtents;
      const ex = 2 * hx, ey = 2 * hy, ez = 2 * hz;
      const Ix = 1 / 12 * mass * (ey * ey + ez * ez);
      const Iy = 1 / 12 * mass * (ex * ex + ez * ez);
      const Iz = 1 / 12 * mass * (ex * ex + ey * ey);
      return Mat3.diagonal(Ix, Iy, Iz);
    }
  }
}

// src/physics/RigidBody.ts
var nextId = 0;
var RigidBody = class {
  constructor(shape, mass, aero) {
    this.id = nextId++;
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;
    this.shape = shape;
    this.inertiaTensorLocal = computeInertiaTensor(shape, mass);
    this.invInertiaTensorLocal = this._invertDiagonal(this.inertiaTensorLocal);
    this.invInertiaTensorWorld = Mat3.identity();
    this.position = Vec3.zero();
    this.velocity = Vec3.zero();
    this.orientation = Quat.identity();
    this.angularVelocity = Vec3.zero();
    this.previousPosition = Vec3.zero();
    this.previousOrientation = Quat.identity();
    this.force = Vec3.zero();
    this.torque = Vec3.zero();
    this.aero = {
      wingArea: aero?.wingArea ?? 1,
      cd: aero?.cd ?? 0.1,
      cl0: aero?.cl0 ?? 0,
      clSlope: aero?.clSlope ?? 0,
      thrustMagnitude: aero?.thrustMagnitude ?? 0
    };
    this.restitution = 0.3;
    this.friction = 0.5;
  }
  _invertDiagonal(m) {
    const d = m.data;
    const inv = (v) => Math.abs(v) > 1e-14 ? 1 / v : 0;
    return Mat3.diagonal(inv(d[0]), inv(d[4]), inv(d[8]));
  }
  updateInvInertiaWorld() {
    const R = Mat3.fromQuat(this.orientation);
    this.invInertiaTensorWorld = this.invInertiaTensorLocal.sandwichTransform(R);
  }
  applyForce(f) {
    this.force.addMut(f);
  }
  applyForceAtPoint(f, worldPoint) {
    this.force.addMut(f);
    const r = worldPoint.sub(this.position);
    this.torque.addMut(r.cross(f));
  }
  applyTorque(t) {
    this.torque.addMut(t);
  }
  clearAccumulators() {
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }
  getForwardDir() {
    return this.orientation.rotateVector(new Vec3(0, 0, -1));
  }
  getUpDir() {
    return this.orientation.rotateVector(new Vec3(0, 1, 0));
  }
  getRightDir() {
    return this.orientation.rotateVector(new Vec3(1, 0, 0));
  }
  localToWorld(localVec) {
    return this.orientation.rotateVector(localVec).add(this.position);
  }
  worldToLocal(worldVec) {
    return this.orientation.conjugate().rotateVector(worldVec.sub(this.position));
  }
  savePreviousState() {
    this.previousPosition.copyFrom(this.position);
    this.previousOrientation = this.orientation.clone();
  }
};

// src/physics/Forces.ts
var GRAVITY = new Vec3(0, -9.81, 0);
function applyGravity(body) {
  body.applyForce(GRAVITY.scale(body.mass));
}
function applyThrust(body) {
  if (body.aero.thrustMagnitude <= 0) return;
  const forward = body.getForwardDir();
  body.applyForce(forward.scale(body.aero.thrustMagnitude));
}
function applyAeroDrag(body, rho) {
  const speed = body.velocity.length();
  if (speed < 1e-4) return;
  const vHat = body.velocity.scale(1 / speed);
  const dragMag = 0.5 * rho * body.aero.cd * body.aero.wingArea * speed * speed;
  body.applyForce(vHat.scale(-dragMag));
}
function applyAeroLift(body, rho) {
  const speed = body.velocity.length();
  if (speed < 1e-4) return;
  const vHat = body.velocity.scale(1 / speed);
  const bodyUp = body.getUpDir();
  const forward = body.getForwardDir();
  const dot = Math.max(-1, Math.min(1, vHat.dot(forward)));
  const alpha = Math.asin(Math.max(-1, Math.min(1, vHat.dot(bodyUp))));
  const clMax = body.aero.cl0 + body.aero.clSlope * (Math.PI / 6);
  const cl = Math.max(-clMax, Math.min(clMax, body.aero.cl0 + body.aero.clSlope * alpha));
  const liftMag = 0.5 * rho * cl * body.aero.wingArea * speed * speed;
  const liftDir = bodyUp.sub(vHat.scale(bodyUp.dot(vHat))).normalize();
  const liftForce = liftDir.scale(liftMag);
  const liftOffset = body.getForwardDir().scale(-0.5);
  const worldLiftPoint = body.position.add(liftOffset);
  body.applyForceAtPoint(liftForce, worldLiftPoint);
}
function applyAngularDamping(body, damping = 0.98) {
  body.angularVelocity.scaleMut(damping);
}

// src/physics/Integrator.ts
function integrate(body, dt) {
  if (body.invMass === 0) return;
  const dv = body.force.scale(body.invMass * dt);
  body.velocity.addMut(dv);
  const dp = body.velocity.scale(dt);
  body.position.addMut(dp);
  const dOmega = body.invInertiaTensorWorld.multiplyVec3(body.torque).scale(dt);
  body.angularVelocity.addMut(dOmega);
  body.orientation = body.orientation.integrate(body.angularVelocity, dt);
}

// src/physics/CollisionDetection.ts
var GROUND_Y = 0;
function sphereVsPlane(body, radius) {
  const pen = radius - (body.position.y - GROUND_Y);
  if (pen <= 0) return null;
  return {
    bodyA: body,
    bodyB: null,
    point: new Vec3(body.position.x, GROUND_Y, body.position.z),
    normal: new Vec3(0, 1, 0),
    penetration: pen
  };
}
function boxVsPlane(body, halfExtents) {
  const contacts = [];
  const corners = [
    [-1, -1, -1],
    [-1, -1, 1],
    [-1, 1, -1],
    [-1, 1, 1],
    [1, -1, -1],
    [1, -1, 1],
    [1, 1, -1],
    [1, 1, 1]
  ];
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
        penetration: pen
      });
    }
  }
  return contacts;
}
function sphereVsSphere(a, ra, b, rb) {
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
    penetration: minDist - dist
  };
}
function boxVsSphere(box, halfExtents, sphere, radius) {
  const localSphere = box.orientation.conjugate().rotateVector(sphere.position.sub(box.position));
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
    penetration: radius - dist
  };
}
function detectCollisions(bodies) {
  const contacts = [];
  for (const body of bodies) {
    const shape = body.shape;
    if (shape.type === "Sphere" /* Sphere */) {
      const c = sphereVsPlane(body, shape.radius);
      if (c) contacts.push(c);
    } else if (shape.type === "Box" /* Box */) {
      contacts.push(...boxVsPlane(body, shape.halfExtents));
    }
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const sa = a.shape;
      const sb = b.shape;
      if (sa.type === "Sphere" /* Sphere */ && sb.type === "Sphere" /* Sphere */) {
        const c = sphereVsSphere(a, sa.radius, b, sb.radius);
        if (c) contacts.push(c);
      } else if (sa.type === "Box" /* Box */ && sb.type === "Sphere" /* Sphere */) {
        const c = boxVsSphere(a, sa.halfExtents, b, sb.radius);
        if (c) contacts.push(c);
      } else if (sa.type === "Sphere" /* Sphere */ && sb.type === "Box" /* Box */) {
        const c = boxVsSphere(b, sb.halfExtents, a, sa.radius);
        if (c) contacts.push(c);
      }
    }
  }
  return contacts;
}

// src/physics/ContactResolver.ts
var BAUMGARTE_BETA = 0.2;
var PENETRATION_SLOP = 5e-3;
function resolveContacts(contacts, dt) {
  const iterations = contacts.length * 2;
  for (let iter = 0; iter < iterations; iter++) {
    for (const contact of contacts) {
      resolveContact(contact, dt);
    }
  }
}
function resolveContact(contact, dt) {
  const { bodyA, bodyB, point, normal, penetration } = contact;
  const rA = point.sub(bodyA.position);
  const rB = bodyB ? point.sub(bodyB.position) : Vec3.zero();
  const vA = bodyA.velocity.add(bodyA.angularVelocity.cross(rA));
  const vB = bodyB ? bodyB.velocity.add(bodyB.angularVelocity.cross(rB)) : Vec3.zero();
  const relVel = vA.sub(vB);
  const relVelNormal = relVel.dot(normal);
  if (relVelNormal > 0) return;
  const restitution = bodyB ? Math.max(bodyA.restitution, bodyB.restitution) : bodyA.restitution;
  const invMassA = bodyA.invMass;
  const invMassB = bodyB ? bodyB.invMass : 0;
  const rACrossN = rA.cross(normal);
  const rBCrossN = bodyB ? rB.cross(normal) : Vec3.zero();
  const angularTermA = bodyA.invInertiaTensorWorld.multiplyVec3(rACrossN).cross(rA).dot(normal);
  const angularTermB = bodyB ? bodyB.invInertiaTensorWorld.multiplyVec3(rBCrossN).cross(rB).dot(normal) : 0;
  const denom = invMassA + invMassB + angularTermA + angularTermB;
  if (denom < 1e-12) return;
  const baumgarte = BAUMGARTE_BETA / dt * Math.max(0, penetration - PENETRATION_SLOP);
  const j = (-(1 + restitution) * relVelNormal + baumgarte) / denom;
  const impulse = normal.scale(j);
  bodyA.velocity.addMut(impulse.scale(invMassA));
  bodyA.angularVelocity.addMut(bodyA.invInertiaTensorWorld.multiplyVec3(rA.cross(impulse)));
  if (bodyB) {
    bodyB.velocity.addMut(impulse.scale(-invMassB));
    bodyB.angularVelocity.addMut(bodyB.invInertiaTensorWorld.multiplyVec3(rB.cross(impulse.negate())));
  }
  const tangent = relVel.sub(normal.scale(relVelNormal)).normalize();
  const relVelTangent = relVel.dot(tangent);
  if (Math.abs(relVelTangent) < 1e-8) return;
  const rACrossT = rA.cross(tangent);
  const rBCrossT = bodyB ? rB.cross(tangent) : Vec3.zero();
  const angTermTA = bodyA.invInertiaTensorWorld.multiplyVec3(rACrossT).cross(rA).dot(tangent);
  const angTermTB = bodyB ? bodyB.invInertiaTensorWorld.multiplyVec3(rBCrossT).cross(rB).dot(tangent) : 0;
  const denomT = invMassA + invMassB + angTermTA + angTermTB;
  if (denomT < 1e-12) return;
  const friction = bodyB ? (bodyA.friction + bodyB.friction) * 0.5 : bodyA.friction;
  const jt = Math.max(-friction * j, Math.min(friction * j, -relVelTangent / denomT));
  const frictionImpulse = tangent.scale(jt);
  bodyA.velocity.addMut(frictionImpulse.scale(invMassA));
  bodyA.angularVelocity.addMut(bodyA.invInertiaTensorWorld.multiplyVec3(rA.cross(frictionImpulse)));
  if (bodyB) {
    bodyB.velocity.addMut(frictionImpulse.scale(-invMassB));
    bodyB.angularVelocity.addMut(bodyB.invInertiaTensorWorld.multiplyVec3(rB.cross(frictionImpulse.negate())));
  }
}

// src/physics/PhysicsWorld.ts
var PhysicsWorld = class {
  constructor() {
    this.bodies = [];
    this.gravity = 9.81;
    this.rho = 1.225;
    // air density kg/m³
    this.thrustActiveIds = /* @__PURE__ */ new Set();
    this.fixedDt = 1 / 120;
    this.maxSubsteps = 8;
    this.accumulator = 0;
    this.substepsLastFrame = 0;
  }
  addBody(body) {
    this.bodies.push(body);
  }
  removeBody(body) {
    const idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
  }
  clear() {
    this.bodies.length = 0;
    this.thrustActiveIds.clear();
  }
  step(dt) {
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
  getInterpolationAlpha() {
    return this.accumulator / this.fixedDt;
  }
  _substep(dt) {
    for (const body of this.bodies) {
      body.savePreviousState();
    }
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
    const contacts = detectCollisions(this.bodies);
    resolveContacts(contacts, dt);
    for (const body of this.bodies) {
      integrate(body, dt);
      body.updateInvInertiaWorld();
    }
    for (const body of this.bodies) {
      body.clearAccumulators();
    }
  }
};
export {
  Mat3,
  PhysicsWorld,
  Quat,
  RigidBody,
  ShapeType,
  Vec3,
  applyAeroDrag,
  applyAeroLift,
  applyAngularDamping,
  applyGravity,
  applyThrust,
  computeInertiaTensor,
  detectCollisions,
  integrate,
  resolveContacts
};
//# sourceMappingURL=index.js.map