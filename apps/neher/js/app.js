/**
 * UI wiring — port of the Current Calc and Neher-McGrath areas of
 * EleCalc/Neher/Neher.xaml.cs.
 *
 * The SQLite queries of the desktop app are replaced by lookups into
 * data/cables.json, extracted from the same elec.db the desktop tool reads.
 */

import {
  calculateThermal,
  buildNeherDucts,
  makeThermalInput,
  NeherInputError,
  INCHES_TO_METRES,
} from './neher-calc.js';
import { currentPerSet } from './current-state.js';
import {
  retornaUnidades,
  calculateSizedCurrent,
  calculateFeederCurrent,
  usesBreakerRating,
  NEC_STANDARD_OCPD_RATINGS,
} from './sizing-calc.js';

const $ = (id) => document.getElementById(id);

const GRID_ROWS = 8; // CriarGradeNumerica(8, 8)
const GRID_COLS = 8;

let db = { low_voltage: [], medium_voltage: [], conduitsNeher: [], nec_430_250: [] };

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

function snack(message, isError = false) {
  const el = $('snackbar');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(snack.timer);
  snack.timer = setTimeout(() => el.classList.remove('show'), isError ? 7000 : 3000);
}

/** Port of TryParseDoubleFlexible — accepts "." or "," as decimal separator. */
function parseFlexible(text) {
  if (text === null || text === undefined) return NaN;
  const raw = String(text).trim();
  if (!raw) return NaN;
  const direct = Number(raw);
  if (Number.isFinite(direct)) return direct;
  const swapped = Number(raw.replace(',', '.'));
  return Number.isFinite(swapped) ? swapped : NaN;
}

function parsePositive(text) {
  const value = parseFlexible(text);
  return value > 0 ? value : NaN;
}

function setOptions(select, values, { placeholder = false } = {}) {
  select.innerHTML = '';
  if (placeholder) select.append(new Option('—', ''));
  for (const value of values) select.append(new Option(value, value));
}

/** Port of TryConvertVoltageSelectionToVolts. */
function voltageSelectionToVolts(voltageText) {
  if (!voltageText || !voltageText.trim()) return NaN;
  let normalized = voltageText.trim().replace(/\s/g, '').toUpperCase();
  let multiplier = 1;
  if (normalized.endsWith('KV')) {
    normalized = normalized.slice(0, -2);
    multiplier = 1000;
  } else if (normalized.endsWith('V')) {
    normalized = normalized.slice(0, -1);
  }
  const parsed = parseFlexible(normalized);
  return parsed > 0 ? parsed * multiplier : NaN;
}

/* ------------------------------------------------------------------ */
/* duct layout grid                                                    */
/* ------------------------------------------------------------------ */

function buildGrid() {
  const grid = $('InputGrid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${GRID_COLS}, 1fr)`;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let column = 0; column < GRID_COLS; column++) {
      const cell = document.createElement('input');
      cell.type = 'text';
      cell.className = 'duct-cell';
      cell.dataset.row = String(row);
      cell.dataset.column = String(column);
      cell.title = `R${row + 1} / C${column + 1}`;
      cell.addEventListener('input', () => {
        cell.classList.toggle('filled', cell.value.trim() !== '');
      });
      cell.addEventListener('focus', () => {
        const size = $('cmbDuctFill').value;
        if (size && !cell.value.trim()) {
          cell.value = size;
          cell.classList.add('filled');
          invalidateResult();
        }
      });
      grid.append(cell);
    }
  }
}

function gridCells() {
  return Array.from($('InputGrid').children);
}

/** Port of ObterValoresPreenchidosDoGrid — trims to the filled bounding box. */
function readGridMatrix() {
  const cells = gridCells();
  const temp = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(''));
  let maxRow = -1;
  let maxColumn = -1;

  cells.forEach((cell, index) => {
    const row = Math.floor(index / GRID_COLS);
    const column = index % GRID_COLS;
    const value = cell.value.trim();
    temp[row][column] = value;
    if (value) {
      if (row > maxRow) maxRow = row;
      if (column > maxColumn) maxColumn = column;
    }
  });

  if (maxRow === -1 || maxColumn === -1) return [];
  return temp.slice(0, maxRow + 1).map((row) => row.slice(0, maxColumn + 1));
}

function resetGridHighlights() {
  for (const cell of gridCells()) {
    cell.classList.remove('limiting', 'hottest');
    cell.title = `R${Number(cell.dataset.row) + 1} / C${Number(cell.dataset.column) + 1}`;
  }
}

function cellAt(row, column) {
  return gridCells()[row * GRID_COLS + column];
}

/* ------------------------------------------------------------------ */
/* Neher-McGrath                                                       */
/* ------------------------------------------------------------------ */

function selectedNeherVoltage() {
  return voltageSelectionToVolts($('cmbVoltageNeher').value);
}

/** Port of TryBuildNeherThermalInput. Throws NeherInputError on bad input. */
function buildThermalInput(operatingCurrent, cableSize) {
  const voltage = selectedNeherVoltage();
  if (!Number.isFinite(voltage)) {
    throw new NeherInputError('Select the voltage level in the Neher-McGrath area.');
  }
  if (!cableSize || !cableSize.trim()) throw new NeherInputError('Select the cable.');

  const maximumTemperature = parseFlexible($('cmbTemp').value);
  const soilTemperature = parseFlexible($('txtSoilTemp').value);
  const soilResistivityCm = parseFlexible($('txtRhoSoil').value);
  const ductResistivityCm = parseFlexible($('txtRhoDuct').value);
  const burialDepthInches = parseFlexible($('txtH').value);
  const ductSpacingInches = parseFlexible($('txtDuctSpacingNeher').value);

  if (
    [
      maximumTemperature,
      soilTemperature,
      soilResistivityCm,
      ductResistivityCm,
      burialDepthInches,
      ductSpacingInches,
    ].some((value) => !Number.isFinite(value))
  ) {
    throw new NeherInputError(
      'Fill in temperatures, resistivities, depth and spacing with valid values.',
    );
  }

  const loadFactor = parseFlexible($('txtLF').value);
  if (!Number.isFinite(loadFactor) || Math.abs(loadFactor - 100) > 0.001) {
    throw new NeherInputError(
      'The implemented model is steady-state and requires LF = 100%. ' +
        'Cyclic loads need a different thermal model.',
    );
  }

  const isMediumVoltage = voltage > 2000;
  const table = isMediumVoltage ? db.medium_voltage : db.low_voltage;
  const cableRow = table.find((row) => row.size === cableSize.trim());
  if (!cableRow) {
    throw new NeherInputError(
      `Cable '${cableSize}' not found in ${isMediumVoltage ? 'medium_voltage' : 'low_voltage'}.`,
    );
  }

  const rdc25 = cableRow.rdc_25;
  const conductorDiameterInches = cableRow.dim_bare;
  const cableOuterDiameterInches = cableRow.OD;
  if (!(rdc25 > 0) || !(conductorDiameterInches > 0) || !(cableOuterDiameterInches > 0)) {
    throw new NeherInputError(
      `Cable '${cableSize}' has no valid Rdc, conductor diameter or OD in the database.`,
    );
  }

  let insulationThicknessInches;
  let diameterUnderJacketInches;
  if (isMediumVoltage) {
    const diameterOverInsulationInches = cableRow.dim_over_insul;
    if (!(diameterOverInsulationInches > 0)) {
      throw new NeherInputError(`MV cable '${cableSize}' has no diameter over the insulation.`);
    }
    insulationThicknessInches = (diameterOverInsulationInches - conductorDiameterInches) / 2;
    diameterUnderJacketInches =
      cableRow['Diameter Over Shield inch'] > 0
        ? cableRow['Diameter Over Shield inch']
        : diameterOverInsulationInches;
  } else {
    const insulationMils = cableRow.insul;
    if (!(insulationMils > 0)) {
      throw new NeherInputError(`LV cable '${cableSize}' has no insulation thickness.`);
    }
    insulationThicknessInches = insulationMils / 1000;
    diameterUnderJacketInches =
      cableRow.jacket > 0
        ? cableOuterDiameterInches - (2 * cableRow.jacket) / 1000
        : cableOuterDiameterInches;
  }

  if (
    insulationThicknessInches <= 0 ||
    diameterUnderJacketInches <= conductorDiameterInches ||
    diameterUnderJacketInches > cableOuterDiameterInches
  ) {
    throw new NeherInputError(`Construction dimensions of cable '${cableSize}' are inconsistent.`);
  }

  const ducts = buildNeherDucts({
    matrix: readGridMatrix(),
    cableOuterDiameterInches,
    burialDepthInches,
    ductSpacingInches,
    conduits: db.conduitsNeher,
  });

  return makeThermalInput({
    rdc25OhmPer1000Feet: rdc25,
    conductorDiameterMetres: conductorDiameterInches * INCHES_TO_METRES,
    insulationThicknessMetres: insulationThicknessInches * INCHES_TO_METRES,
    diameterUnderJacketMetres: diameterUnderJacketInches * INCHES_TO_METRES,
    cableOuterDiameterMetres: cableOuterDiameterInches * INCHES_TO_METRES,
    cableCentreSpacingMetres: cableOuterDiameterInches * INCHES_TO_METRES,
    ductThermalResistivityKmPerW: ductResistivityCm / 100,
    soilThermalResistivityKmPerW: soilResistivityCm / 100,
    soilTemperatureC: soilTemperature,
    maximumConductorTemperatureC: maximumTemperature,
    operatingCurrentAmps: operatingCurrent,
    isMediumVoltage,
    lineVoltageVolts: voltage,
    capacitanceMicrofaradsPerKm: parseFlexible($('txtCapacitance').value),
    dielectricDissipationFactor: parseFlexible($('txtTanDelta').value),
    shieldLossFactor: parseFlexible($('txtShieldLoss').value),
    insulationThermalResistivityKmPerW: parseFlexible($('txtRhoInsulation').value) / 100,
    beddingThermalResistivityKmPerW: parseFlexible($('txtRhoBedding').value) / 100,
    jacketThermalResistivityKmPerW: parseFlexible($('txtRhoJacket').value) / 100,
    installation: $('cmbInstallation').value,
    concrete: {
      resistivityKmPerW: parseFlexible($('txtRhoConcrete').value) / 100,
      ...Object.fromEntries(['top', 'bottom', 'left', 'right'].map(side =>
        [side, parseFlexible($('txtConcrete' + side[0].toUpperCase() + side.slice(1)).value) * INCHES_TO_METRES])),
    },
    ducts,
  });
}

function designCurrent() {
  return currentPerSet(parseFlexible($('txtCurrentMain').value), parseFlexible($('txtParallelSets').value));
}

function invalidateResult() {
  setStatus('Recalculate', 'idle');
  for (const id of ['txtDesignCurrentNeher', 'txtCurrMinNeher', 'txtWorstTempNeher',
    'txtTemperatureMarginNeher', 'txtLimitingCellNeher']) {
    $(id).textContent = '—';
    $(id).classList.remove('ok', 'bad', 'warn');
  }
  $('txtNeherStatus').textContent = 'Inputs changed. Press Calculate to update the thermal result.';
  resetGridHighlights();
}

function syncCurrent() {
  const cablePhaseMultiplier = parseFlexible($('txtParallelSets').value);
  const current = designCurrent();
  $('txtCurrentLinha').value = Number.isFinite(current) ? current.toFixed(2) : '';
  $('btnCablePhase').textContent = Number.isInteger(cablePhaseMultiplier) && cablePhaseMultiplier > 0
    ? `${cablePhaseMultiplier * 3}-1/C` : 'Add set';
  invalidateResult();
}

function clearMvData() {
  for (const id of ['txtCapacitance', 'txtTanDelta', 'txtShieldLoss']) $(id).value = '';
}

function signed(value) {
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}`;
}

function setStatus(text, tone) {
  const el = $('txtNeherResultStatus');
  el.textContent = text;
  el.className = `eh-status eh-status-${tone}`;
}

/** Port of ApplyNeherThermalResult. */
function applyThermalResult(result, operatingCurrent, input) {
  const currentSource = $('txtCurrentLinha').value.trim() ? "I'" : 'I';
  const temperatureMargin = input.maximumConductorTemperatureC - result.maximumOperatingTemperatureC;

  $('txtDesignCurrentNeher').textContent = `${currentSource} = ${operatingCurrent.toFixed(2)} A`;
  $('txtCurrMinNeher').textContent = `${result.minimumAmpacityAmps.toFixed(1)} A`;
  $('txtWorstTempNeher').textContent = result.temperatureConverged
    ? `${result.maximumOperatingTemperatureC.toFixed(1)} °C`
    : 'N/C';
  $('txtTemperatureMarginNeher').textContent = result.temperatureConverged
    ? `${signed(temperatureMargin)} °C`
    : 'N/C';

  const ampacityAccepted = result.minimumAmpacityAmps >= operatingCurrent;
  const temperatureAccepted =
    result.temperatureConverged &&
    result.maximumOperatingTemperatureC <= input.maximumConductorTemperatureC;

  const ampTone = ampacityAccepted ? 'ok' : 'bad';
  const tempTone = temperatureAccepted ? 'ok' : 'bad';
  $('txtCurrMinNeher').className = `big ${ampTone}`;
  $('txtWorstTempNeher').className = `big ${tempTone}`;

  $('txtLimitingCellNeher').textContent = result.temperatureConverged
    ? `R${result.hottestOperatingRow + 1} / C${result.hottestOperatingColumn + 1}`
    : 'did not converge';

  setStatus(
    !result.temperatureConverged ? 'Did not converge' : temperatureAccepted && ampacityAccepted ? 'Pass' : 'Over temperature',
    tempTone,
  );

  const loss = result.cells.find(c => c.row === result.hottestOperatingRow && c.column === result.hottestOperatingColumn)?.lossesWattsPerMetrePerCable;
  let note = 'Steady state · three touching 1/C cables per duct. ';
  if (loss) note += `Hottest cable losses: conductor ${loss.conductor.toFixed(3)}, dielectric ${loss.dielectric.toFixed(3)}, shield ${loss.shield.toFixed(3)} W/m per cable. `;
  if (result.concreteEnvelope) {
    const e = result.concreteEnvelope;
    note += `Concrete: ${(e.width / INCHES_TO_METRES).toFixed(2)} × ${(e.height / INCHES_TO_METRES).toFixed(2)} in; center depth ${(e.depth / INCHES_TO_METRES).toFixed(2)} in. `;
  } else note += 'Homogeneous sand fill. ';
  if (result.dielectricOvertemperature) note += 'Dielectric heating alone exceeds the temperature limit. ';
  $('txtNeherStatus').textContent = note;

  resetGridHighlights();
  for (const cell of result.cells) {
    const element = cellAt(cell.row, cell.column);
    if (!element) continue;
    element.title =
      `R${cell.row + 1} / C${cell.column + 1}\n` +
      `Temperature: ${result.temperatureConverged ? cell.operatingTemperatureC.toFixed(2) + " °C" : "did not converge"}\n` +
      `Bank allowable current: ${cell.ampacityAmps.toFixed(2)} A`;
  }
  cellAt(result.limitingAmpacityRow, result.limitingAmpacityColumn)?.classList.add('limiting');
  if (
    result.hottestOperatingRow !== result.limitingAmpacityRow ||
    result.hottestOperatingColumn !== result.limitingAmpacityColumn
  ) {
    cellAt(result.hottestOperatingRow, result.hottestOperatingColumn)?.classList.add('hottest');
  }
}

/** Port of Button_Click (Calculate). */
function runCalculation() {
  invalidateResult();
  const operatingCurrent = designCurrent();
  if (!Number.isFinite(operatingCurrent)) {
    snack(
      "Enter a positive total current and an integer number of parallel sets.",
      true,
    );
    return;
  }

  try {
    const input = buildThermalInput(operatingCurrent, $('cmbCables').value);
    applyThermalResult(calculateThermal(input), operatingCurrent, input);
  } catch (error) {
    snack(error.message, true);
  }
}

/** Port of Button_Click_4 (Auto-size cable). */
function autoSizeCable() {
  invalidateResult();
  if (selectedNeherVoltage() > 2000) {
    snack('MV requires loss data for each cable size. Select the cable and enter its data manually.', true);
    return;
  }
  const currentLinha = designCurrent();
  if (!Number.isFinite(currentLinha)) {
    snack('Enter a valid current in Current Calc before using Auto-size.', true);
    return;
  }

  const cableSizes = Array.from($('cmbCables').options)
    .map((option) => option.value.trim())
    .filter(Boolean);
  let selectedIndex = cableSizes.findIndex(
    (size) => size.toLowerCase() === $('cmbCables').value.trim().toLowerCase(),
  );
  if (selectedIndex < 0) selectedIndex = 0;

  let lastError = '';
  for (let cableIndex = selectedIndex; cableIndex < cableSizes.length; cableIndex++) {
    const candidateSize = cableSizes[cableIndex];
    let input;
    try {
      input = buildThermalInput(currentLinha, candidateSize);
    } catch (error) {
      lastError = error.message;
      continue;
    }

    let result;
    try { result = calculateThermal(input); } catch (error) { lastError = error.message; continue; }
    if (
      !result.temperatureConverged ||
      result.maximumOperatingTemperatureC > input.maximumConductorTemperatureC
    ) {
      continue;
    }

    $('cmbCables').value = candidateSize;
    applyThermalResult(result, currentLinha, input);
    snack(
      `Cable ${candidateSize}: hottest conductor ${result.maximumOperatingTemperatureC.toFixed(1)} °C.`,
    );
    return;
  }

  snack(
    'No equal or larger section meets the selected temperature in this configuration.' +
      (lastError ? ` ${lastError}` : ''),
    true,
  );
}

/** Port of ComboBox_SelectionChanged (cmbVoltageNeher). */
function onNeherVoltageChanged() {
  clearMvData();
  invalidateResult();
  const value = $('cmbVoltageNeher').value;
  $('mvInputs').hidden = !(selectedNeherVoltage() > 2000);
  $('btnAutoSize').disabled = selectedNeherVoltage() > 2000;
  if (!value) {
    setOptions($('cmbCables'), []);
    setOptions($('cmbTemp'), []);
    return;
  }

  const isMediumVoltage = value === '13.8kV' || value === '4.16kV';
  const table = isMediumVoltage ? db.medium_voltage : db.low_voltage;
  setOptions($('cmbTemp'), isMediumVoltage ? ['90', '105'] : ['75', '90']);
  setOptions($('cmbCables'), table.map((row) => row.size));
}

/* ------------------------------------------------------------------ */
/* Current Calc                                                        */
/* ------------------------------------------------------------------ */

function setRow(row, control, enabled) {
  control.disabled = !enabled;
  if (row) row.hidden = !enabled;
}

/** Port of cmbLoadTypeMain_SelectionChanged. */
function onLoadTypeChanged() {
  const carga = $('cmbLoadTypeMain').value;
  $('cmbCurrentFactor').value = '1.00';

  const voltage = parseFlexible($('txtVoltageMain').value);
  const showAux = carga === 'MOTOR' && voltage <= 2000;
  const showBreaker = usesBreakerRating(carga);

  setRow($('rowAuxPower'), $('cmbAuxPower'), showAux);
  setRow($('rowBreaker'), $('txtBreakerRating'), showBreaker);
  $('hintFeeder').hidden = !showBreaker;
  // the 240.6(A) rating already carries the 125 % continuous allowance
  $('cmbCurrentFactor').disabled = showBreaker;
  setRow($('rowPower'), $('txtPowerMain'), Boolean(carga) && !showAux && !showBreaker);
  $('cmbUnitsMain').disabled = !carga || showAux || showBreaker;

  const withPfAndEfficiency = carga === 'GENERATOR' || (carga === 'MOTOR' && voltage > 2000);
  $('rowPfEff').hidden = !withPfAndEfficiency;
  $('txtPowerFactorMain').disabled = !withPfAndEfficiency;
  $('txtEfficiencyMain').disabled = !withPfAndEfficiency;

  if (showAux) {
    $('cmbAuxPower').innerHTML = '';
    $('cmbAuxPower').append(new Option('—', ''));
    for (const row of db.nec_430_250) {
      $('cmbAuxPower').append(new Option(`${row.Horsepower} HP`, row.Horsepower));
    }
    setOptions($('cmbUnitsMain'), []);
  } else {
    setOptions($('cmbUnitsMain'), retornaUnidades(carga));
  }
}

/** Port of cmbAuxPower_SelectionChanged. */
function onAuxPowerChanged() {
  const selection = $('cmbAuxPower').value;
  if (!selection) return;
  const row = db.nec_430_250.find((entry) => entry.Horsepower === selection);
  if (!row || !(row['460 V'] > 0)) {
    snack(`No 460 V full-load current listed for ${selection} HP.`, true);
    return;
  }
  const sizedCurrent = row['460 V'] * parseFlexible($('cmbCurrentFactor').value);
  $('txtCurrentMain').value = sizedCurrent.toFixed(2);
  syncCurrent();
}

/** Feeder design current comes straight from the upstream OCPD rating (NEC 240.4). */
function onBreakerRatingChanged() {
  const breakerRating = parsePositive($('txtBreakerRating').value);
  const sizedCurrent = calculateFeederCurrent({ breakerRating });
  if (!Number.isFinite(sizedCurrent)) return false;
  $('txtCurrentMain').value = sizedCurrent.toFixed(2);
  syncCurrent();
  return true;
}

/** Port of btnCurrentMain_Click. */
function onCalculateCurrent() {
  if ($('cmbAuxPower').disabled === false && !$('rowAuxPower').hidden) {
    onAuxPowerChanged();
    return;
  }

  if ($('txtBreakerRating').disabled === false && !$('rowBreaker').hidden) {
    if (!onBreakerRatingChanged()) {
      snack('Enter the rating of the breaker or fuse feeding this circuit, in amperes.', true);
    }
    return;
  }

  const powerUnit = $('cmbUnitsMain').value;
  if (!powerUnit) {
    snack('Select a load type and a power unit first.', true);
    return;
  }

  const sizedCurrent = calculateSizedCurrent({
    powerUnit,
    power: parseFlexible($('txtPowerMain').value),
    voltage: parseFlexible($('txtVoltageMain').value),
    powerFactor: $('txtPowerFactorMain').disabled ? 1 : parseFlexible($('txtPowerFactorMain').value),
    efficiency: $('txtEfficiencyMain').disabled ? 1 : parseFlexible($('txtEfficiencyMain').value),
    factor: parseFlexible($('cmbCurrentFactor').value),
  });

  if (!Number.isFinite(sizedCurrent)) {
    snack('Check the power, voltage, power factor and efficiency values.', true);
    return;
  }
  $('txtCurrentMain').value = sizedCurrent.toFixed(2);
  syncCurrent();
}

/** Port of btnCablePhase_Click. */
function onCablePhase() {
  const sets = parseFlexible($('txtParallelSets').value);
  $('txtParallelSets').value = Number.isInteger(sets) && sets > 0 ? sets + 1 : 1;
  syncCurrent();
}

/** Port of btnClearMain_Click. */
function onClearMain() {
  $('txtParallelSets').value = '1';
  invalidateResult();
  $('btnCablePhase').textContent = '3-1/C';
  $('cmbLoadTypeMain').value = '';
  $('txtCurrentLinha').value = '';
  $('txtCurrentMain').value = '';
  onLoadTypeChanged();
}

/* ------------------------------------------------------------------ */
/* bootstrap                                                           */
/* ------------------------------------------------------------------ */

async function init() {
  db = await fetch('data/cables.json').then((response) => response.json());

  buildGrid();
  setOptions($('cmbDuctFill'), db.conduitsNeher.map((duct) => duct.Size), { placeholder: true });
  $('cmbDuctFill').value = '4';
  for (const rating of NEC_STANDARD_OCPD_RATINGS) {
    $('listStdOcpd').append(new Option(String(rating)));
  }

  $('cmbVoltageNeher').addEventListener('change', onNeherVoltageChanged);
  $('btnCalculate').addEventListener('click', runCalculation);
  $('btnAutoSize').addEventListener('click', autoSizeCable);
  $('btnClearLayout').addEventListener('click', () => {
    for (const cell of gridCells()) {
      cell.value = '';
      cell.classList.remove('filled');
    }
    resetGridHighlights();
  });

  $('cmbLoadTypeMain').addEventListener('change', onLoadTypeChanged);
  $('txtVoltageMain').addEventListener('change', onLoadTypeChanged);
  $('cmbAuxPower').addEventListener('change', onAuxPowerChanged);
  $('txtBreakerRating').addEventListener('input', onBreakerRatingChanged);
  $('btnCurrentMain').addEventListener('click', onCalculateCurrent);
  $('btnCablePhase').addEventListener('click', onCablePhase);
  $('btnClearMain').addEventListener('click', onClearMain);

  $('txtCurrentMain').addEventListener('input', syncCurrent);
  $('txtParallelSets').addEventListener('input', syncCurrent);
  $('cmbCables').addEventListener('change', clearMvData);
  $('cmbInstallation').addEventListener('change', () => {
    $('concreteInputs').hidden = $('cmbInstallation').value !== 'concrete';
  });
  for (const event of ['input', 'change']) document.addEventListener(event, e => {
    if (e.target.matches('input, select')) invalidateResult();
  });
  $('btnClearLayout').addEventListener('click', invalidateResult);
  onLoadTypeChanged();
  $('cmbVoltageNeher').value = '480V';
  onNeherVoltageChanged();
}

init().catch((error) => {
  console.error(error);
  snack(`Failed to load application data: ${error.message}`, true);
});
