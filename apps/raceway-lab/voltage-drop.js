import {CABLES, calcVD} from '../../shared/voltage-drop.js';

export const voltageDropDefaults = () => ({
  vdEnabled:false, vdLength:NaN, vdLengthUnit:'ft', vdPowerFactor:0.85,
  vdLimit:5, vdCurrentBasis:'load', vdCurrent:NaN, vdMethod:'custom',
  vdResistance:NaN, vdReactance:NaN, vdSource:'', vdImpedanceKey:'',
});
export const impedanceKey = (p,selected) => JSON.stringify([selected?.cable?.catalogNumber,p.conduitType,p.frequency]);

export function calculateVoltageDrop(p,sizing) {
  if (!p.vdEnabled) return null;
  const errors=[],warnings=[];
  const selected=sizing.selected;
  const current=p.vdCurrentBasis==='load'
    ? sizing.load?.mcc?.operatingCurrent ?? sizing.load?.actual
    : p.vdCurrent;
  const positive=v=>Number.isFinite(v)&&v>0;
  if (!selected?.cable) errors.push('Select a valid catalog cable before calculating voltage drop.');
  if (!positive(p.vdLength)) errors.push('Enter a positive one-way route length.');
  if (!['ft','m'].includes(p.vdLengthUnit)) errors.push('Select feet or metres for route length.');
  if (!positive(p.vdPowerFactor)||p.vdPowerFactor>1) errors.push('Enter a lagging power factor above 0 and at most 1.');
  if (!positive(p.frequency)) errors.push('Enter a positive system frequency for the impedance basis.');
  if (!positive(p.vdLimit)||p.vdLimit>=100) errors.push('Enter a voltage-drop limit above 0 and below 100%.');
  if (!['load','manual'].includes(p.vdCurrentBasis)||!positive(current)) errors.push('Enter a positive operating current or complete the circuit load inputs.');
  if (![1,3].includes(p.phases)||!positive(p.voltage)||!Number.isInteger(p.sets)||p.sets<1) errors.push('Complete the phase, voltage and equal parallel-set inputs.');
  if (p.phases===3&&(p.neutral!=='none'||(p.loadType==='mcc-feeder'&&p.mccLoads?.some(l=>l.phases===1))))
    errors.push('Unbalanced or neutral-loaded three-phase circuits require a separate phase-by-phase voltage-drop study.');
  let r,x,basis;
  if (p.vdMethod==='reference') {
    if (p.voltage>1000||p.construction!=='single'||!['PVC40','PVC80'].includes(p.conduitType)||p.frequency!==60)
      errors.push('The reference data apply only to LV single conductors in PVC at 60 Hz. Use documented R and X for this installation.');
    const cable=CABLES.find(c=>c.size.split(' ')[0]===selected?.size);
    if (!cable) errors.push('No reference impedance is available for the selected conductor size.');
    r=cable?.rCu;x=cable?.x;
    basis='Southwire / NEC Chapter 9 Table 9 reference: copper, 75°C, PVC conduit, 60 Hz (same data as Voltage Drop app).';
  } else if (p.vdMethod==='custom') {
    r=p.vdResistance;x=p.vdReactance;
    if (!positive(r)||!Number.isFinite(x)||x<0) errors.push('Enter AC resistance above zero and reactance at least zero, in ohms/1000 ft per conductor.');
    if (typeof p.vdSource!=='string'||!p.vdSource.trim()) errors.push('Document the R/X source, conductor temperature, frequency and installation arrangement.');
    if (p.vdImpedanceKey!==impedanceKey(p,selected)) errors.push('Enter R/X for the selected cable and raceway; previous impedance data do not match this selection.');
    basis=p.vdSource;
  } else errors.push('Select a supported impedance method.');
  if (errors.length) return {valid:false,errors,warnings};
  const lengthFt=p.vdLength*(p.vdLengthUnit==='m'?1/0.3048:1);
  const calculated=calcVD({rCu:r,x},{material:'cu',phases:p.phases,current,lengthFt,pf:p.vdPowerFactor,n:p.sets,voltage:p.voltage});
  const receivingVoltage=p.voltage-calculated.vd;
  if (![calculated.vd,calculated.pct,calculated.zEff,receivingVoltage].every(Number.isFinite))
    return {valid:false,errors:['Voltage-drop inputs exceed the supported numerical range.'],warnings};
  if (receivingVoltage<=0) return {valid:false,errors:['Calculated drop reaches or exceeds the supply voltage. Review the current, route length and impedance.'],warnings};
  if (p.loadType==='mcc-feeder') warnings.push('MCC voltage drop uses the operating current, not the 125% conductor-sizing current. Verify the aggregate lagging power factor and equipment operating scenarios.');
  warnings.push('Steady-state approximation only; excludes motor starting, harmonics and upstream voltage drop. The entered percentage is a design limit, not a universal NEC compliance test. Cable size is not changed automatically.');
  return {valid:true,errors,warnings,drop:calculated.vd,percent:calculated.pct,
    effectiveImpedance:calculated.zEff,r,x,current,lengthFt,receivingVoltage,
    pass:calculated.pct<=p.vdLimit+1e-9,basis};
}
