import { RigidBody } from './RigidBody.js';
import { PhysicsWorld, IFlightRecorder } from './PhysicsWorld.js';

export interface FlightFrame {
  t: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  speed: number;
  altitude: number;
}

/**
 * Records the state of one or more rigid bodies at each world step.
 *
 * Usage:
 * ```ts
 * const recorder = new FlightRecorder();
 * recorder.attach(missile, world);
 * // ... run simulation ...
 * const frames = recorder.getFrames(missile.id);
 * const csv = recorder.exportCSV(missile.id);
 * ```
 */
export class FlightRecorder implements IFlightRecorder {
  private _bodies: Map<number, { body: RigidBody; frames: FlightFrame[] }> = new Map();
  private _world: PhysicsWorld | null = null;

  attach(body: RigidBody, world: PhysicsWorld): void {
    if (!this._bodies.has(body.id)) {
      this._bodies.set(body.id, { body, frames: [] });
    }
    if (this._world !== world) {
      if (this._world) this._world.detachRecorder(this);
      this._world = world;
      world.attachRecorder(this);
    }
  }

  detach(): void {
    if (this._world) {
      this._world.detachRecorder(this);
      this._world = null;
    }
  }

  clear(): void {
    for (const entry of this._bodies.values()) {
      entry.frames.length = 0;
    }
  }

  getFrames(bodyId?: number): FlightFrame[] {
    if (bodyId !== undefined) {
      return this._bodies.get(bodyId)?.frames ?? [];
    }
    // Return all frames merged (first body only for backward compat)
    const first = this._bodies.values().next().value as { frames: FlightFrame[] } | undefined;
    return first?.frames ?? [];
  }

  exportCSV(bodyId?: number): string {
    const frames = this.getFrames(bodyId);
    const header = 't,x,y,z,vx,vy,vz,speed,altitude,qx,qy,qz,qw';
    const rows = frames.map(f =>
      [
        f.t.toFixed(4),
        f.position.x.toFixed(4), f.position.y.toFixed(4), f.position.z.toFixed(4),
        f.velocity.x.toFixed(4), f.velocity.y.toFixed(4), f.velocity.z.toFixed(4),
        f.speed.toFixed(4),
        f.altitude.toFixed(4),
        f.orientation.x.toFixed(6), f.orientation.y.toFixed(6),
        f.orientation.z.toFixed(6), f.orientation.w.toFixed(6),
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }

  // ── IFlightRecorder interface ───────────────────────────────────────────────

  _record(time: number): void {
    for (const { body, frames } of this._bodies.values()) {
      frames.push({
        t: time,
        position:    { x: body.position.x,       y: body.position.y,       z: body.position.z },
        velocity:    { x: body.velocity.x,       y: body.velocity.y,       z: body.velocity.z },
        orientation: { x: body.orientation.x,    y: body.orientation.y,
                       z: body.orientation.z,    w: body.orientation.w },
        speed:       body.velocity.length(),
        altitude:    body.position.y,
      });
    }
  }

  _onBodyRemoved(body: RigidBody): void {
    this._bodies.delete(body.id);
  }
}
