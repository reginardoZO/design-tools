/**
 * Extracts the tables the Neher-McGrath app needs from the engineering
 * database into apps/neher/data/cables.json.
 *
 * The EleCalc WPF desktop tool queries elec.db directly. A browser cannot, so
 * the four tables the web app needs are exported here with exactly the column
 * names the ported code looks up.
 *
 * Defaults to the copy tracked in this repository (data/elec.db); pass another
 * path to extract from a different database.
 *
 * Usage:  node scripts/extract-elec-db.mjs [path-to-elec.db]
 */

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = process.argv[2] || join(root, 'data/elec.db');
const out = join(root, 'apps/neher/data/cables.json');

const db = new DatabaseSync(dbPath, { readOnly: true });
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(String(v).trim()));
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

// "SELECT size FROM low_voltage ORDER BY rowid" — the order drives the cable
// dropdown and therefore the Auto-size search order.
const low_voltage = db.prepare('SELECT * FROM low_voltage ORDER BY rowid').all().map((r) => ({
  size: str(r.size),
  rdc_25: num(r.rdc_25),
  rac_75: num(r.rac_75),
  reactance: num(r.reatance), // the column is spelled "reatance" in elec.db
  dim_bare: num(r.dim_bare),
  insul: num(r.insul),
  jacket: num(r.jacket),
  OD: num(r.OD),
}));

const medium_voltage = db.prepare('SELECT * FROM medium_voltage ORDER BY rowid').all().map((r) => ({
  size: str(r.size),
  rdc_25: num(r.rdc_25),
  rac_90: num(r.rac_90),
  dim_bare: num(r.dim_bare),
  dim_over_insul: num(r.dim_over_insul),
  'Diameter Over Shield inch': num(r['Diameter Over Shield inch']),
  jacket: num(r.jacket),
  OD: num(r.OD),
}));

const conduitsNeher = db.prepare('SELECT * FROM conduitsNeher').all().map((r) => ({
  Size: str(r.Size),
  Average_OD_in: num(r.Average_OD_in),
  SCH40_Minimum_wall: num(r.SCH40_Minimum_wall),
}));

// Current Calc reads Horsepower, then the [460 V] column, for motors <= 2000 V.
const nec_430_250 = db.prepare('SELECT * FROM nec_430_250 ORDER BY rowid').all().map((r) => ({
  Horsepower: str(r.Horsepower),
  '460 V': num(r['460 V']),
  '2300 V': num(r['2300 V']),
}));

writeFileSync(out, `${JSON.stringify({ low_voltage, medium_voltage, conduitsNeher, nec_430_250 }, null, 2)}\n`);

console.log(`wrote ${out}`);
console.log(`  low_voltage    ${low_voltage.length}`);
console.log(`  medium_voltage ${medium_voltage.length}`);
console.log(`  conduitsNeher  ${conduitsNeher.length}`);
console.log(`  nec_430_250    ${nec_430_250.length}`);
