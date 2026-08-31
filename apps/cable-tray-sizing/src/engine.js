/* ============================================================================
   CABLE TRAY FILL SIZING — WIDTH / ARRANGEMENT MODEL
   ----------------------------------------------------------------------------
   This engine intentionally mirrors, criterion-for-criterion, the calculation
   used by the reference AutoCAD tool (ELDES, C:\Temp\Trash\ELDES\Form1.cs —
   MixedCableTrayDraw / CalculateCableSpacing / CalculateMixedTrayLength /
   StandardizeTraySize) rather than the NEC 392.22(A) area-fill table this app
   used in an earlier iteration. Per the user: the reference tool is the
   ground truth for this calculation; this app is meant to be a plain web
   version of exactly what it already does (the AutoCAD tool is AutoCAD-only).

   Data source: apps/cable-tray-sizing/public/data/cableTray.json is a direct
   copy of the reference tool's own cableTray.json (Load/Type/Voltage/Size ->
   OD in inches, Weight in lb/1000ft). Every Load/Type/Voltage/Size the UI can
   select comes straight from this file (cascading dropdowns, exactly like
   the reference tool's RefreshCableTrayFilterOptions), so a selection can
   never resolve to a missing/blank OD.

   Cable classes (from the data, not hardcoded):
   - Load: "Power" (LV 600V or MV 15kV feeders), "VFD" (drive cable — only
     sold/modeled here as a multiconductor "Multiple" cable), "Power-Tray"
     (thinner tray-rated single-conductor cable, always laid out like a
     trefoil group same as "Single").
   - Type: "Single" (bare/individual conductor — always grouped in trefoils
     of 3 in this model, matching the reference tool) or "Multiple"
     (jacketed multiconductor cable — laid single-file, one item = one
     cable).

   Width/weight rule per item (one trefoil group OR one multiconductor
   cable), left to right along the tray, mirrors CalculateMixedTrayLength:
   - width: trefoil-layout items (Single, or any Power-Tray) occupy 2×OD
     (the two bottom conductors sitting side by side); Multiple items occupy
     1×OD.
   - weight: trefoil-layout items count 3× the single-conductor weight (3
     identical conductors per group); Multiple items count once.
   - spacing between two ADJACENT items (order matters — this is a sequence,
     not an unordered pile) mirrors CalculateCableSpacing:
       * either side is Power-Tray -> forced 1×OD of the larger (no toggle).
       * both trefoil-layout -> 2.15×OD of the larger if "trefoil spacing" is
         on, else 0 (contiguous groups).
       * both Multiple, both VFD -> 1×OD of the larger, or 0 if "VFD
         spacing" is off (contiguous VFD cables).
       * both Multiple, both Power -> 1×OD of the larger, or 0 if "Power
         bundled (encangado)" is on.
       * both Multiple, mixed loads (e.g. one VFD next to one Power) -> 1×OD
         of the larger (falls through to the generic Multiple-Multiple rule).
       * one trefoil-layout + one Multiple (mixed) -> 2.15×OD of the larger.
   - tray edge clearance (each side) mirrors GetMixedTrayEdgeSpacing: 0.2 in,
     UNLESS the item at that edge is Power-Tray, in which case the edge
     clearance equals that item's own OD.

   Standard tray widths mirror StandardizeTraySize exactly: {6, 9, 12, 18,
   24, 30, 36} in — the SAME maximum (36 in) as the reference tool. Above
   36 in there is no commercial size in the reference tool's table either;
   it rounds up to the next whole inch and flags the result as non-commercial
   ("ESTE TAMANHO NAO E COMERCIAL").

   Trefoil circle geometry (three mutually tangent, equal-radius circles,
   resting on the tray floor) is a direct port of the reference tool's own
   DrawTrifoilCable: bottom pair centers 2×r apart (r = OD/2), top circle
   center offset by (r, r·√3) from the bottom-left circle — see App.jsx.

   Everything downstream of the required-width number (spare-capacity
   reserve %, tray depth suggestion, the SVG fill diagram, "suggest
   arrangement to fit") is this app's own addition, layered on top of the
   ELDES-equivalent width calculation — not present in the reference tool
   (which only drafts a schematic in AutoCAD), but harmless additions to it.
   ========================================================================== */

export const STANDARD_WIDTHS_IN = [6, 9, 12, 18, 24, 30, 36];
export const STANDARD_DEPTHS_IN = [3, 4, 5, 6];

export const TREFOIL_WIDTH_MULT = 2; // width per trefoil group = 2×OD (footprint of the two bottom conductors)
export const ADJACENT_SPACING_MULT = 2.15; // ×larger-OD spacing where a trefoil-layout item borders another item
export const EDGE_CLEARANCE_IN = 0.2; // fixed tray-wall clearance, each side (unless Power-Tray at that edge)

export const isPowerTray = (load) => load === "Power-Tray";
export const usesTrefoilLayout = (type, load) => type === "Single" || isPowerTray(load);

/* --------------------------------- data load -------------------------------- */

// public/data/cableTray.json — a plain relative fetch (not new URL(...,
// import.meta.url)) so it resolves against the DOCUMENT's location, which
// sits at the app root in both dev (Vite serves public/ at "/") and the
// published build (Vite copies public/ next to dist/index.html) — see repo
// memory note on the earlier apps/neher cross-app fetch path bug.
export async function loadCableTrayDb() {
  const res = await fetch("data/cableTray.json");
  if (!res.ok) throw new Error("Unable to load the cable tray database (data/cableTray.json).");
  return res.json();
}

/* ------------------------------ cascading filters ---------------------------- */

export function filterRows(rows, { load, type, voltage } = {}) {
  return rows.filter(
    (r) => (!load || r.Load === load) && (!type || r.Type === type) && (!voltage || r.Voltage === voltage)
  );
}

// Mirrors GetDistinctValues: alphabetical, unless orderByOd (sizes ordered
// by ascending OD, same as the reference tool's cmbSizeCTN population).
export function distinctValues(rows, key, { orderByOd = false } = {}) {
  if (orderByOd) {
    const seen = [];
    for (const r of [...rows].sort((a, b) => a.OD - b.OD)) {
      if (r[key] != null && r[key] !== "" && !seen.includes(r[key])) seen.push(r[key]);
    }
    return seen;
  }
  return [...new Set(rows.map((r) => r[key]).filter((v) => v != null && v !== ""))].sort((a, b) => a.localeCompare(b));
}

// Mirrors RefreshCableTrayFilterOptions's cascade: Load -> Type -> Voltage -> Size.
export function cascadeOptions(rows, { load, type, voltage } = {}) {
  const loads = distinctValues(rows, "Load");
  const byLoad = filterRows(rows, { load });
  const types = distinctValues(byLoad, "Type");
  const byLoadType = filterRows(rows, { load, type });
  const voltages = distinctValues(byLoadType, "Voltage");
  const byFull = filterRows(rows, { load, type, voltage });
  const sizes = distinctValues(byFull, "Size", { orderByOd: true });
  return { loads, types, voltages, sizes };
}

export function findCable(rows, { load, type, voltage, size }) {
  return rows.find((r) => r.Load === load && r.Type === type && r.Voltage === voltage && r.Size === size) || null;
}

/* --------------------------------- core layout -------------------------------- */

function itemWidthIn(item) {
  return usesTrefoilLayout(item.type, item.load) ? item.od * TREFOIL_WIDTH_MULT : item.od;
}

function itemWeight(item) {
  return usesTrefoilLayout(item.type, item.load) ? item.weight * 3 : item.weight;
}

// Direct port of CalculateCableSpacing. `opts` = { trefoilSpacing, vfdSpacing, powerBundled } booleans.
export function spacingBetween(curr, next, opts) {
  const bigger = Math.max(curr.od, next.od);
  if (isPowerTray(curr.load) || isPowerTray(next.load)) return bigger;

  const currTrefoil = usesTrefoilLayout(curr.type, curr.load);
  const nextTrefoil = usesTrefoilLayout(next.type, next.load);

  if (currTrefoil && nextTrefoil) {
    return opts.trefoilSpacing ? ADJACENT_SPACING_MULT * bigger : 0;
  }
  if (!currTrefoil && !nextTrefoil) {
    const bothVfd = curr.load === "VFD" && next.load === "VFD";
    const bothPower = curr.load === "Power" && next.load === "Power";
    if (bothVfd && !opts.vfdSpacing) return 0;
    if (bothPower && opts.powerBundled) return 0;
    return bigger;
  }
  return ADJACENT_SPACING_MULT * bigger; // one trefoil-layout, one Multiple
}

function edgeClearance(items, side) {
  if (!items.length) return EDGE_CLEARANCE_IN;
  const it = side === "left" ? items[0] : items[items.length - 1];
  return isPowerTray(it.load) ? it.od : EDGE_CLEARANCE_IN;
}

// Places every item left-to-right (inches), mirroring CalculateMixedTrayLength
// but also returning per-item x/width so the SVG diagram can draw from the
// exact same numbers used for the required-width total (single source of truth).
export function layoutItems(items, opts) {
  if (!items.length) return { totalIn: 0, totalWeight: 0, maxDepthIn: 0, placements: [] };

  let cursor = edgeClearance(items, "left");
  let totalWeight = 0;
  let maxDepthIn = 0;
  const placements = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const widthIn = itemWidthIn(item);
    const trefoil = usesTrefoilLayout(item.type, item.load);
    const depthIn = trefoil ? item.od * (1 + Math.sqrt(3)) : item.od; // floor -> top of tallest conductor
    placements.push({ item, xIn: cursor, widthIn, trefoil });
    maxDepthIn = Math.max(maxDepthIn, depthIn);
    cursor += widthIn;
    totalWeight += itemWeight(item);
    if (i < items.length - 1) cursor += spacingBetween(item, items[i + 1], opts);
  }
  cursor += edgeClearance(items, "right");

  return { totalIn: cursor, totalWeight, maxDepthIn, placements };
}

// Mirrors StandardizeTraySize: smallest catalog size (max 36 in) that fits,
// or the next whole inch above 36 in flagged as non-commercial.
export function standardizeTraySize(lengthIn) {
  if (!(lengthIn > 0)) return { size: STANDARD_WIDTHS_IN[0], commercial: true };
  for (const w of STANDARD_WIDTHS_IN) if (w >= lengthIn) return { size: w, commercial: true };
  return { size: Math.ceil(lengthIn), commercial: false };
}

export function suggestDepth(maxDepthIn, depths = STANDARD_DEPTHS_IN) {
  if (!(maxDepthIn > 0)) return depths[0];
  return depths.find((d) => d >= maxDepthIn) ?? Math.ceil(maxDepthIn);
}

/* ------------------------- arrangement suggestion -------------------------- */

// Trefoil layout is already mandatory for Single/Power-Tray items in this
// model (no touching/spaced alternative — see header), so the one degree of
// freedom left to shrink the total is turning the spacing toggles off.
// Suggests the minimal set of toggles to flip (cheapest/least-disruptive
// first) to make the tray fit within the target usable width.
export function suggestSpacingToggles(items, opts, targetUsableWidthIn) {
  const tryOpts = { ...opts };
  const order = ["powerBundled", "vfdSpacing", "trefoilSpacing"];
  const changed = [];
  for (const key of order) {
    const { totalIn } = layoutItems(items, tryOpts);
    if (totalIn <= targetUsableWidthIn) break;
    const before = tryOpts[key];
    tryOpts[key] = key === "powerBundled" ? true : false;
    if (tryOpts[key] !== before) changed.push(key);
  }
  return { opts: tryOpts, changed, ...layoutItems(items, tryOpts) };
}

