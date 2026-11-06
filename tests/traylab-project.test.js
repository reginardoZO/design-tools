import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {blankTray, compartmentsOf, validateTray, resizeTray, evaluateTray, suggestSize, cableSnapshot} from '../apps/traylab-southwire/project.js';
import {formatNumber, dimension, conductorSize, cableSize} from '../apps/traylab-southwire/format.js';

const catalog = JSON.parse(readFileSync(new URL('../apps/traylab-southwire/catalog.json', import.meta.url)));
const meta = JSON.parse(readFileSync(new URL('../apps/traylab-southwire/catalog-metadata.json', import.meta.url)));
let n = 0;
const id = () => 'id' + (n++);
const multi8 = catalog.find(c => c.spec === '45252' && c.size === '8' && c.conductors === 3);
const single500 = catalog.find(c => c.spec === '45003' && c.size === '500');
const tray = (o = {}) => ({...blankTray(id), ...o});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('catalog holds copper only, with multiconductor cables up to 2/0 AWG except full SPEC families', () => {
  const full = new Set(meta.appFilter.fullSpecs);
  assert.ok(catalog.length > 1000);
  assert.ok(catalog.every(c => /copper/i.test(c.material) && !/alum/i.test(c.material)));
  assert.ok(catalog.filter(c => c.conductors > 1 && !full.has(c.spec)).every(c => c.sizeKcmil <= 133.1 + 1e-6));
  assert.ok(catalog.some(c => c.conductors === 1 && c.sizeKcmil >= 1000));
  assert.ok(catalog.every(c => c.odIn > 0 && c.conductors > 0 && c.pdfUrl.startsWith('https://cabletechsupport.southwire.com/')));
  assert.ok(multi8 && single500);
});

test('SPEC 45252 is loaded in full from its data sheet (8 AWG to 750 kcmil)', () => {
  const rows = catalog.filter(c => c.spec === '45252');
  assert.equal(rows.length, 24);
  assert.equal(meta.specs.find(s => s.spec === '45252').records, 24);
  assert.ok(rows.every(c => c.conductors === 3 && c.voltage === 1000 && c.trayRated && c.odIn > 0 && /^1 x /.test(c.ground)));
  const big = rows.find(c => c.stock === '589359');
  assert.equal(big.size, '750'); assert.equal(big.odIn, 2.694); assert.equal(big.weightLbKft, 8919);
  assert.equal(new Set(rows.map(c => c.id)).size, 24);
});

test('dividers reduce clear width and resizing keeps proportions', () => {
  const t = tray({dividers: [8, 20], compartments: ['a', 'b', 'c'].map(x => ({id: x, name: x, multiLayout: 'stacked', singleLayout: 'trefoil'}))});
  validateTray(t);
  const cs = compartmentsOf(t);
  close(cs[0].widthIn, 7.9375); close(cs[1].widthIn, 11.875); close(cs[2].widthIn, 3.9375);
  const wider = compartmentsOf(resizeTray(t, 36));
  close(wider[0].widthIn / wider[1].widthIn, cs[0].widthIn / cs[1].widthIn);
  assert.throws(() => validateTray({...t, dividers: [20, 8]}), /increasing/);
  assert.throws(() => validateTray({...t, dividerThicknessIn: 3}), /thickness/);
  assert.throws(() => validateTray({...t, compartments: t.compartments.map(c => ({...c, singleLayout: 'x'}))}), /arrangement/);
});

test('cable rows are validated and snapshot only the fields used', () => {
  const t = tray();
  const row = {id: 'r', cable: cableSnapshot(multi8), qty: 4, compartmentId: t.compartments[0].id};
  validateTray({...t, cables: [row]});
  assert.equal(row.cable.odIn, multi8.odIn); assert.equal(row.cable.pdfUrl, multi8.pdfUrl);
  assert.equal('rawFields' in row.cable, false);
  assert.throws(() => validateTray({...t, cables: [{...row, qty: 1.5}]}), /whole number/);
  assert.throws(() => validateTray({...t, cables: [{...row, compartmentId: 'none'}]}), /does not exist/);
  assert.throws(() => validateTray({...t, version: 1}), /Unrecognized/);
});

test('evaluation applies NEC fill, the layout and the spare reserve', () => {
  const t = tray({widthIn: 6});
  t.cables = [{id: 'r', cable: cableSnapshot(multi8), qty: 10, compartmentId: t.compartments[0].id}];
  let e = evaluateTray(t);
  const r = e.results[0];
  assert.equal(r.fill.rule, '392.22(A)(1)(b)'); assert.equal(r.status, 'ok'); assert.equal(e.ok, true);
  close(r.fill.ratio, 10 * Math.PI * multi8.odIn ** 2 / 4 / 7);
  close(e.weightLbFt, 10 * multi8.weightLbKft / 1000);
  e = evaluateTray({...t, reserve: 60});
  assert.equal(e.results[0].status, 'over'); assert.match(e.results[0].problems[0], /40% allowed/);
  e = evaluateTray({...t, cables: [{...t.cables[0], qty: 30}]});
  assert.equal(e.ok, false);
});

test('size suggestion picks the smallest standard width, then a deeper tray', () => {
  const t = tray();
  t.cables = [{id: 'r', cable: cableSnapshot(single500), qty: 6, compartmentId: t.compartments[0].id}];
  let s = suggestSize(t);
  // Two trefoils with a 2.15D gap: 2 × 2D + 2.15D, D = catalog OD.
  assert.ok(2 * 2 * single500.odIn + 2.15 * single500.odIn <= s.tray.widthIn);
  assert.equal(s.tray.widthIn, 6); assert.equal(s.tray.depthIn, 4);
  assert.equal(suggestSize({...t, reserve: 10}).tray.widthIn, 9);
  s = suggestSize({...t, depthIn: 1.5});
  assert.equal(s.tray.depthIn, 3);
  assert.equal(suggestSize(tray()), null);
});

test('U.S. formatting helpers', () => {
  assert.equal(formatNumber(2195.125, 3), '2,195.125'); assert.equal(dimension(.125), '0.125 in');
  assert.equal(conductorSize({size: '4/0', sizeKcmil: 211.6}), '4/0 AWG');
  assert.equal(conductorSize({size: '350', sizeKcmil: 350}), '350 kcmil');
  assert.equal(cableSize(multi8), '3C × 8 AWG');
});
