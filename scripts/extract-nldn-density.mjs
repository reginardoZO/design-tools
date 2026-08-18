/**
 * Converts a NOAA National Lightning Detection Network (NLDN) gridded-count
 * export into the compact Ng lookup grid the Lightning Risk Assessment app
 * reads at apps/lightning-risk/data/nldn-2003-2023.json.
 *
 * The source CSV (CENTERLON, CENTERLAT, TOTAL_COUNT_2003_2023,
 * MEAN_ANNUAL_COUNT) reports a raw annual cloud-to-ground flash *count* per
 * 0.1°x0.1° tile — not a density. This script divides each tile's
 * MEAN_ANNUAL_COUNT by that tile's true surface area (which shrinks with
 * latitude) using the WGS84 degree-length formulas, producing Ng in
 * flashes/km²/year, the quantity NFPA 780 Annex L equations use.
 *
 * The source file is not tracked in this repository (same convention as
 * data/elec.db — see data/README.md); keep it outside the repo and point this
 * script at it.
 *
 * Usage:  node scripts/extract-nldn-density.mjs [path-to-nldn-tiles.csv]
 */

import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const csvPath = process.argv[2] || 'C:/Temp/Lixo/nldn_tiles_2003_2023.csv';
const outPath = join(root, 'apps/lightning-risk/data/nldn-2003-2023.json');
mkdirSync(dirname(outPath), { recursive: true });

// WGS84 length of one degree of latitude/longitude, in metres, as a function
// of latitude (degrees). Standard series expansion (Wikipedia "Length of a
// degree of latitude"), accurate to well under 1 m across CONUS latitudes.
function metresPerDegLat(latDeg) {
  const p = (latDeg * Math.PI) / 180;
  return (
    111132.92 -
    559.82 * Math.cos(2 * p) +
    1.175 * Math.cos(4 * p) -
    0.0023 * Math.cos(6 * p)
  );
}
function metresPerDegLon(latDeg) {
  const p = (latDeg * Math.PI) / 180;
  return 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p) + 0.118 * Math.cos(5 * p);
}
function tileAreaKm2(centerLatDeg, stepDeg) {
  const latKm = (metresPerDegLat(centerLatDeg) * stepDeg) / 1000;
  const lonKm = (metresPerDegLon(centerLatDeg) * stepDeg) / 1000;
  return latKm * lonKm;
}

const STEP = 0.1;
const cells = []; // {lon, lat, ng}
let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;

const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
let isHeader = true;
for await (const line of rl) {
  if (isHeader) { isHeader = false; continue; }
  if (!line.trim()) continue;
  const [lonS, latS, , meanS] = line.split(',');
  const lon = Number(lonS), lat = Number(latS), mean = Number(meanS);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(mean)) continue;
  const ng = mean / tileAreaKm2(lat, STEP);
  cells.push({ lon, lat, ng });
  if (lon < minLon) minLon = lon;
  if (lon > maxLon) maxLon = lon;
  if (lat < minLat) minLat = lat;
  if (lat > maxLat) maxLat = lat;
}

const lon0 = minLon, lat0 = minLat;
const ncols = Math.round((maxLon - lon0) / STEP) + 1;
const nrows = Math.round((maxLat - lat0) / STEP) + 1;
const grid = Array.from({ length: nrows }, () => new Array(ncols).fill(null));

for (const { lon, lat, ng } of cells) {
  const col = Math.round((lon - lon0) / STEP);
  const row = Math.round((lat - lat0) / STEP);
  grid[row][col] = Number(ng.toPrecision(4));
}

const out = {
  source: 'NOAA (https://www.noaa.gov/) - National Lightning Detection Network (NLDN), tiled cloud-to-ground flash counts, 2003-2023',
  sourceNote:
    'The user-supplied CSV lists TOTAL_COUNT_2003_2023 and MEAN_ANNUAL_COUNT per 0.1deg tile centered at CENTERLON/CENTERLAT; ' +
    'https://www.noaa.gov/ is the general NOAA portal, not the specific dataset page - record the exact NOAA product/download URL ' +
    'with the project calculation package before relying on this source for a formal submittal. Confirm whether counts are ' +
    'cloud-to-ground only and whether NLDN detection-efficiency corrections were already applied upstream.',
  unit: 'flashes/km^2/year (Ng), derived here as MEAN_ANNUAL_COUNT / true WGS84 tile area at the tile latitude',
  lon0,
  lat0,
  step: STEP,
  ncols,
  nrows,
  grid,
};

writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${outPath}`);
console.log(`Grid: ${nrows} rows x ${ncols} cols, ${cells.length} populated tiles, lon [${lon0}, ${maxLon}], lat [${lat0}, ${maxLat}]`);
