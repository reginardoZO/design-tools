import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateConduitFill,
  conduitInsideDiameter,
  fillFactorFor,
  NEC_PVC_SCH40_CONDUITS,
} from '../apps/conduit-fill/js/engine.js';

const conduit2 = { Size: '2', Average_OD_in: 2.375, SCH40_Minimum_wall: 0.154 };

test('uses NEC Chapter 9 Table 4 PVC Schedule 40 areas', () => {
  assert.equal(conduitInsideDiameter(NEC_PVC_SCH40_CONDUITS['2']), 2.067);
  assert.equal(NEC_PVC_SCH40_CONDUITS['3'].internalArea, 7.499);
  assert.equal(NEC_PVC_SCH40_CONDUITS['6'].internalArea, 28.727);
});

test('applies NEC Chapter 9 Table 1 fill factors by conductor count', () => {
  assert.equal(fillFactorFor(1), 0.53);
  assert.equal(fillFactorFor(2), 0.31);
  assert.equal(fillFactorFor(3), 0.4);
  assert.equal(fillFactorFor(12), 0.4);
});

test('reports fit against the allowable 40 percent fill area', () => {
  const result = calculateConduitFill(conduit2, [{ quantity: 3, diameter: 0.728 }]);

  assert.equal(result.conductorCount, 3);
  assert.equal(result.fillFactor, 0.4);
  assert.ok(Math.abs(result.conduitArea - 3.356) < 0.002);
  assert.ok(result.fits);
  assert.ok(result.remainingArea > 0);
});

test('handles 1 multiconductor cable under NEC Note 9 with 53 percent fill limit', () => {
  const conduit3 = NEC_PVC_SCH40_CONDUITS['3'];
  const result = calculateConduitFill(conduit3, [
    { quantity: 1, diameter: 1.74, type: 'multiconductor', cores: 3 },
  ]);

  assert.equal(result.cableCount, 1);
  assert.equal(result.totalConductors, 3);
  assert.equal(result.fillFactor, 0.53);
  assert.ok(result.fits);
});

test('detects critical jamming risk for 3 single conductors with ratio between 2.8 and 3.2', () => {
  // Conduit 2": ID = 2.067 in. Cable OD = 0.689 in -> J = 2.067 / 0.689 = 3.00 (Critical)
  const result = calculateConduitFill(NEC_PVC_SCH40_CONDUITS['2'], [
    { quantity: 3, diameter: 0.689, type: 'single', cores: 1 },
  ]);

  assert.equal(result.jamming.applies, true);
  assert.equal(result.jamming.status, 'critical');
  assert.ok(result.jamming.ratio >= 2.8 && result.jamming.ratio <= 3.2);
});

test('detects safe jamming condition when ratio is outside critical zone', () => {
  // Conduit 4": ID = 4.030 in. Cable OD = 0.500 in -> J = 8.06 (Safe)
  const result = calculateConduitFill(NEC_PVC_SCH40_CONDUITS['4'], [
    { quantity: 3, diameter: 0.500, type: 'single', cores: 1 },
  ]);

  assert.equal(result.jamming.applies, true);
  assert.equal(result.jamming.status, 'safe');
});