// Tray model, per-compartment evaluation and size suggestion. Inches throughout.
import {necFill} from './nec.js';
import {planLayout, checkFit, layoutOf, DEFAULT_LAYOUT, MULTI_LAYOUTS, SINGLE_LAYOUTS} from './arrangement.js';

const EPS = 1e-9;
export const STANDARD_WIDTHS = Object.freeze([6, 9, 12, 18, 24, 30, 36, 42, 48]);
export const STANDARD_DEPTHS = Object.freeze([3, 4, 5, 6]);
export const TRAY_TYPES = Object.freeze({ladder: 'Ladder', ventilated: 'Ventilated trough', solid: 'Solid bottom'});

// Only what the drawing and the math need is kept from a catalog record.
const CABLE_FIELDS = ['id', 'spec', 'stock', 'title', 'category', 'voltage', 'conductors', 'size', 'sizeKcmil', 'odIn', 'weightLbKft', 'material', 'insulation', 'sourceUrl', 'pdfUrl'];
export const cableSnapshot = c => Object.fromEntries(CABLE_FIELDS.filter(k => c[k] !== undefined).map(k => [k, c[k]]));

export function blankTray(newId) {
  return {version: 2, trayTag: 'CT-001', widthIn: 24, depthIn: 4, trayType: 'ladder', covered: false,
    dividerThicknessIn: 0.125, reserve: 0, dividers: [],
    compartments: [{id: newId(), name: 'Compartment A', ...DEFAULT_LAYOUT}], cables: []};
}

/** Clear width of each compartment; divider thickness is deducted. */
export function compartmentsOf(t) {
  let start = 0;
  return t.compartments.map((c, i) => {
    const end = i < t.dividers.length ? t.dividers[i] - t.dividerThicknessIn / 2 : t.widthIn;
    const section = {...c, startIn: start, widthIn: end - start};
    start = i < t.dividers.length ? t.dividers[i] + t.dividerThicknessIn / 2 : t.widthIn;
    return section;
  });
}

export function validateTray(t) {
  const fail = message => { throw new Error(message); };
  const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!t || t.version !== 2) fail('Unrecognized tray data.');
  if (typeof t.trayTag !== 'string' || t.trayTag.length > 50) fail('Tray tag must be up to 50 characters.');
  if (!finite(t.widthIn, .5, 120) || !finite(t.depthIn, .25, 24)) fail('Width must be 0.5–120 in. Depth must be 0.25–24 in.');
  if (!finite(t.dividerThicknessIn, 0, 1)) fail('Divider thickness must be between 0 and 1 in.');
  if (!finite(t.reserve, 0, 75)) fail('Spare reserve must be between 0% and 75%.');
  if (!TRAY_TYPES[t.trayType]) fail('Invalid tray type.');
  if (typeof t.covered !== 'boolean') fail('Cover must be on or off.');
  if (!Array.isArray(t.dividers) || !Array.isArray(t.compartments) || t.dividers.length > 11 || t.compartments.length !== t.dividers.length + 1) fail('Use 1 to 12 compartments separated by dividers.');
  if (t.dividers.some((d, i) => !finite(d, 0, t.widthIn) || (i && d <= t.dividers[i - 1]))) fail('Divider positions must be increasing and inside the tray.');
  const ids = new Set(t.compartments.map(c => c.id));
  if (ids.size !== t.compartments.length || t.compartments.some(c => typeof c.id !== 'string' || !c.id || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 40)) fail('Each compartment needs a unique name (up to 40 characters).');
  if (t.compartments.some(c => !MULTI_LAYOUTS[c.multiLayout] || !SINGLE_LAYOUTS[c.singleLayout])) fail('Invalid cable arrangement.');
  if (compartmentsOf(t).some(c => c.widthIn < .25 - 1e-8)) fail('Each compartment must have at least 0.25 in of clear width.');
  if (!Array.isArray(t.cables) || t.cables.length > 500) fail('Invalid cable list (maximum 500 rows).');
  const rowIds = new Set();
  for (const r of t.cables) {
    if (typeof r.id !== 'string' || !r.id || rowIds.has(r.id)) fail('Each cable row must have a unique ID.');
    rowIds.add(r.id);
    if (!ids.has(r.compartmentId)) fail('A cable is assigned to a compartment that does not exist.');
    if (!Number.isInteger(r.qty) || !finite(r.qty, 1, 9999)) fail('Quantity must be a whole number from 1 to 9,999.');
    const c = r.cable;
    if (!c || !finite(c.odIn, .001, 24) || !Number.isInteger(c.conductors) || c.conductors < 1) fail('Missing or invalid cable data.');
  }
  return t;
}

/** Scale compartment widths proportionally to a new tray width. */
export function resizeTray(t, width) {
  const old = compartmentsOf(t);
  const available = width - t.dividers.length * t.dividerThicknessIn;
  const oldAvailable = t.widthIn - t.dividers.length * t.dividerThicknessIn;
  let start = 0;
  const dividers = old.slice(0, -1).map(c => {
    start += c.widthIn / oldAvailable * available;
    const position = start + t.dividerThicknessIn / 2;
    start += t.dividerThicknessIn;
    return position;
  });
  return {...t, widthIn: width, dividers};
}

/**
 * Evaluate one compartment. The spare reserve is applied to both the NEC fill
 * limit and the physical width available to the modeled layout.
 */
export function evaluateCompartment(comp, rows, t) {
  const limit = 1 - (t.reserve || 0) / 100;
  const fill = necFill({widthIn: comp.widthIn, trayType: t.trayType, rows});
  const plan = planLayout(rows, comp);
  const fit = checkFit(plan, comp.widthIn * limit, t.depthIn);
  const weightLbFt = rows.reduce((n, r) => n + (Number.isFinite(r.cable.weightLbKft) ? r.qty * r.cable.weightLbKft / 1000 : 0), 0);
  const problems = [];
  if (fill.rule && fill.ratio > limit + EPS) problems.push(`NEC fill ${fill.ratio === Infinity ? 'exceeds the limit' : (fill.ratio * 100).toFixed(1) + '%'}${t.reserve ? ` is above the ${(limit * 100).toFixed(0)}% allowed with the spare reserve` : ' is above 100%'} (${fill.rule}).`);
  if (!fit.fits) problems.push(`The selected arrangement does not fit ${t.reserve ? 'the width left after the spare reserve' : 'the clear width'} × ${t.depthIn} in usable depth.`);
  const status = !plan.cableCount ? 'empty' : problems.length ? 'over' : 'ok';
  return {comp, rows, fill, plan, fit, weightLbFt, problems, status, layout: layoutOf(comp),
    widthUse: comp.widthIn > 0 ? fit.usedWidthIn / comp.widthIn : 0};
}

export function evaluateTray(t) {
  const results = compartmentsOf(t).map(co => evaluateCompartment(co, t.cables.filter(r => r.compartmentId === co.id), t));
  return {
    results,
    ok: results.every(r => r.status !== 'over'),
    maxRatio: Math.max(0, ...results.map(r => r.fill.ratio ?? 0)),
    cableCount: results.reduce((n, r) => n + r.plan.cableCount, 0),
    weightLbFt: results.reduce((n, r) => n + r.weightLbFt, 0)
  };
}

/**
 * Smallest standard width at the current depth, then at deeper standard
 * depths. Compartment proportions are preserved.
 */
export function suggestSize(t) {
  if (!t.cables.length) return null;
  const depths = [t.depthIn, ...STANDARD_DEPTHS.filter(d => d > t.depthIn + EPS)];
  for (const depthIn of depths) {
    for (const width of STANDARD_WIDTHS) {
      const proposal = {...resizeTray(t, width), depthIn};
      if (compartmentsOf(proposal).some(c => c.widthIn < .25)) continue;
      const evaluation = evaluateTray(proposal);
      if (evaluation.ok) return {tray: proposal, evaluation};
    }
  }
  return null;
}
