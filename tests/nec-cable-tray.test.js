/**
 * Sanity checks for the NEC cable tray engine, worked by hand from the code
 * tables so a bad edit to the data or the derating chain gets caught.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeLoad,
  computeSizing,
  ambientCorrection,
  adjustmentFactor,
  egcSizing,
  vdPercent,
} from '../apps/nec-cable-tray/src/engine.js';

const near = (actual, expected, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);

test('motor load uses table FLC and the 430.22 multiplier', () => {
  const load = computeLoad({ type: 'motor', motorMode: 'table', phases: 3, hp: '100', motorV: 460 });
  near(load.fla, 124); // Table 430.250, 100 HP @ 460 V
  near(load.design, 155); // 124 x 1.25
});

test('feeder load applies 125% only to the continuous part', () => {
  const load = computeLoad({ type: 'feeder', contA: '150', nonContA: '50' });
  near(load.fla, 200);
  near(load.design, 237.5); // 1.25*150 + 50
});

test('generator kW rating converts through power factor at 115%', () => {
  const load = computeLoad({
    type: 'generator', phases: 3, rating: '400', ratingUnit: 'kW', pf: '0.8', voltage: '480',
  });
  const expectedFla = (400 / 0.8) * 1000 / (Math.sqrt(3) * 480);
  near(load.fla, expectedFla, 1e-9);
  near(load.design, expectedFla * 1.15, 1e-9);
});

test('ambient correction: table bands round up to the band top', () => {
  // 42 C sits in the 41-45 band -> uses 45 C. sqrt((90-45)/(90-30)) = 0.866 -> 0.87
  near(ambientCorrection(90, 42, 30, 'table'), 0.87);
  // The exact equation is not rounded and uses the real ambient.
  near(ambientCorrection(90, 42, 30, 'equation'), Math.sqrt((90 - 42) / (90 - 30)), 1e-12);
  // Ambient at or above the conductor rating leaves no ampacity.
  assert.equal(ambientCorrection(90, 90, 30, 'equation'), 0);
});

test('adjustment factors follow Table 310.15(C)(1)', () => {
  assert.equal(adjustmentFactor(3), 1.0);
  assert.equal(adjustmentFactor(6), 0.8);
  assert.equal(adjustmentFactor(9), 0.7);
  assert.equal(adjustmentFactor(20), 0.5);
  assert.equal(adjustmentFactor(41), 0.35);
});

test('LV multiconductor touching in an uncovered tray uses Table 310.16 unmodified', () => {
  const result = computeSizing({
    designI: 155, ambient: 30, insTemp: 90, termTemp: 75, vClass: 'lv',
    construction: 'multi', arrangement: 'touching', covered: false,
    ccc: 3, maxSets: 4, maxSize: '1000', ambMethod: 'table', vd: { on: false },
  });

  assert.equal(result.method.baseTableName, 'Table 310.16');
  assert.equal(result.kAmb, 1); // 30 C ambient, 30 C basis
  assert.equal(result.kAdj, 1); // 3 CCC
  const row = result.rows.find((r) => r.size === '4/0');
  near(row.base, 260); // 310.16, 90 C column
  near(row.termAmp, 230); // 110.14(C) cap at 75 C
  near(row.allowed, 230); // termination governs

  // The 90 C base is derated to nothing here, so the 75 C termination column
  // decides: 2/0 is the first size at or above 155 A (175 A), not 1/0 (150 A).
  assert.equal(result.recommended.n, 1);
  assert.equal(result.recommended.row.size, '2/0');
  near(result.recommended.row.allowed, 175);
  assert.equal(result.recommended.governing, 'ampacity');
});

test('NEC 110.14(C) termination cap is applied by default and can be explicitly overridden', () => {
  const cfg = {
    designI: 650, ambient: 45, insTemp: 90, termTemp: 75, vClass: 'lv',
    construction: 'single', arrangement: 'trefoil215', covered: false,
    ccc: 3, maxSets: 1, maxSize: '700', ambMethod: 'table', vd: { on: false },
  };

  const applied = computeSizing(cfg);
  const appliedExplicitly = computeSizing({ ...cfg, applyNec11014TerminationLimit: true });
  const overridden = computeSizing({ ...cfg, applyNec11014TerminationLimit: false });
  const appliedRow = applied.rows.find((r) => r.size === '700');
  const overriddenRow = overridden.rows.find((r) => r.size === '700');

  near(appliedRow.base, 714); // Table 310.20, 90 C column
  near(appliedRow.derated, 678.3);
  near(appliedRow.termAmp, 460); // Table 310.16, 75 C termination value
  near(appliedRow.allowed, 460);
  near(appliedExplicitly.rows.find((r) => r.size === '700').allowed, 460);
  assert.equal(applied.recommended, null);

  near(overriddenRow.termAmp, 460); // retained for information
  near(overriddenRow.allowed, 678.3);
  assert.equal(overridden.recommended.n, 1);
  assert.equal(overridden.recommended.row.size, '700');
});

test('covered tray applies the 95% factor and a solid cover blocks nothing else', () => {
  const cfg = {
    designI: 100, ambient: 30, insTemp: 90, termTemp: 90, vClass: 'lv',
    construction: 'multi', arrangement: 'touching', ccc: 3, maxSets: 1,
    maxSize: '1000', ambMethod: 'table', vd: { on: false },
  };
  const open = computeSizing({ ...cfg, covered: false });
  const covered = computeSizing({ ...cfg, covered: true });
  near(open.rows.find((r) => r.size === '2').tf, 1.0);
  near(covered.rows.find((r) => r.size === '2').tf, 0.95);
});

test('LV single conductors touching derate Table 310.17 by size band', () => {
  const result = computeSizing({
    designI: 400, ambient: 30, insTemp: 90, termTemp: 90, vClass: 'lv',
    construction: 'single', arrangement: 'touching', covered: false,
    ccc: 3, maxSets: 1, maxSize: '1000', ambMethod: 'table', vd: { on: false },
  });

  assert.equal(result.method.baseTableName, 'Table 310.17 (free air)');
  // 1/0-500 kcmil -> 65%; 600 kcmil and up -> 75% (uncovered).
  near(result.rows.find((r) => r.size === '500').tf, 0.65);
  near(result.rows.find((r) => r.size === '600').tf, 0.75);
  // Sizes below 1/0 are not offered [392.10(B)(1)].
  assert.equal(result.rows.some((r) => r.size === '2'), false);
});

test('MV 15 kV 3-conductor cable is capped on the 90 C column per 110.40', () => {
  const result = computeSizing({
    designI: 300, ambient: 40, insTemp: 105, termTemp: 90, vClass: 'mv15',
    construction: 'multi', arrangement: 'touching', covered: false,
    ccc: 3, maxSets: 1, maxSize: '1000', ambMethod: 'table', vd: { on: false },
    applyNec11014TerminationLimit: false, // the LV-only override must not bypass 110.40
  });

  assert.equal(result.method.baseTableName, 'Table 315.60(C)(5) (3-conductor cable in air)');
  assert.equal(result.kAmb, 1); // 40 C ambient on a 40 C table basis
  const row = result.rows.find((r) => r.size === '4/0');
  near(row.base, 360); // 105 C column, 5001-35000 V
  near(row.tf, 0.95); // 392.80(B)(1)(a)
  near(row.derated, 360 * 0.95);
  near(row.termAmp, 325); // 90 C column of the same table
  near(row.allowed, 325); // termination governs
});

test('voltage drop can govern over ampacity and is halved by two sets', () => {
  const vd = { on: true, lengthFt: 500, maxPct: 3, volts: 480, pf: 0.85, phases: 3, amps: 200 };
  const one = vdPercent('4/0', 1, vd);
  const two = vdPercent('4/0', 2, vd);
  near(two, one / 2, 1e-12);

  // A long run at a tight 2% limit: no single set can meet it, so the search
  // moves to two sets, where voltage drop still forces 500 kcmil even though
  // ampacity alone would accept 1/0 (the smallest size 310.10(G) permits in
  // parallel).
  const result = computeSizing({
    designI: 250, ambient: 30, insTemp: 90, termTemp: 75, vClass: 'lv',
    construction: 'multi', arrangement: 'touching', covered: false,
    ccc: 3, maxSets: 4, maxSize: '1000', ambMethod: 'table',
    vd: { ...vd, lengthFt: 1200, maxPct: 2 },
  });
  assert.equal(result.solutions[0].row, null, 'one set cannot meet the 2% limit');

  const sol = result.recommended;
  assert.equal(sol.n, 2);
  assert.equal(sol.row.size, '500');
  assert.equal(sol.ampRow.size, '1/0');
  assert.equal(sol.governing, 'voltage drop');
  assert.ok(sol.vdPct <= 2, `${sol.vdPct} should be within the 2% limit`);
});

test('EGC follows Table 250.122 and upsizes proportionally per 250.122(B)', () => {
  assert.equal(egcSizing(200, null, null).finalSize, '6');
  assert.equal(egcSizing(400, null, null).finalSize, '3');

  // Phase upsized 4/0 -> 500 kcmil: area ratio 500/211.6 = 2.363,
  // so the 3 AWG (52.62 kcmil) table EGC must grow to >= 124.4 kcmil -> 2/0.
  const up = egcSizing(400, '500', '4/0');
  assert.equal(up.upsized, true);
  assert.equal(up.finalSize, '2/0');

  // 250.122(A): the EGC never exceeds the phase conductor.
  assert.equal(egcSizing(6000, '250', '250').finalSize, '250');
  assert.ok(egcSizing(7000, null, null).error);
});
