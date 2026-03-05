# Engine Expansion — Missiles, Explosions, Custom Bodies

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cylinder shape, attached surfaces (fins), guidance modules, BodyDefinition/createBody, built-in MissileBody preset, and explosion API to `flight-engine-js`.

**Architecture:** All additions are in `src/`. No demo changes required — the engine is self-contained. New `src/bodies/` directory holds the definition system and presets. New `src/physics/Explosions.ts` holds explosion functions. Existing files get minimal surgical additions.

**Tech Stack:** TypeScript, zero runtime dependencies.

---

### Task 1: Add Cylinder shape

**Files:**
- Modify: `src/physics/shapes.ts`

**Step 1: Add CylinderShape to the enum and union**

In `src/physics/shapes.ts`, add after the `Box` entries:

```ts
// In ShapeType enum:
Cylinder = 'Cylinder',

// New interface:
export interface CylinderShape {
  type: ShapeType.Cylinder;
  radius: number;
  height: number;
}

// Update Shape union:
export type Shape = SphereShape | BoxShape | CylinderShape;
```

**Step 2: Add inertia tensor case**

In `computeInertiaTensor`, add after the `Box` case:

```ts
case ShapeType.Cylinder: {
  const r2 = shape.radius * shape.radius;
  const h2 = shape.height * shape.height;
  const Iaxial = 0.5 * mass * r2;                          // along cylinder axis (Y)
  const Ilateral = (1 / 12) * mass * (3 * r2 + h2);       // perpendicular axes (X, Z)
  return Mat3.diagonal(Ilateral, Iaxial, Ilateral);
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/physics/shapes.ts
git commit -m "feat: add Cylinder shape with inertia tensor"
```

---

### Task 2: Add AttachedSurface to RigidBody

**Files:**
- Modify: `src/physics/RigidBody.ts`

**Step 1: Add AttachedSurface interface and imports**

At the top of `RigidBody.ts`, add the interface (no new imports needed — Vec3 already imported):

```ts
export interface AttachedSurface {
  localPosition: Vec3;
  localNormal: Vec3;    // surface normal in body space
  area: number;
  cd: number;
  cl0: number;
  clSlope: number;
}
```

**Step 2: Add GuidanceModule interface**

```ts
export interface GuidanceModule {
  update(body: RigidBody, dt: number): void;
}
```

**Step 3: Add fields to RigidBody class**

In the class body, after `friction: number;` add:

```ts
attachedSurfaces: AttachedSurface[] = [];
guidanceModule: GuidanceModule | null = null;
```

**Step 4: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/physics/RigidBody.ts
git commit -m "feat: add AttachedSurface and GuidanceModule to RigidBody"
```

---

### Task 3: Add applyAttachedSurfaces to Forces.ts

**Files:**
- Modify: `src/physics/Forces.ts`

**Step 1: Add the function at the end of Forces.ts**

```ts
export function applyAttachedSurfaces(body: RigidBody, rho: number): void {
  if (body.attachedSurfaces.length === 0) return;

  const speed = body.velocity.length();
  if (speed < 1e-4) return;
  const vHat = body.velocity.scale(1 / speed);

  for (const surface of body.attachedSurfaces) {
    // Transform surface normal to world space
    const worldNormal = body.orientation.rotateVector(surface.localNormal);
    const worldPos = body.orientation.rotateVector(surface.localPosition).add(body.position);

    // AoA for this surface
    const alpha = Math.asin(Math.max(-1, Math.min(1, vHat.dot(worldNormal))));
    const clMax = surface.cl0 + surface.clSlope * (Math.PI / 6);
    const cl = Math.max(-clMax, Math.min(clMax, surface.cl0 + surface.clSlope * alpha));

    const dynPressure = 0.5 * rho * speed * speed;

    // Drag (opposing velocity)
    const dragMag = dynPressure * surface.cd * surface.area;
    body.applyForceAtPoint(vHat.scale(-dragMag), worldPos);

    // Lift (perpendicular to velocity in normal-velocity plane)
    const liftDir = worldNormal.sub(vHat.scale(worldNormal.dot(vHat))).normalize();
    const liftMag = dynPressure * cl * surface.area;
    body.applyForceAtPoint(liftDir.scale(liftMag), worldPos);
  }
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/physics/Forces.ts
git commit -m "feat: add applyAttachedSurfaces for fin/wing simulation"
```

---

### Task 4: Wire attached surfaces and guidance into PhysicsWorld

**Files:**
- Modify: `src/physics/PhysicsWorld.ts`

**Step 1: Add imports**

At the top of PhysicsWorld.ts, add to the Forces import:

```ts
import { applyGravity, applyThrust, applyAeroDrag, applyAeroLift, applyAngularDamping, applyAttachedSurfaces } from './Forces.js';
```

**Step 2: Add guidance call and attached surfaces call in _substep**

In the `_substep` method, inside the "Apply forces" loop, add after `applyAngularDamping(body)`:

```ts
// Guidance module
if (body.guidanceModule) {
  body.guidanceModule.update(body, dt);
}

// Attached surfaces (fins, wings)
applyAttachedSurfaces(body, this.rho);
```

**Step 3: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/physics/PhysicsWorld.ts
git commit -m "feat: wire guidance modules and attached surfaces into physics substep"
```

---

### Task 5: Create Explosions.ts

**Files:**
- Create: `src/physics/Explosions.ts`

**Step 1: Write the file**

```ts
import { Vec3 } from '../math/Vec3.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { RigidBody } from './RigidBody.js';
import { ShapeType } from './shapes.js';

/**
 * Apply an instantaneous radial impulse to all bodies within radius.
 * Impulse at epicentre = power (N·s), falls off as 1/distance².
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
 * Call each frame, expanding radius at wave speed.
 * Only bodies within [radius - thickness, radius] are affected.
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

    // Pressure strongest at front of wave (inner edge)
    const waveFrac = 1 - (dist - inner) / thickness;
    const impulseMag = power * waveFrac * body.invMass;
    const dir = diff.scale(1 / dist);
    body.velocity.addMut(dir.scale(impulseMag));
  }
}

/**
 * Spawn fragment debris bodies at origin with randomised outward velocities.
 * Returns the spawned bodies so caller can add them to world if desired.
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

    // Random outward velocity
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
```

**Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/physics/Explosions.ts
git commit -m "feat: add explosion API (applyExplosion, applyBlastWave, spawnDebris)"
```

---

### Task 6: Create BodyDefinition system

**Files:**
- Create: `src/bodies/index.ts`

**Step 1: Create directory and file**

```bash
mkdir -p src/bodies
```

Write `src/bodies/index.ts`:

```ts
import { RigidBody, AttachedSurface, AeroProperties } from '../physics/RigidBody.js';
import { Shape, ShapeType } from '../physics/shapes.js';
import { Vec3 } from '../math/Vec3.js';
import { Quat } from '../math/Quat.js';

export interface BodyDefinition {
  name: string;
  shape: Shape;
  mass: number;
  aero: AeroProperties;
  restitution?: number;
  friction?: number;
  attachedSurfaces?: AttachedSurface[];
}

export function createBody(def: BodyDefinition): RigidBody {
  const body = new RigidBody(def.shape, def.mass, def.aero);
  if (def.restitution !== undefined) body.restitution = def.restitution;
  if (def.friction    !== undefined) body.friction    = def.friction;
  if (def.attachedSurfaces)         body.attachedSurfaces = def.attachedSurfaces.map(s => ({ ...s }));
  return body;
}

// ── Built-in presets ─────────────────────────────────────────────────────────

export const MissileBody: BodyDefinition = {
  name: 'Missile',
  shape: { type: ShapeType.Cylinder, radius: 0.1, height: 2.0 },
  mass: 50,
  aero: {
    wingArea: 0.03,
    cd: 0.3,
    cl0: 0,
    clSlope: 0,
    thrustMagnitude: 2000,
  },
  restitution: 0.05,
  friction: 0.4,
  attachedSurfaces: [
    // 4 tail fins 90° apart, placed 0.8 m behind CG
    { localPosition: new Vec3( 0,    0.12, -0.8), localNormal: new Vec3( 0,  1, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
    { localPosition: new Vec3( 0,   -0.12, -0.8), localNormal: new Vec3( 0, -1, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
    { localPosition: new Vec3( 0.12,  0,   -0.8), localNormal: new Vec3( 1,  0, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
    { localPosition: new Vec3(-0.12,  0,   -0.8), localNormal: new Vec3(-1,  0, 0), area: 0.04, cd: 0.012, cl0: 0, clSlope: 3.5 },
  ],
};

export const GliderBody: BodyDefinition = {
  name: 'Glider',
  shape: { type: ShapeType.Box, halfExtents: { x: 1, y: 0.1, z: 0.5 } },
  mass: 5,
  aero: { wingArea: 4, cd: 0.04, cl0: 0.1, clSlope: 5, thrustMagnitude: 0 },
  restitution: 0.2,
  friction: 0.6,
};

export const CannonballBody: BodyDefinition = {
  name: 'Cannonball',
  shape: { type: ShapeType.Sphere, radius: 0.1 },
  mass: 5,
  aero: { wingArea: 0.031, cd: 0.47, cl0: 0, clSlope: 0, thrustMagnitude: 0 },
  restitution: 0.2,
  friction: 0.5,
};
```

**Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/bodies/
git commit -m "feat: add BodyDefinition system, createBody factory, MissileBody/GliderBody/CannonballBody presets"
```

---

### Task 7: Update src/index.ts with all new exports

**Files:**
- Modify: `src/index.ts`

**Step 1: Replace src/index.ts**

```ts
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
```

**Step 2: Build the package**

```bash
npm run build
```

Expected: `dist/` produced with no errors.

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: update public API exports with all new engine features"
```

---

### Task 8: Add Missile to demo Presets and demo SetupPage

**Files:**
- Modify: `demo/src/simulation/Presets.ts`
- Modify: `demo/src/ui/SetupPage.ts`

**Step 1: Update Presets.ts to use createBody for Missile**

Add import at top:
```ts
import { createBody, MissileBody } from 'flight-engine-js';
```

Add new case in `spawnPreset`:
```ts
case 'Missile':
  body = createBody(MissileBody);
  body.position.set(0, 5, 0);
  // Orient nose-up: rotate -90° around X so forward (0,0,-1) → up (0,1,0)
  body.orientation = Quat.fromAxisAngle(new Vec3(1, 0, 0), Math.PI / 2);
  break;
```

Update `PresetName` type:
```ts
export type PresetName = 'Glider' | 'Rocket' | 'Ball' | 'Box' | 'Missile';
export const PRESET_NAMES: PresetName[] = ['Glider', 'Rocket', 'Ball', 'Box', 'Missile'];
```

**Step 2: Update SetupPage.ts palette colors**

Add to `PRESET_COLORS`:
```ts
Missile: '#ff4a4a',
```

Add to `PRESET_ABBR`:
```ts
Missile: 'MS',
```

**Step 3: Verify demo typechecks**

```bash
npx tsc --noEmit -p demo/tsconfig.json
```

Expected: no errors.

**Step 4: Commit**

```bash
git add demo/src/simulation/Presets.ts demo/src/ui/SetupPage.ts
git commit -m "feat: add Missile preset to demo using createBody"
```

---

### Task 9: Final verification

**Step 1: Full typecheck — engine + demo**

```bash
npm run typecheck
```

Expected: no errors from either tsconfig.

**Step 2: Build engine**

```bash
npm run build
```

Expected: clean dist output.

**Step 3: Start demo**

```bash
npm run demo
```

Expected: dev server starts. Setup page shows Missile in palette. Launch simulation, spawn a Missile, press Space — missile accelerates upward, fins stabilise it, it doesn't tumble.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete engine expansion — cylinder, fins, guidance, explosions, BodyDefinition"
```
