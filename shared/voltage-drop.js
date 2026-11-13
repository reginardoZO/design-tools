// Southwire / NEC Chapter 9 Table 9 reference: 75°C, PVC conduit, ohms/1000 ft.
export const CABLES = [
  { size: "14 AWG", rCu: 3.1, rAl: null, x: 0.058, ampCu: 20, ampAl: null },
  { size: "12 AWG", rCu: 2.0, rAl: 3.2, x: 0.054, ampCu: 25, ampAl: 20 },
  { size: "10 AWG", rCu: 1.2, rAl: 2.0, x: 0.050, ampCu: 35, ampAl: 30 },
  { size: "8 AWG", rCu: 0.78, rAl: 1.3, x: 0.052, ampCu: 50, ampAl: 40 },
  { size: "6 AWG", rCu: 0.49, rAl: 0.81, x: 0.051, ampCu: 65, ampAl: 50 },
  { size: "4 AWG", rCu: 0.31, rAl: 0.51, x: 0.048, ampCu: 85, ampAl: 65 },
  { size: "3 AWG", rCu: 0.25, rAl: 0.40, x: 0.047, ampCu: 100, ampAl: 75 },
  { size: "2 AWG", rCu: 0.19, rAl: 0.32, x: 0.045, ampCu: 115, ampAl: 90 },
  { size: "1 AWG", rCu: 0.15, rAl: 0.25, x: 0.046, ampCu: 130, ampAl: 100 },
  { size: "1/0 AWG", rCu: 0.12, rAl: 0.20, x: 0.044, ampCu: 150, ampAl: 120 },
  { size: "2/0 AWG", rCu: 0.10, rAl: 0.16, x: 0.043, ampCu: 175, ampAl: 135 },
  { size: "3/0 AWG", rCu: 0.077, rAl: 0.13, x: 0.042, ampCu: 200, ampAl: 155 },
  { size: "4/0 AWG", rCu: 0.062, rAl: 0.10, x: 0.041, ampCu: 230, ampAl: 180 },
  { size: "250 kcmil", rCu: 0.052, rAl: 0.085, x: 0.041, ampCu: 255, ampAl: 205 },
  { size: "300 kcmil", rCu: 0.044, rAl: 0.071, x: 0.041, ampCu: 285, ampAl: 230 },
  { size: "350 kcmil", rCu: 0.038, rAl: 0.061, x: 0.040, ampCu: 310, ampAl: 250 },
  { size: "400 kcmil", rCu: 0.033, rAl: 0.054, x: 0.040, ampCu: 335, ampAl: 270 },
  { size: "500 kcmil", rCu: 0.027, rAl: 0.043, x: 0.039, ampCu: 380, ampAl: 310 },
  { size: "600 kcmil", rCu: 0.023, rAl: 0.036, x: 0.039, ampCu: 420, ampAl: 340 },
  { size: "750 kcmil", rCu: 0.019, rAl: 0.029, x: 0.038, ampCu: 475, ampAl: 385 },
  { size: "1000 kcmil", rCu: 0.015, rAl: 0.023, x: 0.037, ampCu: 545, ampAl: 445 },
];

export function calcVD(cable, { material, phases, current, lengthFt, pf, n, voltage }) {
  const r = material === "cu" ? cable.rCu : cable.rAl;
  const amp = material === "cu" ? cable.ampCu : cable.ampAl;
  if (r == null) return null;
  const sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
  const zEff = r * pf + cable.x * sinPhi;
  const k = phases === 3 ? Math.sqrt(3) : 2;
  const vd = (k * current * zEff * (lengthFt / 1000)) / n;
  const pct = (vd / voltage) * 100;
  return { vd, pct, zEff, amp, ampOk: amp != null && current / n <= amp };
}
