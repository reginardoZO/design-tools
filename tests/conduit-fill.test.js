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