const NEC_FILL_FACTORS = [
  { maximumConductors: 1, factor: 0.53 },
  { maximumConductors: 2, factor: 0.31 },
  { maximumConductors: Infinity, factor: 0.4 },
];

export const SUPPORTED_CONDUIT_SIZES = ["2", "3", "4", "5", "6"];

// NEC 2023 Chapter 9, Table 4: PVC Schedule 40 internal areas, in².
export const NEC_PVC_SCH40_CONDUITS = {
  "2": { Size: "2", insideDiameter: 2.067, internalArea: 3.356 },
  "3": { Size: "3", insideDiameter: 3.09, internalArea: 7.499 },
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

export function calculateConduitFill(conduit, cableRows) {
  const activeRows = cableRows.filter((row) => row.quantity > 0 && row.diameter > 0);
  const conductorCount = activeRows.reduce((total, row) => total + row.quantity, 0);
  const usedArea = activeRows.reduce(
    (total, row) => total + row.quantity * circleArea(row.diameter),
    0,
  );
  const insideDiameter = conduitInsideDiameter(conduit);
  const conduitArea = conduit.internalArea ?? circleArea(insideDiameter);
  const fillFactor = conductorCount ? fillFactorFor(conductorCount) : 0;
  const allowedArea = conduitArea * fillFactor;
  const remainingArea = allowedArea - usedArea;

  return {
    conductorCount,
    usedArea,
    insideDiameter,
    conduitArea,
    fillFactor,
    allowedArea,
    remainingArea,
    fillPercent: conduitArea ? (usedArea / conduitArea) * 100 : 0,
    fits: conductorCount > 0 && remainingArea >= -0.000001,
  };
}