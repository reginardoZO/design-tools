import assert from 'node:assert/strict';
import test from 'node:test';
import {planLayout, checkFit, drawLayout, layoutOf, TREFOIL_HEIGHT, DEFAULT_LAYOUT} from '../apps/traylab-southwire/arrangement.js';

const single = {odIn: 1, conductors: 1, sizeKcmil: 500, category: 'power'};
const multi = {odIn: .5, conductors: 3, sizeKcmil: 16.51, category: 'control'};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const plan = (rows, comp = {}) => planLayout(rows.map((r, i) => ({id: 'r' + i, ...r})), comp);

test('defaults: stacked multiconductors and 2.15D trefoils', () => {
  assert.deepEqual(DEFAULT_LAYOUT, {multiLayout: 'stacked', singleLayout: 'trefoil-2.15d'});
  const l = layoutOf({});
  assert.equal(l.multi.layer, false); assert.equal(l.single.gap, 2.15);
});

test('trefoils group three single conductors; leftovers stay individual', () => {
  let p = plan([{cable: single, qty: 6}]);
  assert.equal(p.trefoils, 2); assert.equal(p.looseSingles, 0); assert.equal(p.cableCount, 6);
  close(p.linearWidthIn, 2 + 2.15 + 2); close(p.linearHeightIn, TREFOIL_HEIGHT);
  p = plan([{cable: single, qty: 7}], {singleLayout: 'trefoil'});
  assert.equal(p.trefoils, 2); assert.equal(p.looseSingles, 1);
  close(p.linearWidthIn, 2 + 2 + 1); // touching groups
  p = plan([{cable: single, qty: 6}], {singleLayout: 'trefoil-1d'});
  close(p.linearWidthIn, 5);
});

test('flat singles and single-layer multiconductors sit side by side', () => {
  close(plan([{cable: single, qty: 4}], {singleLayout: 'flat'}).linearWidthIn, 4);
  close(plan([{cable: single, qty: 4}], {singleLayout: 'flat-1d'}).linearWidthIn, 7);
  close(plan([{cable: multi, qty: 4}], {multiLayout: 'layer'}).linearWidthIn, 2);
  close(plan([{cable: multi, qty: 4}], {multiLayout: 'layer-1d'}).linearWidthIn, 3.5);
  // Between unequal neighbours the larger OD and the larger factor govern.
  const p = plan([{cable: single, qty: 3}, {cable: multi, qty: 2}], {singleLayout: 'trefoil-1d', multiLayout: 'layer'});
  close(p.linearWidthIn, 2 + 1 * 1 + .5 + .5);
});

test('physical fit checks width and depth', () => {
  const p = plan([{cable: single, qty: 6}]);
  assert.equal(checkFit(p, 6.15, 4).fits, true);
  assert.equal(checkFit(p, 6.1, 4).fits, false);
  assert.equal(checkFit(p, 12, 1.8).fits, false); // trefoil height 1.866 D
  const stacked = plan([{cable: multi, qty: 40}]);
  let fit = checkFit(stacked, 6, 4); // 12 per row, 8 rows available
  assert.equal(fit.fits, true); close(fit.usedWidthIn, 6); close(fit.usedHeightIn, 2);
  assert.equal(checkFit(stacked, 6, 1.4).fits, false); // only 2 rows = 24 cables
  // Stacked cables use what the layer zone leaves free.
  const mixed = plan([{cable: single, qty: 3}, {cable: multi, qty: 4}], {singleLayout: 'trefoil'});
  fit = checkFit(mixed, 4, 4);
  assert.equal(fit.fits, true); close(fit.usedWidthIn, 4);
  assert.equal(checkFit(mixed, 2.4, .9).fits, false);
});

test('drawing matches the plan and never splits a trefoil', () => {
  let p = plan([{cable: single, qty: 6}], {singleLayout: 'trefoil-1d'});
  let d = drawLayout(p, 12, 4);
  assert.equal(d.groups.length, 2); assert.equal(d.placed.length, 6); assert.equal(d.omitted, 0);
  close(d.groups[1].x, 3); close(d.gaps[0].width, 1);
  const abc = d.placed.slice(0, 3).map(c => ({x: c.x + c.d / 2, y: c.y + c.d / 2}));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) close(Math.hypot(abc[i].x - abc[j].x, abc[i].y - abc[j].y), 1);
  d = drawLayout(plan([{cable: single, qty: 6}]), 12, 1.8);
  assert.equal(d.placed.length, 0); assert.equal(d.omitted, 6);
  p = plan([{cable: single, qty: 30000}], {singleLayout: 'trefoil'});
  d = drawLayout(p, 120, 4);
  assert.equal(d.placed.length % 3, 0); assert.equal(d.placed.length + d.omitted, 30000);
});
