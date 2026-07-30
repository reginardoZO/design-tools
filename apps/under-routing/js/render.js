// render.js — draws the whole scene into a single SVG element.
//
// Everything is rebuilt from state on each render(). At this scale that is
// simpler and fast enough, and keeps the drawing a pure function of state.

import {
  COL_WIDTH_IN,
  END_SECTION_WIDTH_IN,
  panelLocalToWorld,
  columnTapWorld,
  panelLengthIn,
} from './geometry.js?v=20260730-2';
import { state } from './store.js?v=20260730-2';

export const BASE_PPI = 1.0; // pixels per inch at scale 1
const SVGNS = 'http://www.w3.org/2000/svg';
const PANEL_DEPTH_IN = 150; // drawn depth of a panel box (presentation only)
const NUM_STRIP_IN = 26; // width of the dark numbered strip on the front edge
const RESIZE_HANDLE_RADIUS = 6;

// Labels that read as structural rows rather than connectable feeders; drawn
// with a hatch so they stand out (purely cosmetic).
const HATCH_WORDS = ['METERING', 'TRANSITION', 'CROSS-TIE', 'INCOMER'];

let svg = null;

export function initSvg(el) {
  svg = el;
}

// ---- coordinate transforms ------------------------------------------------

export function worldToScreen(x, y) {
  const { scale, offsetX, offsetY } = state.view;
  return [offsetX + x * scale * BASE_PPI, offsetY + y * scale * BASE_PPI];
}

export function screenToWorld(sx, sy) {
  const { scale, offsetX, offsetY } = state.view;
  return [
    (sx - offsetX) / (scale * BASE_PPI),
    (sy - offsetY) / (scale * BASE_PPI),
  ];
}

function el(name, attrs, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

// ---- top level ------------------------------------------------------------

export function render() {
  if (!svg) return;
  svg.textContent = '';
  drawDefs(svg);

  const root = el('g', {}, svg);

  for (const foundation of state.foundations) drawFoundation(root, foundation);
  for (const panel of state.panels) drawPanel(root, panel);
  if (state.showRoutes) for (const route of state.routes) drawRoute(root, route);
  for (const load of state.loads) drawLoad(root, load);
  for (const tag of state.tags) drawTag(root, tag);
}

function drawDefs(parent) {
  const defs = el('defs', {}, parent);
  const pattern = el(
    'pattern',
    {
      id: 'hatch',
      width: 6,
      height: 6,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
    },
    defs
  );
  el(
    'line',
    { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#c9d2dd', 'stroke-width': 1.2 },
    pattern
  );
}

// ---- foundations ---------------------------------------------------------

function drawFoundation(parent, foundation) {
  const [left, top] = worldToScreen(foundation.x, foundation.y);
  const [right, bottom] = worldToScreen(
    foundation.x + foundation.width,
    foundation.y + foundation.height
  );
  const width = Math.abs(right - left);
  const height = Math.abs(bottom - top);
  const selected = state.selection && state.selection.id === foundation.id;
  const group = el(
    'g',
    { class: 'foundation', 'data-id': foundation.id },
    parent
  );

  el(
    'rect',
    {
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width,
      height,
      class: 'foundation-area' + (selected ? ' selected' : ''),
    },
    group
  );

  if (width >= 96 && height >= 42) {
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const title = el(
      'text',
      { x: centerX, y: centerY - 4, class: 'foundation-label', 'text-anchor': 'middle' },
      group
    );
    title.textContent = 'DEEP FOUNDATION';
    const dimensions = el(
      'text',
      { x: centerX, y: centerY + 13, class: 'foundation-size', 'text-anchor': 'middle' },
      group
    );
    dimensions.textContent =
      `${formatFeet(foundation.width)} × ${formatFeet(foundation.height)}`;
  }

  if (selected) drawResizeHandles(group, foundation, 'foundation');
}

function formatFeet(inches) {
  const feet = inches / 12;
  return `${feet.toFixed(feet >= 10 ? 0 : 1)} ft`;
}

// ---- panels ---------------------------------------------------------------

function isHatched(label) {
  const up = (label || '').toUpperCase();
  return HATCH_WORDS.some((w) => up.includes(w));
}

function drawPanel(parent, panel) {
  const g = el('g', { class: 'panel', 'data-id': panel.id }, parent);
  const n = panel.columns.length;
  const panelLength = panelLengthIn(panel);
  const rot = panel.rotation;

  // Corners of the whole panel box, local → screen.
  const corners = [
    [0, 0],
    [PANEL_DEPTH_IN, 0],
    [PANEL_DEPTH_IN, panelLength],
    [0, panelLength],
  ].map(([lx, ly]) => worldToScreen(...panelLocalToWorld(panel, lx, ly)));

  const selected = state.selection && state.selection.id === panel.id;

  // Outer box.
  el(
    'polygon',
    {
      points: corners.map((c) => c.join(',')).join(' '),
      class: 'panel-box' + (selected ? ' selected' : ''),
    },
    g
  );

  // END SECTION is structural and non-connectable. It is always present at
  // both ends of the configured equipment lineup.
  drawHatch(g, panel, 0, END_SECTION_WIDTH_IN);
  drawHatch(g, panel, panelLength - END_SECTION_WIDTH_IN, panelLength);

  // Other structural rows first, so the strip and text sit on top.
  for (let i = 0; i < n; i++) {
    if (isHatched(panel.columns[i].label)) {
      const y0 = END_SECTION_WIDTH_IN + i * COL_WIDTH_IN;
      drawHatch(g, panel, y0, y0 + COL_WIDTH_IN);
    }
  }

  // Dark numbered strip along the front edge (where cables land).
  const strip = [
    [0, 0],
    [NUM_STRIP_IN, 0],
    [NUM_STRIP_IN, panelLength],
    [0, panelLength],
  ].map(([lx, ly]) => worldToScreen(...panelLocalToWorld(panel, lx, ly)));
  el(
    'polygon',
    { points: strip.map((c) => c.join(',')).join(' '), class: 'panel-numstrip' },
    g
  );

  const labelX = NUM_STRIP_IN + (PANEL_DEPTH_IN - NUM_STRIP_IN) / 2;

  // Separators include the two END SECTION boundaries. The outside edges are
  // already provided by the panel box.
  for (let boundary = 0; boundary <= n; boundary++) {
    const y = END_SECTION_WIDTH_IN + boundary * COL_WIDTH_IN;
    const s0 = worldToScreen(...panelLocalToWorld(panel, 0, y));
    const s1 = worldToScreen(...panelLocalToWorld(panel, PANEL_DEPTH_IN, y));
    el(
      'line',
      { x1: s0[0], y1: s0[1], x2: s1[0], y2: s1[1], class: 'panel-sep' },
      g
    );
    const sd = worldToScreen(...panelLocalToWorld(panel, NUM_STRIP_IN, y));
    el(
      'line',
      { x1: s0[0], y1: s0[1], x2: sd[0], y2: sd[1], class: 'panel-numsep' },
      g
    );
  }

  drawPanelText(
    g,
    panel,
    labelX,
    END_SECTION_WIDTH_IN / 2,
    'END SECTION',
    rot,
    'panel-end-label'
  );
  drawPanelText(
    g,
    panel,
    labelX,
    panelLength - END_SECTION_WIDTH_IN / 2,
    'END SECTION',
    rot,
    'panel-end-label'
  );

  // Each connectable column: number, label and tap.
  for (let i = 0; i < n; i++) {
    const col = panel.columns[i];
    const y0 = END_SECTION_WIDTH_IN + i * COL_WIDTH_IN;
    const cy = y0 + COL_WIDTH_IN / 2;

    // Column number inside the dark strip.
    const numPos = worldToScreen(...panelLocalToWorld(panel, NUM_STRIP_IN / 2, cy));
    const t = el(
      'text',
      {
        x: numPos[0],
        y: numPos[1],
        class: 'panel-num',
        'text-anchor': 'middle',
        transform: labelRotation(rot, numPos),
      },
      g
    );
    t.textContent = String(i + 1);

    // Column label, centred in the white area.
    drawPanelText(g, panel, labelX, cy - 5, col.label, rot, 'panel-label');
    drawPanelText(
      g,
      panel,
      labelX,
      cy + 8,
      `${COL_WIDTH_IN} in / ${COL_WIDTH_IN / 12} ft`,
      rot,
      'panel-size'
    );

    // Tap tick on the front face.
    const tap = worldToScreen(...columnTapWorld(panel, i));
    el('circle', { cx: tap[0], cy: tap[1], r: 2.4, class: 'panel-tap' }, g);
  }

  // Title above the front-top of the panel (e.g. "BUS A ▲").
  const titlePos = worldToScreen(
    ...panelLocalToWorld(panel, PANEL_DEPTH_IN / 2, -10)
  );
  const title = el(
    'text',
    { x: titlePos[0], y: titlePos[1], class: 'panel-title', 'text-anchor': 'middle' },
    g
  );
  title.textContent = panel.name + ' ▲';

  if (selected) drawRotateHandle(g, panel, corners);
}

function drawPanelText(g, panel, labelX, centerY, text, rot, className) {
  const labelPos = worldToScreen(...panelLocalToWorld(panel, labelX, centerY));
  const label = el(
    'text',
    {
      x: labelPos[0],
      y: labelPos[1],
      class: className,
      'text-anchor': 'middle',
      transform: labelRotation(rot, labelPos),
    },
    g
  );
  label.textContent = text;
}

function labelRotation(rot, pos) {
  // Keep labels upright-ish; rotate text with panel for the vertical walls.
  const r = ((rot % 360) + 360) % 360;
  if (r === 90 || r === 270) return `rotate(${r === 90 ? -90 : 90} ${pos[0]} ${pos[1]})`;
  return '';
}

function drawHatch(g, panel, y0, y1) {
  const p = [
    worldToScreen(...panelLocalToWorld(panel, 0, y0)),
    worldToScreen(...panelLocalToWorld(panel, PANEL_DEPTH_IN, y0)),
    worldToScreen(...panelLocalToWorld(panel, PANEL_DEPTH_IN, y1)),
    worldToScreen(...panelLocalToWorld(panel, 0, y1)),
  ];
  el(
    'polygon',
    { points: p.map((c) => c.join(',')).join(' '), class: 'panel-hatch' },
    g
  );
}

function drawRotateHandle(g, panel, corners) {
  // Place the handle just outside the front-top corner.
  const pos = worldToScreen(...panelLocalToWorld(panel, -14, -14));
  const h = el('g', { class: 'rotate-handle', 'data-rotate': panel.id }, g);
  el('circle', { cx: pos[0], cy: pos[1], r: 9 }, h);
  const t = el('text', { x: pos[0], y: pos[1] + 4, 'text-anchor': 'middle' }, h);
  t.textContent = '↻';
}

// ---- routes ---------------------------------------------------------------

function drawRoute(parent, route) {
  const pts = route.points.map((p) => worldToScreen(p[0], p[1]));
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ' ' + p[1]).join(' ');
  el(
    'path',
    { d, class: 'route' + (route.blocked ? ' blocked' : ''), stroke: route.color },
    parent
  );
}

// ---- loads ----------------------------------------------------------------

function drawLoad(parent, load) {
  const [sx, sy] = worldToScreen(load.x, load.y);
  const route = state.routes.find((r) => r.loadId === load.id);
  const color = route ? route.color : '#333';
  const selected = state.selection && state.selection.id === load.id;

  const g = el('g', { class: 'load', 'data-id': load.id }, parent);

  // Invisible, generous hit target so the marker is easy to grab / delete.
  el(
    'circle',
    { cx: sx, cy: sy, r: 14, fill: 'transparent', stroke: 'transparent', 'pointer-events': 'all' },
    g
  );

  // Target-style marker: outer ring + inner dot.
  el('circle', { cx: sx, cy: sy, r: 7, class: 'load-ring', stroke: color }, g);
  el('circle', { cx: sx, cy: sy, r: 2.6, fill: color }, g);
  if (selected) el('circle', { cx: sx, cy: sy, r: 11, class: 'load-select' }, g);

  const tag = el(
    'text',
    { x: sx, y: sy - 14, class: 'load-tag', 'text-anchor': 'middle' },
    g
  );
  const busTag = load.panelId ? ` [${panelBusTag(load.panelId)}]` : '';
  tag.textContent = load.tag + busTag;

  const sub = el(
    'text',
    { x: sx, y: sy + 22, class: 'load-sub', 'text-anchor': 'middle' },
    g
  );
  sub.textContent = `← col. ${load.colIndex + 1}`;
}

function panelBusTag(panelId) {
  const idx = state.panels.findIndex((p) => p.id === panelId);
  return String.fromCharCode(65 + Math.max(0, idx)); // A, B, C...
}

// ---- tag rectangles -------------------------------------------------------
//
// Pure drawing markers (e.g. "future load", "panel area"): they never take
// part in routing, they only carry a centred label.

function drawTag(parent, tag) {
  const [left, top] = worldToScreen(tag.x, tag.y);
  const [right, bottom] = worldToScreen(tag.x + tag.width, tag.y + tag.height);
  const width = Math.abs(right - left);
  const height = Math.abs(bottom - top);
  const selected = state.selection && state.selection.id === tag.id;
  const group = el('g', { class: 'tag', 'data-id': tag.id }, parent);

  el(
    'rect',
    {
      x: Math.min(left, right),
      y: Math.min(top, bottom),
      width,
      height,
      class: 'tag-box' + (selected ? ' selected' : ''),
    },
    group
  );

  const label = el(
    'text',
    {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      class: 'tag-label',
      'text-anchor': 'middle',
    },
    group
  );
  label.textContent = tag.tag;

  if (width >= 80 && height >= 38) {
    const dimensions = el(
      'text',
      {
        x: (left + right) / 2,
        y: (top + bottom) / 2 + 16,
        class: 'tag-size',
        'text-anchor': 'middle',
      },
      group
    );
    dimensions.textContent = `${formatFeet(tag.width)} × ${formatFeet(tag.height)}`;
  }

  if (selected) drawResizeHandles(group, tag, 'tag');
}

function drawResizeHandles(parent, rectangle, type) {
  const [left, top] = worldToScreen(rectangle.x, rectangle.y);
  const [right, bottom] = worldToScreen(
    rectangle.x + rectangle.width,
    rectangle.y + rectangle.height
  );
  const corners = [
    ['nw', left, top],
    ['ne', right, top],
    ['se', right, bottom],
    ['sw', left, bottom],
  ];

  for (const [corner, x, y] of corners) {
    el(
      'circle',
      {
        cx: x,
        cy: y,
        r: RESIZE_HANDLE_RADIUS,
        class: 'resize-handle',
        'data-resize-type': type,
        'data-resize-id': rectangle.id,
        'data-corner': corner,
      },
      parent
    );
  }
}

// ---- view fitting ---------------------------------------------------------

// Fit all content into the viewport with a margin.
export function fitToContent(margin = 60) {
  const b = contentBounds();
  if (!b) return;
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  const sx = (w - margin * 2) / (b.w * BASE_PPI);
  const sy = (h - margin * 2) / (b.h * BASE_PPI);
  const scale = Math.max(0.1, Math.min(sx, sy, 4));
  state.view.scale = scale;
  state.view.offsetX = margin - b.x * scale * BASE_PPI + (w - margin * 2 - b.w * scale * BASE_PPI) / 2;
  state.view.offsetY = margin - b.y * scale * BASE_PPI + (h - margin * 2 - b.h * scale * BASE_PPI) / 2;
}

function contentBounds() {
  const xs = [];
  const ys = [];
  for (const panel of state.panels) {
    const panelLength = panelLengthIn(panel);
    for (const [lx, ly] of [
      [0, -18],
      [PANEL_DEPTH_IN, 0],
      [PANEL_DEPTH_IN, panelLength],
      [0, panelLength],
    ]) {
      const [wx, wy] = panelLocalToWorld(panel, lx, ly);
      xs.push(wx);
      ys.push(wy);
    }
  }
  for (const load of state.loads) {
    xs.push(load.x - 60, load.x + 60);
    ys.push(load.y - 30, load.y + 30);
  }
  for (const foundation of state.foundations) {
    xs.push(foundation.x, foundation.x + foundation.width);
    ys.push(foundation.y, foundation.y + foundation.height);
  }
  for (const tag of state.tags) {
    xs.push(tag.x, tag.x + tag.width);
    ys.push(tag.y, tag.y + tag.height);
  }
  if (!xs.length) return null;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}
