/**
 * Validates apps/lightning-risk/js/detailed-lra-calc.js (the engine extracted
 * from NFPA780AnnexLdetailedLRA.html) against the same third-party LRA report
 * used by tests/lightning-risk-detailed.test.js (apps/lightning-risk/detailed.pdf
 * — "Electrolyzer Building" case study). See that file's header comment for
 * the full fixture provenance and the report's own internal inconsistencies.
 *
 * Unlike the older engine (apps/lightning-risk/js/detailed-risk-calc.js), this
 * one reuses the SAME RA-RZ components for R1/R2/R3/R4 (per §L.6.5 and per how
 * the report itself computes R2), so R2 is comparable here — it was not with
 * the older engine's separate-loss-factor modeling choice.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { collectionArea, computeDetailedRisk } from '../apps/lightning-risk/js/detailed-lra-calc.js';

function closeRel(actual, expected, tolPct = 2) {
  const tol = Math.abs(expected) * (tolPct / 100);
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${actual} to be within ${tolPct}% of ${expected}`,
  );
}

// Structure: 75 x 175 x 26 ft (22.86 x 53.34 x 7.92 m), N_G = 1.19 flashes/km²/year,
// C_D = 0.5. Report's near-structure AM uses a 250 m radius (not this engine's
// 500 m 2020-edition default) — pass radius explicitly to verify the formula.
const state = {
  Ng: 1.19,
  L: 22.86, W: 53.34, H: 7.92,
  CD: 0.5,
  radius: 250,
  adj: 1, adjManualM2: 125856, adjCD: 0.5, // vendor CAD area, not L*W*H (irregular)
  PA: 0.000001, PB: 0.001, PC: 1.0,
  ks1mode: 'metal', ks1metal: 0.69, ks2mode: 'metal', ks2metal: 0.69,
  KS3: 1.0, ks3conduit: 0, UW: 1.5, spdCoord: 0,
  lossMode: 'typical', LT: 0.001, LF: 0.05, LO: 0.000001,
  rt: 0.01, rp: 1.0, rf: 0.10, hZ: 2,
  r1extra: 0, useR2: 0, useR3: 0, animals: 0,
  services: [{
    name: 'Incoming power feeder', type: 'power',
    LL: 240, CE: 1.0, CT: 0.2,
    puRow: [1, 0.4, 0.2, 0.04, 0.02], // shielded & bonded, RS <= 1 Ohm/km
    pzRow: [1, 0.6, 0.3, 0.16, 0.1], // power line
    spdEB: 0, PAline: 1, mesh: 0, adjEnd: 1,
  }],
};

test('collection areas and direct-strike threat frequency match the reference report', () => {
  closeRel(collectionArea(state.L, state.W, state.H), 6614, 0.5);
  const o = computeDetailedRisk(state);
  closeRel(o.AD, 6614, 0.5);
  closeRel(o.ND, 0.004, 5);
});

test('near-structure and service threat frequencies match the reference report (250 m radius)', () => {
  const o = computeDetailedRisk(state);
  closeRel(o.AM, 235669, 1);
  closeRel(o.NM, 0.14, 5);
  closeRel(o.svc[0].NL, 0.0023, 5);
  closeRel(o.svc[0].NI, 0.2, 15);
  closeRel(o.svc[0].NDJ, 0.015, 10);
});

test('PM factor (KS chain) is forced to 1 without a coordinated SPD system, matching the report', () => {
  const o = computeDetailedRisk(state);
  closeRel(o.KS, 0.48, 3);
  assert.equal(o.PM, 1);
});

test('R1 (loss of life, non-critical structure) matches the reference report', () => {
  const o = computeDetailedRisk(state);
  closeRel(o.LA, 0.00001, 1);
  closeRel(o.LB, 0.01, 1);
  closeRel(o.LC, 0.000001, 1);
  closeRel(o.RA, 3.95e-14, 5);
  closeRel(o.RB, 3.95e-8, 5);
  closeRel(o.RU, 6.93e-8, 5);
  closeRel(o.RV, 6.93e-5, 5);
  closeRel(o.R1, 6.94e-5, 2);
});

test('R2 (loss of service) reuses the R1 components, matching the reference report', () => {
  // Unlike the older engine, RC/RM/RW/RZ are always computed (not gated behind
  // an R1-only "critical" flag) so they correctly feed into R2 here.
  const o = computeDetailedRisk(state);
  closeRel(o.R2, 6.97e-5, 3);
});
