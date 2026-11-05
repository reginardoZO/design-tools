// Physical layout of one compartment. D is the outside diameter of one cable.
// Spacing is edge to edge; between unequal neighbours the larger OD governs.
const EPS = 1e-9;
export const TREFOIL_HEIGHT = 1 + Math.sqrt(3) / 2;

export const MULTI_LAYOUTS = Object.freeze({
  stacked: {label: 'Random fill (stacked)', layer: false, gap: 0},
  layer: {label: 'Single layer · touching', layer: true, gap: 0},
  'layer-1d': {label: 'Single layer · 1D spacing', layer: true, gap: 1}
});
export const SINGLE_LAYOUTS = Object.freeze({
  trefoil: {label: 'Trefoil · touching', trefoil: true, gap: 0},
  'trefoil-1d': {label: 'Trefoil · 1D spacing', trefoil: true, gap: 1},
  'trefoil-2.15d': {label: 'Trefoil · 2.15D spacing', trefoil: true, gap: 2.15},
  flat: {label: 'Flat · touching', trefoil: false, gap: 0},
  'flat-1d': {label: 'Flat · 1D spacing', trefoil: false, gap: 1}
});
export const DEFAULT_LAYOUT = Object.freeze({multiLayout: 'stacked', singleLayout: 'trefoil-2.15d'});

export function layoutOf(comp = {}) {
  return {
    multi: MULTI_LAYOUTS[comp.multiLayout] || MULTI_LAYOUTS[DEFAULT_LAYOUT.multiLayout],
    single: SINGLE_LAYOUTS[comp.singleLayout] || SINGLE_LAYOUTS[DEFAULT_LAYOUT.singleLayout]
  };
}

export const clearGap = (a, b) => Math.max(a.gap, b.gap) * Math.max(a.d, b.d);

/**
 * rows = [{id, cable, qty}] where qty is the number of physical cables.
 * Layer items (trefoils, flat singles, single-layer multiconductors) sit side
 * by side from the left wall; stacked multiconductors fill the remaining width.
 * Counts stay compressed so very large quantities never allocate per cable.
 */
export function planLayout(rows = [], comp = {}) {
  const {multi, single} = layoutOf(comp);
  const linear = [], stacked = [];
  for (const r of rows) {
    const c = r.cable, d = Number(c?.odIn), n = Number(r.qty);
    if (!(d > 0) || !Number.isInteger(n) || n < 1) continue;
    const base = {id: r.id, cat: c.category, d};
    if (c.conductors === 1) {
      if (single.trefoil) {
        const groups = Math.floor(n / 3), loose = n % 3;
        if (groups) linear.push({...base, kind: 'trefoil', count: groups, cablesPerUnit: 3, width: 2 * d, height: TREFOIL_HEIGHT * d, gap: single.gap});
        if (loose) linear.push({...base, kind: 'single', count: loose, cablesPerUnit: 1, width: d, height: d, gap: single.gap, loose: true});
      } else {
        linear.push({...base, kind: 'single', count: n, cablesPerUnit: 1, width: d, height: d, gap: single.gap});
      }
    } else if (multi.layer) {
      linear.push({...base, kind: 'multi', count: n, cablesPerUnit: 1, width: d, height: d, gap: multi.gap});
    } else {
      stacked.push({...base, kind: 'multi', count: n});
    }
  }
  const order = {trefoil: 0, single: 1, multi: 2};
  linear.sort((a, b) => order[a.kind] - order[b.kind] || b.d - a.d);
  stacked.sort((a, b) => b.d - a.d);
  let width = 0, prev = null;
  for (const s of linear) {
    if (prev) width += clearGap(prev, s);
    width += s.count * s.width + (s.count - 1) * s.gap * s.d;
    prev = s;
  }
  const zoneGapIn = prev && stacked.length ? clearGap(prev, {gap: 0, d: stacked[0].d}) : 0;
  return {
    linear, stacked, zoneGapIn,
    linearWidthIn: width,
    linearHeightIn: Math.max(0, ...linear.map(s => s.height)),
    trefoils: linear.filter(s => s.kind === 'trefoil').reduce((n, s) => n + s.count, 0),
    looseSingles: linear.filter(s => s.loose).reduce((n, s) => n + s.count, 0),
    cableCount: linear.reduce((n, s) => n + s.count * s.cablesPerUnit, 0) + stacked.reduce((n, s) => n + s.count, 0)
  };
}

// Shelf packing of stacked cables (largest first) between `lane` and `width`.
function shelfPack(segments, lane, width, depth) {
  let x = lane, y = 0, rowH = 0, used = lane;
  const done = fits => ({fits, usedWidthIn: used, usedHeightIn: y + rowH});
  for (const s of segments) {
    let n = s.count;
    while (n > 0) {
      if (lane + s.d > width + EPS || y + s.d > depth + EPS) return done(false);
      const capacity = Math.floor((width - x + EPS) / s.d);
      if (capacity <= 0) { y += rowH; x = lane; rowH = 0; continue; }
      const taken = Math.min(n, capacity);
      x += taken * s.d; used = Math.max(used, x); n -= taken; rowH = Math.max(rowH, s.d);
      if (n > 0) {
        y += rowH; x = lane; rowH = 0;
        const full = Math.floor((width - lane + EPS) / s.d);
        const rows = Math.min(Math.floor(n / full), Math.max(0, Math.floor((depth - y + EPS) / s.d)));
        if (rows > 0) { n -= rows * full; used = Math.max(used, lane + full * s.d); y += (rows - 1) * s.d; x = lane + full * s.d; rowH = s.d; }
      }
    }
  }
  return done(true);
}

/** Does the modeled layout fit the clear width × usable depth? */
export function checkFit(plan, width, depth) {
  const linearFits = plan.linearWidthIn <= width + EPS && plan.linearHeightIn <= depth + EPS;
  if (!plan.stacked.length) return {fits: linearFits, usedWidthIn: plan.linearWidthIn, usedHeightIn: plan.linearHeightIn};
  const lane = plan.linearWidthIn + plan.zoneGapIn;
  const stack = shelfPack(plan.stacked, lane, width, depth);
  return {fits: linearFits && stack.fits, usedWidthIn: stack.usedWidthIn, usedHeightIn: Math.max(plan.linearHeightIn, stack.usedHeightIn)};
}

/** Cable positions for the SVG (x from the left wall, y up from the tray bottom). */
export function drawLayout(plan, width, depth, limit = 1500) {
  const placed = [], groups = [], gaps = [];
  const put = (s, atX, atY, unit) => {
    const offsets = s.kind === 'trefoil' ? [[0, 0, 'A'], [s.d, 0, 'B'], [s.d / 2, s.d * Math.sqrt(3) / 2, 'C']] : [[0, 0, null]];
    if (atX + s.width > width + EPS || atY + s.height > depth + EPS || placed.length + offsets.length > limit) return false;
    if (s.kind === 'trefoil') groups.push({id: `${s.id}-${unit}`, x: atX, y: atY, width: s.width, height: s.height, d: s.d});
    for (const [dx, dy, phase] of offsets) placed.push({id: s.id, d: s.d, cat: s.cat, x: atX + dx, y: atY + dy, phase});
    return true;
  };
  let x = 0, prev = null;
  for (const s of plan.linear) {
    if (prev) {
      const gap = clearGap(prev, s);
      if (gap && x + gap <= width + EPS) gaps.push({x, width: gap, factor: Math.max(prev.gap, s.gap)});
      x += gap;
    }
    const pitch = s.width + s.gap * s.d;
    for (let i = 0; i < s.count; i++) {
      const at = x + i * pitch;
      if (at + s.width > width + EPS || !put(s, at, 0, i)) break;
      if (i && s.gap) gaps.push({x: at - s.gap * s.d, width: s.gap * s.d, factor: s.gap});
    }
    x += s.count * s.width + (s.count - 1) * s.gap * s.d;
    prev = s;
  }
  const lane = plan.linearWidthIn + plan.zoneGapIn;
  let cx = lane, y = 0, rowH = 0;
  for (const s of plan.stacked) {
    for (let i = 0; i < s.count && placed.length < limit; i++) {
      if (cx + s.d > width + EPS && cx > lane) { cx = lane; y += rowH; rowH = 0; }
      if (y + s.d > depth + EPS || lane + s.d > width + EPS) break;
      put({...s, width: s.d, height: s.d}, cx, y, i); cx += s.d; rowH = Math.max(rowH, s.d);
    }
  }
  return {placed, groups, gaps, omitted: plan.cableCount - placed.length};
}
