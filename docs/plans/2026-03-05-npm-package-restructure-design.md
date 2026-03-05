# Design: flight-engine-js npm package restructure

**Date:** 2026-03-05
**Status:** Approved

## Goal

Restructure the project so the physics engine is a first-class npm package (`flight-engine-js`) and the Three.js demo is a separate demo app that consumes it — exactly as an external user would.

## Structure

```
flightengineJS/
├── src/                        # Engine source (published to npm)
│   ├── index.ts                # Public API re-exports
│   ├── math/
│   │   ├── Vec3.ts
│   │   ├── Quat.ts
│   │   └── Mat3.ts
│   └── physics/
│       ├── RigidBody.ts
│       ├── shapes.ts
│       ├── PhysicsWorld.ts
│       ├── Forces.ts
│       ├── Integrator.ts
│       ├── CollisionDetection.ts
│       └── ContactResolver.ts
├── demo/                       # Three.js demo app (not published)
│   ├── index.html
│   ├── vite.config.ts          # aliases 'flight-engine-js' → ../src
│   └── src/
│       ├── main.ts
│       ├── styles.css
│       ├── renderer/
│       ├── simulation/
│       └── ui/
├── package.json                # Engine package
├── tsup.config.ts              # Package build config
└── tsconfig.json               # Shared TS config
```

## Package outputs

`npm run build` via tsup produces:

```
dist/
  index.js      # ESM
  index.cjs     # CommonJS
  index.d.ts    # TypeScript declarations
```

`package.json` exports map:

```json
{
  "name": "flight-engine-js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"]
}
```

## Public API

Full export — all math primitives, all physics classes and functions:

```ts
// Math
export { Vec3, Quat, Mat3 }

// Physics core
export { RigidBody, PhysicsWorld }
export type { AeroProperties }
export { ShapeType, computeInertiaTensor }
export type { Shape, SphereShape, BoxShape }

// Building blocks (power user API)
export { applyGravity, applyThrust, applyAeroDrag, applyAeroLift, applyAngularDamping }
export { integrate }
export { detectCollisions }
export type { Contact }
export { resolveContacts }
```

## Demo

- Lives in `demo/`, has its own `vite.config.ts`
- Imports `from 'flight-engine-js'` via Vite alias pointing to `../src`
- Behaves exactly like consumer code
- Scripts: `npm run demo` (dev), `npm run demo:build` (production build)

## Scripts

| Command | Action |
|---------|--------|
| `npm run build` | Build engine to `dist/` via tsup |
| `npm run typecheck` | `tsc --noEmit` across all source |
| `npm run demo` | Start demo dev server |
| `npm run demo:build` | Build demo for deployment |
