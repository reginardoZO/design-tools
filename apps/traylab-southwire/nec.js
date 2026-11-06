/* TrayLab: NEC 2023 392.22 cable tray fill. Inches, in² and kcmil.
 * Pure geometry/area math. No ampacity, voltage-drop, temperature or
 * installation-condition checks: cables are assumed to be already sized.
 */
export const TABLE_WIDTHS = Object.freeze([2, 4, 6, 8, 9, 12, 16, 18, 20, 24, 30, 36]);
const MULTI_VENT = [2.5, 4.5, 7, 9.5, 10.5, 14, 18.5, 21, 23.5, 28, 35, 42];   // Table 392.22(A) col. 1
const MULTI_SOLID = [2, 3.5, 5.5, 7, 8, 11, 14.5, 16.5, 18.5, 22, 27.5, 33];   // Table 392.22(A) col. 3
const SINGLE_VENT = [2, 4.5, 6.5, 8.5, 9.5, 13, 17.5, 19.5, 21.5, 26, 32.5, 39]; // Table 392.22(B)(1) col. 1
const EPS = 1e-9;
const KCMIL_4_0 = 211.6;

/** Convert AWG/kcmil labels to kcmil without guessing metric sizes. */
export function sizeToKcmil(size) {
  if (typeof size === 'number') return size > 0 ? size : null;
  const text = String(size ?? '').trim().toUpperCase();
  const zeros = text.match(/\b([1-4])\/0\b/);
  if (zeros) return [105.6, 133.1, 167.8, 211.6][Number(zeros[1]) - 1];
  const kcmil = text.match(/([\d,.]+)\s*(?:KCMIL|MCM)/);
  if (kcmil) return Number(kcmil[1].replace(/,/g, ''));
  const awg = text.match(/^(?:#\s*)?(\d{1,2})(?:\s*AWG)?$/);
  if (awg && Number(awg[1]) >= 1 && Number(awg[1]) <= 40) {
    const mil = 5 * Math.pow(92, (36 - Number(awg[1])) / 39);
    return mil * mil / 1000;
  }
  if (/^\d+(?:\.\d+)?$/.test(text) && Number(text) >= 250) return Number(text);
  return null;
}
export const kcmilOf = cable => Number(cable?.sizeKcmil) > 0 ? Number(cable.sizeKcmil) : sizeToKcmil(cable?.size);

/**
 * Keep the published area at each tabulated width. Between rows, use a linear
 * engineering interpolation of the area at the actual clear width, including
 * the width lost to dividers. Rounding 11.9375 in down to the 9 in row creates
 * an artificial loss of nearly 25% of the capacity. No extrapolation outside
 * the table: below 2 in is unsupported, above 36 in remains capped at 36 in.
 * Interpolation is an engineering treatment, not an express NEC instruction.
 * Basis: Eaton Cable Tray Manual, MAN-23 and MAN-44 (area/required-width method).
 * See README.md for sources and the distinction from published table rows.
 */
export function tabulatedArea(widthIn, kind = 'multi-vent') {
  const width = Number(widthIn);
  if (!Number.isFinite(width)) return null;
  let index = -1;
  TABLE_WIDTHS.forEach((w, i) => { if (w <= width + EPS) index = i; });
  if (index < 0) return null;
  const table = kind === 'single' ? SINGLE_VENT : kind === 'multi-solid' ? MULTI_SOLID : MULTI_VENT;
  const lowerWidth = TABLE_WIDTHS[index];
  if (Math.abs(width - lowerWidth) <= EPS || index === TABLE_WIDTHS.length - 1) {
    return {area: table[index], tableWidth: lowerWidth, interpolated: false,
      conservative: width > lowerWidth + EPS};
  }
  const upperWidth = TABLE_WIDTHS[index + 1];
  const fraction = (width - lowerWidth) / (upperWidth - lowerWidth);
  return {area: table[index] + fraction * (table[index + 1] - table[index]),
    tableWidth: null, lowerWidth, upperWidth, interpolated: true, conservative: false};
}

const sum = (items, fn) => items.reduce((total, x) => total + fn(x), 0);
const round = x => Number(x.toFixed(3)).toLocaleString('en-US');

/**
 * NEC fill of one compartment. rows = [{cable, qty}], qty = physical cables.
 * Returns rule: null when NEC 392.22 has no rule for the combination; the
 * physical layout check then governs alone.
 */
export function necFill({widthIn, trayType = 'ladder', rows = []} = {}) {
  const width = Number(widthIn);
  const notes = [];
  const items = rows.filter(r => Number(r.qty) > 0 && Number(r.cable?.odIn) > 0).map(r => ({
    n: Number(r.qty), od: Number(r.cable.odIn), k: kcmilOf(r.cable),
    single: r.cable.conductors === 1, mv: Number(r.cable.voltage) > 2000
  }));
  const out = {rule: null, used: 0, allowed: null, unit: '', ratio: null, notes,
    count: sum(items, x => x.n), areaIn2: sum(items, x => x.n * Math.PI * x.od * x.od / 4), sumOdIn: sum(items, x => x.n * x.od)};
  if (!items.length) { out.ratio = 0; return out; }
  const set = (used, allowed, unit, rule) => {
    Object.assign(out, {used, allowed: Math.max(0, allowed), unit, rule});
    out.ratio = allowed > 0 ? used / allowed : Infinity;
  };
  const table = kind => {
    const t = tabulatedArea(width, kind);
    if (!t) { notes.push('Clear width under 2 in is below the NEC fill tables. Only the physical layout is checked.'); return null; }
    if (t.interpolated) notes.push(`Non-tabulated clear width: ${round(t.area)} in² at ${round(width)} in, by engineering interpolation between the ${round(t.lowerWidth)} and ${round(t.upperWidth)} in table rows. Interpolation is not an express NEC instruction.`);
    if (t.conservative) notes.push(`Clear width exceeds the table range: allowable area is capped at the ${round(t.tableWidth)} in table row (no extrapolation).`);
    return t.area;
  };
  const solid = trayType === 'solid';

  if (items.every(x => x.mv)) {
    set(out.sumOdIn, width, 'in', '392.22(C)');
    notes.push('Cables above 2,000 V: sum of cable diameters ≤ tray width, single layer.');
  } else if (items.some(x => x.mv)) {
    notes.push('Cables above and up to 2,000 V share this compartment. NEC 392.22 has no combined fill rule, so only the physical layout is checked. Use a divider to get a fill result for each group.');
  } else if (items.every(x => x.single)) {
    if (solid) {
      notes.push('NEC 392.22(B) gives single-conductor fill for ladder and ventilated trays only. Only the physical layout is checked.');
    } else if (items.some(x => x.k <= KCMIL_4_0 + 0.1)) {
      set(out.sumOdIn, width, 'in', '392.22(B)(1)(d)');
      notes.push('Singles 4/0 AWG and smaller present: sum of diameters of all single conductors ≤ tray width, single layer.');
    } else if (items.every(x => x.k >= 1000)) {
      set(out.sumOdIn, width, 'in', '392.22(B)(1)(a)');
      notes.push('Singles 1,000 kcmil and larger: sum of diameters ≤ tray width, single layer.');
    } else {
      const cap = table('single');
      const largeOd = sum(items.filter(x => x.k >= 1000), x => x.n * x.od);
      const smallArea = sum(items.filter(x => x.k < 1000), x => x.n * Math.PI * x.od * x.od / 4);
      if (cap !== null) set(smallArea, cap - 1.1 * largeOd, 'in²', largeOd ? '392.22(B)(1)(c)' : '392.22(B)(1)(b)');
      if (largeOd) notes.push('Allowable area for 250–900 kcmil singles = table area − 1.1 × sum of diameters of 1,000 kcmil and larger.');
    }
  } else if (items.every(x => !x.single)) {
    const section = solid ? '392.22(A)(3)' : '392.22(A)(1)';
    const large = items.filter(x => x.k >= KCMIL_4_0 - 0.1);
    const small = items.filter(x => !(x.k >= KCMIL_4_0 - 0.1));
    const largeOd = sum(large, x => x.n * x.od);
    if (!small.length) {
      set(largeOd, width * (solid ? 0.9 : 1), 'in', `${section}(a)`);
      notes.push('Multiconductor cables 4/0 AWG and larger: sum of diameters, single layer.');
    } else {
      const cap = table(solid ? 'multi-solid' : 'multi-vent');
      const k = solid ? 1 : 1.2;
      const smallArea = sum(small, x => x.n * Math.PI * x.od * x.od / 4);
      if (cap !== null) set(smallArea, cap - k * largeOd, 'in²', large.length ? `${section}(c)` : `${section}(b)`);
      if (large.length) notes.push(`Allowable area = table area − ${k} × sum of diameters of 4/0 AWG and larger cables.`);
    }
  } else {
    notes.push('Single-conductor and multiconductor cables share this compartment. NEC 392.22 has no combined fill rule, so only the physical layout is checked. Use a divider to get a fill result for each group.');
  }
  return out;
}
