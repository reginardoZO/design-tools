/**
 * Port of the Current Calc helpers in EleCalc/Neher/Neher.xaml.cs.
 */
/** Port of NeherCalc.retornaUnidades. */
export function retornaUnidades(carga) {
  switch (carga) {
    case 'MOTOR':
      return ['kW', 'HP'];
    case 'XFRM':
      return ['kVA'];
    case 'HEATER':
      return ['kW'];
    case 'FEEDER':
      return []; // sized from the upstream OCPD rating, not from the connected load
    case 'GENERATOR':
      return ['kVA', 'kW', 'HP'];
    default:
      return [];
  }
}

/** Standard ampere ratings of NEC 240.6(A). */
export const NEC_STANDARD_OCPD_RATINGS = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250,
  300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000,
];

/** True when the load type is sized from its overcurrent device instead of its load. */
export function usesBreakerRating(carga) {
  return carga === 'FEEDER';
}

/**
 * NEC 240.4 requires a feeder conductor to be protected at its ampacity, and the
 * 240.6(A) rating of the upstream device already embeds the 125 % continuous-load
 * allowance of 215.2(A)(1) — so the design current is the device rating itself and
 * no further factor is applied.
 */
export function calculateFeederCurrent({ breakerRating }) {
  return breakerRating > 0 ? breakerRating : NaN;
}

/** Port of btnCurrentMain_Click. `powerFactor`/`efficiency` are 1 when disabled. */
export function calculateSizedCurrent({ powerUnit, power, voltage, powerFactor, efficiency, factor }) {
  let sizedCurrent = 0;

  switch (powerUnit) {
    case 'kW':
      sizedCurrent = (power * 1000) / (Math.sqrt(3) * voltage * powerFactor * efficiency);
      break;
    case 'HP':
      sizedCurrent = (power * 0.7456 * 1000) / (Math.sqrt(3) * voltage * powerFactor * efficiency);
      break;
    case 'kVA':
      sizedCurrent = (power * 1000) / (Math.sqrt(3) * voltage);
      break;
    default:
      return 0;
  }

  return sizedCurrent * factor;
}
