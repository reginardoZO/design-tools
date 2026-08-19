/**
 * CLI to fetch/refresh NOAA SWDI Ng data for a project point and persist it
 * to the committed disk cache the app reads at
 * apps/lightning-risk/data/ng-swdi-cache.json. Closed calendar years are
 * cached forever; re-run this script only to add new points or extend a
 * range into a newly-closed year.
 *
 * Usage:
 *   node scripts/fetch-ng-swdi.mjs <lat> <lon> [startYear] [endYear]
 *   node scripts/fetch-ng-swdi.mjs 33.77583 -112.16057
 *   node scripts/fetch-ng-swdi.mjs 33.77583 -112.16057 2015 2024
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeNg } from "../apps/lightning-risk/js/ng-swdi.js";
import { createFileCache } from "../apps/lightning-risk/js/ng-swdi-node-cache.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cachePath = join(root, "apps/lightning-risk/data/ng-swdi-cache.json");

const [, , latArg, lonArg, startArg, endArg] = process.argv;
if (!latArg || !lonArg) {
  console.error("Usage: node scripts/fetch-ng-swdi.mjs <lat> <lon> [startYear] [endYear]");
  process.exit(1);
}

const lat = Number(latArg);
const lon = Number(lonArg);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error("lat/lon must be numbers.");
  process.exit(1);
}

const cache = createFileCache(cachePath);
const result = await computeNg({
  lat,
  lon,
  startYear: startArg ? Number(startArg) : undefined,
  endYear: endArg ? Number(endArg) : undefined,
  cache,
});
cache.save();

console.log(JSON.stringify(result, null, 2));
console.log(
  `\nNg = ${result.ng.toFixed(4)} flashes/km²/year ` +
    `(${result.startYear}-${result.endYear}, tile ${result.tile?.lat ?? "—"}, ${result.tile?.lon ?? "—"}, ` +
    `area ${result.areaKm2 ? result.areaKm2.toFixed(2) : "—"} km², total ${result.totalFcount} flashes)`
);
console.log(`Cache written to ${cachePath}`);
