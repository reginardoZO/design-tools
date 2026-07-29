// store.js — the application state and small helpers to mutate it.
//
// State is plain JSON so it can be persisted to localStorage and restored.

import { COL_WIDTH_IN } from './geometry.js?v=20260723-2';

const STORAGE_KEY = 'underground-router-state-v1';

let uid = 1;
export function nextId(prefix) {
  return `${prefix}${uid++}`;
}

export const state = {
  mode: 'route', // 'setup' | 'route' | 'foundation'
  wall: 'RIGHT', // RIGHT | BOTTOM | LEFT | TOP  (where the wall sits)
  panels: [],
  loads: [],
  foundations: [],
  routes: [], // computed: { loadId, points:[[x,y]...], length, color }
  view: { scale: 1.32, offsetX: 0, offsetY: 0 },
  selection: null, // { type:'panel'|'load'|'foundation', id }
  showRoutes: true,
  stats: { routes: 0, crossings: 0, blocked: 0, length: 0 },
};

// Map a wall side to the panel rotation that backs onto it (cables exit the
// opposite side).
export const WALL_ROTATION = { RIGHT: 0, BOTTOM: 270, LEFT: 180, TOP: 90 };
export const WALL_CYCLE = ['RIGHT', 'BOTTOM', 'LEFT', 'TOP'];

export function createPanel({ name, columns, x, y }) {
  return {
    id: nextId('P'),
    name,
    colWidthIn: COL_WIDTH_IN,
    columns: columns.map((label, i) => ({ index: i, label: label || `COL ${i + 1}` })),
    x,
    y,
    rotation: WALL_ROTATION[state.wall],
  };
}

export function createLoad({ tag, panelId, colIndex, x, y }) {
  return { id: nextId('L'), tag, panelId, colIndex, x, y };
}

export function createFoundation({ x, y, width, height }) {
  return { id: nextId('F'), x, y, width, height };
}

export function getPanel(id) {
  return state.panels.find((p) => p.id === id) || null;
}

export function removeLoad(id) {
  state.loads = state.loads.filter((l) => l.id !== id);
  state.routes = state.routes.filter((r) => r.loadId !== id);
  if (state.selection && state.selection.id === id) state.selection = null;
}

export function removeFoundation(id) {
  state.foundations = state.foundations.filter((foundation) => foundation.id !== id);
  if (state.selection && state.selection.id === id) state.selection = null;
}

export function removePanel(id) {
  state.panels = state.panels.filter((p) => p.id !== id);
  // Orphan any loads that referenced it.
  state.loads = state.loads.filter((l) => l.panelId !== id);
  state.routes = state.routes.filter((r) => {
    const l = state.loads.find((x) => x.id === r.loadId);
    return l && l.panelId !== id;
  });
  if (state.selection && state.selection.id === id) state.selection = null;
}

export function save() {
  try {
    const snapshot = {
      wall: state.wall,
      panels: state.panels,
      loads: state.loads,
      foundations: state.foundations,
      view: state.view,
      uid,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    /* storage may be unavailable; ignore */
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.wall = s.wall || 'RIGHT';
    state.panels = s.panels || [];
    state.loads = s.loads || [];
    state.foundations = s.foundations || [];
    if (s.view) state.view = s.view;
    uid = s.uid || uid;
    return state.panels.length > 0;
  } catch (e) {
    return false;
  }
}
