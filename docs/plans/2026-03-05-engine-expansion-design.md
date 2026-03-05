# Design: Engine Expansion — Missiles, Explosions, Custom Bodies

**Date:** 2026-03-05
**Status:** Approved

## Goal

Expand `flight-engine-js` into a serious missile/projectile simulation framework with fin-stabilised bodies, guidance modules, explosion physics, and a shareable `BodyDefinition` system.

## New Concepts

### AttachedSurface
A lift/drag emitter fixed to a body at a local-space offset. Used for fins, canards, wings. Each surface applies aero forces at its world position, naturally generating stabilising torque.

```ts
interface AttachedSurface {
  localPosition: Vec3   // offset from CG in body space
  localNormal: Vec3     // surface normal in body space
  area: number          // m²
  cd: number
  cl0: number
  clSlope: number
}
```

`RigidBody` gains `attachedSurfaces: AttachedSurface[]`.
`Forces.ts` gains `applyAttachedSurfaces(body, rho)`.

### BodyDefinition + createBody
Typed schema describing a body's complete physical properties. Shareable as npm packages.

```ts
interface BodyDefinition {
  name: string
  shape: Shape
  mass: number
  aero: AeroProperties
  restitution?: number
  friction?: number
  attachedSurfaces?: AttachedSurface[]
}

function createBody(def: BodyDefinition): RigidBody
```

### Cylinder shape
New `ShapeType.Cylinder` with `radius` and `height`. Inertia tensor for solid cylinder.

### GuidanceModule interface
User-supplied per-body controller. Called each physics substep before force integration.

```ts
interface GuidanceModule {
  update(body: RigidBody, dt: number): void
}
// Attached via: body.guidanceModule?: GuidanceModule
```

### Built-in Missile preset
`MissileBody: BodyDefinition` — cylinder shape, 4 tail fins, high thrust. Exported from `src/index.ts`.

### Explosion API

```ts
// Radial impulse — instantaneous
applyExplosion(world, origin, power, radius): void

// Pressure wave — call each frame, caller expands radius
applyBlastWave(world, origin, power, radius, thickness): void

// Debris spawning
spawnDebris(world, origin, count, speed, def?): RigidBody[]
```

## Public API additions

```ts
export type { AttachedSurface, GuidanceModule, BodyDefinition }
export { createBody }
export { MissileBody }
export { applyExplosion, applyBlastWave, spawnDebris } from './physics/Explosions.js'
```

## Files changed

| File | Action |
|------|--------|
| `src/physics/shapes.ts` | Add `ShapeType.Cylinder`, `CylinderShape`, inertia |
| `src/physics/RigidBody.ts` | Add `attachedSurfaces`, `guidanceModule` |
| `src/physics/Forces.ts` | Add `applyAttachedSurfaces` |
| `src/physics/PhysicsWorld.ts` | Call `guidanceModule.update()` and `applyAttachedSurfaces` in substep |
| `src/physics/Explosions.ts` | New file: `applyExplosion`, `applyBlastWave`, `spawnDebris` |
| `src/bodies/index.ts` | New file: `BodyDefinition`, `createBody`, `MissileBody` |
| `src/index.ts` | Export all new public API |
