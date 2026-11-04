import {defaults} from './engine.js';
import {CONDUITS, SIZES} from './data.js';

// JSON encodes a deliberately blank numeric input as null. Preserve that blank
// on restore so an incomplete engineering input can never become a default.
export function loadProject(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 2)
    throw Error('Unsupported project version');
  const clean = defaults();
  for (const key of Object.keys(clean)) {
    if (!(key in raw)) throw Error(`Missing input: ${key}`);
    if (typeof clean[key] === 'number' && raw[key] === null) clean[key] = NaN;
    else if (typeof raw[key] === typeof clean[key]) clean[key] = raw[key];
    else throw Error(`Invalid input type: ${key}`);
  }
  const choices = {
    conduitType: Object.keys(CONDUITS), construction: ['single', 'multi'],
    loadType: ['feeder', 'motor', 'vfd'], selection: ['auto', 'manual'],
    neutral: ['none', 'linear', 'nonlinear'], groundMode: ['separate', 'integral'],
    terminal: ['auto', '60', '75', '90', '105'],
    size: SIZES,
  };
  for (const [key, values] of Object.entries(choices))
    if (!values.includes(clean[key])) throw Error(`Unsupported choice: ${key}`);
  if (clean.conduitSize !== 'auto' && !CONDUITS[clean.conduitType].some(c => c.trade === clean.conduitSize))
    throw Error('Unsupported conduit size');
  return clean;
}
