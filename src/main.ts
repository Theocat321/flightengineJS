import './styles.css';
import { Simulation } from './simulation/Simulation.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { ObjectPicker } from './ui/ObjectPicker.js';

const canvas = document.getElementById('viewport') as HTMLCanvasElement;
const panelEl = document.getElementById('panel') as HTMLElement;

const sim = new Simulation(canvas);

const panel = new ControlPanel(sim, panelEl);

const picker = new ObjectPicker(
  canvas,
  sim.sceneManager.camera,
  () => sim.bodyRenderer.getAllMeshes()
);

picker.onSelect = (bodyId) => {
  if (bodyId === null) {
    sim.selectBody(null);
    panel.updateSelectedBody(null);
    return;
  }
  const body = sim.world.bodies.find(b => b.id === bodyId) ?? null;
  sim.selectBody(body);
  panel.updateSelectedBody(body);
};

sim.onSelect = (body) => {
  panel.updateSelectedBody(body);
};

// Spawn default glider
const glider = sim.spawn('Glider');
sim.selectBody(glider);
panel.updateSelectedBody(glider);

sim.start();
