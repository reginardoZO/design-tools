// Duct Sketch — grid-based duct bank cross-section builder.
// State persists to localStorage; export renders the same geometry to a canvas.

const STORAGE_KEY = 'duct-sketch:v1';
const SIZE_DIAMETER = { 2: 44, 4: 58, 5: 66, 6: 74 };
const PLACEHOLDER_DIAMETER = 46;
const CELL = 90;
const GAP = 14;
const MIN_CONDUITS = 20;

const defaultState = () => ({ rows: 4, cols: 5, conduits: {} });

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      rows: Number(parsed.rows) || 4,
      cols: Number(parsed.cols) || 5,
      conduits: parsed && typeof parsed.conduits === 'object' ? parsed.conduits : {},
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadState();
let activeCell = null;

const grid = document.getElementById('grid');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const layoutHint = document.getElementById('layout-hint');
const summaryCount = document.getElementById('summary-count');
const summaryList = document.getElementById('summary-list');

const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalSize = document.getElementById('modal-size');
const modalCircuits = document.getElementById('modal-circuits');

const key = (row, col) => `${row}-${col}`;

const parseCircuits = (text) =>
  text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function render() {
  rowsInput.value = state.rows;
  colsInput.value = state.cols;
  renderGrid();
  renderSummary();
}

function renderGrid() {
  grid.style.gridTemplateColumns = `repeat(${state.cols}, ${CELL}px)`;
  grid.style.gridTemplateRows = `repeat(${state.rows}, ${CELL}px)`;
  grid.style.gap = `${GAP}px`;
  grid.innerHTML = '';

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const entry = state.conduits[key(r, c)];
      const cell = document.createElement('div');
      cell.className = 'db-conduit' + (entry ? ' used' : '');

      const diameter = entry ? SIZE_DIAMETER[entry.size] : PLACEHOLDER_DIAMETER;
      cell.style.width = `${diameter}px`;
      cell.style.height = `${diameter}px`;

      if (entry) {
        const circuitsText = entry.circuits.length ? entry.circuits.join(', ') : 'spare';
        cell.title = `${entry.size}" — ${circuitsText}`;
        cell.innerHTML =
          `<div class="db-info"><div class="db-size">${entry.size}&quot;</div>` +
          `<div class="db-circuits">${escapeHtml(circuitsText)}</div></div>`;
      } else {
        cell.title = 'Click to configure';
        cell.innerHTML = '<div class="db-placeholder">+</div>';
      }

      cell.addEventListener('click', () => openModal(r, c));
      grid.appendChild(cell);
    }
  }
}

function renderSummary() {
  const entries = Object.entries(state.conduits)
    .map(([k, v]) => {
      const [row, col] = k.split('-').map(Number);
      return { ...v, row, col };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);

  summaryCount.textContent = `${entries.length} / ${state.rows * state.cols} conduits assigned`;

  if (!entries.length) {
    summaryList.innerHTML = '<div class="db-summary-empty">No conduit configured yet.</div>';
    return;
  }

  summaryList.innerHTML = entries
    .map((e) => {
      const circuitsText = e.circuits.length ? escapeHtml(e.circuits.join(', ')) : 'Spare (no circuit)';
      return (
        `<div class="db-summary-item"><span class="pos">R${e.row + 1}C${e.col + 1}</span>` +
        `<span class="size-tag">${e.size}&quot;</span><div class="circuits">${circuitsText}</div></div>`
      );
    })
    .join('');
}

function openModal(row, col) {
  activeCell = { row, col };
  const entry = state.conduits[key(row, col)];
  modalTitle.textContent = `Conduit — Row ${row + 1}, Column ${col + 1}`;
  modalSize.value = entry ? String(entry.size) : '4';
  modalCircuits.value = entry ? entry.circuits.join(', ') : '';
  modalOverlay.classList.remove('hidden');
  modalCircuits.focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  activeCell = null;
}

document.getElementById('modal-save').addEventListener('click', () => {
  if (!activeCell) return;
  state.conduits[key(activeCell.row, activeCell.col)] = {
    size: Number(modalSize.value),
    circuits: parseCircuits(modalCircuits.value),
  };
  saveState();
  render();
  closeModal();
});

document.getElementById('modal-clear').addEventListener('click', () => {
  if (!activeCell) return;
  delete state.conduits[key(activeCell.row, activeCell.col)];
  saveState();
  render();
  closeModal();
});

document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (ev) => {
  if (ev.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !modalOverlay.classList.contains('hidden')) closeModal();
});

document.getElementById('apply-layout').addEventListener('click', () => {
  const rows = Math.max(1, Math.round(Number(rowsInput.value) || 0));
  const cols = Math.max(1, Math.round(Number(colsInput.value) || 0));

  if (rows * cols < MIN_CONDUITS) {
    layoutHint.textContent = `The layout needs at least ${MIN_CONDUITS} conduits (current: ${rows * cols}).`;
    layoutHint.classList.add('warn');
    return;
  }

  const dropped = Object.keys(state.conduits).filter((k) => {
    const [r, c] = k.split('-').map(Number);
    return r >= rows || c >= cols;
  });

  if (dropped.length && !confirm(`${dropped.length} configured conduit(s) will fall outside the new layout and be removed. Continue?`)) {
    return;
  }

  dropped.forEach((k) => delete state.conduits[k]);
  state.rows = rows;
  state.cols = cols;
  layoutHint.textContent = `Minimum of ${MIN_CONDUITS} conduits (rows × columns).`;
  layoutHint.classList.remove('warn');
  saveState();
  render();
});

document.getElementById('clear-all').addEventListener('click', () => {
  if (!Object.keys(state.conduits).length) return;
  if (!confirm('Clear all configured conduits?')) return;
  state.conduits = {};
  saveState();
  render();
});

document.getElementById('export-png').addEventListener('click', exportPng);

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const capped = lines.slice(0, maxLines);
  const startY = y - ((capped.length - 1) * lineHeight) / 2;
  capped.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function exportPng() {
  const scale = 2;
  const padding = 30;
  const border = 4;
  const width = state.cols * CELL + (state.cols - 1) * GAP;
  const height = state.rows * CELL + (state.rows - 1) * GAP;
  const canvasWidth = width + padding * 2 + border * 2;
  const canvasHeight = height + padding * 2 + border * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#eceff2';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.strokeStyle = '#1d2530';
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, canvasWidth - border, canvasHeight - border);

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const entry = state.conduits[key(r, c)];
      const diameter = entry ? SIZE_DIAMETER[entry.size] : PLACEHOLDER_DIAMETER;
      const radius = diameter / 2;
      const cx = padding + border + c * (CELL + GAP) + CELL / 2;
      const cy = padding + border + r * (CELL + GAP) + CELL / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = entry ? '#eef4fb' : '#fbfcfd';
      ctx.fill();
      ctx.lineWidth = entry ? 2.4 : 1.6;
      ctx.strokeStyle = entry ? '#0e5da8' : '#c6cdd4';
      ctx.setLineDash(entry ? [] : [3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (entry) {
        ctx.fillStyle = '#0b4c8a';
        ctx.font = '600 9px "IBM Plex Mono", monospace';
        ctx.fillText(`${entry.size}"`, cx, cy - radius * 0.45);

        ctx.fillStyle = '#1d2530';
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        const label = entry.circuits.length ? entry.circuits.join(', ') : 'spare';
        wrapText(ctx, label, cx, cy + radius * 0.15, diameter - 10, 11, 3);
      } else {
        ctx.fillStyle = '#c6cdd4';
        ctx.font = '16px "IBM Plex Mono", monospace';
        ctx.fillText('+', cx, cy);
      }
    }
  }

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duct-sketch.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}

render();
