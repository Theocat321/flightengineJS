/**
 * Web Worker physics loop.
 *
 * The main thread communicates by posting typed messages:
 *
 * Main → Worker:
 *   { type: 'step',   dt: number }
 *   { type: 'init',   snapshot: WorldSnapshot }  — optional restore
 *   { type: 'setGravity', x, y, z }
 *   { type: 'setWind',    x, y, z }
 *
 * Worker → Main:
 *   { type: 'snapshot', snapshot: WorldSnapshot }
 */

import { PhysicsWorld, WorldSnapshot } from '../physics/PhysicsWorld.js';
import { Vec3 } from '../math/Vec3.js';

// ── Message types ─────────────────────────────────────────────────────────────

export type WorkerInbound =
  | { type: 'step';       dt: number }
  | { type: 'init';       snapshot: WorldSnapshot }
  | { type: 'setGravity'; x: number; y: number; z: number }
  | { type: 'setWind';    x: number; y: number; z: number };

export type WorkerOutbound =
  | { type: 'snapshot';   snapshot: WorldSnapshot };

// ── Worker setup ──────────────────────────────────────────────────────────────

let world: PhysicsWorld | null = null;

function getWorld(): PhysicsWorld {
  if (!world) world = new PhysicsWorld();
  return world;
}

self.onmessage = (evt: MessageEvent<WorkerInbound>) => {
  const msg = evt.data;
  const w   = getWorld();

  switch (msg.type) {
    case 'init':
      w.deserialize(msg.snapshot);
      break;

    case 'setGravity':
      w.gravity.set(msg.x, msg.y, msg.z);
      break;

    case 'setWind':
      w.wind.set(msg.x, msg.y, msg.z);
      break;

    case 'step':
      w.step(msg.dt);
      // Post snapshot back — structured clone will copy plain objects
      (self as unknown as { postMessage(m: WorkerOutbound): void }).postMessage({
        type:     'snapshot',
        snapshot: w.serialize(),
      });
      break;
  }
};
