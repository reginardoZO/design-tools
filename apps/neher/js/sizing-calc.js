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
      return ['kVA'];
    case 'GENERATOR':
      return ['kVA', 'kW', 'HP'];
    default:
      return [];
  }
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
