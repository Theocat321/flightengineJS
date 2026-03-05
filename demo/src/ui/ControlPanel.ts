import { Simulation } from '../simulation/Simulation.js';
import { RigidBody } from 'flight-engine-js';
import { Telemetry } from './Telemetry.js';
import { PRESET_NAMES, PresetName } from '../simulation/Presets.js';

export class ControlPanel {
  private sim: Simulation;
  private container: HTMLElement;
  private telemetry!: Telemetry;
  private telemetryEl!: HTMLElement;
  private selectedBody: RigidBody | null = null;
  private rafId = 0;

  constructor(sim: Simulation, container: HTMLElement) {
    this.sim = sim;
    this.container = container;
    this._build();
    this._startTelemetryLoop();
  }

  private _build(): void {
    this.container.innerHTML = `
      <div class="panel-section">
        <h2>Flight Sandbox</h2>
        <div class="btn-row">
          <button id="btn-play">&#9654; Play</button>
          <button id="btn-pause">&#9646;&#9646; Pause</button>
          <button id="btn-step">&#9656; Step</button>
          <button id="btn-reset">&#8635; Reset</button>
        </div>
      </div>

      <div class="panel-section">
        <h2>Spawn Object</h2>
        <div class="spawn-row">
          <select id="spawn-select">
            ${PRESET_NAMES.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
          <button id="btn-spawn">Spawn</button>
        </div>
      </div>

      <div class="panel-section">
        <h2>World Settings</h2>
        ${this._sliderHTML('gravity', 'Gravity', 0, 30, this.sim.world.gravity, 0.5)}
        ${this._sliderHTML('rho', 'Air Density', 0, 3, this.sim.world.rho, 0.05)}
      </div>

      <div class="panel-section">
        <h2>Selected Body</h2>
        <div id="body-props">
          <div style="color:var(--text-muted);font-size:11px;">Click an object to select it.</div>
        </div>
      </div>

      <div class="panel-section">
        <h2>View</h2>
        <div class="toggle-row">
          <label>Follow Camera</label>
          <input type="checkbox" id="chk-follow" />
        </div>
        <div class="toggle-row">
          <label>Debug Vectors</label>
          <input type="checkbox" id="chk-debug" />
        </div>
      </div>

      <div class="panel-section">
        <h2>Telemetry</h2>
        <div id="telemetry-container"></div>
      </div>

      <div class="panel-section">
        <h2>Controls</h2>
        <div class="kbd-help">
          <span class="kbd">W/S</span> Pitch &nbsp;
          <span class="kbd">A/D</span> Roll &nbsp;
          <span class="kbd">Q/E</span> Yaw<br/>
          <span class="kbd">Space</span> Thrust &nbsp;
          <span class="kbd">R</span> Reset<br/>
          <span class="kbd">LMB</span> Select &nbsp;
          <span class="kbd">RMB drag</span> Orbit
        </div>
      </div>
    `;

    this.telemetryEl = this.container.querySelector('#telemetry-container')!;
    this.telemetry = new Telemetry(this.telemetryEl);

    this._wireTransport();
    this._wireWorld();
    this._wireView();
  }

  private _sliderHTML(id: string, label: string, min: number, max: number, val: number, step: number): string {
    return `<div class="slider-row">
      <label>${label}</label>
      <input type="range" id="sl-${id}" min="${min}" max="${max}" step="${step}" value="${val}" />
      <span class="slider-val" id="sv-${id}">${val.toFixed(2)}</span>
    </div>`;
  }

  private _bodySliderHTML(id: string, label: string, min: number, max: number, val: number, step: number): string {
    return `<div class="slider-row">
      <label>${label}</label>
      <input type="range" id="bsl-${id}" min="${min}" max="${max}" step="${step}" value="${val}" />
      <span class="slider-val" id="bsv-${id}">${val.toFixed(2)}</span>
    </div>`;
  }

  private _wireTransport(): void {
    this.container.querySelector('#btn-play')!.addEventListener('click', () => this.sim.play());
    this.container.querySelector('#btn-pause')!.addEventListener('click', () => this.sim.pause());
    this.container.querySelector('#btn-step')!.addEventListener('click', () => { this.sim.pause(); this.sim.stepOnce(); });
    this.container.querySelector('#btn-reset')!.addEventListener('click', () => this.sim.reset());
    this.container.querySelector('#btn-spawn')!.addEventListener('click', () => {
      const sel = this.container.querySelector('#spawn-select') as HTMLSelectElement;
      const body = this.sim.spawn(sel.value as PresetName, 0, 0);
      this.sim.setFollowCamera(true);
      (this.container.querySelector('#chk-follow') as HTMLInputElement).checked = true;
      this.sim.selectBody(body);
    });
  }

  private _wireWorld(): void {
    const makeSlider = (id: string, onChange: (v: number) => void) => {
      const input = this.container.querySelector(`#sl-${id}`) as HTMLInputElement;
      const span = this.container.querySelector(`#sv-${id}`) as HTMLSpanElement;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        span.textContent = v.toFixed(2);
        onChange(v);
      });
    };

    makeSlider('gravity', v => { this.sim.world.gravity = v; });
    makeSlider('rho', v => { this.sim.world.rho = v; });
  }

  private _wireView(): void {
    (this.container.querySelector('#chk-follow') as HTMLInputElement).addEventListener('change', e => {
      this.sim.setFollowCamera((e.target as HTMLInputElement).checked);
    });
    (this.container.querySelector('#chk-debug') as HTMLInputElement).addEventListener('change', e => {
      this.sim.setDebug((e.target as HTMLInputElement).checked);
    });
  }

  updateSelectedBody(body: RigidBody | null): void {
    this.selectedBody = body;
    const propsEl = this.container.querySelector('#body-props')!;

    if (!body) {
      propsEl.innerHTML = '<div style="color:var(--text-muted);font-size:11px;">Click an object to select it.</div>';
      return;
    }

    propsEl.innerHTML = `
      ${this._bodySliderHTML('mass', 'Mass', 0.1, 50, body.mass, 0.1)}
      ${this._bodySliderHTML('cd', 'Drag Cd', 0, 2, body.aero.cd, 0.01)}
      ${this._bodySliderHTML('cl0', 'Lift Cl₀', -1, 2, body.aero.cl0, 0.01)}
      ${this._bodySliderHTML('clslope', 'Lift Slope', 0, 10, body.aero.clSlope, 0.1)}
      ${this._bodySliderHTML('wingarea', 'Wing Area', 0, 20, body.aero.wingArea, 0.1)}
      ${this._bodySliderHTML('thrust', 'Thrust', 0, 500, body.aero.thrustMagnitude, 1)}
      ${this._bodySliderHTML('restitution', 'Restitution', 0, 1, body.restitution, 0.01)}
      ${this._bodySliderHTML('friction', 'Friction', 0, 1, body.friction, 0.01)}
    `;

    const wire = (id: string, onChange: (v: number) => void) => {
      const input = propsEl.querySelector(`#bsl-${id}`) as HTMLInputElement;
      const span = propsEl.querySelector(`#bsv-${id}`) as HTMLSpanElement;
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        span.textContent = v.toFixed(2);
        onChange(v);
      });
    };

    wire('mass', v => {
      body.mass = v;
      body.invMass = v > 0 ? 1 / v : 0;
    });
    wire('cd', v => { body.aero.cd = v; });
    wire('cl0', v => { body.aero.cl0 = v; });
    wire('clslope', v => { body.aero.clSlope = v; });
    wire('wingarea', v => { body.aero.wingArea = v; });
    wire('thrust', v => { body.aero.thrustMagnitude = v; });
    wire('restitution', v => { body.restitution = v; });
    wire('friction', v => { body.friction = v; });
  }

  private _startTelemetryLoop(): void {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.telemetry.update(this.selectedBody);
    };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
  }
}
