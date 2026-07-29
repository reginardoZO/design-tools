/**
 * Builds data/elec.db — the trimmed engineering database tracked in this
 * repository — from a full elec.db.
 *
 * The full database also holds client project data (cable lists, circuit
 * schedules, a Kanban board, a document index) that has nothing to do with
 * these tools and must not be published. This script copies ONLY the four
 * tables the web applications read, preserving their original schema.
 *
 * Usage:  node scripts/make-app-db.mjs [path-to-full-elec.db] [output.db]
 *
 * Defaults: C:/temp/database/elec.db  ->  data/elec.db
 */

import { DatabaseSync } from 'node:sqlite';
import { rmSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = process.argv[2] || 'C:/temp/database/elec.db';
const outPath = process.argv[3] || join(root, 'data/elec.db');

/** The only tables any application reads. Nothing else may be copied. */
const TABLES = ['low_voltage', 'medium_voltage', 'conduitsNeher', 'nec_430_250'];

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;

const source = new DatabaseSync(sourcePath, { readOnly: true });

mkdirSync(dirname(outPath), { recursive: true });
rmSync(outPath, { force: true });
const target = new DatabaseSync(outPath);

for (const table of TABLES) {
  const meta = source
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);
  if (!meta) throw new Error(`table '${table}' not found in ${sourcePath}`);

  target.exec(meta.sql);

  const rows = source.prepare(`SELECT * FROM ${quote(table)}`).all();
  if (rows.length === 0) {
    console.log(`  ${table.padEnd(15)} 0 rows`);
    continue;
  }

  const columns = Object.keys(rows[0]);
  const insert = target.prepare(
    `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
  );
  for (const row of rows) insert.run(...columns.map((c) => row[c] ?? null));

  console.log(`  ${table.padEnd(15)} ${rows.length} rows`);
}

target.exec('VACUUM');
target.close();
source.close();

const kb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`\nwrote ${outPath} (${kb} kB) — ${TABLES.length} tables, no project data.`);
