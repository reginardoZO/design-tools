const NEC_FILL_FACTORS = [
  { maximumConductors: 1, factor: 0.53 },
  { maximumConductors: 2, factor: 0.31 },
  { maximumConductors: Infinity, factor: 0.4 },
];

export const SUPPORTED_CONDUIT_SIZES = [
  "1/2",
  "3/4",
  "1",
  "1-1/4",
  "1-1/2",
  "2",
  "2-1/2",
  "3",
  "3-1/2",
  "4",
  "5",
  "6",
];

// NEC 2023 Chapter 9, Table 4: PVC Schedule 40 internal areas, in².
export const NEC_PVC_SCH40_CONDUITS = {
  "1/2": { Size: "1/2", insideDiameter: 0.602, internalArea: 0.285 },
  "3/4": { Size: "3/4", insideDiameter: 0.804, internalArea: 0.508 },
  "1": { Size: "1", insideDiameter: 1.029, internalArea: 0.832 },
  "1-1/4": { Size: "1-1/4", insideDiameter: 1.360, internalArea: 1.453 },
  "1-1/2": { Size: "1-1/2", insideDiameter: 1.590, internalArea: 1.986 },
  "2": { Size: "2", insideDiameter: 2.067, internalArea: 3.356 },
  "2-1/2": { Size: "2-1/2", insideDiameter: 2.445, internalArea: 4.695 },
  "3": { Size: "3", insideDiameter: 3.09, internalArea: 7.499 },
  "3-1/2": { Size: "3-1/2", insideDiameter: 3.521, internalArea: 9.737 },
  "4": { Size: "4", insideDiameter: 4.03, internalArea: 12.754 },
  "5": { Size: "5", insideDiameter: 5.016, internalArea: 19.761 },
  "6": { Size: "6", insideDiameter: 6.049, internalArea: 28.727 },
};

export function circleArea(diameterInches) {
  return Math.PI * (diameterInches / 2) ** 2;
}

export function conduitInsideDiameter(conduit) {
  return conduit.insideDiameter ?? conduit.Average_OD_in - 2 * conduit.SCH40_Minimum_wall;
}

export function fillFactorFor(conductorCount) {
  return NEC_FILL_FACTORS.find((entry) => conductorCount <= entry.maximumConductors).factor;
}

/**
 * Checks for jamming risk when pulling 3 conductors of equal size through bends in conduit.
 * Jamming Ratio J = Inside Diameter (D) / Cable OD (d)
 * Critical risk when 2.8 <= J <= 3.2 (cables can line up flat and wedge against the conduit wall).
 */
export function checkJammingRisk(insideDiameter, activeRows) {
  const individualCables = [];
  for (const row of activeRows) {
    for (let i = 0; i < row.quantity; i++) {
      individualCables.push({
        diameter: row.diameter,
        type: row.type || 'single',
      });
    }
  }

  // Jamming primarily occurs with 3 cables pulled simultaneously
  if (individualCables.length !== 3) {
    return { applies: false, ratio: null, status: 'none', message: '' };
  }

  const d1 = individualCables[0].diameter;
  const d2 = individualCables[1].diameter;
  const d3 = individualCables[2].diameter;

  const maxD = Math.max(d1, d2, d3);
  const minD = Math.min(d1, d2, d3);
  const avgD = (d1 + d2 + d3) / 3;

  // Check if they are similar diameter (within 10%)
  if (maxD - minD > avgD * 0.1) {
    return { applies: false, ratio: null, status: 'none', message: '' };
  }

  const ratio = insideDiameter / avgD;

  if (ratio >= 2.8 && ratio <= 3.2) {
    return {
      applies: true,
      ratio,
      status: 'critical',
      severity: 'high',
      message: `Jamming Ratio D/d = ${ratio.toFixed(2)} is in the critical zone (2.8 – 3.2). Risk of cables wedging and jamming during pulling through conduit bends.`,
    };
  }

  if ((ratio >= 2.5 && ratio < 2.8) || (ratio > 3.2 && ratio <= 3.5)) {
    return {
      applies: true,
      ratio,
      status: 'caution',
      severity: 'medium',
      message: `Jamming Ratio D/d = ${ratio.toFixed(2)} is in the caution zone (2.5 – 2.8 or 3.2 – 3.5). Ensure adequate bend radius and pulling lubricant.`,
    };
  }

  return {
    applies: true,
    ratio,
    status: 'safe',
    severity: 'low',
    message: `Jamming Ratio D/d = ${ratio.toFixed(2)} is safe (< 2.5 or > 3.5). Low risk of wedging in bends.`,
  };
}

export function calculateConduitFill(conduit, cableRows) {
  const activeRows = cableRows.filter((row) => row.quantity > 0 && row.diameter > 0);
  const cableCount = activeRows.reduce((total, row) => total + row.quantity, 0);
  const totalConductors = activeRows.reduce(
    (total, row) => total + row.quantity * (row.cores || 1),
    0,
  );
  const usedArea = activeRows.reduce(
    (total, row) => total + row.quantity * circleArea(row.diameter),
    0,
  );
  const insideDiameter = conduitInsideDiameter(conduit);
  const conduitArea = conduit.internalArea ?? circleArea(insideDiameter);
  const fillFactor = cableCount ? fillFactorFor(cableCount) : 0;
  const allowedArea = conduitArea * fillFactor;
  const remainingArea = allowedArea - usedArea;
  const jamming = checkJammingRisk(insideDiameter, activeRows);

  return {
    cableCount,
    conductorCount: cableCount, // maintained for backward compatibility
    totalConductors,
    usedArea,
    insideDiameter,
    conduitArea,
    fillFactor,
    allowedArea,
    remainingArea,
    fillPercent: conduitArea ? (usedArea / conduitArea) * 100 : 0,
    fits: cableCount > 0 && remainingArea >= -0.000001,
    jamming,
  };
}