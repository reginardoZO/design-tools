// main.js — UI wiring: modes, modals, pointer interaction, zoom/pan.

import {
  state,
  createPanel,
  createLoad,
  createFoundation,
  createTag,
  getPanel,
  removeLoad,
  removeFoundation,
  removeTag,
  removePanel,
  save,
  load as loadState,
  WALL_ROTATION,
  WALL_CYCLE,
} from './store.js?v=20260730-1';
import {
  render,
  initSvg,
  screenToWorld,
  fitToContent,
  BASE_PPI,
} from './render.js?v=20260730-1';
import { autoRoute } from './router.js?v=20260730-1';
import { COL_WIDTH_IN, IN_PER_FT } from './geometry.js?v=20260730-1';

const DRAG_THRESHOLD = 4; // px of movement before a press counts as a drag

// Default first panel mirrors a typical lineup so a new user can hit "Save"
// and immediately see a routed drawing.
const DEFAULT_LABELS = [
  'CROSS-TIE', 'INCOMER A', 'METERING', 'MCC A', 'BACKUP MCC A', 'RECY',
  'MAC A', 'N2 A', 'SCR A', 'TRANSITION', 'TIE', 'MCC B', 'BACKUP MCC B',
  'MAC B', 'MAC C', 'N2 B', 'SCR B', 'METERING', 'CROSS-TIE',
];

let svg;
let pendingLoadPoint = null; // world point where a new load will drop

// ---- boot -----------------------------------------------------------------

function boot() {
  svg = document.getElementById('canvas');
  initSvg(svg);
  wireToolbar();
  wireZoom();
  wireCanvas();
  wireModals();

  const restored = loadState();
  if (restored) {
    reroute();
    fitToContent();
    render();
    updateChrome();
  } else {
    openSetup(true);
    updateChrome();
  }

  window.addEventListener('resize', render);
}

// ---- chrome (statusline / hint / mode buttons) ----------------------------

function updateChrome() {
  const s = state.stats;
  document.getElementById('statusline').innerHTML =
    `ROUTES: <b>${s.routes}</b> &middot; CROSSINGS: <b>${s.crossings}</b> ` +
    `&middot; BLOCKED: <b>${s.blocked || 0}</b> &middot; ` +
    `FOUNDATIONS: <b>${state.foundations.length}</b> &middot; ` +
    `TAGS: <b>${state.tags.length}</b> &middot; ` +
    `TOTAL LENGTH: <b>${s.length}</b> in`;

  const hints = {
    foundation:
      'drag empty space = draw foundation · drag foundation = move · ' +
      'select + Del or double-click = delete',
    tag:
      'drag empty space = draw tag rectangle · drag tag = move · ' +
      'select + Del or double-click = delete',
    route:
      'drag panel, load, foundation or tag = move & reroute · click panel then ↻ = rotate · ' +
      'select foundation/tag + Del = delete · double-click = delete · click empty space = add load',
  };
  document.getElementById('hint').textContent = hints[state.mode] || hints.route;

  document.getElementById('btn-route').classList.toggle('active', state.mode === 'route');
  document.getElementById('btn-setup').classList.toggle('active', state.mode === 'setup');
  document.getElementById('btn-foundation').classList.toggle(
    'active', state.mode === 'foundation'
  );
  document.getElementById('btn-tag').classList.toggle('active', state.mode === 'tag');
  document.getElementById('btn-wall').innerHTML = `&#8635; WALL: ${state.wall}`;
  document.getElementById('zoom-level').textContent =
    Math.round(state.view.scale * 100) + '%';

  svg.classList.toggle('foundation-mode', state.mode === 'foundation');
  svg.classList.toggle('tag-mode', state.mode === 'tag');
}

// Recompute routes + stats, redraw, persist.
function reroute() {
  if (state.showRoutes) autoRoute();
  render();
  updateChrome();
  save();
}

// ---- toolbar --------------------------------------------------------------

function wireToolbar() {
  document.getElementById('btn-setup').onclick = () => openSetup(false);
  document.getElementById('btn-route').onclick = () => {
    state.mode = 'route';
    state.selection = null;
    state.showRoutes = true;
    reroute();
  };
  document.getElementById('btn-foundation').onclick = () => {
    state.mode = state.mode === 'foundation' ? 'route' : 'foundation';
    state.selection = null;
    render();
    updateChrome();
  };
  document.getElementById('btn-tag').onclick = () => {
    state.mode = state.mode === 'tag' ? 'route' : 'tag';
    state.selection = null;
    render();
    updateChrome();
  };
  document.getElementById('btn-wall').onclick = cycleWall;
  document.getElementById('btn-clear-routes').onclick = () => {
    state.showRoutes = false;
    state.routes = [];
    state.stats = { routes: 0, crossings: 0, blocked: 0, length: 0 };
    render();
    updateChrome();
  };
  document.getElementById('btn-clear-loads').onclick = () => {
    if (!state.loads.length) return;
    if (!confirm('Remove all loads?')) return;
    state.loads = [];
    state.routes = [];
    state.selection = null;
    reroute();
  };
  document.getElementById('btn-clear-foundations').onclick = () => {
    if (!state.foundations.length) return;
    if (!confirm('Remove all foundations?')) return;
    state.foundations = [];
    state.selection = null;
    reroute();
  };
  document.getElementById('btn-export').onclick = async () => {
    const { exportPdf } = await import('./pdf.js?v=20260730-1');
    exportPdf();
  };
}

function cycleWall() {
  const i = WALL_CYCLE.indexOf(state.wall);
  state.wall = WALL_CYCLE[(i + 1) % WALL_CYCLE.length];
  for (const p of state.panels) p.rotation = WALL_ROTATION[state.wall];
  state.showRoutes = true;
  reroute();
}

// ---- zoom / pan -----------------------------------------------------------

function wireZoom() {
  document.getElementById('zoom-in').onclick = () => zoomAt(1.2);
  document.getElementById('zoom-out').onclick = () => zoomAt(1 / 1.2);
  document.getElementById('zoom-fit').onclick = () => {
    fitToContent();
    render();
    updateChrome();
    save();
  };
}

function zoomAt(factor, cx, cy) {
  const rect = svg.getBoundingClientRect();
  const px = cx == null ? rect.width / 2 : cx;
  const py = cy == null ? rect.height / 2 : cy;
  const [wx, wy] = screenToWorld(px, py);
  state.view.scale = Math.max(0.15, Math.min(6, state.view.scale * factor));
  // keep the point under the cursor fixed
  state.view.offsetX = px - wx * state.view.scale * BASE_PPI;
  state.view.offsetY = py - wy * state.view.scale * BASE_PPI;
  render();
  updateChrome();
  save();
}

// ---- canvas pointer interaction -------------------------------------------

let drag = null;
let lastLoadClick = null; // { id, time } for manual double-click detection
let lastFoundationClick = null;
let lastTagClick = null;

function wireCanvas() {
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('dblclick', onDblClick);
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    },
    { passive: false }
  );
}

function localPoint(e) {
  const rect = svg.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

function onPointerDown(e) {
  const [sx, sy] = localPoint(e);

  // Panels and loads are directly manipulable at all times — dragging a panel
  // repositions it, its rotate handle turns it. (Config lives in the SETUP
  // dialog.) Gating this behind a "mode" made panels feel locked, so we don't.
  const rotateEl = e.target.closest('.rotate-handle');
  if (rotateEl) {
    const id = rotateEl.getAttribute('data-rotate');
    const p = getPanel(id);
    if (p) {
      p.rotation = (p.rotation + 90) % 360;
      reroute();
    }
    return;
  }

  // NOTE: we deliberately do NOT render() on pointerdown. Rebuilding the SVG
  // here would remove the very element the browser needs to synthesise the
  // following click/dblclick, breaking double-click-to-delete. Selection
  // highlights are drawn on move or on pointerup instead.
  const loadEl = e.target.closest('.load');
  if (loadEl) {
    const id = loadEl.getAttribute('data-id');
    // Manual double-click detection: because every interaction rebuilds the
    // SVG, the browser's native dblclick can't be relied upon here.
    const now = Date.now();
    if (lastLoadClick && lastLoadClick.id === id && now - lastLoadClick.time < 350) {
      lastLoadClick = null;
      removeLoad(id);
      reroute();
      return;
    }
    lastLoadClick = { id, time: now };
    const l = state.loads.find((x) => x.id === id);
    state.selection = { type: 'load', id };
    drag = { kind: 'load', id, moved: false, startSX: sx, startSY: sy, startX: l.x, startY: l.y };
    svg.setPointerCapture(e.pointerId);
    return;
  }

  const panelEl = e.target.closest('.panel');
  if (panelEl) {
    const id = panelEl.getAttribute('data-id');
    const p = getPanel(id);
    state.selection = { type: 'panel', id };
    drag = { kind: 'panel', id, moved: false, startSX: sx, startSY: sy, startX: p.x, startY: p.y };
    svg.setPointerCapture(e.pointerId);
    return;
  }

  const foundationEl = e.target.closest('.foundation');
  if (foundationEl) {
    const id = foundationEl.getAttribute('data-id');
    const now = Date.now();
    if (
      lastFoundationClick &&
      lastFoundationClick.id === id &&
      now - lastFoundationClick.time < 350
    ) {
      lastFoundationClick = null;
      removeFoundation(id);
      reroute();
      return;
    }
    lastFoundationClick = { id, time: now };
    const foundation = state.foundations.find((item) => item.id === id);
    state.selection = { type: 'foundation', id };
    drag = {
      kind: 'foundation',
      id,
      moved: false,
      startSX: sx,
      startSY: sy,
      startX: foundation.x,
      startY: foundation.y,
    };
    svg.setPointerCapture(e.pointerId);
    return;
  }

  const tagEl = e.target.closest('.tag');
  if (tagEl) {
    const id = tagEl.getAttribute('data-id');
    const now = Date.now();
    if (lastTagClick && lastTagClick.id === id && now - lastTagClick.time < 350) {
      lastTagClick = null;
      removeTag(id);
      reroute();
      return;
    }
    lastTagClick = { id, time: now };
    const tag = state.tags.find((item) => item.id === id);
    state.selection = { type: 'tag', id };
    drag = {
      kind: 'tag',
      id,
      moved: false,
      startSX: sx,
      startSY: sy,
      startX: tag.x,
      startY: tag.y,
    };
    svg.setPointerCapture(e.pointerId);
    return;
  }

  if (state.mode === 'foundation') {
    const [x, y] = screenToWorld(sx, sy);
    const foundation = createFoundation({ x, y, width: 0, height: 0 });
    state.foundations.push(foundation);
    state.selection = { type: 'foundation', id: foundation.id };
    drag = {
      kind: 'foundation-new',
      id: foundation.id,
      moved: false,
      startSX: sx,
      startSY: sy,
      startX: x,
      startY: y,
    };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('drawing-foundation');
    render();
    return;
  }

  if (state.mode === 'tag') {
    const [x, y] = screenToWorld(sx, sy);
    const tag = createTag({ x, y, width: 0, height: 0 });
    state.tags.push(tag);
    state.selection = { type: 'tag', id: tag.id };
    drag = {
      kind: 'tag-new',
      id: tag.id,
      moved: false,
      startSX: sx,
      startSY: sy,
      startX: x,
      startY: y,
    };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('drawing-foundation');
    render();
    return;
  }

  // Empty space: pan (and a click-without-drag adds a load there).
  state.selection = null;
  drag = {
    kind: 'pan',
    moved: false,
    startSX: sx,
    startSY: sy,
    startOX: state.view.offsetX,
    startOY: state.view.offsetY,
  };
  svg.setPointerCapture(e.pointerId);
  svg.classList.add('panning');
}

function onPointerMove(e) {
  if (!drag) return;
  const [sx, sy] = localPoint(e);
  const dxs = sx - drag.startSX;
  const dys = sy - drag.startSY;
  if (Math.hypot(dxs, dys) > DRAG_THRESHOLD) drag.moved = true;

  if (drag.kind === 'pan') {
    state.view.offsetX = drag.startOX + dxs;
    state.view.offsetY = drag.startOY + dys;
    render();
    return;
  }

  const dwx = dxs / (state.view.scale * BASE_PPI);
  const dwy = dys / (state.view.scale * BASE_PPI);

  if (drag.kind === 'load') {
    const l = state.loads.find((x) => x.id === drag.id);
    if (l) {
      l.x = drag.startX + dwx;
      l.y = drag.startY + dwy;
      if (state.showRoutes) autoRoute();
      render();
      updateChrome();
    }
  } else if (drag.kind === 'panel') {
    const p = getPanel(drag.id);
    if (p) {
      p.x = drag.startX + dwx;
      p.y = drag.startY + dwy;
      if (state.showRoutes) autoRoute();
      render();
      updateChrome();
    }
  } else if (drag.kind === 'foundation') {
    const foundation = state.foundations.find((item) => item.id === drag.id);
    if (foundation) {
      foundation.x = drag.startX + dwx;
      foundation.y = drag.startY + dwy;
      if (state.showRoutes) autoRoute();
      render();
      updateChrome();
    }
  } else if (drag.kind === 'foundation-new') {
    const foundation = state.foundations.find((item) => item.id === drag.id);
    if (foundation) {
      const currentX = drag.startX + dwx;
      const currentY = drag.startY + dwy;
      foundation.x = Math.min(drag.startX, currentX);
      foundation.y = Math.min(drag.startY, currentY);
      foundation.width = Math.abs(currentX - drag.startX);
      foundation.height = Math.abs(currentY - drag.startY);
      render();
    }
  } else if (drag.kind === 'tag') {
    // Tags are drawing markers only: moving them never triggers a reroute.
    const tag = state.tags.find((item) => item.id === drag.id);
    if (tag) {
      tag.x = drag.startX + dwx;
      tag.y = drag.startY + dwy;
      render();
    }
  } else if (drag.kind === 'tag-new') {
    const tag = state.tags.find((item) => item.id === drag.id);
    if (tag) {
      const currentX = drag.startX + dwx;
      const currentY = drag.startY + dwy;
      tag.x = Math.min(drag.startX, currentX);
      tag.y = Math.min(drag.startY, currentY);
      tag.width = Math.abs(currentX - drag.startX);
      tag.height = Math.abs(currentY - drag.startY);
      render();
    }
  }
}

function onPointerUp(e) {
  if (!drag) return;
  svg.classList.remove('panning');
  svg.classList.remove('drawing-foundation');
  try {
    svg.releasePointerCapture(e.pointerId);
  } catch (_) {}

  if (drag.kind === 'foundation-new') {
    const foundation = state.foundations.find((item) => item.id === drag.id);
    const tooSmall = !foundation ||
      foundation.width * state.view.scale * BASE_PPI < DRAG_THRESHOLD ||
      foundation.height * state.view.scale * BASE_PPI < DRAG_THRESHOLD;
    if (tooSmall) {
      removeFoundation(drag.id);
      render();
      updateChrome();
    } else {
      reroute();
    }
  } else if (drag.kind === 'tag-new') {
    const tag = state.tags.find((item) => item.id === drag.id);
    const tooSmall = !tag ||
      tag.width * state.view.scale * BASE_PPI < DRAG_THRESHOLD ||
      tag.height * state.view.scale * BASE_PPI < DRAG_THRESHOLD;
    if (tooSmall) {
      removeTag(drag.id);
      render();
      updateChrome();
    } else {
      // A new tag rectangle always gets asked for its label on drop.
      openTagModal(drag.id);
    }
  } else if (drag.kind === 'pan' && !drag.moved) {
    // A plain click on empty space adds a load there.
    const [sx, sy] = localPoint(e);
    pendingLoadPoint = screenToWorld(sx, sy);
    render();
    openLoadModal();
  } else if (
    drag.moved &&
    (drag.kind === 'load' || drag.kind === 'panel' || drag.kind === 'foundation' ||
      drag.kind === 'tag')
  ) {
    save();
    render();
  } else {
    // A plain selection click: reflect the new selection now.
    render();
  }
  drag = null;
}

function onDblClick(e) {
  const loadEl = e.target.closest('.load');
  if (loadEl) {
    const id = loadEl.getAttribute('data-id');
    removeLoad(id);
    reroute();
    return;
  }
  const foundationEl = e.target.closest('.foundation');
  if (foundationEl) {
    removeFoundation(foundationEl.getAttribute('data-id'));
    reroute();
    return;
  }
  const tagEl = e.target.closest('.tag');
  if (tagEl) {
    removeTag(tagEl.getAttribute('data-id'));
    reroute();
  }
}

// ---- setup modal ----------------------------------------------------------

let setupDraft = [];

function wireModals() {
  document.getElementById('setup-close').onclick = closeSetup;
  document.getElementById('setup-cancel').onclick = closeSetup;
  document.getElementById('add-panel').onclick = () => {
    setupDraft.push(makeDraft());
    renderPanelList();
  };
  document.getElementById('setup-save').onclick = saveSetup;

  document.getElementById('load-close').onclick = closeLoadModal;
  document.getElementById('load-cancel').onclick = closeLoadModal;
  document.getElementById('load-save').onclick = saveLoad;
  document.getElementById('load-panel').onchange = fillColumnSelect;

  document.getElementById('tag-close').onclick = () => closeTagModal(true);
  document.getElementById('tag-cancel').onclick = () => closeTagModal(true);
  document.getElementById('tag-save').onclick = saveTag;

  document.addEventListener('keydown', (e) => {
    const loadOpen = !document.getElementById('modal-load').hidden;
    const setupOpen = !document.getElementById('modal-setup').hidden;
    const tagOpen = !document.getElementById('modal-tag').hidden;
    if (e.key === 'Escape') {
      if (loadOpen) closeLoadModal();
      else if (setupOpen) closeSetup();
      else if (tagOpen) closeTagModal(true);
    } else if (e.key === 'Enter' && loadOpen && e.target.id === 'load-tag') {
      e.preventDefault();
      saveLoad();
    } else if (e.key === 'Enter' && tagOpen && e.target.id === 'tag-tag') {
      e.preventDefault();
      saveTag();
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      !loadOpen && !setupOpen && !tagOpen
    ) {
      // Del removes the selected foundation or tag rectangle.
      if (e.target.closest('input, textarea, select')) return;
      const sel = state.selection;
      if (!sel) return;
      if (sel.type === 'foundation') {
        e.preventDefault();
        removeFoundation(sel.id);
        reroute();
      } else if (sel.type === 'tag') {
        e.preventDefault();
        removeTag(sel.id);
        reroute();
      }
    }
  });
}

function makeDraft(seed) {
  if (seed) {
    return {
      id: seed.id,
      name: seed.name,
      count: seed.columns.length,
      labels: seed.columns.map((c) => c.label),
    };
  }
  const letter = String.fromCharCode(65 + setupDraft.length);
  return { id: null, name: `BUS ${letter}`, count: 6, labels: [] };
}

function openSetup(initial) {
  state.mode = 'setup';
  if (state.panels.length) {
    setupDraft = state.panels.map((p) => makeDraft(p));
  } else if (initial) {
    setupDraft = [
      { id: null, name: 'BUS A', count: DEFAULT_LABELS.length, labels: [...DEFAULT_LABELS] },
    ];
  } else {
    setupDraft = [makeDraft()];
  }
  renderPanelList();
  document.getElementById('modal-setup').hidden = false;
  updateChrome();
}

function closeSetup() {
  document.getElementById('modal-setup').hidden = true;
  state.mode = 'route';
  updateChrome();
}

function renderPanelList() {
  const list = document.getElementById('panel-list');
  list.textContent = '';
  setupDraft.forEach((d, idx) => {
    const row = document.createElement('div');
    row.className = 'panel-row';

    const top = document.createElement('div');
    top.className = 'row-top';

    const nameL = document.createElement('label');
    nameL.className = 'grow';
    nameL.innerHTML = '<span>Panel name</span>';
    const nameI = document.createElement('input');
    nameI.type = 'text';
    nameI.value = d.name;
    nameI.oninput = () => (d.name = nameI.value);
    nameL.appendChild(nameI);

    const countL = document.createElement('label');
    countL.innerHTML = '<span>Columns (3 ft each)</span>';
    const countI = document.createElement('input');
    countI.type = 'number';
    countI.min = '1';
    countI.max = '60';
    countI.value = d.count;
    countI.style.width = '90px';
    countI.oninput = () => {
      d.count = Math.max(1, Math.min(60, parseInt(countI.value || '1', 10)));
      syncLabels(d);
      labels.value = d.labels.join('\n');
      widthNote.textContent = widthText(d.count);
    };
    countL.appendChild(countI);

    top.appendChild(nameL);
    top.appendChild(countL);
    row.appendChild(top);

    const widthNote = document.createElement('div');
    widthNote.style.cssText = 'font-size:11px;color:var(--ink-soft);margin-top:8px;';
    widthNote.textContent = widthText(d.count);
    row.appendChild(widthNote);

    const labels = document.createElement('textarea');
    syncLabels(d);
    labels.value = d.labels.join('\n');
    labels.placeholder = 'One label per line (optional)';
    labels.hidden = true;
    labels.oninput = () => {
      d.labels = labels.value.split('\n');
    };
    row.appendChild(labels);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const toggle = document.createElement('button');
    toggle.className = 'toggle-cols';
    toggle.textContent = 'Edit column labels ▾';
    toggle.onclick = () => {
      labels.hidden = !labels.hidden;
      toggle.textContent = labels.hidden ? 'Edit column labels ▾' : 'Hide column labels ▴';
    };
    const remove = document.createElement('button');
    remove.className = 'link-btn';
    remove.textContent = 'Remove panel';
    remove.onclick = () => {
      setupDraft.splice(idx, 1);
      renderPanelList();
    };
    actions.appendChild(toggle);
    actions.appendChild(remove);
    row.appendChild(actions);

    list.appendChild(row);
  });
}

function widthText(count) {
  const totalIn = count * COL_WIDTH_IN;
  const totalFt = totalIn / IN_PER_FT;
  return `Column size: ${COL_WIDTH_IN} in (${COL_WIDTH_IN / IN_PER_FT} ft) · ` +
    `${count} columns: ${totalIn} in (${totalFt} ft), excluding end sections`;
}

function syncLabels(d) {
  const out = [];
  for (let i = 0; i < d.count; i++) out.push(d.labels[i] || `COL ${i + 1}`);
  d.labels = out;
}

function saveSetup() {
  if (!setupDraft.length) {
    alert('Add at least one panel.');
    return;
  }
  const kept = [];
  let placeX = 460;
  setupDraft.forEach((d) => {
    syncLabels(d);
    const existing = d.id ? getPanel(d.id) : null;
    if (existing) {
      existing.name = d.name;
      existing.columns = d.labels.map((label, i) => ({ index: i, label }));
      kept.push(existing);
    } else {
      const p = createPanel({ name: d.name, columns: d.labels, x: placeX, y: 30 });
      placeX += 260;
      kept.push(p);
    }
  });
  state.panels = kept;
  // Drop loads whose panel disappeared or whose column no longer exists.
  state.loads = state.loads.filter((l) => {
    const p = getPanel(l.panelId);
    return p && l.colIndex < p.columns.length;
  });

  document.getElementById('modal-setup').hidden = true;
  state.mode = 'route';
  state.showRoutes = true;
  reroute();
  fitToContent();
  render();
  updateChrome();
}

// ---- load modal -----------------------------------------------------------

function openLoadModal() {
  const panelSel = document.getElementById('load-panel');
  panelSel.textContent = '';
  if (!state.panels.length) {
    alert('Create a panel first (SETUP).');
    return;
  }
  for (const p of state.panels) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    panelSel.appendChild(opt);
  }
  fillColumnSelect();
  document.getElementById('load-tag').value = '';
  document.getElementById('modal-load').hidden = false;
  setTimeout(() => document.getElementById('load-tag').focus(), 0);
}

function fillColumnSelect() {
  const panelId = document.getElementById('load-panel').value;
  const p = getPanel(panelId);
  const colSel = document.getElementById('load-col');
  colSel.textContent = '';
  if (!p) return;
  p.columns.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.index;
    opt.textContent = `${c.index + 1} — ${c.label}`;
    colSel.appendChild(opt);
  });
}

function closeLoadModal() {
  document.getElementById('modal-load').hidden = true;
  pendingLoadPoint = null;
}

function saveLoad() {
  const tag = document.getElementById('load-tag').value.trim();
  const panelId = document.getElementById('load-panel').value;
  const colIndex = parseInt(document.getElementById('load-col').value, 10);
  if (!tag) {
    alert('Enter a tag for the load.');
    return;
  }
  const pt = pendingLoadPoint || screenToWorld(svg.clientWidth / 3, svg.clientHeight / 2);
  const l = createLoad({ tag, panelId, colIndex, x: pt[0], y: pt[1] });
  state.loads.push(l);
  state.selection = { type: 'load', id: l.id };
  closeLoadModal();
  state.showRoutes = true;
  reroute();
}

// ---- tag modal ------------------------------------------------------------

let pendingTagId = null; // id of the freshly drawn rectangle awaiting a label

function openTagModal(id) {
  pendingTagId = id;
  document.getElementById('tag-tag').value = '';
  document.getElementById('modal-tag').hidden = false;
  setTimeout(() => document.getElementById('tag-tag').focus(), 0);
}

// Cancelling the modal for a just-drawn rectangle drops the rectangle too.
function closeTagModal(cancelled) {
  document.getElementById('modal-tag').hidden = true;
  if (cancelled && pendingTagId) removeTag(pendingTagId);
  pendingTagId = null;
  render();
  updateChrome();
}

function saveTag() {
  const label = document.getElementById('tag-tag').value.trim();
  if (!label) {
    alert('Enter a tag for the rectangle.');
    return;
  }
  const tag = state.tags.find((item) => item.id === pendingTagId);
  if (tag) tag.tag = label;
  pendingTagId = null;
  document.getElementById('modal-tag').hidden = true;
  save();
  render();
  updateChrome();
}

boot();
