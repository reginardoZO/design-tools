/**
 * Locks the JavaScript Neher-McGrath port to the WPF implementation.
 *
 * The expected values below were produced by compiling the original
 * EleCalc/Neher/NeherCalc.cs with `dotnet run` and feeding it the same three
 * duct-bank configurations. Every number matched to six decimal places; if a
 * change here breaks a case, the web app no longer reproduces the desktop tool.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateThermal,
  buildNeherDucts,
  makeThermalInput,
  INCHES_TO_METRES as IN2M,
} from '../apps/neher/js/neher-calc.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const db = JSON.parse(readFileSync(join(root, 'apps/neher/data/cables.json'), 'utf8'));

function solve(matrix, options) {
  const ducts = buildNeherDucts({
    matrix,
    cableOuterDiameterInches: options.odIn,
    burialDepthInches: options.burialIn,
    ductSpacingInches: options.spacingIn,
    conduits: db.conduitsNeher,
  });

  return calculateThermal(
    makeThermalInput({
      rdc25OhmPer1000Feet: options.rdc25,
      conductorDiameterMetres: options.dcondIn * IN2M,
      insulationThicknessMetres: options.insulThickIn * IN2M,
      diameterUnderJacketMetres: options.dUnderJacketIn * IN2M,
      cableOuterDiameterMetres: options.odIn * IN2M,
      cableCentreSpacingMetres: options.odIn * IN2M,
      ductThermalResistivityKmPerW: options.rhoDuctCm / 100,
      soilThermalResistivityKmPerW: options.rhoSoilCm / 100,
      soilTemperatureC: options.soilT,
      maximumConductorTemperatureC: options.maxT,
      operatingCurrentAmps: options.I,
      isMediumVoltage: options.mv,
      ducts,
    }),
  );
}

const close = (actual, expected) =>
  assert.equal(actual.toFixed(6), expected.toFixed(6));

test('LV 500 kcmil in a 2x3 bank of 4in ducts', () => {
  const result = solve(
    [
      ['4', '4', '4'],
      ['4', '4', '4'],
    ],
    {
      odIn: 1.062,
      rdc25: 0.022,
      dcondIn: 0.789,
      insulThickIn: 65 / 1000,
      dUnderJacketIn: 1.062 - (2 * 65) / 1000,
      burialIn: 24,
      spacingIn: 3,
      rhoSoilCm: 110,
      rhoDuctCm: 650,
      soilT: 35,
      maxT: 90,
      I: 300,
      mv: false,
    },
  );

  close(result.minimumAmpacityAmps, 242.859838);
  close(result.maximumOperatingTemperatureC, 124.967306);
  assert.equal(result.limitingAmpacityRow, 1);
  assert.equal(result.limitingAmpacityColumn, 1);
  assert.equal(result.hottestOperatingRow, 1);
  assert.equal(result.hottestOperatingColumn, 1);
  assert.equal(result.temperatureConverged, true);
  assert.equal(result.cells.length, 6);
  close(result.cells[0].ampacityAmps, 255.768149);
  close(result.cells[0].operatingTemperatureC, 115.605778);
});

test('LV 4/0 in a single 4in duct', () => {
  const result = solve([['4']], {
    odIn: 0.728,
    rdc25: 0.051,
    dcondIn: 0.512,
    insulThickIn: 55 / 1000,
    dUnderJacketIn: 0.728 - (2 * 55) / 1000,
    burialIn: 30,
    spacingIn: 0,
    rhoSoilCm: 90,
    rhoDuctCm: 650,
    soilT: 25,
    maxT: 75,
    I: 180,
    mv: false,
  });

  close(result.minimumAmpacityAmps, 223.332796);
  close(result.maximumOperatingTemperatureC, 56.163391);
  assert.equal(result.temperatureConverged, true);
});

test('MV 350 kcmil in a staggered 3x3 bank of 5in ducts', () => {
  const result = solve(
    [
      ['5', '', '5'],
      ['5', '5', '5'],
      ['', '5', ''],
    ],
    {
      odIn: 1.342,
      rdc25: 0.031,
      dcondIn: 0.615,
      insulThickIn: 0.22,
      dUnderJacketIn: 0.615 + 2 * 0.22,
      burialIn: 36,
      spacingIn: 7.5,
      rhoSoilCm: 120,
      rhoDuctCm: 650,
      soilT: 20,
      maxT: 105,
      I: 420,
      mv: true,
    },
  );

  close(result.minimumAmpacityAmps, 246.927554);
  close(result.maximumOperatingTemperatureC, 456.775111);
  assert.equal(result.cells.length, 6, 'empty grid cells must not become ducts');
  assert.equal(result.hottestOperatingRow, 1);
  assert.equal(result.hottestOperatingColumn, 1);
  close(result.cells[5].operatingTemperatureC, 431.813582);
});

test('cable data extracted from elec.db matches the desktop tables', () => {
  assert.equal(db.low_voltage.length, 17);
  assert.equal(db.medium_voltage.length, 12);
  assert.equal(db.conduitsNeher.length, 12);
  assert.equal(db.nec_430_250.length, 27);

  // 12 and 10 AWG carry no construction geometry in elec.db, so the desktop
  // tool rejects them too; every larger size must be usable.
  for (const row of db.low_voltage) {
    assert.ok(row.rdc_25 > 0, `${row.size} rdc_25`);
    if (row.size === '12' || row.size === '10') continue;
    assert.ok(row.dim_bare > 0 && row.OD > 0 && row.insul > 0 && row.jacket > 0, row.size);
    assert.ok(row.OD - (2 * row.jacket) / 1000 > row.dim_bare, `${row.size} jacket geometry`);
  }

  for (const row of db.medium_voltage) {
    assert.ok(row.rdc_25 > 0, `${row.size} rdc_25`);
    assert.ok(row.dim_over_insul > row.dim_bare, `${row.size} insulation`);
    assert.ok(row.OD > row.dim_over_insul, `${row.size} OD`);
  }

  // The Current Calc motor lookup reads the 460 V column.
  assert.ok(db.nec_430_250.every((row) => row.Horsepower));
  assert.equal(db.nec_430_250.find((row) => row.Horsepower === '100')['460 V'], 124);
});

test('every usable catalogue cable solves in a single 5in duct', () => {
  // Guards the data extraction: the geometry columns must be self-consistent
  // for the thermal model, not merely present.
  const usable = db.low_voltage.filter((row) => row.dim_bare > 0 && row.insul > 0);
  assert.equal(usable.length, 15);

  for (const row of usable) {
    const result = solve([['5']], {
      odIn: row.OD,
      rdc25: row.rdc_25,
      dcondIn: row.dim_bare,
      insulThickIn: row.insul / 1000,
      dUnderJacketIn: row.OD - (2 * row.jacket) / 1000,
      burialIn: 24,
      spacingIn: 0,
      rhoSoilCm: 90,
      rhoDuctCm: 650,
      soilT: 25,
      maxT: 90,
      I: 100,
      mv: false,
    });
    assert.ok(result.minimumAmpacityAmps > 0, `${row.size} ampacity`);
    assert.ok(Number.isFinite(result.maximumOperatingTemperatureC), `${row.size} temperature`);
  }
});
