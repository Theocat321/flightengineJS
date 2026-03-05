import { PresetName, PRESET_NAMES } from '../simulation/Presets.js';

export interface PlacedObject {
  preset: PresetName;
  gridCol: number;  // 0-based column (X axis)
  gridRow: number;  // 0-based row    (Z axis)
}

const GRID_COLS = 16;
const GRID_ROWS = 16;
const CELL_SIZE = 5;  // metres per cell in world space

// World position from grid cell (centred on grid)
export function gridToWorld(col: number, row: number): { x: number; z: number } {
  return {
    x: (col - (GRID_COLS - 1) / 2) * CELL_SIZE,
    z: (row - (GRID_ROWS - 1) / 2) * CELL_SIZE,
  };
}

const PRESET_COLORS: Record<PresetName, string> = {
  Glider: '#4a9eff',
  Rocket: '#ff6b4a',
  Ball:   '#4aff8a',
  Box:    '#ffe14a',
};

const PRESET_ABBR: Record<PresetName, string> = {
  Glider: 'GL',
  Rocket: 'RK',
  Ball:   'BA',
  Box:    'BX',
};

type Tool = PresetName | 'erase';

export class SetupPage {
  private el: HTMLElement;
  private grid: (PresetName | null)[][];
  private selectedTool: Tool = 'Glider';
  private painting = false;
  onLaunch: ((objects: PlacedObject[]) => void) | null = null;

  constructor() {
    this.grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

    this.el = document.createElement('div');
    this.el.id = 'setup-page';
    document.body.appendChild(this.el);

    this._render();
  }

  show(): void { this.el.classList.remove('hidden'); }
  hide(): void { this.el.classList.add('hidden'); }

  private _render(): void {
    this.el.innerHTML = `
      <div class="setup-header">
        <h1>Flight Sandbox — Scene Setup</h1>
      </div>
      <div class="setup-body">
        <div class="setup-palette">
          <h2>Place Object</h2>
          ${PRESET_NAMES.map(name => `
            <div class="palette-item${this.selectedTool === name ? ' selected' : ''}" data-preset="${name}">
              <div class="palette-dot" style="background:${PRESET_COLORS[name]}"></div>
              <span class="palette-label">${name}</span>
            </div>
          `).join('')}
          <div class="palette-eraser">
            <div class="palette-item${this.selectedTool === 'erase' ? ' selected' : ''}" data-preset="erase">
              <div class="palette-dot" style="background:#444;border:1px solid #666"></div>
              <span class="palette-label">Erase</span>
            </div>
          </div>
          <div class="hint">
            Click or drag to paint.<br/>
            Right-click to erase.
          </div>
        </div>
        <div class="setup-grid-wrap">
          <div id="grid-container">
            ${this._gridHTML()}
          </div>
        </div>
      </div>
      <div class="setup-footer">
        <button id="btn-clear-grid">Clear All</button>
        <span class="object-count" id="obj-count">${this._countObjects()} objects placed</span>
        <div style="flex:1"></div>
        <button id="btn-launch">Launch Simulation</button>
      </div>
    `;

    this._wirePalette();
    this._wireGrid();
    this._wireFooter();
  }

  private _gridHTML(): string {
    let html = '<div class="setup-grid" id="setup-grid" style="grid-template-columns: repeat(' + GRID_COLS + ', 36px)">';
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const preset = this.grid[row]![col]!;
        const bg = preset ? PRESET_COLORS[preset] : '';
        const abbr = preset ? PRESET_ABBR[preset] : '';
        html += `<div class="grid-cell${preset ? ' occupied' : ''}"
          data-col="${col}" data-row="${row}"
          style="${bg ? `background:${bg}` : ''}"
          title="${preset ?? ''}">${abbr}</div>`;
      }
    }
    html += '</div>';
    return html;
  }

  private _refreshGrid(): void {
    const container = this.el.querySelector('#grid-container');
    if (container) container.innerHTML = this._gridHTML();
    this._wireGridCells();
    const count = this.el.querySelector('#obj-count');
    if (count) count.textContent = `${this._countObjects()} objects placed`;
  }

  private _wirePalette(): void {
    this.el.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const preset = (el as HTMLElement).dataset['preset'] as Tool;
        this.selectedTool = preset;
        // Update selected highlight
        this.el.querySelectorAll('.palette-item').forEach(p => p.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  }

  private _wireGrid(): void {
    this._wireGridCells();
  }

  private _wireGridCells(): void {
    const grid = this.el.querySelector('#setup-grid');
    if (!grid) return;

    grid.addEventListener('mousedown', (e) => {
      this.painting = true;
      this._paintCell(e as MouseEvent);
    });
    grid.addEventListener('mousemove', (e) => {
      if (this.painting) this._paintCell(e as MouseEvent);
    });
    grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._eraseCell(e as MouseEvent);
    });

    window.addEventListener('mouseup', () => { this.painting = false; }, { once: false });
  }

  private _paintCell(e: MouseEvent): void {
    const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    const col = parseInt(cell.dataset['col']!);
    const row = parseInt(cell.dataset['row']!);

    if (this.selectedTool === 'erase') {
      this.grid[row]![col] = null;
    } else {
      this.grid[row]![col] = this.selectedTool as PresetName;
    }
    this._refreshGrid();
  }

  private _eraseCell(e: MouseEvent): void {
    const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    const col = parseInt(cell.dataset['col']!);
    const row = parseInt(cell.dataset['row']!);
    this.grid[row]![col] = null;
    this._refreshGrid();
  }

  private _wireFooter(): void {
    this.el.querySelector('#btn-clear-grid')!.addEventListener('click', () => {
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
          this.grid[r]![c] = null;
      this._refreshGrid();
    });

    this.el.querySelector('#btn-launch')!.addEventListener('click', () => {
      const objects = this._collectObjects();
      this.onLaunch?.(objects);
    });
  }

  private _collectObjects(): PlacedObject[] {
    const result: PlacedObject[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const preset = this.grid[row]![col];
        if (preset) result.push({ preset, gridCol: col, gridRow: row });
      }
    }
    return result;
  }

  private _countObjects(): number {
    let n = 0;
    for (let r = 0; r < GRID_ROWS; r++)
      for (let c = 0; c < GRID_COLS; c++)
        if (this.grid[r]![c]) n++;
    return n;
  }
}
