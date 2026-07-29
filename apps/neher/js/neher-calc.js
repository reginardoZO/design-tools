/**
 * Direct port of EleCalc/Neher/NeherCalc.cs (WPF).
 *
 * Every formula, constant, damping factor and convergence rule below is a
 * one-to-one translation of the C# original. Do not "improve" the maths here:
 * the web app is required to reproduce the desktop results exactly.
 */

const INCHES_TO_METRES = 0.0254;

export const DEFAULTS = {
  insulationThermalResistivityKmPerW: 3.5,
  jacketThermalResistivityKmPerW: 6.0,
  frequencyHz: 60,
  conductorsPerDuct: 3,
  airGapU: 1.87,
  airGapV: 0.312,
  airGapY: 0.0037,
  maximumIterations: 200,
  temperatureToleranceC: 0.001,
};

/** NeherThermalInput with the C# property initialisers applied. */
export function makeThermalInput(fields) {
  return { ...DEFAULTS, ducts: [], ...fields };
}

export class NeherInputError extends Error {}

function cylindricalThermalResistance(rho, innerDiameter, outerDiameter) {
  return (rho / (2 * Math.PI)) * Math.log(outerDiameter / innerDiameter);
}

function acResistance(input, conductorTemperatureC) {
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

function airGapResistance(input, conductorTemperatureC) {
  const meanTemperature = (conductorTemperatureC + input.soilTemperatureC) / 2;
  const cableOuterDiameterMm = input.cableOuterDiameterMetres * 1000;
  return (
    input.airGapU /
    (1 + 0.1 * (input.airGapV + input.airGapY * meanTemperature) * cableOuterDiameterMm)
  );
}

function buildSoilResistanceMatrix(input) {
  const ductCount = input.ducts.length;
  const resistance = Array.from({ length: ductCount }, () => new Array(ductCount).fill(0));

  for (let targetIndex = 0; targetIndex < ductCount; targetIndex++) {
    const target = input.ducts[targetIndex];
    resistance[targetIndex][targetIndex] =
      (input.soilThermalResistivityKmPerW / (2 * Math.PI)) *
      Math.log((4 * target.centreDepthMetres) / target.outerDiameterMetres);

    for (let sourceIndex = 0; sourceIndex < ductCount; sourceIndex++) {
      if (sourceIndex === targetIndex) continue;

      const source = input.ducts[sourceIndex];
      const horizontalDistance = source.centreXMetres - target.centreXMetres;
      const verticalDistance = source.centreDepthMetres - target.centreDepthMetres;
      const directDistance = Math.sqrt(
        horizontalDistance * horizontalDistance + verticalDistance * verticalDistance,
      );
      const imageDistance = Math.sqrt(
        horizontalDistance * horizontalDistance +
          (source.centreDepthMetres + target.centreDepthMetres) ** 2,
      );

      resistance[targetIndex][sourceIndex] =
        (input.soilThermalResistivityKmPerW / (2 * Math.PI)) *
        Math.log(imageDistance / directDistance);
    }
  }

  return resistance;
}

function validateInput(input) {
  const fail = (message) => {
    throw new NeherInputError(message);
  };

  if (input.ducts.length === 0) fail('At least one duct is required.');
  if (input.rdc25OhmPer1000Feet <= 0) fail('Rdc at 25 C must be positive.');
  if (input.conductorDiameterMetres <= 0) fail('Conductor diameter must be positive.');
  if (input.insulationThicknessMetres <= 0) fail('Insulation thickness must be positive.');
  if (input.cableOuterDiameterMetres <= 0) fail('Cable outer diameter must be positive.');
  if (
    input.diameterUnderJacketMetres <= 0 ||
    input.diameterUnderJacketMetres > input.cableOuterDiameterMetres
  ) {
    fail('Diameter under jacket is invalid.');
  }
  if (input.maximumConductorTemperatureC <= input.soilTemperatureC) {
    fail('Maximum conductor temperature must be above soil temperature.');
  }
  if (input.operatingCurrentAmps <= 0) fail('Operating current must be positive.');
  if (input.conductorsPerDuct <= 0) fail('Conductors per duct must be positive.');
  if (input.cableCentreSpacingMetres < input.cableOuterDiameterMetres) {
    fail('Cable centre spacing cannot be smaller than the cable diameter.');
  }

  for (const duct of input.ducts) {
    if (duct.innerDiameterMetres <= 0 || duct.outerDiameterMetres <= duct.innerDiameterMetres) {
      fail('Duct dimensions are invalid.');
    }
    if (duct.centreDepthMetres <= duct.outerDiameterMetres / 2) {
      fail('Duct centre depth is invalid.');
    }
  }
}

/** Port of NeherCalc.CalculateThermal. */
export function calculateThermal(input) {
  validateInput(input);

  const insulationResistance = cylindricalThermalResistance(
    input.insulationThermalResistivityKmPerW,
    input.conductorDiameterMetres,
    input.conductorDiameterMetres + 2 * input.insulationThicknessMetres,
  );

  const jacketResistance =
    input.diameterUnderJacketMetres < input.cableOuterDiameterMetres
      ? cylindricalThermalResistance(
          input.jacketThermalResistivityKmPerW,
          input.diameterUnderJacketMetres,
          input.cableOuterDiameterMetres,
        )
      : 0;

  const ductCount = input.ducts.length;
  const soilResistance = buildSoilResistanceMatrix(input);
  const ductWallResistance = input.ducts.map((duct) =>
    cylindricalThermalResistance(
      input.ductThermalResistivityKmPerW,
      duct.innerDiameterMetres,
      duct.outerDiameterMetres,
    ),
  );

  const resistanceAtLimit = acResistance(input, input.maximumConductorTemperatureC);
  const airGapAtLimit = airGapResistance(input, input.maximumConductorTemperatureC);
  const cells = [];

  for (let ductIndex = 0; ductIndex < ductCount; ductIndex++) {
    let externalResistance = airGapAtLimit + ductWallResistance[ductIndex];
    for (let sourceIndex = 0; sourceIndex < ductCount; sourceIndex++) {
      externalResistance += soilResistance[ductIndex][sourceIndex];
    }

    const totalResistance =
      insulationResistance + jacketResistance + input.conductorsPerDuct * externalResistance;
    const temperatureRise = input.maximumConductorTemperatureC - input.soilTemperatureC;
    const ampacity = Math.sqrt(temperatureRise / (resistanceAtLimit * totalResistance));

    cells.push({
      row: input.ducts[ductIndex].row,
      column: input.ducts[ductIndex].column,
      ampacityAmps: ampacity,
      operatingTemperatureC: 0,
    });
  }

  const temperatures = new Array(ductCount).fill(input.soilTemperatureC);
  let converged = false;

  for (let iteration = 0; iteration < input.maximumIterations; iteration++) {
    const conductorResistance = temperatures.map((temperature) => acResistance(input, temperature));
    const ductLosses = conductorResistance.map(
      (resistance) =>
        input.conductorsPerDuct *
        input.operatingCurrentAmps *
        input.operatingCurrentAmps *
        resistance,
    );
    const nextTemperatures = new Array(ductCount).fill(0);

    for (let ductIndex = 0; ductIndex < ductCount; ductIndex++) {
      const conductorLoss =
        input.operatingCurrentAmps * input.operatingCurrentAmps * conductorResistance[ductIndex];
      let temperature =
        input.soilTemperatureC +
        conductorLoss * (insulationResistance + jacketResistance) +
        ductLosses[ductIndex] *
          (airGapResistance(input, temperatures[ductIndex]) + ductWallResistance[ductIndex]);

      for (let sourceIndex = 0; sourceIndex < ductCount; sourceIndex++) {
        temperature += ductLosses[sourceIndex] * soilResistance[ductIndex][sourceIndex];
      }

      nextTemperatures[ductIndex] = temperature;
    }

    if (nextTemperatures.some((temperature) => !Number.isFinite(temperature) || temperature > 1000)) {
      break;
    }

    let maximumDifference = 0;
    for (let ductIndex = 0; ductIndex < ductCount; ductIndex++) {
      const dampedTemperature = (temperatures[ductIndex] + nextTemperatures[ductIndex]) / 2;
      maximumDifference = Math.max(
        maximumDifference,
        Math.abs(dampedTemperature - temperatures[ductIndex]),
      );
      temperatures[ductIndex] = dampedTemperature;
    }

    if (maximumDifference <= input.temperatureToleranceC) {
      converged = true;
      break;
    }
  }

  for (let ductIndex = 0; ductIndex < ductCount; ductIndex++) {
    cells[ductIndex].operatingTemperatureC = temperatures[ductIndex];
  }

  // MinBy / MaxBy in .NET return the FIRST element holding the extreme value.
  let limitingAmpacityCell = cells[0];
  let hottestOperatingCell = cells[0];
  for (const cell of cells) {
    if (cell.ampacityAmps < limitingAmpacityCell.ampacityAmps) limitingAmpacityCell = cell;
    if (cell.operatingTemperatureC > hottestOperatingCell.operatingTemperatureC) {
      hottestOperatingCell = cell;
    }
  }

  return {
    cells,
    minimumAmpacityAmps: limitingAmpacityCell.ampacityAmps,
    limitingAmpacityRow: limitingAmpacityCell.row,
    limitingAmpacityColumn: limitingAmpacityCell.column,
    maximumOperatingTemperatureC: hottestOperatingCell.operatingTemperatureC,
    hottestOperatingRow: hottestOperatingCell.row,
    hottestOperatingColumn: hottestOperatingCell.column,
    temperatureConverged: converged,
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
