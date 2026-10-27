/* TrayLab: NEC 2023 fill checks. Values are in inches, in² and lb/ft.
 * Status is the fill/installation screening result, NOT an ampacity approval.
 * Source material and deliberate scope limits are documented in NEC-NOTES.md.
 */
import {planArrangement, checkPhysicalFit} from './arrangement.js';
export const TABLE_WIDTHS = Object.freeze([2, 4, 6, 8, 9, 12, 16, 18, 20, 24, 30, 36]);
const MULTI_VENT = [2.5, 4.5, 7, 9.5, 10.5, 14, 18.5, 21, 23.5, 28, 35, 42];
const MULTI_SOLID = [2, 3.5, 5.5, 7, 8, 11, 14.5, 16.5, 18.5, 22, 27.5, 33];
const SINGLE_VENT = [2, 4.5, 6.5, 8.5, 9.5, 13, 17.5, 19.5, 21.5, 26, 32.5, 39];
const EPS = 1e-9;
export const SOURCES = Object.freeze([
  {title: 'NFPA · Article 392, public code-development record', url: 'https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2022_NEC_P08_SD_PCStatements.pdf'},
  {title: 'NFPA · 2023 base text in CMP-8 agenda', url: 'https://docinfofiles.nfpa.org/files/AboutTheCodes/70/70_A2025_NEC_P08_FD_MeetingAgenda_0124.pdf'},
  {title: 'Eaton · Cable tray design considerations', url: 'https://www.eaton.com/content/dam/eaton/products/support-systems/cable-management/b-line-cable-tray-design-considerations.pdf'},
  {title: 'NEC · Official NFPA 70', url: 'https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70'}
]);

const positive = x => Number.isFinite(Number(x)) && Number(x) > 0;
const sum = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);
const fmt = x => Number(x.toFixed(3)).toLocaleString('en-US');
export const isMC = c => c.type === 'MC' || c.cableType === 'MC' || /\btype\s+mc\b|\bmetal[- ]clad\b/i.test([c.title, c.insulation, c.cableType].filter(Boolean).join(' '));
export const isMV = c => c.type === 'MV' || /\b(?:type\s+)?MV(?:-\d+)?\b/i.test([c.title,c.insulation,c.cableType].filter(Boolean).join(' '));

/** Convert conventional AWG/kcmil size labels to kcmil without guessing metric sizes. */
export function sizeToKcmil(size) {
  if (typeof size === 'number') return size > 0 ? size : null;
  const text = String(size ?? '').trim().toUpperCase();
  const zeros = text.match(/\b([1-4])\/0\b/);
  if (zeros) return [105.6, 133.1, 167.8, 211.6][Number(zeros[1]) - 1];
  const kcmil = text.match(/([\d,.]+)\s*(?:KCMIL|MCM)/);
  if (kcmil) return Number(kcmil[1].replace(/,/g, ''));
  const awg = text.match(/^(?:#\s*)?(\d{1,2})(?:\s*AWG)?$/);
  if (awg && Number(awg[1]) >= 1 && Number(awg[1]) <= 40) {
    const diameterMil = 5 * Math.pow(92, (36 - Number(awg[1])) / 39);
    return diameterMil * diameterMil / 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(text) && Number(text) >= 250) return Number(text);
  return null;
}

/** Floor non-tabulated widths, deliberately conservative; never interpolate silently. */
export function tabulatedArea(widthIn, kind = 'multi-vent') {
  let index = -1;
  TABLE_WIDTHS.forEach((w, i) => { if (w <= widthIn + EPS) index = i; });
  if (index < 0) return null;
  const table = kind === 'single' ? SINGLE_VENT : kind === 'multi-solid' ? MULTI_SOLID : MULTI_VENT;
  return {area: table[index], tableWidth: TABLE_WIDTHS[index], conservative: Math.abs(TABLE_WIDTHS[index] - widthIn) > EPS};
}

/**
 * qty = number of equal circuit runs; cablesPerRun = physical cables in each run.
 * For 1/C three-phase runs use cablesPerRun=3 (plus separately modeled EGC if used).
 * controlOnly is an explicit statement of circuit function by the designer.
 */
export function calculateNECFill(input = {}) {
  const width = Number(input.widthIn);
  const depth = Number(input.depthIn);
  const trayType = input.trayType || 'ladder';
  const notes = [];
  const failures = [];
  const reviews = [];
  const rows = [];
  const base = {
    status: 'empty', ratio: 0, used: 0, allowed: width || 0, unit: 'in', rule: '—',
    notes, count: 0, areaIn2: 0, sumOdIn: 0, spacingWidthIn: 0,
    spacingEligible: false, weightLbFt: 0, weightComplete: true,
    widthIn: width, depthIn: depth, fillStatus: 'empty', ampacityStatus: 'not-calculated',
    singleLayerRequired: false, largeCableSumOdIn: 0, smallCableAreaIn2: 0,
    tableWidthIn: null, conservativeTable: false
  };
  const finish = () => {
    base.notes = [...new Set([...failures, ...reviews, ...notes])];
    base.status = failures.length ? 'fail' : reviews.length ? 'review' : base.count ? 'pass' : 'empty';
    return base;
  };
  if (!positive(width) || !positive(depth)) {
    failures.push('Enter a clear width and usable depth greater than zero.');
    return finish();
  }
  if (!['ladder', 'ventilated', 'solid'].includes(trayType)) {
    reviews.push('This tray type is not supported by the calculation engine.');
    return finish();
  }
  for (const circuit of input.circuits || []) {
    const c = circuit.cable;
    const q = Number(circuit.qty ?? 1);
    const perRun = Number(circuit.cablesPerRun ?? 1);
    const name = String(circuit.tag || circuit.id || 'Circuit');
    if (!c || !positive(c.odIn) || !Number.isInteger(q) || q < 1 || !Number.isInteger(perRun) || perRun < 1) {
      failures.push(`${name}: invalid cable, diameter, or quantity.`);
      continue;
    }
    const n = q * perRun;
    if (!Number.isSafeInteger(n)) {
      failures.push(`${name}: quantity exceeds the supported calculation precision.`);
      continue;
    }
    const size = positive(c.sizeKcmil) ? Number(c.sizeKcmil) : sizeToKcmil(c.size);
    const isGround = circuit.purpose === 'ground';
    const rated = positive(c.voltage) ? Number(c.voltage) : null;
    const operating = isGround ? null : positive(circuit.voltage) ? Number(circuit.voltage) : rated;
    const conductors = Number(c.conductors);
    if (!size) reviews.push(`${name}: conductor size is unknown; verify the cable data.`);
    if (!rated && !isGround) reviews.push(`${name}: cable voltage rating is unknown.`);
    if (!positive(circuit.voltage) && !isGround) reviews.push(`${name}: enter the operating voltage to check separation and insulation rating.`);
    if (!Number.isInteger(conductors) || conductors < 1) reviews.push(`${name}: conductor count is unknown.`);
    if (rated && operating > rated) failures.push(`${name}: operating voltage exceeds the cable voltage rating.`);
    if (rated > 2000 && !isMC(c) && !isMV(c)) reviews.push(`${name}: Type MV or Type MC identity is not established for the above-2,000 V rule (392.22(C)).`);
    if (isMV(c) && input.industrialQualified !== true) failures.push(`${name}: Type MV cable requires confirmed industrial conditions in 392.10(B)(2).`);
    if (!isGround && c.trayRated === false) failures.push(`${name}: this catalog product is not identified as suitable for cable tray use.`);
    else if (!isGround && c.trayRated !== true) reviews.push(`${name}: confirm listing/marking for cable tray use (392.10).`);
    if (conductors === 1 && size && size < (isGround ? 41.74 : 105.6) - 0.1) {
      failures.push(`${name}: single-conductor cable is below the minimum ${isGround ? '4 AWG for EGC' : '1/0 AWG'} in 392.10(B)(1).`);
    }
    if (isGround) reviews.push('A separate EGC is included in the geometry; review its fill treatment and the rule applicable to the full arrangement.');
    rows.push({c, n, od: Number(c.odIn), size, rated, operating, conductors, name, isGround});
  }
  if (!rows.length) return finish();
  base.count = sum(rows, r => r.n);
  base.areaIn2 = sum(rows, r => r.n * Math.PI * r.od * r.od / 4);
  base.sumOdIn = sum(rows, r => r.n * r.od);
  const maxOD = Math.max(...rows.map(r => r.od));
  // Conservative for unequal diameters: every adjacent gap uses the largest OD.
  base.spacingWidthIn = base.sumOdIn + Math.max(0, base.count - 1) * maxOD;
  base.spacingEligible = base.spacingWidthIn <= width + EPS && maxOD <= depth + EPS;
  base.weightComplete = rows.every(r => Number.isFinite(r.c.weightLbKft) && r.c.weightLbKft >= 0);
  base.weightLbFt = sum(rows, r => Number.isFinite(r.c.weightLbKft) ? r.n * r.c.weightLbKft / 1000 : 0);
  if (!base.weightComplete) notes.push('Partial weight: some items have no catalog weight.');
  if (maxOD > width + EPS || maxOD > depth + EPS) failures.push('A cable exceeds the clear width or usable depth of the compartment.');
  if (base.areaIn2 > width * depth + EPS) failures.push('The physical cable area exceeds the internal compartment area.');
  const highOperating = rows.filter(r => !r.isGround && r.operating > 1000);
  const lowOperating = rows.filter(r => !r.isGround && r.operating <= 1000);
  if (highOperating.length && lowOperating.length && highOperating.some(r => !isMC(r.c))) {
    failures.push('Circuits above 1,000 V and up to 1,000 V share a compartment: 392.20(B) requires a compatible solid, fixed barrier or Type MC cables for circuits above 1,000 V.');
  }
  if (rows.some(r => r.conductors === 1)) {
    notes.push('Single-conductor cables: verify circuit grouping, securing, and the industrial conditions in 392.10(B) and 392.20(C)/(D).');
    if (input.industrialQualified !== true) failures.push('Single-conductor applications require confirmed industrial conditions in 392.10(B).');
    if (rows.some(r => r.conductors === 1 && r.size >= 105.5 && r.size <= 211.7) && trayType === 'ladder') {
      if (!positive(input.rungSpacingIn) || Number(input.rungSpacingIn) > 9 + EPS) failures.push('1/0–4/0 AWG single-conductor cables require a confirmed rung spacing no greater than 9 in (392.10(B)(1)(a)).');
      else notes.push('1/0–4/0 AWG single-conductor cables: maximum tray rung spacing is 9 in.');
    }
  }
  const known = rows.every(r => r.size && r.rated && Number.isInteger(r.conductors) && r.conductors > 0);
  const allMV = known && rows.every(r => r.rated > 2000);
  const someMV = rows.some(r => r.rated > 2000);
  const allSingle = rows.every(r => r.conductors === 1);
  const someSingle = rows.some(r => r.conductors === 1);
  const setCheck = (used, allowed, unit, rule) => {
    base.used = used; base.allowed = Math.max(0, allowed); base.unit = unit; base.rule = rule;
    base.ratio = allowed > 0 ? used / allowed : used > 0 ? Infinity : 0;
    base.fillStatus = base.ratio > 1 + EPS ? 'fail' : 'pass';
    if (base.fillStatus === 'fail') failures.push(`Fill exceeds the limit in ${rule}.`);
  };
  const areaFromTable = kind => {
    const table = tabulatedArea(width, kind);
    if (!table) { reviews.push('Width below 2 in: the fill table does not cover this compartment.'); return null; }
    base.tableWidthIn = table.tableWidth;
    base.conservativeTable = table.conservative;
    if (table.conservative) notes.push(`Non-tabulated width: conservatively using the ${fmt(table.tableWidth)} in table row without interpolation.`);
    return table.area;
  };
  if (rows.some(r => r.isGround)) {
    base.used = base.areaIn2; base.allowed = null; base.ratio = null; base.unit = 'in²'; base.rule = '392.10(B)(1)(c) · EGC'; base.fillStatus = 'review';
  } else if (!known) {
    base.used = base.areaIn2; base.allowed = null; base.ratio = null; base.unit = 'in²'; base.rule = 'Incomplete cable data'; base.fillStatus = 'review';
  } else if (allMV) {
    base.singleLayerRequired = true;
    setCheck(base.sumOdIn, width, 'in', '392.22(C)');
    notes.push('MV/MC cables rated above 2,000 V: single layer; for groups, use the sum of individual cable diameters.');
  } else if (someMV) {
    base.used = base.sumOdIn; base.allowed = width; base.ratio = base.sumOdIn / width; base.rule = '392.22(A)/(B)/(C)';
    base.fillStatus = 'review';
    reviews.push('Cables rated above and at or below 2,000 V are mixed: size separate zones; combined fill is not automated.');
  } else if (allSingle) {
    if (input.controlOnly) reviews.push('The control-only rule applies to multiconductor cables, not single-conductor cables.');
    if (trayType === 'solid') {
      base.used = base.sumOdIn; base.allowed = width; base.ratio = null; base.rule = '392.22(B) / 310.14(B)'; base.fillStatus = 'review';
      reviews.push('LV single-conductor cables in a solid-bottom tray require specific review; the ventilated-tray fill rule was not applied.');
    } else if (rows.some(r => r.size <= 211.7)) {
      base.singleLayerRequired = true;
      setCheck(base.sumOdIn, width, 'in', '392.22(B)(1)(d)');
      notes.push('1/0–4/0 AWG single-conductor cables are present: sum the diameters of ALL single-conductor cables; use a single layer or groups permitted by 392.20(D).');
    } else if (rows.every(r => r.size >= 1000)) {
      base.singleLayerRequired = true;
      setCheck(base.sumOdIn, width, 'in', '392.22(B)(1)(a)');
    } else {
      const cap = areaFromTable('single');
      const large = rows.filter(r => r.size >= 1000);
      const smaller = rows.filter(r => r.size < 1000);
      base.largeCableSumOdIn = sum(large, r => r.n * r.od);
      base.smallCableAreaIn2 = sum(smaller, r => r.n * Math.PI * r.od * r.od / 4);
      if (smaller.some(r => r.size < 250 || r.size > 900)) reviews.push('Single-conductor size is outside the tabulated 250–900 kcmil range: confirm the applicable rule.');
      if (cap !== null) setCheck(base.smallCableAreaIn2, cap - 1.1 * base.largeCableSumOdIn, 'in²', large.length ? '392.22(B)(1)(c)' : '392.22(B)(1)(b)');
      if (base.largeCableSumOdIn > width + EPS) failures.push('The sum of diameters of single-conductor cables ≥1,000 kcmil exceeds the width.');
      if (large.length) notes.push('Area available for smaller cables = tabulated area − 1.1 × sum of diameters of cables ≥1,000 kcmil.');
    }
  } else if (someSingle) {
    base.used = base.areaIn2; base.allowed = null; base.ratio = null; base.unit = 'in²'; base.rule = '392.80(A)(3)'; base.fillStatus = 'review';
    reviews.push('Single-conductor and multiconductor cables share a compartment: verify the sum of relative fills and arrangements in 392.80(A)(3); combined fill is not automated.');
  } else if (input.controlOnly) {
    if (rows.some(r => ['vfd', 'mv'].includes(r.c.category))) reviews.push('Confirm the control/signal function of all circuits; a VFD/MV cable was assigned to a control-only compartment.');
    const fraction = trayType === 'solid' ? 0.4 : 0.5;
    setCheck(base.areaIn2, width * Math.min(depth, 6) * fraction, 'in²', trayType === 'solid' ? '392.22(A)(4)' : '392.22(A)(2)');
    notes.push(`Control/signal-only use declared by the user; limit ${fraction * 100}% and calculation depth capped at 6 in.`);
  } else {
    const large = rows.filter(r => r.size >= 211.5);
    const small = rows.filter(r => r.size < 211.5);
    const section = trayType === 'solid' ? '392.22(A)(3)' : '392.22(A)(1)';
    base.largeCableSumOdIn = sum(large, r => r.n * r.od);
    base.smallCableAreaIn2 = sum(small, r => r.n * Math.PI * r.od * r.od / 4);
    if (!small.length) {
      base.singleLayerRequired = true;
      setCheck(base.sumOdIn, width * (trayType === 'solid' ? 0.9 : 1), 'in', `${section}(a)`);
      notes.push('Multiconductor cables with conductors ≥4/0 AWG must remain in a single layer.');
    } else {
      const cap = areaFromTable(trayType === 'solid' ? 'multi-solid' : 'multi-vent');
      const multiplier = trayType === 'solid' ? 1 : 1.2;
      if (cap !== null) setCheck(base.smallCableAreaIn2, cap - multiplier * base.largeCableSumOdIn, 'in²', large.length ? `${section}(c)` : `${section}(b)`);
      if (large.length) {
        notes.push(`Smaller cable area ≤ tabulated area − ${fmt(multiplier)} × sum of diameters of cables with conductors ≥4/0 AWG. Larger cables remain in a single layer with no cables above them.`);
        if (base.largeCableSumOdIn > width + EPS) failures.push('Cables with conductors ≥4/0 AWG do not fit in a single layer within the available width.');
      }
    }
  }
  notes.push('Ampacity is not calculated: verify 392.80, temperature, terminals, and actual installation conditions.');
  if (input.spacing === 'one-diameter') {
    base.singleLayerRequired = true;
    notes.push(`Spaced arrangement: estimated width ${fmt(base.spacingWidthIn)} in; each gap is 1× the largest cable diameter. This does not establish ampacity.`);
    if (!base.spacingEligible) failures.push('The width/depth cannot accommodate the selected single layer with one-diameter clear spacing.');
    if (input.covered) reviews.push('Covered tray: the uncovered-tray condition for spaced-cable ampacity is not met.');
    if (trayType === 'solid') reviews.push('Solid bottom: verify specific thermal requirements; geometric spacing does not establish free-air ampacity.');
  }
  return finish();
}

/** Application check: NEC fill, mandatory project arrangement, then geometry.
 * The fill-only engine remains separately testable and never treats a bundle
 * envelope as the three individual cable diameters required by 392.22.
 */
export function calculateCompartment(input = {}) {
  const result = calculateNECFill({...input, spacing:'touching'});
  const plan = planArrangement(input.circuits || [], input, result.singleLayerRequired);
  const physicalFit = checkPhysicalFit(plan,result.widthIn,result.depthIn,result);
  const geometryFits = physicalFit.fits;
  const failures = [...plan.issues];
  const reviews = [];
  const notes = [];
  if (plan.linear && !geometryFits) failures.push(`Selected arrangement requires ${fmt(plan.widthIn)} in clear width and ${fmt(plan.heightIn)} in usable depth. It does not fit this compartment.`);
  if (!plan.linear && !geometryFits) failures.push('The modeled cable packing does not fit the usable width/depth. Increase the compartment dimensions or revise the layout; an area-only fill pass is insufficient.');
  if (plan.trefoilGroups) {
    notes.push(`Project rule: 4/0 AWG and larger non-VFD phase cables use touching trefoils of three 1/C cables. ${plan.trefoilGroups} trefoil group(s); selected group clearance ${plan.settings.trefoilSpacing}. D is one cable's outside diameter.`);
    notes.push('Groups occupy one layer. Gap = selected multiplier × the larger adjacent cable OD; the higher spacing requirement governs at mixed boundaries. No extra gap is added at tray walls or across dividers.');
  }
  if (plan.vfdCables) notes.push(`VFD cables remain multiconductor cables in one layer: ${plan.settings.vfdSpacing === '1D' ? '1D clear spacing' : 'touching permitted'}. VFD spacing is independent of the trefoil setting.`);
  const thermal = [];
  const groups = plan.segments.filter(s=>s.kind==='trefoil');
  const freeAirContext = !input.covered && input.trayType !== 'solid';
  if (groups.length) {
    const routes = [...new Set(groups.map(s=>s.rated > 2000 ? '392.80(B)(2)(3)' : '392.80(A)(2)(d)'))].join(' / ');
    const meetsGap = plan.settings.trefoilSpacing === '2.15D';
    thermal.push({kind:'trefoil',status:meetsGap&&geometryFits&&freeAirContext?'geometry-only':'review',rule:routes,
      message:!meetsGap ? `The 1D trefoil preset does not qualify for the 2.15D grouped route or the individually spaced route. For LV singles, the ordinary-tray reductions in 392.80(A)(2)(a)/(b) may apply; declare the method used externally.` : `For LV cables, 392.80(A)(2)(d) refers to messenger-supported conductors: Table 310.20, based on 40°C (104°F) ambient. Do not substitute unadjusted Table 310.17. For MV groups, use 315.60(C)(1)/(2) under 392.80(B)(2)(3). Uncovered installation, retained clearance, table conditions and temperature corrections must match the external design.`});
  }
  const vfds = plan.segments.filter(s=>s.kind==='vfd');
  if(vfds.length) thermal.push({kind:'vfd',status:'review',rule:[...new Set(vfds.map(s=>s.rated>2000?'392.80(B)(1)':'392.80(A)(1)'))].join(' / '),
    message:plan.settings.vfdSpacing==='1D'?'VFD 1D spacing is between complete multiconductor cable jackets. For LV cables, review 392.80(A)(1)(c); for MV, 392.80(B)(1)(2). Do not apply single-conductor ampacity tables to VFD multiconductor cables.':'Touching VFD cables require the applicable multiconductor ampacity method and adjustments. This setting does not qualify for the spaced-cable route.'});
  if (plan.segments.some(s=>s.factor>0)) {
    if (input.covered) notes.push('Covered tray: geometry alone does not qualify for an uncovered spaced-cable ampacity route. The declared external method must address the cover.');
    if (input.trayType === 'solid') notes.push('Solid bottom: geometric spacing alone does not establish a thermal method. The declared external method is checked separately.');
  }
  if (plan.settings.spacing === 'one-diameter' && plan.segments.some(s=>s.kind==='cable')) notes.push('Other individual cables use 1D clear spacing in one layer. This setting does not override the separate trefoil or VFD spacing selections.');
  result.notes = [...new Set([...failures,...reviews,...result.notes,...notes])];
  result.status = failures.length || result.status==='fail' ? 'fail' : reviews.length || result.status==='review' ? 'review' : result.status;
  return {...result, arrangement:plan, geometryStatus:!plan.cableCount?'empty':geometryFits?'pass':'fail',
    policyStatus:plan.issues.length?'fail':'pass', thermal,
    arrangementWidthIn:plan.linear?plan.widthIn:null, arrangementHeightIn:plan.heightIn,
    spacingWidthIn:plan.widthIn,spacingEligible:geometryFits};
}
