# flight-engine-js

A zero-dependency TypeScript physics engine for flight simulation — rigid bodies, aerodynamics, ISA atmosphere, collisions, constraints, and more. Runs in the browser and Node.js.

```
npm install flight-engine-js
```

---

## Features

| Area | What's included |
|------|----------------|
| **Math** | `Vec3`, `Quat`, `Mat3` |
| **Shapes** | Sphere, Box, Cylinder, Capsule |
| **Integrator** | Semi-implicit (symplectic) Euler |
| **Atmosphere** | ISA standard model — density, pressure, temperature, speed of sound, Mach |
| **Forces** | Gravity (configurable vector), thrust, thrust curves, aerodynamic drag + lift, attached surfaces, wind |
| **Collision** | All shape pairs vs ground plane; sphere-sphere, box-sphere, cylinder-sphere, cylinder-cylinder, capsule-sphere |
| **Contact resolution** | Sequential impulse solver with friction and Baumgarte stabilisation |
| **Sleep system** | Bodies below velocity threshold stop simulating, wake on contact/force |
| **Events** | Typed `world.on/off` emitter — `contact`, `sleep`, `wake`, `bodyAdded` |
| **Constraints** | Spring, distance (rigid rod), fixed joint (weld) |
| **Stage separation** | `world.couple()` → `StageJoint` → `joint.separate(impulse)` |
| **Flight recorder** | Per-body frame log with CSV export |
| **Serialisation** | `world.serialize()` / `world.deserialize()` — transfer across Web Workers |
| **Web Worker** | Drop-in physics worker (`PhysicsWorker.ts`) |
| **Presets** | `MissileBody`, `GliderBody`, `CannonballBody` |

---

## Quick start

```ts
import { PhysicsWorld, RigidBody, ShapeType, Vec3 } from 'flight-engine-js';

const world = new PhysicsWorld();
world.gravity = new Vec3(0, -9.81, 0);

const ball = new RigidBody(
  { type: ShapeType.Sphere, radius: 0.5 },
  2,                                       // mass (kg)
  { wingArea: 0.8, cd: 0.47, cl0: 0, clSlope: 0, thrustMagnitude: 0 }
);
ball.position.set(0, 10, 0);
world.addBody(ball);

function loop(dt: number) {
  world.step(dt);
  console.log(ball.position.y.toFixed(2)); // falling…
}
```

---

## Core concepts

### PhysicsWorld

```ts
const world = new PhysicsWorld();

world.gravity = new Vec3(0, -9.81, 0); // configurable gravity vector
world.wind    = new Vec3(5,  0,    0); // ambient wind (m/s)

world.addBody(body);
world.removeBody(body);
world.step(dt);                        // call each animation frame
```

`step()` uses a fixed substep of 1/120 s internally; pass your real frame delta and it accumulates.

### RigidBody

```ts
const body = new RigidBody(shape, mass, aeroProperties);

body.position.set(x, y, z);
body.velocity.set(vx, vy, vz);
body.orientation = Quat.fromAxisAngle(new Vec3(1, 0, 0), Math.PI / 2);

body.thrustEnabled = true;    // ignite
body.sleeping;                // true when at rest
body.restitution = 0.3;       // bounciness
body.friction    = 0.5;
```

### Shapes

```ts
{ type: ShapeType.Sphere,   radius: 0.5 }
{ type: ShapeType.Box,      halfExtents: { x: 1, y: 0.1, z: 0.5 } }
{ type: ShapeType.Cylinder, radius: 0.1, height: 2.0 }
{ type: ShapeType.Capsule,  radius: 0.1, halfHeight: 0.8 }
```

### Aerodynamics

```ts
const aero = {
  wingArea: 4,      // reference area (m²)
  cd: 0.04,         // drag coefficient
  cl0: 0.1,         // lift at zero AoA
  clSlope: 5,       // lift slope (per radian)
  thrustMagnitude: 0,
};
```

All aero forces automatically use ISA air density at the body's current altitude and respect `world.wind`.

### Atmosphere

```ts
import { airDensity, airPressure, speedOfSound, machNumber } from 'flight-engine-js';

airDensity(10_000);             // ~0.414 kg/m³ at 10 km
speedOfSound(0);                // ~340 m/s at sea level
machNumber(340, 0);             // 1.0
```

### Thrust curves

```ts
body.aero.thrustCurve = {
  times:   [0,   0.5, 2,   3  ],  // seconds from ignition
  thrusts: [0, 2000, 1800,  0  ],  // Newtons
};
body.thrustEnabled = true;  // starts counting thrustAge
```

When the curve ends, thrust returns to 0 automatically.

### Wind

```ts
world.wind = new Vec3(15, 0, 0); // 15 m/s headwind from the west
```

Drag, lift, and attached surfaces all use `apparentVelocity = body.velocity − wind`.

### Events

```ts
world.on('contact', (contacts) => {
  for (const c of contacts) {
    console.log('impact at', c.point);
  }
});

world.on('sleep', (body) => console.log(body.id, 'went to sleep'));
world.on('wake',  (body) => console.log(body.id, 'woke up'));

world.off('contact', handler); // remove listener
```

### Constraints

```ts
import { SpringConstraint, DistanceConstraint, FixedJoint } from 'flight-engine-js';

// Spring between two bodies
world.addConstraint(new SpringConstraint({
  bodyA: tank, bodyB: turret,
  restLength: 0, stiffness: 500, damping: 10,
}));

// Rigid rod (fixed distance)
world.addConstraint(new DistanceConstraint({
  bodyA: a, bodyB: b, distance: 3,
}));
```

### Stage separation

```ts
// Importing StageJoint registers world.couple() automatically
import { StageJoint } from 'flight-engine-js';

const joint = world.couple(booster, payload, new Vec3(0, 0.5, 0));

// ... later, on burnout:
joint.separate(800); // 800 N·s separation impulse
```

### Flight recorder

```ts
import { FlightRecorder } from 'flight-engine-js';

const recorder = new FlightRecorder();
recorder.attach(missile, world);

// after simulation:
const frames = recorder.getFrames(missile.id);
// [{ t, position, velocity, orientation, speed, altitude }, ...]

const csv = recorder.exportCSV(missile.id);
```

### Serialisation

```ts
const snapshot = world.serialize();
// snapshot is a plain JSON-serialisable object — safe to postMessage

world.deserialize(snapshot); // restore state
```

### Web Worker

```ts
// worker.ts
import 'flight-engine-js/worker'; // re-export PhysicsWorker

// main.ts
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
worker.postMessage({ type: 'step', dt: 1 / 60 });
worker.onmessage = ({ data }) => {
  if (data.type === 'snapshot') world.deserialize(data.snapshot);
};
```

### Sleep system

```ts
world.sleepEnabled = true;   // default
world.sleepDelay   = 0.5;    // seconds below threshold before sleeping

body.sleepThreshold = 0.05;  // m/s combined speed (linear + angular)
body.wake();                 // manually wake a body
```

---

## Presets

```ts
import { createBody, MissileBody, GliderBody, CannonballBody } from 'flight-engine-js';

const missile = createBody(MissileBody);
missile.position.set(0, 1, 0);
world.addBody(missile);
```

---

## Body helpers

```ts
body.getForwardDir()          // local -Z in world space
body.getUpDir()               // local +Y in world space
body.localToWorld(localVec)
body.worldToLocal(worldVec)
body.applyForce(f)
body.applyForceAtPoint(f, worldPoint)
body.applyTorque(t)
```

---

## Coordinate conventions

- **Y-up** world space
- **Forward** = local `-Z` (matches Three.js and glTF)
- Cylinder/Capsule axis runs along **local -Z**
- Ground plane at `Y = 0`

---

## Building

```
npm run build        # emit dist/
npm run typecheck    # tsc --noEmit for lib + demo
npm run demo         # Vite dev server for the interactive demo
```

---

## License

MIT
