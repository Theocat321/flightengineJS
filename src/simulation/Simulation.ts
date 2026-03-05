import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { RigidBody } from '../physics/RigidBody.js';
import { SceneManager } from '../renderer/SceneManager.js';
import { BodyRenderer } from '../renderer/BodyRenderer.js';
import { DebugRenderer } from '../renderer/DebugRenderer.js';
import { InputManager } from './InputManager.js';
import { spawnPreset, PresetName } from './Presets.js';
import { Vec3 } from '../math/Vec3.js';

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

  private _rafId: number = 0;
  private _lastTime: number = 0;
  private _resetPressed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new PhysicsWorld();
    this.sceneManager = new SceneManager(canvas);
    this.bodyRenderer = new BodyRenderer(this.sceneManager.scene);
    this.debugRenderer = new DebugRenderer(this.sceneManager.scene);
    this.input = new InputManager();
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
    this.bodyRenderer.syncBodies(this.world.bodies, 1);
    this.debugRenderer.update(this.world);
    this.sceneManager.update(1);
    this.sceneManager.render();
  }

  spawn(name: PresetName): RigidBody {
    const offset = new Vec3(
      (Math.random() - 0.5) * 4,
      0,
      (Math.random() - 0.5) * 4
    );
    const body = spawnPreset(name);
    body.position.addMut(offset);
    this.world.addBody(body);
    this.bodyRenderer.addBody(body);
    return body;
  }

  removeBody(body: RigidBody): void {
    if (this.selectedBody === body) {
      this.selectBody(null);
    }
    this.world.removeBody(body);
    this.bodyRenderer.removeBody(body);
  }

  selectBody(body: RigidBody | null): void {
    this.selectedBody = body;
    this.bodyRenderer.selectedId = body?.id ?? null;

    if (this.followCamera && body) {
      const mesh = this.bodyRenderer.getMesh(body.id);
      this.sceneManager.setFollowTarget(mesh ?? null);
    } else if (!body) {
      this.sceneManager.setFollowTarget(null);
    }

    this.onSelect?.(body);
  }

  setFollowCamera(enabled: boolean): void {
    this.followCamera = enabled;
    if (enabled && this.selectedBody) {
      const mesh = this.bodyRenderer.getMesh(this.selectedBody.id);
      this.sceneManager.setFollowTarget(mesh ?? null);
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
    this.selectedBody = null;
    this.bodyRenderer.selectedId = null;
    this.onSelect?.(null);
  }

  private _loop(time: number): void {
    this._rafId = requestAnimationFrame(t => this._loop(t));

    const dt = Math.min((time - this._lastTime) / 1000, MAX_DT);
    this._lastTime = time;

    // Handle thrust for selected body
    if (this.selectedBody) {
      if (this.input.isThrustActive()) {
        this.world.thrustActiveIds.add(this.selectedBody.id);
      } else {
        this.world.thrustActiveIds.delete(this.selectedBody.id);
      }
    }

    // Handle reset
    const rDown = this.input.isResetPressed();
    if (rDown && !this._resetPressed) {
      this.reset();
    }
    this._resetPressed = rDown;

    if (!this.paused) {
      this._physicsStep(dt);
    }

    const alpha = this.world.getInterpolationAlpha();
    this.bodyRenderer.syncBodies(this.world.bodies, alpha);
    this.debugRenderer.update(this.world);
    this.sceneManager.update(alpha);
    this.sceneManager.render();
  }

  private _physicsStep(dt: number): void {
    // Apply control torques from input
    if (this.selectedBody) {
      const body = this.selectedBody;
      const pitch = this.input.getPitchInput();
      const roll = this.input.getRollInput();
      const yaw = this.input.getYawInput();

      if (pitch !== 0 || roll !== 0 || yaw !== 0) {
        // Convert body-local control axes to world torque
        const pitchAxis = body.getRightDir();
        const rollAxis = body.getForwardDir();
        const yawAxis = body.getUpDir();

        const torque = pitchAxis.scale(pitch * CONTROL_TORQUE)
          .add(rollAxis.scale(roll * CONTROL_TORQUE))
          .add(yawAxis.scale(yaw * CONTROL_TORQUE));

        body.applyTorque(torque);
      }
    }

    this.world.step(dt);
  }
}
