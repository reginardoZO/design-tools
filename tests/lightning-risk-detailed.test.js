/**
 * Locks the detailed-method (NFPA 780 Annex L) math to a real third-party LRA
 * report (apps/lightning-risk/detailed.pdf — a "Electrolyzer Building" case
 * study produced by an external LPS design firm using DEHN CAD + a Visme
 * report template). Numbers below were read directly off that PDF's
 * "Lightning Collection Areas", "Annual Threat Occurrence", "Probability of
 * Damage", "Loss Factors", "Risk Components" and "Annual Risk Calculations"
 * tables.
 *
 * KNOWN, DELIBERATELY-UNASSERTED DISCREPANCIES found while building this
 * fixture (surfaced to the user instead of silently "fixed" here):
 *  - The report's near-structure collection area (AM) uses a 250 m radius
 *    ("Area within 250 m of structure"); this app's constants are 500 m
 *    (2020 edition) / 350 m (2026 edition). The test below passes radius=250
 *    explicitly to verify the AM/NM *formula*, without changing the app's
 *    edition-based default.
 *  - The report computes R2 (loss of service) and R4 (economic loss) by
 *    reusing the SAME RA-RZ components/loss factors already computed for R1
 *    (LA/LB/LC), just summing a different subset. This app instead uses
 *    separate, user-entered loss factors for R2 (lf2/lo2) and R4
 *    (lt4/lf4/lo4), which is a different modeling choice — not necessarily
 *    wrong, but not comparable to this report's R2/R4 numbers. Not asserted.
 *  - The report's RZ formula is shown as (NI + NL)*PZ*LZ; this app uses
 *    NI*PZ*LC only (no NL term). Numerically inconsequential in this case
 *    (NL << NI), not asserted as a component here.
 *  - The report's R4 section displays the same RB/RC/RM/RV/RW/RZ input rows
 *    as R2 but reports a very different R4 result (1.89E-07 vs R2's
 *    6.97E-05) — internally inconsistent in the PDF itself, so R4 is not
 *    usable as a validation fixture at all.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FT, collArea, computeDetailedRisk } from '../apps/lightning-risk/js/detailed-risk-calc.js';

// Relative-tolerance compare: the PDF only prints 3 significant figures.
function closeRel(actual, expected, tolPct = 2) {
  const tol = Math.abs(expected) * (tolPct / 100);
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${actual} to be within ${tolPct}% of ${expected}`,
  );
}

// Structure: 75 x 175 x 26 ft (22.86 x 53.34 x 7.92 m), N_G = 1.19 flashes/km²/year,
// C_D = 0.5 (surrounded by structures of equal/lesser height within 3H).
const structure = {
  N: 1.19,
  L: 22.86, W: 53.34, H: 7.92,
  ADmanualM2: null,
  CD: 0.5,
  radius: 250, // see header note: report's AM uses 250 m, not this app's 500/350 m default
};

// Single connected power service: 240 m buried line, rural, transformer present,
// shielded/bonded (RS <= 1 Ohm/km), UW = 1.5 kV, no SPDs. Adjacent structure
// (Linde Plant) area was computed by the vendor's CAD tool, not L*W*H — use the
// manual A_DJ override added alongside this refactor.
const powerService = {
  on: 1,
  lengthFt: 240 / FT,
  ce: 1.0,
  ct: 0.2,
  puRow: [1, 0.4, 0.2, 0.04, 0.02], // "Shielded and bonded; RS <= 1 Ohm/km"
  uw: 1.5,
  spd: 0,
  reduce: 0,
  pzRow: [1, 0.6, 0.3, 0.16, 0.1], // "Power line"
  aLft: 0, aWft: 0, aHft: 0, // irregular adjacent structure -> manual override below
  aCD: 0.5,
  adjManualM2: 125856,
};

const detailedInputs = {
  ...structure,
  PA: 0.000001, PB: 0.001, PC: 1.0,
  KS1: 0.69, KS2: 0.69, KS3: 1.0, UW: 1.5,
  pmUnknown: false, pmCoordinated: false,
  LT: 0.001, LF: 0.05, LO: 0.000001,
  rt: 0.01, rp: 1.0, rf: 0.10, hz: 2,
  critical: false, // no life-critical/explosion internal systems in this case
  services: [powerService],
  r2: null, r3: null, r4: null,
};

test('collection areas and direct-strike threat frequency match the reference report', () => {
  const AD = collArea(structure.L, structure.W, structure.H);
  closeRel(AD, 6614, 0.5);
  const result = computeDetailedRisk(detailedInputs);
  closeRel(result.AD, 6614, 0.5);
  closeRel(result.ND, 0.004, 5);
});

test('near-structure and service threat frequencies match the reference report (250 m radius)', () => {
  const result = computeDetailedRisk(detailedInputs);
  closeRel(result.AM, 235669, 1);
  closeRel(result.NM, 0.14, 5);
  closeRel(result.totals.NL, 0.0023, 5);
  closeRel(result.totals.NI, 0.2, 15); // report rounds this to both 0.2 and 0.23 in different tables
  closeRel(result.totals.NDJ, 0.015, 10);
});

test('PM factor (KS chain) matches the reference report', () => {
  const result = computeDetailedRisk(detailedInputs);
  closeRel(result.KS, 0.48, 3);
  assert.equal(result.PM, 1); // KS > 0.4 -> PM = 1.0, per NFPA 780 Annex L Table L.6.7.5
});

test('loss factors and R1 (loss of life) match the reference report for a non-critical structure', () => {
  const result = computeDetailedRisk(detailedInputs);
  closeRel(result.LA, 0.00001, 1);
  closeRel(result.LB, 0.01, 1);
  closeRel(result.LC, 0.000001, 1);
  closeRel(result.components.RA, 3.95e-14, 5);
  closeRel(result.components.RB, 3.95e-8, 5);
  closeRel(result.components.RU, 6.93e-8, 5);
  closeRel(result.components.RV, 6.93e-5, 5);
  // Not life-critical: RC/RM/RW/RZ are excluded from R1, matching
  // "R1 = RA + RB + RU + RV" in the reference report.
  assert.equal(result.components.RC, 0);
  assert.equal(result.components.RM, 0);
  closeRel(result.R1, 6.94e-5, 2);
});
