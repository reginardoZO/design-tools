/**
 * NOAA NCEI Severe Weather Data Inventory (SWDI) client for ground-flash
 * density (Ng), used by the Lightning Risk Assessment app as a live,
 * per-project-point alternative to the digitized NFPA Figure L.2 bands and
 * the precomputed NLDN grid. No API key/auth is required.
 *
 * Isomorphic: imported directly by apps/lightning-risk/index.html (browser,
 * native fetch) and by tests/scripts/fetch-ng-swdi.mjs (Node, native fetch).
 */
"use strict";

// NLDN network coverage is the contiguous US only; approximate bounding box
// (excludes Alaska, Hawaii and territories) used to fail fast and explicitly
// instead of returning a silent zero for out-of-coverage coordinates.
export const NLDN_COVERAGE_BOUNDS = { latMin: 24, latMax: 50, lonMin: -125, lonMax: -66 };

export function isWithinNldnCoverage(lat, lon) {
  return (
    lat >= NLDN_COVERAGE_BOUNDS.latMin &&
    lat <= NLDN_COVERAGE_BOUNDS.latMax &&
    lon >= NLDN_COVERAGE_BOUNDS.lonMin &&
    lon <= NLDN_COVERAGE_BOUNDS.lonMax
  );
}

export class SwdiCoverageError extends Error {
  constructor(lat, lon) {
    super(
      `Coordinate ${lat}, ${lon} is outside NLDN (contiguous US) coverage; NOAA SWDI cannot supply Ng for this point.`
    );
    this.name = "SwdiCoverageError";
    this.lat = lat;
    this.lon = lon;
  }
}
export class SwdiNetworkError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "SwdiNetworkError";
    this.cause = cause;
  }
}
export class SwdiParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "SwdiParseError";
  }
}

// www.ncdc.noaa.gov (the legacy documented host) 301-redirects here; that
// redirect response carries no CORS header, which browsers block even though
// this host's own responses send Access-Control-Allow-Origin: *. Calling
// ncei.noaa.gov directly avoids the redirect hop entirely.
const SWDI_BASE = "https://www.ncei.noaa.gov/swdiws/csv/nldn";

// stat=tilesum takes LONGITUDE FIRST, then latitude - the reverse of the
// usual lat,lon convention. Do not swap this order.
export function buildSwdiUrl({ year, lat, lon }) {
  const start = `${year}0101`;
  const end = `${year}1231`;
  return `${SWDI_BASE}/${start}:${end}/10000?stat=tilesum:${lon},${lat}`;
}

export function tileKeyFromPoint(lat, lon) {
  const round1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  return `${round1(lat)}_${round1(lon)}`;
}

// Body is CSV with a header (omitted when there are zero rows) followed by a
// footer starting at the literal line "summary", which must be discarded.
export function parseSwdiCsv(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const summaryIdx = lines.indexOf("summary");
  const dataLines = summaryIdx === -1 ? lines : lines.slice(0, summaryIdx);
  const footerLines = summaryIdx === -1 ? [] : lines.slice(summaryIdx + 1);

  const rows = [];
  for (const line of dataLines) {
    if (line.startsWith("DAY,")) continue; // header row, present only when rows exist
    const parts = line.split(",");
    if (parts.length !== 4) {
      throw new SwdiParseError(`Unexpected NOAA SWDI CSV row shape: "${line}"`);
    }
    const [day, latS, lonS, fcountS] = parts;
    const centerLat = Number(latS);
    const centerLon = Number(lonS);
    const fcount = Number(fcountS);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon) || !Number.isFinite(fcount)) {
      throw new SwdiParseError(`Unexpected NOAA SWDI CSV row values: "${line}"`);
    }
    rows.push({ day, centerLat, centerLon, fcount });
  }

  const countLine = footerLines.find((l) => l.startsWith("count,"));
  if (countLine) {
    const declaredCount = Number(countLine.split(",")[1]);
    if (Number.isFinite(declaredCount) && declaredCount !== rows.length) {
      throw new SwdiParseError(
        `NOAA SWDI response footer declares count=${declaredCount} but ${rows.length} data row(s) were parsed.`
      );
    }
  }

  return rows;
}

// WGS84 tile area, using the CENTERLAT RETURNED BY THE API (not the query
// latitude) for the 0.1deg x 0.1deg tile that contains the queried point.
export function tileAreaKm2(centerLatDeg) {
  const phi = (centerLatDeg * Math.PI) / 180;
  const kmPerDegLat = 111.132954 - 0.559822 * Math.cos(2 * phi) + 0.001175 * Math.cos(4 * phi);
  const kmPerDegLon = 111.41513 * Math.cos(phi) - 0.09455 * Math.cos(3 * phi) + 0.00012 * Math.cos(5 * phi);
  return 0.1 * kmPerDegLat * 0.1 * kmPerDegLon;
}

// Default is 10 full calendar years ending at the last closed year - the
// current, partial year is excluded because it would underestimate Ng.
export function defaultYearRange(now = new Date()) {
  const endYear = now.getUTCFullYear() - 1;
  return { startYear: endYear - 9, endYear };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, { fetchImpl, timeoutMs, retries, backoffMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new SwdiNetworkError(`NOAA SWDI request failed with HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await sleep(backoffMs * 2 ** attempt);
    }
  }
  const reason = lastErr?.name === "AbortError" ? "timed out" : lastErr?.message || String(lastErr);
  throw new SwdiNetworkError(
    `NOAA SWDI request failed after ${retries + 1} attempt(s): ${reason}`,
    lastErr
  );
}

/**
 * Fetches and aggregates one calendar year of tilesum data for (lat, lon).
 * Closed years (year < now) are read from/written to `cache` (an object with
 * async get(key)/set(key,value)) when provided, since a closed year's totals
 * never change. The current, still-open year is always fetched live.
 */
export async function fetchYear({
  year,
  lat,
  lon,
  fetchImpl = fetch,
  timeoutMs = 10000,
  retries = 2,
  backoffMs = 300,
  cache = null,
  now = new Date(),
}) {
  const key = `${tileKeyFromPoint(lat, lon)}:${year}`;
  const closed = year < now.getUTCFullYear();

  if (closed && cache) {
    const cached = await cache.get(key);
    if (cached) return { ...cached, year, fromCache: true };
  }

  const url = buildSwdiUrl({ year, lat, lon });
  const text = await fetchWithRetry(url, { fetchImpl, timeoutMs, retries, backoffMs });
  const rows = parseSwdiCsv(text);
  const fcount = rows.reduce((sum, r) => sum + r.fcount, 0);
  const centerLat = rows.length ? rows[0].centerLat : null;
  const centerLon = rows.length ? rows[0].centerLon : null;
  const result = { fcount, rowCount: rows.length, centerLat, centerLon };

  if (closed && cache) await cache.set(key, result);
  return { ...result, year, fromCache: false };
}

/**
 * Computes Ng for (lat, lon) over [startYear, endYear] (default: last 10
 * closed calendar years). Returns full provenance for report traceability:
 * source, year range, tile center, area used, total flashes and Ng.
 */
export async function computeNg({
  lat,
  lon,
  startYear,
  endYear,
  fetchImpl = fetch,
  cache = null,
  timeoutMs,
  retries,
  backoffMs,
  now = new Date(),
} = {}) {
  if (!isWithinNldnCoverage(lat, lon)) throw new SwdiCoverageError(lat, lon);

  const range =
    startYear != null && endYear != null ? { startYear, endYear } : defaultYearRange(now);

  const years = [];
  for (let year = range.startYear; year <= range.endYear; year++) {
    years.push(
      await fetchYear({ year, lat, lon, fetchImpl, timeoutMs, retries, backoffMs, cache, now })
    );
  }

  const totalFcount = years.reduce((s, y) => s + y.fcount, 0);
  const tileYear = years.find((y) => y.centerLat != null);
  const tile = tileYear ? { lat: tileYear.centerLat, lon: tileYear.centerLon } : null;
  const areaKm2 = tile ? tileAreaKm2(tile.lat) : null;
  const yearsCount = range.endYear - range.startYear + 1;
  const ng = totalFcount === 0 ? 0 : totalFcount / (yearsCount * areaKm2);

  return {
    source: "noaa-swdi",
    queryPoint: { lat, lon },
    startYear: range.startYear,
    endYear: range.endYear,
    yearsCount,
    years,
    tile,
    areaKm2,
    totalFcount,
    ng,
  };
}
