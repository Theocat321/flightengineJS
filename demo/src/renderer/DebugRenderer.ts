import * as THREE from 'three';
import { RigidBody, PhysicsWorld } from 'flight-engine-js';

interface BodyArrows {
  velocity: THREE.ArrowHelper;
  lift: THREE.ArrowHelper;
  drag: THREE.ArrowHelper;
  thrust: THREE.ArrowHelper;
  angVel: THREE.ArrowHelper;
}

export class DebugRenderer {
  private scene: THREE.Scene;
  private arrows: Map<number, BodyArrows> = new Map();
  private overlay: HTMLElement;
  visible: boolean = false;

  private frameCount = 0;
  private lastFpsTime = performance.now();
  private fps = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.overlay = document.createElement('div');
    this.overlay.id = 'debug-overlay';
    this.overlay.style.display = 'none';
    document.body.appendChild(this.overlay);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.overlay.style.display = v ? 'block' : 'none';
    if (!v) {
      for (const [, arrs] of this.arrows) this._hideArrows(arrs);
    }
  }

  update(world: PhysicsWorld): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (!this.visible) return;

    this.overlay.textContent = `FPS: ${this.fps}  |  substeps: ${world.substepsLastFrame}  |  bodies: ${world.bodies.length}`;

    for (const body of world.bodies) {
      if (!this.arrows.has(body.id)) {
        this._createArrows(body.id);
      }
      this._updateArrows(body, body.thrustEnabled);
    }

    // Remove arrows for removed bodies
    for (const [id] of this.arrows) {
      if (!world.bodies.find(b => b.id === id)) {
        const arrs = this.arrows.get(id)!;
        this._removeArrows(arrs);
        this.arrows.delete(id);
      }
    }
  }

  private _createArrows(id: number): void {
    const dir = new THREE.Vector3(0, 1, 0);
    const origin = new THREE.Vector3(0, 0, 0);
    const arrs: BodyArrows = {
      velocity: new THREE.ArrowHelper(dir, origin, 1, 0xff2222),
      lift: new THREE.ArrowHelper(dir, origin, 1, 0x22ff44),
      drag: new THREE.ArrowHelper(dir, origin, 1, 0xffee22),
      thrust: new THREE.ArrowHelper(dir, origin, 1, 0x2288ff),
      angVel: new THREE.ArrowHelper(dir, origin, 1, 0xcc44ff),
    };
    for (const v of Object.values(arrs)) this.scene.add(v);
    this.arrows.set(id, arrs);
  }

  private _hideArrows(arrs: BodyArrows): void {
    for (const v of Object.values(arrs)) v.visible = false;
  }

  private _removeArrows(arrs: BodyArrows): void {
    for (const v of Object.values(arrs)) this.scene.remove(v);
  }

  private _updateArrows(body: RigidBody, thrustActive: boolean): void {
    const rho = 1.225; // sea-level density for debug visualisation
    const arrs = this.arrows.get(body.id)!;
    const pos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);

    const setArrow = (arrow: THREE.ArrowHelper, vx: number, vy: number, vz: number, scale: number) => {
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz) * scale;
      if (len < 0.01) { arrow.visible = false; return; }
      arrow.visible = true;
      arrow.position.copy(pos);
      arrow.setDirection(new THREE.Vector3(vx, vy, vz).normalize());
      arrow.setLength(Math.min(len, 20), 0.3, 0.2);
    };

    setArrow(arrs.velocity, body.velocity.x, body.velocity.y, body.velocity.z, 0.3);
    setArrow(arrs.angVel, body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z, 0.5);

    // Drag direction
    const speed = body.velocity.length();
    if (speed > 0.1) {
      const dragDir = body.velocity.scale(-1 / speed);
      const dragMag = 0.5 * rho * body.aero.cd * body.aero.wingArea * speed * speed * 0.05;
      setArrow(arrs.drag, dragDir.x, dragDir.y, dragDir.z, dragMag);
    } else {
      arrs.drag.visible = false;
    }

    // Thrust
    if (thrustActive && body.aero.thrustMagnitude > 0) {
      const fwd = body.getForwardDir();
      setArrow(arrs.thrust, fwd.x, fwd.y, fwd.z, body.aero.thrustMagnitude * 0.02);
    } else {
      arrs.thrust.visible = false;
    }

    // Lift (simplified: upward component)
    const up = body.getUpDir();
    setArrow(arrs.lift, up.x, up.y, up.z, 0.2);
  }

  dispose(): void {
    for (const [, arrs] of this.arrows) this._removeArrows(arrs);
    this.arrows.clear();
    this.overlay.remove();
  }
}
