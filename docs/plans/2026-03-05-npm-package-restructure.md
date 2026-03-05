# flight-engine-js npm package restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the repo so `src/` is the publishable npm package (`flight-engine-js`) and the Three.js demo lives in `demo/` importing the engine as a real package.

**Architecture:** Root `package.json` is the engine package. `tsup` builds `dist/`. The `demo/` folder is a self-contained Vite app with a path alias so `import { PhysicsWorld } from 'flight-engine-js'` resolves to `../src` — exactly like a consumer would write it.

**Tech Stack:** TypeScript, tsup (package build), Vite (demo dev server), Three.js (demo only)

---

### Task 1: Add tsup, update package.json

**Files:**
- Modify: `package.json`

**Step 1: Install tsup**

```bash
npm install --save-dev tsup
```

Expected: tsup added to devDependencies in package.json.

**Step 2: Replace package.json**

Rewrite `package.json` to:

```json
{
  "name": "flight-engine-js",
  "version": "0.1.0",
  "description": "Aerodynamic rigid-body physics engine for the browser and Node.js",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p demo/tsconfig.json",
    "demo": "vite demo",
    "demo:build": "vite build demo"
  },
  "keywords": ["physics", "aerodynamics", "rigid-body", "simulation"],
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {
    "@types/three": "^0.170.0",
    "three": "^0.170.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

**Step 3: Verify install**

```bash
npm install
```

Expected: clean install, tsup present in node_modules.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: rename package flight-engine-js, add tsup"
```

---

### Task 2: Create tsup.config.ts

**Files:**
- Create: `tsup.config.ts`

**Step 1: Write the file**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

**Step 2: Commit**

```bash
git add tsup.config.ts
git commit -m "chore: add tsup build config"
```

---

### Task 3: Create src/index.ts — public API

**Files:**
- Create: `src/index.ts`

**Step 1: Write the file**

```ts
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
```

**Step 2: Test-build the package**

```bash
npm run build
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` created, no errors.

**Step 3: Commit**

```bash
git add src/index.ts dist/
git commit -m "feat: add public API index, build engine package"
```

---

### Task 4: Create demo/ directory structure

**Files:**
- Create: `demo/` directory tree

**Step 1: Create directories**

```bash
mkdir -p demo/src/renderer demo/src/simulation demo/src/ui
```

**Step 2: Move demo files out of src/**

```bash
mv src/renderer/SceneManager.ts   demo/src/renderer/
mv src/renderer/BodyRenderer.ts   demo/src/renderer/
mv src/renderer/DebugRenderer.ts  demo/src/renderer/
mv src/simulation/InputManager.ts demo/src/simulation/
mv src/simulation/Presets.ts      demo/src/simulation/
mv src/simulation/Simulation.ts   demo/src/simulation/
mv src/ui/ControlPanel.ts         demo/src/ui/
mv src/ui/ObjectPicker.ts         demo/src/ui/
mv src/ui/SetupPage.ts            demo/src/ui/
mv src/ui/Telemetry.ts            demo/src/ui/
mv src/main.ts                    demo/src/
mv src/styles.css                 demo/src/
mv index.html                     demo/
mv vite.config.ts                 demo/
```

**Step 3: Verify src/ only contains engine files**

```bash
find src/ -name "*.ts" | sort
```

Expected output (exactly):
```
src/index.ts
src/math/Mat3.ts
src/math/Quat.ts
src/math/Vec3.ts
src/physics/CollisionDetection.ts
src/physics/ContactResolver.ts
src/physics/Forces.ts
src/physics/Integrator.ts
src/physics/PhysicsWorld.ts
src/physics/RigidBody.ts
src/physics/shapes.ts
```

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move demo files to demo/"
```

---

### Task 5: Create demo/vite.config.ts

**Files:**
- Create: `demo/vite.config.ts`

**Step 1: Delete the moved vite.config.ts and write the new one**

The file is now at `demo/vite.config.ts`. Overwrite it with:

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'flight-engine-js': resolve(__dirname, '../src'),
    },
  },
});
```

**Step 2: Commit**

```bash
git add demo/vite.config.ts
git commit -m "chore: configure demo Vite alias for flight-engine-js"
```

---

### Task 6: Create demo/tsconfig.json

**Files:**
- Create: `demo/tsconfig.json`

**Step 1: Write the file**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "flight-engine-js": ["../src/index.ts"]
    }
  },
  "include": ["src"]
}
```

**Step 2: Update root tsconfig.json to only cover src/**

Open `tsconfig.json` and change the `include` field to:

```json
"include": ["src"]
```

(It was `["src"]` — verify it hasn't been changed to include renderer/simulation/ui paths.)

**Step 3: Commit**

```bash
git add demo/tsconfig.json tsconfig.json
git commit -m "chore: add demo tsconfig with flight-engine-js path alias"
```

---

### Task 7: Update demo imports — renderer files

**Files:**
- Modify: `demo/src/renderer/SceneManager.ts`
- Modify: `demo/src/renderer/BodyRenderer.ts`
- Modify: `demo/src/renderer/DebugRenderer.ts`

Each file currently imports from `../math/...` or `../physics/...`. Replace those with `flight-engine-js`.

**Step 1: Update SceneManager.ts**

Change:
```ts
import { Vec3 } from '../math/Vec3.js';
```
To:
```ts
import { Vec3 } from 'flight-engine-js';
```

**Step 2: Update BodyRenderer.ts**

Change:
```ts
import { RigidBody } from '../physics/RigidBody.js';
import { ShapeType } from '../physics/shapes.js';
import { Vec3 } from '../math/Vec3.js';
import { Quat } from '../math/Quat.js';
```
To:
```ts
import { RigidBody, ShapeType, Vec3, Quat } from 'flight-engine-js';
```

**Step 3: Update DebugRenderer.ts**

Change:
```ts
import { RigidBody } from '../physics/RigidBody.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
```
To:
```ts
import { RigidBody, PhysicsWorld } from 'flight-engine-js';
```

**Step 4: Commit**

```bash
git add demo/src/renderer/
git commit -m "refactor: update renderer imports to flight-engine-js"
```

---

### Task 8: Update demo imports — simulation files

**Files:**
- Modify: `demo/src/simulation/Presets.ts`
- Modify: `demo/src/simulation/Simulation.ts`

**Step 1: Update Presets.ts**

Change:
```ts
import { RigidBody } from '../physics/RigidBody.js';
import { ShapeType } from '../physics/shapes.js';
import { Vec3 } from '../math/Vec3.js';
import { Quat } from '../math/Quat.js';
```
To:
```ts
import { RigidBody, ShapeType, Vec3, Quat } from 'flight-engine-js';
```

**Step 2: Update Simulation.ts**

Change:
```ts
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { RigidBody } from '../physics/RigidBody.js';
import { Vec3 } from '../math/Vec3.js';
```
To:
```ts
import { PhysicsWorld, RigidBody, Vec3 } from 'flight-engine-js';
```

Also update the relative imports for files now in the same `demo/src/simulation/` directory — they stay as-is (`./Presets.js`, `./InputManager.js`).

Update the renderer imports from `../renderer/...` — these are still correct relative paths within demo/src/.

**Step 3: Commit**

```bash
git add demo/src/simulation/
git commit -m "refactor: update simulation imports to flight-engine-js"
```

---

### Task 9: Update demo imports — ui files

**Files:**
- Modify: `demo/src/ui/Telemetry.ts`

(ControlPanel, ObjectPicker, SetupPage only import from `../simulation/` or `three` — those relative paths are still valid.)

**Step 1: Update Telemetry.ts**

Change:
```ts
import { RigidBody } from '../physics/RigidBody.js';
```
To:
```ts
import { RigidBody } from 'flight-engine-js';
```

**Step 2: Update demo/src/main.ts**

The main.ts imports are already local demo imports (`./ui/SetupPage.js`, `./simulation/Simulation.js`, etc.) — no engine imports. Verify this is the case, no changes needed.

**Step 3: Update demo/src/styles.css import in main.ts**

The import `import './styles.css'` in main.ts is correct since both are in `demo/src/`.

**Step 4: Commit**

```bash
git add demo/src/ui/ demo/src/main.ts
git commit -m "refactor: update ui imports to flight-engine-js"
```

---

### Task 10: Verify full build

**Step 1: Run engine typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

**Step 2: Run demo typecheck**

```bash
npx tsc --noEmit -p demo/tsconfig.json
```

Expected: no errors.

**Step 3: Build the engine package**

```bash
npm run build
```

Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` — no errors.

**Step 4: Start demo dev server**

```bash
npm run demo
```

Expected: Vite dev server starts, opens in browser. Setup page shows, launch into simulation works. No console errors.

**Step 5: Final commit**

```bash
git add -A
git commit -m "refactor: complete flight-engine-js package restructure"
```

---

### Task 11: Add .npmignore

**Files:**
- Create: `.npmignore`

**Step 1: Write the file**

```
demo/
docs/
src/
*.config.ts
tsconfig.json
.worktrees/
```

This ensures only `dist/` ships in the published package.

**Step 2: Verify what would be published**

```bash
npm pack --dry-run
```

Expected: only `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `package.json`, `README.md` listed.

**Step 3: Commit**

```bash
git add .npmignore
git commit -m "chore: add .npmignore to exclude demo and source from npm publish"
```
