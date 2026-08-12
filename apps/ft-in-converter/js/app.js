/**
 * Ft · In · mm Converter
 *
 * Block 1: two-way feet <-> inches conversion with flexible feet entry
 * (x-y, "ft - in", x y, x,y, x_y, or a plain decimal meaning decimal feet).
 * Block 2: millimeters -> Ft-In / decimal feet / decimal inches.
 *
 * Ft-In display is always rounded to the nearest 1/4 inch.
 */

// ==================== CONSTANTS ====================

const MM_PER_INCH = 25.4;
const IN_PER_METER = 1 / 0.0254;
const QUARTERS_PER_FOOT = 48; // 12 in/ft * 4 quarters/in

// ==================== PARSING ====================

/**
 * Parses a flexible feet-entry string into total inches.
 * Accepts: plain decimal (decimal feet), "x-y", "x ft - y in", "x y",
 * "x,y", "x_y" (x = feet, y = inches).
 * @param {string} raw
 * @returns {number|null} total inches, or null if unparseable
 */
function parseFeetEntry(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // A plain decimal (or integer) number is read as decimal feet.
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    return parseFloat(s) * 12;
  }

  const cleaned = s
    .toLowerCase()
    .replace(/feet|foot|ft\.?/g, ' ')
    .replace(/inches|inch|in\.?/g, ' ')
    .replace(/['"]/g, ' ');

  const parts = cleaned.split(/[-,_\s]+/).filter(Boolean);
  if (parts.length === 0) return null;

  const feet = parseFloat(parts[0]);
  if (Number.isNaN(feet)) return null;

  const inches = parts.length > 1 ? parseFloat(parts[1]) : 0;
  return feet * 12 + (Number.isNaN(inches) ? 0 : inches);
}

/**
 * Parses a decimal inches string (accepts comma as decimal separator).
 * @param {string} raw
 * @returns {number|null}
 */
function parseInchesEntry(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
}

// ==================== FORMATTING ====================

/**
 * Formats total inches as a Ft-In string, rounded to the nearest 1/4 inch.
 * @param {number} totalInches
 * @returns {string}
 */
function formatFeetInches(totalInches) {
  if (!Number.isFinite(totalInches)) return '—';

  const quarters = Math.round(totalInches * 4);
  const sign = quarters < 0 ? '-' : '';
  const absQuarters = Math.abs(quarters);

  const feet = Math.floor(absQuarters / QUARTERS_PER_FOOT);
  const remQuarters = absQuarters % QUARTERS_PER_FOOT;
  const wholeInches = Math.floor(remQuarters / 4);
  const quarterRemainder = remQuarters % 4;
  const fractionLabels = ['', ' 1/4', ' 1/2', ' 3/4'];

  return `${sign}${feet}' - ${wholeInches}${fractionLabels[quarterRemainder]}"`;
}

/**
 * Formats a number with a fixed number of decimals, trimming trailing zeros.
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
function formatDecimal(value, decimals = 4) {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(decimals);
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// ==================== DOM SELECTORS ====================

const els = {
  ftMode: document.getElementById('ftMode'),
  ftInput: document.getElementById('ftInput'),
  inInput: document.getElementById('inInput'),
  metersOut1: document.getElementById('metersOut1'),

  mmInput: document.getElementById('mmInput'),
  mmFtIn: document.getElementById('mmFtIn'),
  mmFtDec: document.getElementById('mmFtDec'),
  mmInDec: document.getElementById('mmInDec'),
};

// ==================== BLOCK 1: FT <-> IN ====================

// Canonical value shared by both fields, in inches.
let totalInches = 66; // default example: 5' - 6"

function refreshFeetField() {
  els.ftInput.value = els.ftMode.value === 'decimal'
    ? formatDecimal(totalInches / 12, 4)
    : formatFeetInches(totalInches);
}

function refreshInchesField() {
  els.inInput.value = formatDecimal(totalInches, 4);
}

function refreshMeters() {
  els.metersOut1.textContent = Number.isFinite(totalInches)
    ? `${formatDecimal(totalInches / IN_PER_METER, 4)} m`
    : '—';
}

els.ftInput.addEventListener('input', () => {
  const parsed = parseFeetEntry(els.ftInput.value);
  if (parsed !== null) {
    totalInches = parsed;
    refreshInchesField();
    refreshMeters();
  }
});
els.ftInput.addEventListener('blur', refreshFeetField);

els.inInput.addEventListener('input', () => {
  const parsed = parseInchesEntry(els.inInput.value);
  if (parsed !== null) {
    totalInches = parsed;
    refreshFeetField();
    refreshMeters();
  }
});
els.inInput.addEventListener('blur', refreshInchesField);

els.ftMode.addEventListener('change', refreshFeetField);

// ==================== BLOCK 2: MM -> FT-IN / FT / IN ====================

function updateFromMm() {
  const mm = parseFloat(els.mmInput.value);

  if (!Number.isFinite(mm)) {
    els.mmFtIn.textContent = '—';
    els.mmFtDec.textContent = '—';
    els.mmInDec.textContent = '—';
    return;
  }

  const inches = mm / MM_PER_INCH;
  els.mmFtIn.textContent = formatFeetInches(inches);
  els.mmFtDec.textContent = `${formatDecimal(inches / 12, 4)} ft`;
  els.mmInDec.textContent = `${formatDecimal(inches, 4)} in`;
}

els.mmInput.addEventListener('input', updateFromMm);

// ==================== INIT ====================

refreshFeetField();
refreshInchesField();
refreshMeters();
updateFromMm();
