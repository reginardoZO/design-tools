import {defaults, newProject, loadDefaults, LOAD_TYPES} from './engine.js';
import {CONDUITS, SIZES, MOTOR_FLC} from './data.js';

function migrateV2(raw) {
  const clean = defaults();
  for (const key of Object.keys(clean)) {
    if (['version', 'loadType', 'motorFLC', 'motorHp', 'motorVoltage', 'motorTrip', 'breakerRating', 'motorDuty', 'driveInput', 'continuousRatedAssembly'].includes(key)) continue;
    if (!(key in raw)) throw Error(`Missing input: ${key}`);
    if (typeof clean[key] === 'number' && raw[key] === null) clean[key] = NaN;
    else if (typeof raw[key] === typeof clean[key]) clean[key] = raw[key];
    else throw Error(`Invalid input type: ${key}`);
  }
  clean.version = 4;
  clean.continuousRatedAssembly = false;
  clean.motorDuty = 'continuous';
  if (raw.loadType === 'feeder') clean.loadType = 'feeder';
  else if (raw.loadType === 'motor' && raw.voltage > 1000) {
    clean.loadType = 'mv-motor';
    clean.motorFLC = Number.isFinite(raw.current) && raw.current > 0 ? raw.current : NaN;
    clean.motorTrip = NaN;
  } else if (raw.loadType === 'motor') {
    clean.loadType = 'lv-motor';
    clean.motorHp = Number(raw.motorHp);
    clean.motorVoltage = Number(raw.motorVoltage);
    const columns = [200, 208, 230, 460, 575, 2300];
    clean.motorFLC = MOTOR_FLC[String(raw.motorHp)]?.[columns.indexOf(raw.motorVoltage)] ?? NaN;
  } else if (raw.loadType === 'vfd') {
    clean.loadType = 'vfd-input';
    clean.driveInput = Number.isFinite(raw.current) && raw.current > 0 ? raw.current : NaN;
  } else throw Error('Unsupported legacy load type');
  return clean;
}

function migrateV3(raw) {
  return {...raw, version: 4, motorHp: raw.loadType === 'lv-motor' ? NaN : 1, motorVoltage: 460};
}

// JSON encodes blank numeric inputs as null; restore them as NaN, never as defaults.
export function loadProject(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw Error('Unsupported project version');
  if (raw.version === 2) raw = migrateV2(raw);
  if (raw.version === 3) raw = migrateV3(raw);
  if (raw.version === 4) {
    raw = {...loadDefaults(), ...raw, version: 5};
    if (raw.neutral !== 'none') raw.neutralCurrent = null;
  }
  if (raw.version !== 5) throw Error('Unsupported project version');
  if (raw.loadType === 'vfd-input') raw = {...raw, loadType: raw.voltage > 1000 ? 'mv-vfd' : 'lv-vfd'};
  const clean = newProject();
  for (const key of Object.keys(clean)) {
    if (!(key in raw)) throw Error(`Missing input: ${key}`);
    if (typeof clean[key] === 'number' && raw[key] === null) clean[key] = NaN;
    else if (typeof raw[key] === typeof clean[key]) clean[key] = raw[key];
    else throw Error(`Invalid input type: ${key}`);
  }
  const choices = {
    conduitType: Object.keys(CONDUITS), construction: ['single', 'multi'],
    loadType: LOAD_TYPES.map(([id]) => id), phases: [1, 3],
    selection: ['auto', 'manual'], neutral: ['none', 'linear', 'nonlinear'],
    groundMode: ['separate', 'integral'], terminal: ['auto', '60', '75', '90', '105'],
    size: SIZES,
  };
  for (const [key, values] of Object.entries(choices))
    if (!values.includes(clean[key])) throw Error(`Unsupported choice: ${key}`);
  if (clean.conduitSize !== 'auto' && !CONDUITS[clean.conduitType].some(c => c.trade === clean.conduitSize))
    throw Error('Unsupported conduit size');
  if (!['feeder', 'heater', 'transformer', 'general'].includes(clean.loadType)) clean.neutral = 'none';
  return clean;
}
