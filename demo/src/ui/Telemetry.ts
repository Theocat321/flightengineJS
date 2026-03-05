import { RigidBody } from '../physics/RigidBody.js';

export class Telemetry {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = this._render(null);
  }

  update(body: RigidBody | null): void {
    this.container.innerHTML = this._render(body);
  }

  private _render(body: RigidBody | null): string {
    if (!body) {
      return `<div class="telemetry-grid">
        <span class="telemetry-label">No object selected</span><span></span>
      </div>`;
    }

    const speed = body.velocity.length();
    const altitude = body.position.y;

    // AoA
    const vHat = speed > 0.1 ? body.velocity.scale(1 / speed) : body.getForwardDir();
    const bodyUp = body.getUpDir();
    const alpha = Math.asin(Math.max(-1, Math.min(1, vHat.dot(bodyUp))));
    const alphaDeg = alpha * (180 / Math.PI);

    // Lift magnitude (estimate)
    const rho = 1.225;
    const cl = Math.max(-2, Math.min(2, body.aero.cl0 + body.aero.clSlope * alpha));
    const liftMag = 0.5 * rho * cl * body.aero.wingArea * speed * speed;
    const dragMag = 0.5 * rho * body.aero.cd * body.aero.wingArea * speed * speed;

    const angRate = body.angularVelocity.length() * (180 / Math.PI);
    const px = body.angularVelocity.x * (180 / Math.PI);
    const py = body.angularVelocity.y * (180 / Math.PI);
    const pz = body.angularVelocity.z * (180 / Math.PI);

    const fmt = (n: number, d = 1) => n.toFixed(d);

    return `<div class="telemetry-grid">
      <span class="telemetry-label">Speed</span><span class="telemetry-value">${fmt(speed)} m/s</span>
      <span class="telemetry-label">Altitude</span><span class="telemetry-value">${fmt(altitude)} m</span>
      <span class="telemetry-label">AoA</span><span class="telemetry-value">${fmt(alphaDeg, 1)}°</span>
      <span class="telemetry-label">Lift</span><span class="telemetry-value">${fmt(liftMag)} N</span>
      <span class="telemetry-label">Drag</span><span class="telemetry-value">${fmt(dragMag)} N</span>
      <span class="telemetry-label">AngRate</span><span class="telemetry-value">${fmt(angRate, 1)} °/s</span>
      <span class="telemetry-label">Pitch rate</span><span class="telemetry-value">${fmt(px, 1)} °/s</span>
      <span class="telemetry-label">Yaw rate</span><span class="telemetry-value">${fmt(py, 1)} °/s</span>
      <span class="telemetry-label">Roll rate</span><span class="telemetry-value">${fmt(pz, 1)} °/s</span>
    </div>`;
  }
}
