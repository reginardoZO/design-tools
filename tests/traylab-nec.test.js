import assert from 'node:assert/strict';
import test from 'node:test';
import {necFill, sizeToKcmil, tabulatedArea} from '../apps/traylab-southwire/nec.js';

const cable = (o = {}) => ({odIn: 0.5, sizeKcmil: 10.38, size: '10', conductors: 3, voltage: 600, category: 'power', ...o});
const fill = (rows, o = {}) => necFill({widthIn: 12, trayType: 'ladder', rows, ...o});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('multiconductor cables smaller than 4/0 use the tabulated area of 392.22(A)', () => {
  const rows = [{cable: cable(), qty: 50}];
  let r = fill(rows);
  assert.equal(r.rule, '392.22(A)(1)(b)'); close(r.allowed, 14); close(r.used, 50 * Math.PI * .25 / 4); assert.equal(r.unit, 'in²');
  assert.equal(fill(rows, {trayType: 'solid'}).rule, '392.22(A)(3)(b)'); close(fill(rows, {trayType: 'solid'}).allowed, 11);
  r = fill(rows, {widthIn: 7.9});
  close(r.allowed, 7); assert.match(r.notes[0], /6 in table row/); // next smaller width, never interpolated
  assert.equal(tabulatedArea(1.9), null);
  close(fill(rows, {widthIn: 48}).allowed, 42); // NEC table ends at 36 in
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
