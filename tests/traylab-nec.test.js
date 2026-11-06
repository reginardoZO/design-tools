import assert from 'node:assert/strict';
import test from 'node:test';
import {necFill, sizeToKcmil, tabulatedArea, TABLE_WIDTHS} from '../apps/traylab-southwire/nec.js';

const cable = (o = {}) => ({odIn: 0.5, sizeKcmil: 10.38, size: '10', conductors: 3, voltage: 600, category: 'power', ...o});
const fill = (rows, o = {}) => necFill({widthIn: 12, trayType: 'ladder', rows, ...o});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('multiconductor cables smaller than 4/0 use the tabulated area of 392.22(A)', () => {
  const rows = [{cable: cable(), qty: 50}];
  let r = fill(rows);
  assert.equal(r.rule, '392.22(A)(1)(b)'); close(r.allowed, 14); close(r.used, 50 * Math.PI * .25 / 4); assert.equal(r.unit, 'in²');
  assert.equal(fill(rows, {trayType: 'solid'}).rule, '392.22(A)(3)(b)'); close(fill(rows, {trayType: 'solid'}).allowed, 11);
  r = fill(rows, {widthIn: 7.9});
  close(r.allowed, 9.375); assert.match(r.notes[0], /interpolat.*6.*8/i);
  assert.equal(tabulatedArea(1.9), null);
  close(fill(rows, {widthIn: 48}).allowed, 42); // NEC table ends at 36 in
});

test('intermediate clear widths interpolate between table rows without a capacity cliff', () => {
  close(tabulatedArea(11.9375).area, 13.927083333333334);
  assert.equal(tabulatedArea(11.9375).interpolated, true);
  close(tabulatedArea(11.9375, 'multi-solid').area, 10.9375);
  close(tabulatedArea(11.9375, 'single').area, 12.927083333333334);
  for (const kind of ['multi-vent', 'multi-solid', 'single']) {
    for (const width of TABLE_WIDTHS.slice(1)) {
      const exact = tabulatedArea(width, kind);
      assert.equal(exact.tableWidth, width);
      assert.equal(exact.interpolated, false);
      assert.ok(Math.abs(tabulatedArea(width - .000001, kind).area - exact.area) < .000002);
    }
    close(tabulatedArea(48, kind).area, tabulatedArea(36, kind).area);
    assert.equal(tabulatedArea(48, kind).conservative, true);
    assert.equal(tabulatedArea(1.9, kind), null);
  }
  assert.equal(tabulatedArea(NaN), null);
  assert.equal(tabulatedArea(Infinity), null);
});

test('mixed-cable deductions still apply to the interpolated area', () => {
  const big = cable({size: '4/0', sizeKcmil: 211.6, odIn: 1.5});
  const rows = [{cable: big, qty: 1}, {cable: cable(), qty: 10}];
  close(fill(rows, {widthIn: 11.9375}).allowed, 13.927083333333334 - 1.2 * 1.5);
  close(fill(rows, {widthIn: 11.9375, trayType: 'solid'}).allowed, 10.9375 - 1.5);
});

test('4/0 AWG and larger multiconductor cables use the sum of diameters', () => {
  const big = cable({odIn: 1.898, sizeKcmil: 350, size: '350'});
  let r = fill([{cable: big, qty: 2}], {widthIn: 4});
  assert.equal(r.rule, '392.22(A)(1)(a)'); close(r.ratio, 3.796 / 4);
  r = fill([{cable: big, qty: 2}, {cable: cable(), qty: 50}], {widthIn: 24});
  assert.equal(r.rule, '392.22(A)(1)(c)'); close(r.allowed, 28 - 1.2 * 3.796);
});

test('single conductors follow 392.22(B)', () => {
  const s = o => cable({conductors: 1, ...o});
  let r = fill([{cable: s({sizeKcmil: 350, odIn: 1}), qty: 6}]);
  assert.equal(r.rule, '392.22(B)(1)(b)'); close(r.allowed, 13); assert.equal(r.count, 6);
  r = fill([{cable: s({sizeKcmil: 350, odIn: 1}), qty: 2}, {cable: s({sizeKcmil: 105.6, odIn: .7}), qty: 1}]);
  assert.equal(r.rule, '392.22(B)(1)(d)'); close(r.used, 2.7); close(r.allowed, 12);
  r = fill([{cable: s({sizeKcmil: 350, odIn: 1}), qty: 2}, {cable: s({sizeKcmil: 1000, odIn: 1.5}), qty: 1}]);
  assert.equal(r.rule, '392.22(B)(1)(c)'); close(r.allowed, 13 - 1.1 * 1.5);
  assert.equal(fill([{cable: s({sizeKcmil: 1000, odIn: 1.5}), qty: 2}]).rule, '392.22(B)(1)(a)');
  r = fill([{cable: s({sizeKcmil: 350}), qty: 3}], {trayType: 'solid'});
  assert.equal(r.rule, null); assert.equal(r.ratio, null); assert.match(r.notes[0], /ladder and ventilated/);
});

test('cables above 2,000 V use the sum of diameters; uncovered mixes report no NEC rule', () => {
  const mv = cable({conductors: 1, sizeKcmil: 350, odIn: 1.2, voltage: 15000});
  const r = fill([{cable: mv, qty: 3}], {widthIn: 4});
  assert.equal(r.rule, '392.22(C)'); close(r.used, 3.6); close(r.ratio, .9);
  assert.equal(fill([{cable: mv, qty: 3}, {cable: cable(), qty: 1}]).rule, null);
  assert.equal(fill([{cable: cable({conductors: 1, sizeKcmil: 350}), qty: 3}, {cable: cable(), qty: 1}]).rule, null);
});

test('empty input and size parsing', () => {
  const r = fill([]);
  assert.equal(r.ratio, 0); assert.equal(r.count, 0);
  assert.equal(fill([{cable: cable(), qty: 0}]).count, 0);
  assert.equal(sizeToKcmil('4/0 AWG'), 211.6);
  assert.equal(sizeToKcmil('350 kcmil'), 350);
  assert.equal(sizeToKcmil('70 mm²'), null);
});
