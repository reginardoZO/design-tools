/* ============================================================================
   CABLE TRAY FILL SIZING — MINIMUM TRAY WIDTH FOR A GIVEN SET OF CABLES
   ----------------------------------------------------------------------------
   Scope: NEC 392.22 (fill of a ladder / ventilated-trough cable tray with
   power and control cables rated 2000 V or less, plus MV cables handled the
   same way as their LV single/multiconductor counterparts since Article 315
   trays follow the identical physical-fill logic as Article 392.22(A)/(B)).

   This is a DIFFERENT problem than apps/nec-cable-tray (which sizes conductor
   AMPACITY for a tray whose width is already known, per 392.80). Here the
   tray width itself is the unknown — we size the smallest standard tray that
   physically holds the cables the user lists.

   Two families of rule, both from 392.22:
   - Single-conductor cables [392.22(B)] and multiconductor cables 4/0 AWG or
     larger [392.22(A)(1)(a)] are always laid SINGLE LAYER: the cable tray
     width must be at least the sum of the cables' diameters (plus, where the
     user wants maintained spacing or trefoil grouping, the extra spacing the
     arrangement requires).
   - Multiconductor cables smaller than 4/0 AWG [392.22(A)(1)(b)/(c)] may be
     stacked/randomly filled: the limit is on the SUM OF CROSS-SECTIONAL AREAS
     against a maximum allowable fill area for the tray width, per Table
     392.22(A) — Column 1 (1/0 AWG through 3/0 AWG) or Column 2 (smaller than
     1/0 AWG). NOTE: this tool assigns exactly 4/0 AWG to the single-layer
     "large cable" class (392.22(A)(1)(a)) to keep the two classes disjoint;
     verify the 4/0 boundary case against the code text for a final design.

   Table 392.22(A) itself is reproduced here as a LINEAR APPROXIMATION valid
   for standard tray widths ≥ 6 in (allowable area scales as a fixed in²-per-
   inch-of-width ratio for every printed row from 6 in to 36 in) — it has NOT
   been independently verified against an official NEC scan (unlike the MV
   ampacity tables in apps/nec-cable-tray, which were). Treat the resulting
   tray width as an engineering estimate and verify against the code edition
   adopted in your jurisdiction before final design.

   Trefoil bundle geometry (3 round cables tangent in a triangle): the
   circumscribed bundle diameter is OD × (1 + 2/√3) ≈ 2.155 × OD. The 2.15×OD
   minimum spacing between trefoil groups mirrors the constant already used
   in apps/nec-cable-tray/src/engine.js for 392.80(A)(2)(d)/(B)(2)(d).

   VFD (drive output) cable separation: NEC does not prescribe a universal
   numeric separation from other power/control cables. The 12 in (300 mm)
   default here reflects common adjustable-speed-drive manufacturer
   installation guidance (to limit high-frequency conducted/radiated noise
   coupling into adjacent cables) — it is a best-practice default, not a
   specific NEC table value. Always check the drive manufacturer's
   installation manual.
   ========================================================================== */

export const LV_SIZE_ORDER = [
  "14", "12", "10", "8", "6", "4", "3", "2", "1",
  "1/0", "2/0", "3/0", "4/0",
  "250", "300", "350", "400", "500", "600", "700", "750", "800", "900", "1000",
];

const isKcmil = (s) => !isNaN(parseInt(s, 10)) && parseInt(s, 10) >= 250;
export const sizeLabel = (s) => (isKcmil(s) ? `${s} kcmil` : `${s} AWG`);

const IDX_1_0 = LV_SIZE_ORDER.indexOf("1/0");
const IDX_4_0 = LV_SIZE_ORDER.indexOf("4/0");

// Classifies a MULTICONDUCTOR cable size into the 392.22(A) fill rule that
// applies to it. "large" -> single layer / sum of diameters. "col1"/"col2" ->
// area-fill against the Table 392.22(A) approximation above.
export function multiSizeClass(size) {
  const i = LV_SIZE_ORDER.indexOf(size);
  if (i < 0) return "col2";
  if (i >= IDX_4_0) return "large";
  if (i >= IDX_1_0) return "col1";
  return "col2";
}

// Table 392.22(A) linear approximation, in² of allowable fill area per inch
// of tray width (valid for standard widths ≥ 6 in — see header note).
export const AREA1_PER_IN = 7 / 6; // Column 1 — 1/0 AWG through 3/0 AWG
export const AREA2_PER_IN = 3.5 / 6; // Column 2 — smaller than 1/0 AWG

// Trefoil (triangular) bundle of 3 round cables, per NEC 392.80 citations.
export const TREFOIL_BUNDLE_MULT = 1 + 2 / Math.sqrt(3); // ≈ 2.1547
export const TREFOIL_GROUP_GAP_MULT = 2.15; // min. spacing between groups, ×OD

export const STANDARD_WIDTHS_IN = [6, 9, 12, 18, 24, 30, 36, 42, 48];
export const STANDARD_DEPTHS_IN = [3, 4, 5, 6];

export const CATEGORIES = [
  ["lv-single", "LV · Single-conductor"],
  ["lv-multi", "LV · Multiconductor (TC/MC)"],
  ["mv-single", "MV · Single-conductor"],
  ["mv-multi", "MV · Multiconductor (3C)"],
  ["vfd-single", "VFD · Single-conductor (drive output)"],
  ["vfd-multi", "VFD · Multiconductor (shielded drive cable)"],
];

export const isSingleConductorCategory = (cat) => cat === "lv-single" || cat === "mv-single" || cat === "vfd-single";
export const isVfdCategory = (cat) => cat === "vfd-single" || cat === "vfd-multi";
export const isMvCategory = (cat) => cat === "mv-single" || cat === "mv-multi";

export function arrangementOptions(category) {
  return isSingleConductorCategory(category)
    ? [
        ["touching", "Touching (contiguous, single layer)"],
        ["spaced1", "Single layer, spaced ≥ 1×OD"],
        ["trefoil", "Trefoil group (spacing ≥ 2.15×OD between groups)"],
      ]
    : [
        ["auto", "Auto (per size — 392.22(A))"],
        ["singleLayer", "Force single layer (sum of diameters)"],
      ];
}

// Default label for the quantity field, since it means "conductors" for
// touching/spaced arrangements but "trefoil groups" (packages of 3) for
// trefoil grouping — mirrors how a real engineer would specify "1 trefoil of
// 300 kcmil" as a single package rather than 3 separate conductor rows.
export function qtyLabel(category, arrangement) {
  if (isSingleConductorCategory(category) && arrangement === "trefoil") return "Trefoil groups (packages of 3)";
  if (isSingleConductorCategory(category)) return "Conductors";
  return "Cables";
}

/* ------------------------------ per-line calc ----------------------------- */

// Computes the tray-width contribution (in), the depth a single item needs
// (in, for the "does it fit under the rails" check) and, for area-fill
// multiconductor cables, the raw area (in²) for transparency in the UI.
export function computeLine(line) {
  const od = Number(line.odIn) || 0;
  const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
  if (!(od > 0) || qty <= 0) return { widthIn: 0, depthIn: 0, areaIn2: null, conductorsTotal: 0 };

  if (isSingleConductorCategory(line.category)) {
    if (line.arrangement === "trefoil") {
      const bundleOD = od * TREFOIL_BUNDLE_MULT;
      const gap = od * TREFOIL_GROUP_GAP_MULT;
      const widthIn = qty * bundleOD + Math.max(0, qty - 1) * gap;
      return { widthIn, depthIn: bundleOD, areaIn2: null, conductorsTotal: qty * 3, groups: qty };
    }
    if (line.arrangement === "spaced1") {
      const widthIn = (2 * qty - 1) * od;
      return { widthIn, depthIn: od, areaIn2: null, conductorsTotal: qty };
    }
    // touching
    return { widthIn: qty * od, depthIn: od, areaIn2: null, conductorsTotal: qty };
  }

  // Multiconductor cable.
  const cls = line.arrangement === "singleLayer" ? "large" : multiSizeClass(line.size);
  if (cls === "large") {
    return { widthIn: qty * od, depthIn: od, areaIn2: null, conductorsTotal: qty, cls };
  }
  const ratio = cls === "col1" ? AREA1_PER_IN : AREA2_PER_IN;
  const areaIn2 = qty * (Math.PI / 4) * od * od;
  return { widthIn: areaIn2 / ratio, depthIn: od, areaIn2, conductorsTotal: qty, cls, ratio };
}

/* -------------------------------- tray totals ------------------------------ */

export function computeTray(lines, trayWidthIn, reservePct) {
  const rows = lines.map((l) => ({ ...l, calc: computeLine(l) }));
  const totalWidthIn = rows.reduce((s, r) => s + r.calc.widthIn, 0);
  const maxDepthNeededIn = rows.reduce((m, r) => Math.max(m, r.calc.depthIn || 0), 0);
  const usableWidthIn = trayWidthIn * (1 - reservePct);
  const fillPct = trayWidthIn > 0 ? (totalWidthIn / trayWidthIn) * 100 : 0;
  const fits = totalWidthIn <= usableWidthIn + 1e-9;
  const hasVfd = rows.some((r) => isVfdCategory(r.category) && r.calc.widthIn > 0);
  const hasNonVfd = rows.some((r) => !isVfdCategory(r.category) && r.calc.widthIn > 0);
  return {
    rows, totalWidthIn, usableWidthIn, trayWidthIn, reservePct, fillPct, fits,
    maxDepthNeededIn, mixesVfdWithOthers: hasVfd && hasNonVfd,
  };
}

// Smallest standard width whose usable (post-reserve) width covers the total.
export function suggestWidth(totalWidthIn, reservePct, widths = STANDARD_WIDTHS_IN) {
  if (!(totalWidthIn > 0)) return widths[0];
  const needed = totalWidthIn / (1 - reservePct);
  return widths.find((w) => w >= needed) ?? null;
}

export function suggestDepth(maxDepthNeededIn, depths = STANDARD_DEPTHS_IN) {
  if (!(maxDepthNeededIn > 0)) return depths[0];
  return depths.find((d) => d >= maxDepthNeededIn) ?? null;
}

/* ------------------------- arrangement suggestion -------------------------- */

// Greedily switches single-conductor lines (in groups of 3 conductors) from
// their current arrangement to trefoil grouping — the most space-efficient
// NEC-valid arrangement for 3-conductor sets — until the total fits the
// target usable width, or no more candidates are left.
export function suggestArrangement(lines, targetUsableWidthIn) {
  const working = lines.map((l) => ({ ...l }));
  const totalOf = (list) => list.reduce((s, l) => s + computeLine(l).widthIn, 0);

  const candidates = working
    .map((l, i) => ({ i, l }))
    .filter(({ l }) => isSingleConductorCategory(l.category) && l.arrangement !== "trefoil" && l.qty >= 3 && l.qty % 3 === 0)
    .map(({ i, l }) => {
      const before = computeLine(l).widthIn;
      const afterLine = { ...l, arrangement: "trefoil", qty: l.qty / 3 };
      const after = computeLine(afterLine).widthIn;
      return { i, savingsIn: before - after, afterLine };
    })
    .filter((c) => c.savingsIn > 1e-6)
    .sort((a, b) => b.savingsIn - a.savingsIn);

  const changedIds = [];
  for (const c of candidates) {
    if (totalOf(working) <= targetUsableWidthIn) break;
    working[c.i] = c.afterLine;
    changedIds.push(working[c.i].id);
  }
  return { lines: working, changedIds, totalWidthIn: totalOf(working), fits: totalOf(working) <= targetUsableWidthIn };
}

/* --------------------------------- cable OD DB ------------------------------ */

// Loads apps/neher/data/cables.json (the same engineering DB apps/conduit-fill
// reads) and returns { lv: {size: od}, mv: {size: od} } lookup maps for
// single-conductor default outer diameters. `baseUrl` must be the calling
// module's import.meta.url — both in dev (served from src/) and in the built
// app (bundled into dist/assets/) it sits exactly one folder below the app
// root, and apps/neher is a sibling of that app root, hence "../../".
export async function loadCableOdDb(baseUrl) {
  const response = await fetch(new URL("../../neher/data/cables.json", baseUrl));
  if (!response.ok) throw new Error("Unable to load the cable OD database.");
  const data = await response.json();
  const toMap = (arr) => Object.fromEntries(arr.filter((c) => c.OD > 0).map((c) => [c.size, c.OD]));
  return { lv: toMap(data.low_voltage), mv: toMap(data.medium_voltage) };
}
