import test from 'node:test';
import assert from 'node:assert/strict';
import { currentPerSet } from '../apps/neher/js/current-state.js';
test('per-set current tracks total-current recalculation and changing set count', () => {
  assert.equal(currentPerSet(600,2),300);
  assert.equal(currentPerSet(900,2),450);
  assert.equal(currentPerSet(900,3),300);
  assert.equal(currentPerSet(900,1),900);
  assert.equal(currentPerSet(100,3),100/3);
});
test('invalid current or set count cannot fall back to stale current', () => {
  for (const [current,sets] of [[NaN,2],[600,0],[600,1.5],[600,Infinity],[-600,2],[0,1]])
    assert.ok(Number.isNaN(currentPerSet(current,sets)));
});

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  calculateSizedCurrent,
  retornaUnidades,
  calculateFeederCurrent,
  usesBreakerRating,
  NEC_STANDARD_OCPD_RATINGS,
} from '../apps/neher/js/sizing-calc.js';

function uiHarness() {
  let source = readFileSync(new URL('../apps/neher/js/app.js', import.meta.url), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  source = source.slice(0, source.lastIndexOf('init().catch'));
  const elements = {};
  const el = id => elements[id] ??= {
    value: '', textContent: '', innerHTML: '', disabled: true, hidden: true, children: [],
    append(...nodes) { this.children.push(...nodes); },
    classList: { add() {}, remove() {}, toggle() {} },
  };
  const context = vm.createContext({ document: { getElementById: el },
    Option: function Option(text, value) { return { text, value: value ?? text }; },
    currentPerSet, calculateSizedCurrent, retornaUnidades, calculateFeederCurrent,
    usesBreakerRating, NEC_STANDARD_OCPD_RATINGS, console, setTimeout, clearTimeout });
  vm.runInContext(source, context);
  return { el, run: code => vm.runInContext(code, context), context };
}

test('actual UI handlers update I-prime after Calculate I, manual changes and set reduction', () => {
  const { el, run } = uiHarness();
  el('txtParallelSets').value = '1';
  el('txtCurrentMain').value = '600';
  run('onCablePhase()');
  assert.equal(el('txtCurrentLinha').value, '300.00');
  el('cmbUnitsMain').value = 'kVA';
  el('txtPowerMain').value = String(900 * Math.sqrt(3) * 480 / 1000);
  el('txtVoltageMain').value = '480';
  el('cmbCurrentFactor').value = '1';
  run('onCalculateCurrent()');
  assert.equal(el('txtCurrentMain').value, '900.00');
  assert.equal(el('txtCurrentLinha').value, '450.00');
  assert.equal(run('designCurrent()'), 450);
  el('txtCurrentMain').value = '750';
  run('syncCurrent()');
  assert.equal(el('txtCurrentLinha').value, '375.00');
  el('txtParallelSets').value = '1';
  run('syncCurrent()');
  assert.equal(run('designCurrent()'), 750);
  assert.equal(el('txtNeherResultStatus').textContent, 'Recalculate');
  el('txtParallelSets').value = '';
  run('syncCurrent()');
  assert.equal(el('txtCurrentLinha').value, '');
  assert.ok(Number.isNaN(run('designCurrent()')));
});

test('motor table handler updates per-set current and invalidates thermal result', () => {
  const { el, run, context } = uiHarness();
  context.catalogue = JSON.parse(readFileSync(new URL('../apps/neher/data/cables.json', import.meta.url)));
  run('db = catalogue');
  el('txtParallelSets').value = '2';
  el('cmbAuxPower').value = '100';
  el('cmbCurrentFactor').value = '1.25';
  run('onAuxPowerChanged()');
  assert.equal(el('txtCurrentMain').value, '155.00');
  assert.equal(el('txtCurrentLinha').value, '77.50');
  assert.equal(run('designCurrent()'), 77.5);
  assert.equal(el('txtNeherResultStatus').textContent, 'Recalculate');
});

test('feeder design current is the upstream OCPD rating, never the connected load', () => {
  assert.ok(usesBreakerRating('FEEDER'));
  for (const carga of ['MOTOR', 'XFRM', 'HEATER', 'GENERATOR', ''])
    assert.equal(usesBreakerRating(carga), false);
  assert.equal(calculateFeederCurrent({ breakerRating: 400 }), 400);
  for (const rating of [0, -400, NaN, undefined])
    assert.ok(Number.isNaN(calculateFeederCurrent({ breakerRating: rating })));
  assert.deepEqual(retornaUnidades('FEEDER'), []);
  assert.ok(NEC_STANDARD_OCPD_RATINGS.includes(400) && NEC_STANDARD_OCPD_RATINGS.includes(6000));
});

test('selecting FEEDER swaps the power inputs for a breaker rating and locks the factor', () => {
  const { el, run } = uiHarness();
  el('txtVoltageMain').value = '480';
  el('cmbLoadTypeMain').value = 'FEEDER';
  run('onLoadTypeChanged()');
  assert.equal(el('rowBreaker').hidden, false);
  assert.equal(el('txtBreakerRating').disabled, false);
  assert.equal(el('hintFeeder').hidden, false);
  assert.equal(el('rowPower').hidden, true);
  assert.equal(el('txtPowerMain').disabled, true);
  assert.equal(el('cmbUnitsMain').disabled, true);
  assert.equal(el('cmbCurrentFactor').disabled, true);
  assert.equal(el('cmbCurrentFactor').value, '1.00');

  el('txtParallelSets').value = '2';
  el('txtBreakerRating').value = '1200';
  run('onCalculateCurrent()');
  assert.equal(el('txtCurrentMain').value, '1200.00');
  assert.equal(el('txtCurrentLinha').value, '600.00');
  assert.equal(run('designCurrent()'), 600);

  el('cmbLoadTypeMain').value = 'XFRM';
  run('onLoadTypeChanged()');
  assert.equal(el('rowBreaker').hidden, true);
  assert.equal(el('txtBreakerRating').disabled, true);
  assert.equal(el('cmbCurrentFactor').disabled, false);
  assert.equal(el('rowPower').hidden, false);
});
