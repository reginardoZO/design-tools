/** Steady-state Neher–McGrath thermal network, SI units.
 * Reference: Neher & McGrath (1957), equations 2–9, 40, 44A, 57–60.
 * See ../METHOD.md for assumptions, loss-factor definitions and applicability.
 */
const INCHES_TO_METRES = 0.0254;
export const DEFAULTS = {
  insulationThermalResistivityKmPerW: 3.5,
  beddingThermalResistivityKmPerW: 3.5,
  jacketThermalResistivityKmPerW: 6,
  frequencyHz: 60, conductorsPerDuct: 3,
  airGapU: 17 * 0.3048, airGapV: 2.3, airGapY: 0.024,
  maximumIterations: 500, temperatureToleranceC: 0.0001,
  installation: 'sand',
};
export function makeThermalInput(fields) { return { ...DEFAULTS, ducts: [], ...fields }; }
export class NeherInputError extends Error {}
function cylindricalThermalResistance(rho, inner, outer) {
  return rho / (2 * Math.PI) * Math.log(outer / inner);
}
export function acResistance(input, conductorTemperatureC) {
  const copperTemperatureCoefficientAt20C = 0.00393;
  const rdc20OhmPerMetre =
    input.rdc25OhmPer1000Feet / 304.8 / (1 + copperTemperatureCoefficientAt20C * 5);
  const rdcAtTemperature =
    rdc20OhmPerMetre * (1 + copperTemperatureCoefficientAt20C * (conductorTemperatureC - 20));

  const xsSquared = (8 * Math.PI * input.frequencyHz * 1e-7) / rdcAtTemperature;
  const skinFactor = xsSquared ** 2 / (192 + 0.8 * xsSquared ** 2);

  const xpSquared = xsSquared;
  const proximityBase = xpSquared ** 2 / (192 + 0.8 * xpSquared ** 2);
  const diameterSpacingRatio = input.conductorDiameterMetres / input.cableCentreSpacingMetres;
  const proximityFactor =
    proximityBase *
    diameterSpacingRatio ** 2 *
    (0.312 * diameterSpacingRatio ** 2 + 1.18 / (proximityBase + 0.27));

  return rdcAtTemperature * (1 + skinFactor + proximityFactor);
}


export function airGapResistance(input, meanMediumTemperatureC) {
  // Table VII: equivalent diameter of THREE touching cables is 2.15 × OD.
  const equivalentDiameterInches = 2.15 * input.cableOuterDiameterMetres / INCHES_TO_METRES;
  return input.airGapU / (1 + (input.airGapV +
    input.airGapY * meanMediumTemperatureC) * equivalentDiameterInches);
}

export function concreteEnvelope(input) {
  if (input.installation !== 'concrete') return null;
  const e = input.concrete;
  if (!e) throw new NeherInputError('Enter concrete properties and four clearances.');
  for (const side of ['top', 'bottom', 'left', 'right']) {
    if (!Number.isFinite(e[side]) || e[side] <= 0)
      throw new NeherInputError('Concrete clearances must be positive (measured from outer duct surfaces).');
  }
  if (!Number.isFinite(e.resistivityKmPerW) || e.resistivityKmPerW <= 0)
    throw new NeherInputError('Concrete resistivity must be positive.');
  const left = Math.min(...input.ducts.map(d => d.centreXMetres - d.outerDiameterMetres / 2)) - e.left;
  const right = Math.max(...input.ducts.map(d => d.centreXMetres + d.outerDiameterMetres / 2)) + e.right;
  const top = Math.min(...input.ducts.map(d => d.centreDepthMetres - d.outerDiameterMetres / 2)) - e.top;
  const bottom = Math.max(...input.ducts.map(d => d.centreDepthMetres + d.outerDiameterMetres / 2)) + e.bottom;
  const width = right - left, height = bottom - top, depth = (top + bottom) / 2;
  const x = Math.min(width, height), y = Math.max(width, height);
  if (top <= 0) throw new NeherInputError('Concrete must remain below grade; increase duct top cover.');
  if (y / x > 3) throw new NeherInputError('Concrete envelope aspect ratio exceeds the supported 3:1 approximation.');
  // Appendix II, eq. 60; natural logs used consistently throughout.
  const radius = Math.exp(0.5 * x / y * (4 / Math.PI - x / y) *
    Math.log1p((y / x) ** 2) + Math.log(x / 2));
  if (depth <= radius) throw new NeherInputError('Equivalent concrete cylinder intersects grade. Increase cover.');
  return { width, height, depth, radius, geometricFactor: Math.acosh(depth / radius) };
}

export function buildSoilResistanceMatrix(input) {
  const envelope = concreteEnvelope(input);
  const rho = envelope ? input.concrete.resistivityKmPerW : input.soilThermalResistivityKmPerW;
  // Eq. 44A at LF=1: concrete everywhere, then correct the region outside it.
  const correction = envelope ? (input.soilThermalResistivityKmPerW - rho) /
    (2 * Math.PI) * envelope.geometricFactor : 0;
  return input.ducts.map((target, i) => input.ducts.map((source, j) => {
    const factor = i === j ? Math.log(4 * target.centreDepthMetres / target.outerDiameterMetres) :
      Math.log(Math.hypot(source.centreXMetres - target.centreXMetres,
        source.centreDepthMetres + target.centreDepthMetres) /
        Math.hypot(source.centreXMetres - target.centreXMetres,
          source.centreDepthMetres - target.centreDepthMetres));
    const r = rho / (2 * Math.PI) * factor + correction;
    if (!Number.isFinite(r) || r <= 0) throw new NeherInputError(
      'This geometry/resistivity contrast is outside the equivalent-envelope approximation.');
    return r;
  }));
}

export function dielectricLoss(input) {
  if (!input.isMediumVoltage) return 0;
  // Capacitance is per phase to shield. µF/km × 1e-9 = F/m.
  return 2 * Math.PI * input.frequencyHz * input.capacitanceMicrofaradsPerKm * 1e-9 *
    (input.lineVoltageVolts ** 2 / 3) * input.dielectricDissipationFactor;
}

function validateInput(input) {
  const fail = message => { throw new NeherInputError(message); };
  if (!input.ducts?.length) fail('At least one duct is required.');
  for (const key of ['rdc25OhmPer1000Feet', 'conductorDiameterMetres', 'insulationThicknessMetres',
    'cableOuterDiameterMetres', 'diameterUnderJacketMetres', 'cableCentreSpacingMetres',
    'insulationThermalResistivityKmPerW', 'beddingThermalResistivityKmPerW',
    'jacketThermalResistivityKmPerW', 'soilThermalResistivityKmPerW',
    'ductThermalResistivityKmPerW', 'frequencyHz', 'temperatureToleranceC', 'airGapU']) {
    if (!Number.isFinite(input[key]) || input[key] <= 0) fail(`${key} must be finite and positive.`);
  }
  for (const key of ['airGapV', 'airGapY']) {
    if (!Number.isFinite(input[key]) || input[key] < 0) fail(`${key} must be finite and non-negative.`);
  }
  if (!Number.isInteger(input.maximumIterations) || input.maximumIterations < 1) fail('Invalid iteration limit.');
  if (![input.soilTemperatureC, input.maximumConductorTemperatureC].every(Number.isFinite) ||
      input.soilTemperatureC < 0 || input.maximumConductorTemperatureC > 200 ||
      input.maximumConductorTemperatureC <= input.soilTemperatureC)
    fail('Supported temperatures: soil >= 0 °C, conductor limit above soil and <= 200 °C.');
  if (!Number.isFinite(input.operatingCurrentAmps) || input.operatingCurrentAmps < 0) fail('Invalid operating current.');
  if (input.conductorsPerDuct !== 3) fail('Only three touching single-core cables per duct are supported.');
  if (Math.abs(input.cableCentreSpacingMetres - input.cableOuterDiameterMetres) > 1e-9)
    fail('Only touching trefoil cables are supported.');
  const overInsulation = input.conductorDiameterMetres + 2 * input.insulationThicknessMetres;
  if (input.diameterUnderJacketMetres < overInsulation - 1e-9 ||
      input.diameterUnderJacketMetres > input.cableOuterDiameterMetres)
    fail('Cable layer diameters are inconsistent.');
  if (!['sand', 'concrete'].includes(input.installation)) fail('Invalid installation type.');
  if (input.isMediumVoltage) {
    for (const key of ['lineVoltageVolts', 'capacitanceMicrofaradsPerKm'])
      if (!Number.isFinite(input[key]) || input[key] <= 0) fail(`MV: enter ${key} from cable/project data.`);
    for (const key of ['dielectricDissipationFactor', 'shieldLossFactor'])
      if (!Number.isFinite(input[key]) || input[key] < 0) fail(`MV: enter ${key}; unknown losses cannot be assumed zero.`);
    if (input.dielectricDissipationFactor > 1) fail('Enter tan δ as a fraction, not percent.');
  }
  for (const [i, duct] of input.ducts.entries()) {
    if (![duct.innerDiameterMetres, duct.outerDiameterMetres, duct.centreDepthMetres, duct.centreXMetres].every(Number.isFinite) ||
        duct.innerDiameterMetres <= 0 || duct.outerDiameterMetres <= duct.innerDiameterMetres ||
        duct.centreDepthMetres <= duct.outerDiameterMetres / 2)
      fail('Duct dimensions or position are invalid.');
    if (duct.innerDiameterMetres < input.cableOuterDiameterMetres * (1 + 2 / Math.sqrt(3)))
      fail('Duct cannot fit three cables in trefoil.');
    for (const other of input.ducts.slice(0, i))
      if (Math.hypot(duct.centreXMetres - other.centreXMetres, duct.centreDepthMetres - other.centreDepthMetres) <
          (duct.outerDiameterMetres + other.outerDiameterMetres) / 2 - 1e-9) fail('Ducts overlap.');
  }
}

export function calculateThermal(input) {
  validateInput(input);
  const n = input.ducts.length;
  const ri = cylindricalThermalResistance(input.insulationThermalResistivityKmPerW,
    input.conductorDiameterMetres, input.conductorDiameterMetres + 2 * input.insulationThicknessMetres);
  const rb = cylindricalThermalResistance(input.beddingThermalResistivityKmPerW,
    input.conductorDiameterMetres + 2 * input.insulationThicknessMetres, input.diameterUnderJacketMetres);
  const rj = cylindricalThermalResistance(input.jacketThermalResistivityKmPerW,
    input.diameterUnderJacketMetres, input.cableOuterDiameterMetres);
  const soil = buildSoilResistanceMatrix(input);
  const rd = input.ducts.map(d => cylindricalThermalResistance(input.ductThermalResistivityKmPerW,
    d.innerDiameterMetres, d.outerDiameterMetres));
  const wd = dielectricLoss(input);
  const lambda = input.isMediumVoltage ? input.shieldLossFactor : 0;
  function solve(current) {
    let temperatures = Array(n).fill(input.soilTemperatureC);
    let means = [...temperatures];
    let losses = [];
    for (let iteration = 0; iteration < input.maximumIterations; iteration++) {
      losses = temperatures.map(t => {
        const conductor = current ** 2 * acResistance(input, t);
        return { conductor, dielectric: wd, shield: lambda * conductor,
          total: conductor * (1 + lambda) + wd };
      });
      const nextMeans = [], next = losses.map((loss, i) => {
        const innerDuct = input.soilTemperatureC +
          soil[i].reduce((sum, r, j) => sum + r * 3 * losses[j].total, 0) + rd[i] * 3 * loss.total;
        const surface = innerDuct + airGapResistance(input, means[i]) * 3 * loss.total;
        nextMeans[i] = (surface + innerDuct) / 2;
        // Dielectric heat is distributed: half Ri; shield heat starts outside Ri/Rb.
        return surface + loss.total * rj + (loss.conductor + wd) * rb + (loss.conductor + wd / 2) * ri;
      });
      if (next.some(t => !Number.isFinite(t) || t > 1000)) break;
      const residual = Math.max(...next.map((t,i) => Math.abs(t - temperatures[i])),
        ...nextMeans.map((t,i) => Math.abs(t - means[i])));
      if (residual <= input.temperatureToleranceC)
        return { temperatures: next, losses, converged: true };
      temperatures = next.map((t,i) => (t + temperatures[i]) / 2);
      means = nextMeans.map((t,i) => (t + means[i]) / 2);
    }
    return { temperatures: Array(n).fill(NaN), losses, converged: false };
  }
  const acceptable = r => r.converged && Math.max(...r.temperatures) <= input.maximumConductorTemperatureC;
  let lower = 0, upper = 100;
  let rated = solve(0);
  if (!rated.converged) throw new NeherInputError('Thermal solver did not converge, even at zero current.');
  const dielectricOvertemperature = !acceptable(rated);
  if (!dielectricOvertemperature) {
    while (acceptable(solve(upper)) && upper < 1e7) upper *= 2;
    if (upper >= 1e7) throw new NeherInputError('Unable to bracket the allowable current.');
    for (let k = 0; k < 40 && upper - lower > 0.0001; k++) {
      const mid = (lower + upper) / 2, result = solve(mid);
      if (acceptable(result)) { lower = mid; rated = result; } else upper = mid;
    }
    // Do not silently interpret a convergence failure below the temperature limit as an ampacity.
    if (Math.abs(Math.max(...rated.temperatures) - input.maximumConductorTemperatureC) > 0.01)
      throw new NeherInputError('Allowable current could not be resolved to the temperature limit.');
  }
  const operating = solve(input.operatingCurrentAmps);
  const hottestIndex = r => r.temperatures.reduce((best,t,i,a) => t > a[best] ? i : best, 0);
  const limiting = input.ducts[hottestIndex(rated)], hottest = input.ducts[hottestIndex(operating)];
  return {
    cells: input.ducts.map((d,i) => ({ row: d.row, column: d.column,
      ampacityAmps: lower, operatingTemperatureC: operating.temperatures[i],
      lossesWattsPerMetrePerCable: operating.converged ? operating.losses[i] : null })),
    minimumAmpacityAmps: lower, limitingAmpacityRow: limiting.row, limitingAmpacityColumn: limiting.column,
    maximumOperatingTemperatureC: operating.converged ? Math.max(...operating.temperatures) : NaN,
    hottestOperatingRow: hottest.row, hottestOperatingColumn: hottest.column,
    temperatureConverged: operating.converged, dielectricOvertemperature,
    concreteEnvelope: concreteEnvelope(input),
  };
}

/* ------------------------------------------------------------------------ *
 * Duct-bank geometry — port of Neher.xaml.cs TryBuildNeherDucts /
 * CalculateGridCentres.
 * ------------------------------------------------------------------------ */

/** Port of CalculateGridCentres. Rows/columns with no duct keep a centre of 0. */
export function calculateGridCentres(radii, initialOffset, spacing) {
  const centres = new Array(radii.length).fill(0);
  let hasPrevious = false;
  let previousCentre = 0;
  let previousRadius = 0;

  for (let index = 0; index < radii.length; index++) {
    if (radii[index] <= 0) continue;

    centres[index] = hasPrevious
      ? previousCentre + previousRadius + spacing + radii[index]
      : initialOffset + radii[index];
    previousCentre = centres[index];
    previousRadius = radii[index];
    hasPrevious = true;
  }

  return centres;
}

/**
 * Port of TryBuildNeherDucts. `matrix` is the trimmed grid of trade sizes
 * (rows x columns of strings, empty where there is no duct).
 */
export function buildNeherDucts({
  matrix,
  cableOuterDiameterInches,
  burialDepthInches,
  ductSpacingInches,
  conduits,
}) {
  if (burialDepthInches <= 0 || ductSpacingInches < 0) {
    throw new NeherInputError('Depth must be positive and spacing cannot be negative.');
  }

  const rows = matrix.length;
  const columns = rows > 0 ? matrix[0].length : 0;
  const layout = [];
  const requiredInsideDiameter = cableOuterDiameterInches * (1 + 2 / Math.sqrt(3));

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const tradeSize = (matrix[row][column] ?? '').replace(/"/g, '').trim();
      if (!tradeSize) continue;

      const duct = conduits.find((c) => c.Size === tradeSize);
      if (!duct || !(duct.Average_OD_in > 0) || !(duct.SCH40_Minimum_wall > 0)) {
        throw new NeherInputError(`Duct '${tradeSize}' not found or without valid dimensions.`);
      }

      const innerDiameterInches = duct.Average_OD_in - 2 * duct.SCH40_Minimum_wall;
      if (innerDiameterInches < requiredInsideDiameter) {
        throw new NeherInputError(
          `Duct '${tradeSize}' cannot fit three cables in trefoil. ` +
            `Minimum required ID: ${requiredInsideDiameter.toFixed(2)} in.`,
        );
      }

      layout.push({
        row,
        column,
        innerDiameterInches,
        outerDiameterInches: duct.Average_OD_in,
      });
    }
  }

  if (layout.length === 0) {
    throw new NeherInputError('Draw at least one duct on the grid.');
  }

  const columnRadius = new Array(columns).fill(0);
  const rowRadius = new Array(rows).fill(0);
  for (const duct of layout) {
    const radius = duct.outerDiameterInches / 2;
    columnRadius[duct.column] = Math.max(columnRadius[duct.column], radius);
    rowRadius[duct.row] = Math.max(rowRadius[duct.row], radius);
  }

  const centreX = calculateGridCentres(columnRadius, 0, ductSpacingInches);
  const centreDepth = calculateGridCentres(rowRadius, burialDepthInches, ductSpacingInches);

  return layout.map((duct) => ({
    row: duct.row,
    column: duct.column,
    centreXMetres: centreX[duct.column] * INCHES_TO_METRES,
    centreDepthMetres: centreDepth[duct.row] * INCHES_TO_METRES,
    innerDiameterMetres: duct.innerDiameterInches * INCHES_TO_METRES,
    outerDiameterMetres: duct.outerDiameterInches * INCHES_TO_METRES,
  }));
}

export { INCHES_TO_METRES };
