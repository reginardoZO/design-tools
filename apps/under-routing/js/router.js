// router.js — auto-routing of loads to their panel columns.
//
// Goals, in priority order (from the spec):
//   1. minimise the number of crossings between routes,
//   2. use only 45° bends and straight runs (guaranteed by octRoute),
//   3. keep each route as short as possible.
//
// Every load is wired to the tap point of the single column it was assigned
// to. Because the assignment is fixed, crossings come purely from geometry:
// a route that needs to travel "up" the panel while another travels "down"
// will tend to cross it. We fight that by choosing, per route, how far it
// runs straight before its diagonal (its "slack"/track offset), then we pick
// the ordering of those tracks that yields the fewest crossings.

import {
  octRoute,
  panelFrontDir,
  columnTapWorld,
  countPolylineCrossings,
  avoidRectangles,
} from './geometry.js?v=20260723-2';
import { state, getPanel } from './store.js?v=20260723-2';

// Distinct, print-friendly colours cycled across routes.
const COLORS = [
  '#d6482b', '#127a7a', '#2f6fd8', '#8e44ad', '#1f8f4e', '#b8860b',
  '#c2185b', '#5d6d7e', '#e07b39', '#00838f', '#7b1fa2', '#33691e',
  '#c62828', '#455a64', '#6d4c41', '#00695c', '#4527a0', '#9e6b00',
];

const TRACK_GAP_IN = 9; // spacing between adjacent diagonal "tracks"
export const FOUNDATION_CLEARANCE_IN = 12;

// Build every route and store the result + stats on the state.
export function autoRoute() {
  const routes = [];
  // Group loads by the panel they feed so each panel gets its own fan of
  // nested tracks.
  const byPanel = new Map();
  for (const load of state.loads) {
    if (!byPanel.has(load.panelId)) byPanel.set(load.panelId, []);
    byPanel.get(load.panelId).push(load);
  }

  let colorIndex = 0;
  for (const [panelId, loads] of byPanel) {
    const panel = getPanel(panelId);
    if (!panel) continue;
    const front = panelFrontDir(panel);

    // Precompute each load's tap and a signed "need" = how far up/down the
    // route must travel along the panel front axis, used to order tracks.
    const items = loads.map((load) => {
      const tap = columnTapWorld(panel, load.colIndex);
      return { load, tap, color: COLORS[colorIndex++ % COLORS.length] };
    });

    const ordered = orderForFewestCrossings(items, front);
    for (const it of ordered) {
      routes.push({
        loadId: it.load.id,
        panelId,
        colIndex: it.load.colIndex,
        points: it.points,
        length: it.length,
        blocked: it.blocked,
        color: it.color,
      });
    }
  }

  state.routes = routes;
  updateStats();
  return routes;
}

// Try a handful of track orderings and keep whichever crosses least. The
// candidate orderings are cheap sorts that tend to nest routes cleanly.
function orderForFewestCrossings(items, front) {
  if (items.length === 0) return [];

  // Perpendicular offset of each load relative to its tap, along the panel
  // front axis, tells us whether it approaches from "above" or "below".
  const perp = (it) => {
    const dx = it.load.x - it.tap[0];
    const dy = it.load.y - it.tap[1];
    // component perpendicular to front direction
    return dx * -front[1] + dy * front[0];
  };
  const along = (it) => {
    const dx = it.load.x - it.tap[0];
    const dy = it.load.y - it.tap[1];
    return dx * front[0] + dy * front[1]; // how far out in front the load sits
  };

  const candidates = [
    [...items].sort((a, b) => perp(a) - perp(b)),
    [...items].sort((a, b) => perp(b) - perp(a)),
    [...items].sort((a, b) => a.tap[1] - b.tap[1] || a.tap[0] - b.tap[0]),
    [...items].sort((a, b) => along(b) - along(a)),
  ];

  let best = null;
  let bestCross = Infinity;
  for (const order of candidates) {
    const built = buildTracks(order);
    const cross = totalCrossings(built);
    if (cross < bestCross) {
      bestCross = cross;
      best = built;
    }
  }
  return best;
}

// Assign each item an increasing slack so their diagonals sit on parallel,
// non-overlapping tracks, then compute the octilinear path.
function buildTracks(order) {
  return order.map((it, i) => {
    const slack = i * TRACK_GAP_IN;
    const front = panelFrontDir(getPanel(it.load.panelId));
    const direct = octRoute([it.load.x, it.load.y], it.tap, front, slack);
    const routed = avoidRectangles(
      direct.points,
      state.foundations,
      FOUNDATION_CLEARANCE_IN
    );
    return {
      ...it,
      points: routed.points,
      length: routed.length,
      blocked: routed.blocked,
    };
  });
}

function totalCrossings(built) {
  let n = 0;
  for (let i = 0; i < built.length; i++) {
    for (let j = i + 1; j < built.length; j++) {
      n += countPolylineCrossings(built[i].points, built[j].points);
    }
  }
  return n;
}

// Recompute the global stats bar (routes / crossings / total length).
export function updateStats() {
  const routes = state.routes;
  let length = 0;
  for (const r of routes) length += r.length;
  const blocked = routes.filter((route) => route.blocked).length;

  let crossings = 0;
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      crossings += countPolylineCrossings(routes[i].points, routes[j].points);
    }
  }
  state.stats = {
    routes: routes.length,
    crossings,
    blocked,
    length: Math.round(length * 10) / 10,
  };
}
