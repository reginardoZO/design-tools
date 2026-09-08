/** Physics-based verification of the revised thermal network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateThermal,
  airGapResistance,
  acResistance,
  dielectricLoss,
  concreteEnvelope,
  buildSoilResistanceMatrix,
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

function fixture(extra = {}) {
  return makeThermalInput({
    rdc25OhmPer1000Feet: 0.022, conductorDiameterMetres: 0.789 * IN2M,
    insulationThicknessMetres: 0.065 * IN2M, diameterUnderJacketMetres: 0.932 * IN2M,
    cableOuterDiameterMetres: 1.062 * IN2M, cableCentreSpacingMetres: 1.062 * IN2M,
    ductThermalResistivityKmPerW: 6.5, soilThermalResistivityKmPerW: 1.1,
    soilTemperatureC: 35, maximumConductorTemperatureC: 90, operatingCurrentAmps: 250,
    ducts: buildNeherDucts({matrix: [['4']], cableOuterDiameterInches: 1.062,
      burialDepthInches: 24, ductSpacingInches: 3, conduits: db.conduitsNeher}), ...extra,
  });
}
const near = (a,b,tol=1e-6) => assert.ok(Math.abs(a-b) < tol, `${a} != ${b}`);
const mv = { isMediumVoltage: true, lineVoltageVolts: 13800,
  capacitanceMicrofaradsPerKm: 0.3, dielectricDissipationFactor: 0.004, shieldLossFactor: 0.25 };

test('1957 Table VII uses 2.15 cable OD and local air mean, thermal ohm-ft converted to SI', () => {
  near(airGapResistance(fixture({cableOuterDiameterMetres: IN2M}), 50),
    17 * 0.3048 / (1 + (2.3 + 0.024 * 50) * 2.15));
});

test('dielectric losses: phase-to-shield voltage, µF/km conversion and voltage squared', () => {
  const input=fixture(mv);
  near(dielectricLoss(input), 2*Math.PI*60*0.3e-9*(13800**2/3)*0.004);
  near(dielectricLoss({...input,lineVoltageVolts:27600}), 4*dielectricLoss(input));
  assert.equal(dielectricLoss(fixture()),0);
});

test('single duct ampacity agrees with independent closed-form loss-weighted thermal circuit', () => {
  const input=fixture({...mv, airGapY: 0}); // Temperature-independent air gap gives a closed-form check.
  const d=input.ducts[0], dc=0.789*IN2M, di=0.919*IN2M, ds=0.932*IN2M, od=1.062*IN2M;
  const ri=3.5/(2*Math.PI)*Math.log(di/dc);
  const rb=3.5/(2*Math.PI)*Math.log(ds/di);
  const rj=6/(2*Math.PI)*Math.log(od/ds);
  const ext=17*.3048/(1+2.3*2.15*1.062)+6.5/(2*Math.PI)*Math.log(d.outerDiameterMetres/d.innerDiameterMetres)+
    1.1/(2*Math.PI)*Math.log(4*d.centreDepthMetres/d.outerDiameterMetres);
  const wd=2*Math.PI*60*0.3e-9*(13800**2/3)*.004;
  const expected=Math.sqrt((55-wd*(ri/2+rb+rj+3*ext))/
    (acResistance(input,90)*(ri+rb+1.25*(rj+3*ext))));
  const result=calculateThermal(input);
  near(result.minimumAmpacityAmps,expected,0.002);
  const atRating=calculateThermal({...input,operatingCurrentAmps:result.minimumAmpacityAmps});
  near(atRating.maximumOperatingTemperatureC,90,0.001);
});

test('MV dielectric and shield losses lower allowable current and increase temperature', () => {
  const zero=calculateThermal(fixture({...mv,dielectricDissipationFactor:0,shieldLossFactor:0}));
  const dielectric=calculateThermal(fixture({...mv,shieldLossFactor:0}));
  const both=calculateThermal(fixture(mv));
  assert.ok(zero.minimumAmpacityAmps>dielectric.minimumAmpacityAmps);
  assert.ok(dielectric.minimumAmpacityAmps>both.minimumAmpacityAmps);
  assert.ok(both.maximumOperatingTemperatureC>dielectric.maximumOperatingTemperatureC);
  const loss=both.cells[0].lossesWattsPerMetrePerCable;
  near(loss.shield,0.25*loss.conductor);
  near(loss.total,loss.conductor+loss.shield+loss.dielectric);
});

test('zero-current dielectric heating traverses half insulation and all external resistances', () => {
  const input=fixture({...mv,operatingCurrentAmps:0,airGapY:0});
  const r=calculateThermal(input);
  const d=input.ducts[0];
  const ri=3.5/(2*Math.PI)*Math.log(.919/.789), rb=3.5/(2*Math.PI)*Math.log(.932/.919),rj=6/(2*Math.PI)*Math.log(1.062/.932);
  const ext=17*.3048/(1+2.3*2.15*1.062)+6.5/(2*Math.PI)*Math.log(d.outerDiameterMetres/d.innerDiameterMetres)+1.1/(2*Math.PI)*Math.log(4*d.centreDepthMetres/d.outerDiameterMetres);
  near(r.maximumOperatingTemperatureC,35+dielectricLoss(input)*(ri/2+rb+rj+3*ext));
  const over=calculateThermal({...input,capacitanceMicrofaradsPerKm:1000});
  assert.equal(over.minimumAmpacityAmps,0);
  assert.equal(over.dielectricOvertemperature,true);
});

const concrete = { top: .1, bottom: .1, left: .1, right: .1, resistivityKmPerW: .85 };
test('1957 square equivalent radius and clearances measured from outer duct surfaces', () => {
  const input=fixture({installation:'concrete',concrete});
  const e=concreteEnvelope(input), width=input.ducts[0].outerDiameterMetres+.2;
  near(e.width,width);near(e.height,width);
  near(e.radius,width/2*Math.exp((4/Math.PI-1)*Math.log(2)/2));
  near(e.depth,input.ducts[0].centreDepthMetres);
  const shifted=concreteEnvelope({...input,concrete:{...concrete,bottom:.2,left:.2}});
  near(shifted.depth,e.depth+.05);near(shifted.height,e.height+.1);near(shifted.width,e.width+.1);
});

test('equal concrete and sand resistivities reproduce homogeneous sand exactly', () => {
  const input=fixture(), a=calculateThermal(input);
  const b=calculateThermal({...input,installation:'concrete',concrete:{...concrete,resistivityKmPerW:1.1}});
  near(a.minimumAmpacityAmps,b.minimumAmpacityAmps);
  near(a.maximumOperatingTemperatureC,b.maximumOperatingTemperatureC);
});

test('concrete common correction applies to EVERY source, including mutual heating', () => {
  const ducts=buildNeherDucts({matrix:[['4','4'],['4','4']],cableOuterDiameterInches:1.062,
    burialDepthInches:24,ductSpacingInches:3,conduits:db.conduitsNeher});
  const input=fixture({ducts,installation:'concrete',concrete});
  const actual=buildSoilResistanceMatrix(input);
  const homogeneous=buildSoilResistanceMatrix({...input,installation:'sand',soilThermalResistivityKmPerW:.85});
  const correction=(1.1-.85)/(2*Math.PI)*concreteEnvelope(input).geometricFactor;
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) near(actual[i][j]-homogeneous[i][j],correction);
  const r=calculateThermal(input);
  const rated=calculateThermal({...input,operatingCurrentAmps:r.minimumAmpacityAmps});
  near(rated.maximumOperatingTemperatureC,90,.001);
});

test('invalid geometry, resistivities, unknown MV losses and nonfinite inputs are rejected', () => {
  for(const extra of [{soilThermalResistivityKmPerW:NaN},{operatingCurrentAmps:Infinity},
    {soilThermalResistivityKmPerW:-1},{isMediumVoltage:true},
    {installation:'concrete',concrete:{...concrete,top:1}},
    {installation:'concrete',concrete:{...concrete,right:10}},
    {installation:'concrete',concrete:{...concrete,left:0}}]) assert.throws(()=>calculateThermal(fixture(extra)));
});

test('nonconvergent operation never returns an old temperature as a valid result', () => {
  const r=calculateThermal(fixture({operatingCurrentAmps:100000}));
  assert.equal(r.temperatureConverged,false);
  assert.ok(Number.isNaN(r.maximumOperatingTemperatureC));
  assert.equal(r.cells[0].lossesWattsPerMetrePerCable,null);
});
