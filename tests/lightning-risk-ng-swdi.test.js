/**
 * Locks the NOAA SWDI Ng client to the documented API contract, using the
 * real fixture (33.77583, -112.16057, year 2024) with the HTTP body mocked -
 * no network access in this test.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSwdiUrl,
  parseSwdiCsv,
  tileAreaKm2,
  defaultYearRange,
  computeNg,
  fetchYear,
  SwdiCoverageError,
  SwdiParseError,
} from "../apps/lightning-risk/js/ng-swdi.js";

const LAT = 33.77583;
const LON = -112.16057;

const FIXTURE_2024_CSV = `DAY,CENTERLAT,CENTERLON,FCOUNT
2024-01-07,33.8,-112.2,2
2024-03-19,33.8,-112.2,1
2024-03-21,33.8,-112.2,1
2024-06-25,33.8,-112.2,4
2024-07-13,33.8,-112.2,2
2024-07-17,33.8,-112.2,4
2024-07-21,33.8,-112.2,4
2024-07-22,33.8,-112.2,4
2024-07-25,33.8,-112.2,2
2024-08-09,33.8,-112.2,22
2024-08-18,33.8,-112.2,16
2024-11-03,33.8,-112.2,1
summary
count,12
totalTimeInSeconds,0.001
`;

const EMPTY_YEAR_CSV = `summary
count,0
totalTimeInSeconds,0.0
`;

function fakeFetch(responses) {
  return async (url) => {
    const yearMatch = url.match(/nldn\/(\d{4})0101:\d{4}1231/);
    const year = yearMatch ? yearMatch[1] : null;
    const body = responses[year] ?? EMPTY_YEAR_CSV;
    return { ok: true, status: 200, text: async () => body };
  };
}

test("stat=tilesum URL puts longitude before latitude", () => {
  const url = buildSwdiUrl({ year: 2024, lat: LAT, lon: LON });
  const m = url.match(/stat=tilesum:([^,]+),(.+)$/);
  assert.ok(m, "URL must contain stat=tilesum:<lon>,<lat>");
  assert.equal(Number(m[1]), LON);
  assert.equal(Number(m[2]), LAT);
});

test("URL includes the /10000 limit and a single-year date range", () => {
  const url = buildSwdiUrl({ year: 2024, lat: LAT, lon: LON });
  assert.match(url, /\/20240101:20241231\/10000\?/);
});

test("parseSwdiCsv discards the summary footer and parses data rows", () => {
  const rows = parseSwdiCsv(FIXTURE_2024_CSV);
  assert.equal(rows.length, 12);
  assert.equal(
    rows.reduce((s, r) => s + r.fcount, 0),
    63
  );
  assert.equal(rows[0].centerLat, 33.8);
  assert.equal(rows[0].centerLon, -112.2);
});

test("parseSwdiCsv returns zero rows for a year with no activity (no throw)", () => {
  const rows = parseSwdiCsv(EMPTY_YEAR_CSV);
  assert.deepEqual(rows, []);
});

test("parseSwdiCsv throws SwdiParseError when the footer count disagrees with parsed rows", () => {
  const bad = FIXTURE_2024_CSV.replace("count,12", "count,99");
  assert.throws(() => parseSwdiCsv(bad), SwdiParseError);
});

test("tileAreaKm2 matches the documented fixture (~102.7 km2 at 33.8N)", () => {
  const area = tileAreaKm2(33.8);
  assert.ok(Math.abs(area - 102.7) < 0.1, `expected ~102.7, got ${area}`);
});

test("fetchYear aggregates FCOUNT and reports zero for a year with no rows", async () => {
  const fetchImpl = fakeFetch({ "2024": FIXTURE_2024_CSV, "2023": EMPTY_YEAR_CSV });
  const y2024 = await fetchYear({ year: 2024, lat: LAT, lon: LON, fetchImpl });
  assert.equal(y2024.fcount, 63);
  assert.equal(y2024.centerLat, 33.8);
  assert.equal(y2024.centerLon, -112.2);

  const y2023 = await fetchYear({ year: 2023, lat: LAT, lon: LON, fetchImpl });
  assert.equal(y2023.fcount, 0);
  assert.equal(y2023.centerLat, null);
});

test("computeNg reproduces the documented fixture: sum 63, area ~102.7 km2, Ng ~0.613", async () => {
  const fetchImpl = fakeFetch({ "2024": FIXTURE_2024_CSV });
  const result = await computeNg({
    lat: LAT,
    lon: LON,
    startYear: 2024,
    endYear: 2024,
    fetchImpl,
  });
  assert.equal(result.totalFcount, 63);
  assert.ok(Math.abs(result.areaKm2 - 102.7) < 0.1, `area = ${result.areaKm2}`);
  assert.ok(Math.abs(result.ng - 0.613) < 0.001, `ng = ${result.ng}`);
  assert.equal(result.tile.lat, 33.8);
  assert.equal(result.tile.lon, -112.2);
});

test("computeNg rejects coordinates outside NLDN (US) coverage explicitly, not as zero", async () => {
  const fetchImpl = fakeFetch({});
  await assert.rejects(
    computeNg({ lat: 48.8566, lon: 2.3522, startYear: 2024, endYear: 2024, fetchImpl }),
    SwdiCoverageError
  );
});

test("defaultYearRange spans 10 years and excludes the current (partial) year", () => {
  const now = new Date(Date.UTC(2026, 5, 1)); // mid-2026
  const range = defaultYearRange(now);
  assert.equal(range.endYear, 2025);
  assert.equal(range.startYear, 2016);
  assert.equal(range.endYear - range.startYear + 1, 10);
});

test("closed-year cache is read instead of re-fetching, and is written after a live fetch", async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    return { ok: true, status: 200, text: async () => FIXTURE_2024_CSV };
  };
  const store = {};
  const cache = {
    async get(key) {
      return store[key] ?? null;
    },
    async set(key, value) {
      store[key] = value;
    },
  };
  const now = new Date(Date.UTC(2026, 0, 1));

  const first = await fetchYear({ year: 2024, lat: LAT, lon: LON, fetchImpl, cache, now });
  assert.equal(calls, 1);
  assert.equal(first.fromCache, false);

  const second = await fetchYear({ year: 2024, lat: LAT, lon: LON, fetchImpl, cache, now });
  assert.equal(calls, 1, "closed year must be served from cache, not re-fetched");
  assert.equal(second.fromCache, true);
  assert.equal(second.fcount, 63);
});
