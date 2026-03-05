import './styles.css';
import { SetupPage, gridToWorld } from './ui/SetupPage.js';
import { Simulation } from './simulation/Simulation.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { ObjectPicker } from './ui/ObjectPicker.js';

// ── Setup page ──────────────────────────────────────────────────────────────
const setupPage = new SetupPage();
setupPage.show();

// ── Simulation (hidden until launch) ────────────────────────────────────────
const appEl = document.getElementById('app') as HTMLElement;
appEl.style.display = 'none';

const canvas = document.getElementById('viewport') as HTMLCanvasElement;
const panelEl = document.getElementById('panel') as HTMLElement;

let sim: Simulation | null = null;
let panel: ControlPanel | null = null;

setupPage.onLaunch = (objects) => {
  setupPage.hide();
  appEl.style.display = 'flex';

  // Initialise simulation lazily so the canvas has layout dimensions
  sim = new Simulation(canvas);
  panel = new ControlPanel(sim, panelEl);

  const picker = new ObjectPicker(
    canvas,
    sim.sceneManager.camera,
    () => sim!.bodyRenderer.getAllMeshes()
  );

  picker.onSelect = (bodyId) => {
    if (bodyId === null) {
      sim!.selectBody(null);
      panel!.updateSelectedBody(null);
      return;
    }
    const body = sim!.world.bodies.find(b => b.id === bodyId) ?? null;
    sim!.selectBody(body);
    panel!.updateSelectedBody(body);
  };

  sim.onSelect = (body) => {
    panel!.updateSelectedBody(body);
  };

  // Spawn all placed objects at their grid positions
  let firstBody = null;
  for (const obj of objects) {
    const { x, z } = gridToWorld(obj.gridCol, obj.gridRow);
    const body = sim.spawn(obj.preset, x, z);
    if (!firstBody) firstBody = body;
  }

  // If nothing was placed, spawn a default glider at centre
  if (!firstBody) {
    firstBody = sim.spawn('Glider', 0, 0);
  }

  // Auto-follow the first spawned body
  sim.setFollowCamera(true);
  sim.selectBody(firstBody);
  panel.updateSelectedBody(firstBody);

  sim.start();
};
