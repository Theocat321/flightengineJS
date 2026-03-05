import { PhysicsWorld, RigidBody, Vec3, applyExplosion, spawnDebris } from 'flight-engine-js';
import { SceneManager } from '../renderer/SceneManager.js';
import { BodyRenderer } from '../renderer/BodyRenderer.js';
import { DebugRenderer } from '../renderer/DebugRenderer.js';
import { InputManager } from './InputManager.js';
import { spawnPreset, PresetName } from './Presets.js';

const CONTROL_TORQUE = 15;
const MAX_DT = 0.1;

export class Simulation {
  world: PhysicsWorld;
  sceneManager: SceneManager;
  bodyRenderer: BodyRenderer;
  debugRenderer: DebugRenderer;
  input: InputManager;

  selectedBody: RigidBody | null = null;
  paused: boolean = false;
  followCamera: boolean = false;

  onSelect: ((body: RigidBody | null) => void) | null = null;

  /** Bodies that explode on contact (e.g. missiles) */
  private _explosiveBodies: Set<number> = new Set();
  /** Bodies queued for removal after the physics step completes */
  private _removalQueue: Set<number> = new Set();

  private _rafId: number = 0;
  private _lastTime: number = 0;
  private _resetPressed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new PhysicsWorld();
    this.sceneManager = new SceneManager(canvas);
    this.bodyRenderer = new BodyRenderer(this.sceneManager.scene);
    this.debugRenderer = new DebugRenderer(this.sceneManager.scene);
    this.input = new InputManager();

    // Wire explosion callback — only trigger on real impacts (speed > threshold)
    this.world.onContact = (contacts) => {
      for (const contact of contacts) {
        const bodies = [contact.bodyA, contact.bodyB].filter(Boolean) as RigidBody[];
        for (const b of bodies) {
          if (
            this._explosiveBodies.has(b.id) &&
            !this._removalQueue.has(b.id) &&
            b.velocity.length() > 8
          ) {
            this._removalQueue.add(b.id);
            this._triggerExplosion(b);
          }
        }
      }
    };
  }

  private _triggerExplosion(body: RigidBody): void {
    const origin = body.position.clone();
    applyExplosion(this.world, origin, 8000, 25);

    // Spawn debris and add renderers for them
    const debris = spawnDebris(this.world, origin, 24, 35, { mass: 0.3, radius: 0.06 });
    for (const d of debris) {
      this.bodyRenderer.addBody(d);
    }
  }

  start(): void {
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  stop(): void {
    cancelAnimationFrame(this._rafId);
  }

  pause(): void { this.paused = true; }
  play(): void { this.paused = false; }
  togglePause(): void { this.paused = !this.paused; }

  stepOnce(): void {
    const dt = 1 / 60;
    this._physicsStep(dt);
    this._flushRemovals();
    this.bodyRenderer.syncBodies(this.world.bodies, 1);
    this.debugRenderer.update(this.world);
    this.sceneManager.update(1);
    this.sceneManager.render();
  }

  spawn(name: PresetName, worldX?: number, worldZ?: number): RigidBody {
    const body = spawnPreset(name);
    if (worldX !== undefined) body.position.x = worldX;
    if (worldZ !== undefined) body.position.z = worldZ;
    body.previousPosition.copyFrom(body.position);
    this.world.addBody(body);
    this.bodyRenderer.addBody(body);
    if (name === 'Missile') {
      this._explosiveBodies.add(body.id);
    }
    return body;
  }

  removeBody(body: RigidBody): void {
    if (this.selectedBody === body) {
      this.selectBody(null);
    }
    this._explosiveBodies.delete(body.id);
    this.world.removeBody(body);
    this.bodyRenderer.removeBody(body);
  }

  selectBody(body: RigidBody | null): void {
    this.selectedBody = body;
    this.bodyRenderer.selectedId = body?.id ?? null;

    const obj = body ? this.bodyRenderer.getMesh(body.id) : null;

    if (this.followCamera && obj) {
      this.sceneManager.setFollowTarget(obj);
    } else if (!body) {
      this.sceneManager.setFollowTarget(null);
    }

    if (body) {
      this.sceneManager.snapToPosition(body.position.x, body.position.y, body.position.z);
    }

    this.onSelect?.(body);
  }

  setFollowCamera(enabled: boolean): void {
    this.followCamera = enabled;
    if (enabled && this.selectedBody) {
      const obj = this.bodyRenderer.getMesh(this.selectedBody.id);
      this.sceneManager.setFollowTarget(obj ?? null);
    } else {
      this.sceneManager.setFollowTarget(null);
    }
  }

  setDebug(enabled: boolean): void {
    this.debugRenderer.setVisible(enabled);
  }

  reset(): void {
    this.world.clear();
    this.bodyRenderer.clear();
    this._explosiveBodies.clear();
    this._removalQueue.clear();
    this.selectedBody = null;
    this.bodyRenderer.selectedId = null;
    this.onSelect?.(null);
  }

  private _flushRemovals(): void {
    if (this._removalQueue.size === 0) return;
    for (const id of this._removalQueue) {
      const body = this.world.bodies.find(b => b.id === id);
      if (body) this.removeBody(body);
    }
    this._removalQueue.clear();
  }

  private _loop(time: number): void {
    this._rafId = requestAnimationFrame(t => this._loop(t));

    const dt = Math.min((time - this._lastTime) / 1000, MAX_DT);
    this._lastTime = time;

    if (this.selectedBody) {
      if (this.input.isThrustActive()) {
        this.world.thrustActiveIds.add(this.selectedBody.id);
      } else {
        this.world.thrustActiveIds.delete(this.selectedBody.id);
      }
    }

    const rDown = this.input.isResetPressed();
    if (rDown && !this._resetPressed) {
      this.reset();
    }
    this._resetPressed = rDown;

    if (!this.paused) {
      this._physicsStep(dt);
      this._flushRemovals();
    }

    const alpha = this.world.getInterpolationAlpha();
    this.bodyRenderer.syncBodies(this.world.bodies, alpha);
    this.debugRenderer.update(this.world);
    this.sceneManager.update(alpha);
    this.sceneManager.render();
  }

  private _physicsStep(dt: number): void {
    if (this.selectedBody) {
      const body = this.selectedBody;
      const pitch = this.input.getPitchInput();
      const roll  = this.input.getRollInput();
      const yaw   = this.input.getYawInput();

      if (pitch !== 0 || roll !== 0 || yaw !== 0) {
        const torque = body.getRightDir().scale(pitch * CONTROL_TORQUE)
          .add(body.getForwardDir().scale(roll * CONTROL_TORQUE))
          .add(body.getUpDir().scale(yaw * CONTROL_TORQUE));
        body.applyTorque(torque);
      }
    }

    this.world.step(dt);
  }
}
