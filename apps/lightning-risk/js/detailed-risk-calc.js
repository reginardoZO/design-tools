// Pure NFPA 780 Annex L "detailed method" math, isomorphic (browser + node --test).
// Extracted from the inline calcAll() in index.html so it can be unit-tested against
// third-party reference reports without duplicating the formulas.
"use strict";

export const FT = 0.3048;
export const FT2 = FT * FT;

// Equivalent collection area of a rectangular structure (L, W, H in metres).
export function collArea(L, W, H) {
  return L * W + 6 * H * (L + W) + 9 * Math.PI * H * H;
}

// PM lookup table (IEC 62305-2 / NFPA 780 Annex L Table L.6.7.5 shape) from KS.
export function pmTable(ks) {
  if (ks > 0.4) return 1;
  if (ks >= 0.15) return 0.9;
  if (ks >= 0.07) return 0.5;
  if (ks >= 0.035) return 0.1;
  if (ks >= 0.021) return 0.01;
  if (ks >= 0.016) return 0.005;
  if (ks >= 0.015) return 0.003;
  if (ks >= 0.014) return 0.001;
  return 0.0001;
}

// Column index into a 5-value PU/PZ table row ([1.5, 2.5, 4, 6] kV breakpoints).
export function uwIndex(u) {
  return u >= 6 ? 4 : u >= 4 ? 3 : u >= 2.5 ? 2 : u >= 1.5 ? 1 : 0;
}

// Per-service annual threat frequencies (NL, NI, NDJ) and probabilities (PU, PV, PW, PZ).
// `s` fields are already resolved to plain numbers/rows by the caller (no table lookups here).
export function serviceCalc(s, N, PC, PA) {
  if (!s.on) return { NL: 0, NI: 0, NDJ: 0, PU: 0, PV: 0, PW: 0, PZ: 0, LL: 0 };
  const LL = Math.min(1000, Math.max(0, s.lengthFt * FT));
  const CE = s.ce ?? 1;
  const CT = Number(s.ct) || 1;
  const AL = 40 * LL, AI = 4000 * LL;
  const NL = N * AL * CE * CT * 1e-6;
  const NI = N * AI * CE * CT * 1e-6;
  const aL = (s.aLft || 0) * FT, aW = (s.aWft || 0) * FT, aH = (s.aHft || 0) * FT;
  const ADJ = s.adjManualM2 > 0 ? s.adjManualM2 : (aL > 0 && aW > 0) ? collArea(aL, aW, aH) : 0;
  const CDJ = s.aCD ?? 1;
  const NDJ = N * ADJ * CDJ * CT * 1e-6;
  const ui = uwIndex(s.uw);
  let PU = s.puRow?.[ui] ?? 1;
  if (s.spd) PU = Math.min(PC, PU);
  if (s.reduce) PU *= PA;
  const PV = s.spd ? Math.min(PC, s.puRow?.[ui] ?? 1) : (s.puRow?.[ui] ?? 1);
  const PW = PV;
  let PZ = s.pzRow?.[ui] ?? 1;
  if (s.spd) PZ = Math.min(PC, PZ);
  return { NL, NI, NDJ, PU, PV, PW, PZ, LL, ADJ };
}

// Generic single-value risk sum used for R4 (touch/physical/internal-system loss factors a/b/c).
export function genericRisk(ND, NM, PB, PC, PM, lineData, a, b, c, includeTouch, PA, rt) {
  let R = (includeTouch ? ND * PA * (rt * a) : 0) + ND * PB * b + ND * PC * c + NM * PM * c;
  lineData.forEach(x => {
    R += (includeTouch ? (x.NL + x.NDJ) * x.PU * (rt * a) : 0) + (x.NL + x.NDJ) * x.PV * b + (x.NL + x.NDJ) * x.PW * c + x.NI * x.PZ * c;
  });
  return R;
}

// Full detailed-method computation. `inputs.services` is an array of serviceCalc() inputs.
export function computeDetailedRisk(inputs) {
  const {
    N, L, W, H, ADmanualM2 = null, CD, radius,
    PA, PB, PC,
    KS1, KS2, KS3, UW, pmUnknown = false, pmCoordinated = false,
    LT, LF, LO, rt, rp, rf, hz,
    critical = false,
    services = [],
    r2 = null, r3 = null, r4 = null,
  } = inputs;

  const AD = ADmanualM2 != null && ADmanualM2 > 0 ? ADmanualM2 : collArea(L, W, H);
  const ND = N * AD * CD * 1e-6;
  const AM = 2 * radius * (L + W) + Math.PI * radius * radius;
  const NM = N * Math.max(0, AM - AD) * CD * 1e-6;

  const KS4 = 1.5 / UW;
  const KS = KS1 * KS2 * KS3 * KS4;
  let PM;
  if (pmUnknown) {
    PM = 1;
  } else {
    PM = pmTable(KS);
    if (pmCoordinated) PM = Math.min(PC, PM);
  }

  const LA = rt * LT, LB = rp * rf * hz * LF, LC = LO;
  const lineData = services.map(s => serviceCalc(s, N, PC, PA));

  const RA = ND * PA * LA;
  const RB = ND * PB * LB;
  const RC = critical ? ND * PC * LC : 0;
  const RM = critical ? NM * PM * LC : 0;
  let RU = 0, RV = 0, RW = 0, RZ = 0;
  lineData.forEach(x => {
    RU += (x.NL + x.NDJ) * x.PU * LA;
    RV += (x.NL + x.NDJ) * x.PV * LB;
    if (critical) { RW += (x.NL + x.NDJ) * x.PW * LC; RZ += x.NI * x.PZ * LC; }
  });
  const R1 = RA + RB + RC + RM + RU + RV + RW + RZ;

  let R2 = 0;
  if (r2?.on) {
    const LB2 = rp * rf * r2.lf2, LC2 = r2.lo2;
    R2 = ND * PB * LB2 + ND * PC * LC2 + NM * PM * LC2;
    lineData.forEach(x => { R2 += (x.NL + x.NDJ) * x.PV * LB2 + (x.NL + x.NDJ) * x.PW * LC2 + x.NI * x.PZ * LC2; });
  }

  let R3 = 0;
  if (r3?.on) {
    const LB3 = rp * rf * r3.lf3;
    R3 = ND * PB * LB3;
    lineData.forEach(x => { R3 += (x.NL + x.NDJ) * x.PV * LB3; });
  }

  let R4 = 0;
  if (r4?.on) {
    R4 = genericRisk(ND, NM, PB, PC, PM, lineData, r4.lt4, rp * rf * r4.lf4, r4.lo4, true, PA, rt);
  }

  const totals = {
    NL: lineData.reduce((a, x) => a + x.NL, 0),
    NI: lineData.reduce((a, x) => a + x.NI, 0),
    NDJ: lineData.reduce((a, x) => a + x.NDJ, 0),
  };

  return {
    AD, AM, ND, NM, KS, PM, LA, LB, LC,
    components: { RA, RB, RC, RM, RU, RV, RW, RZ },
    R1, R2, R3, R4,
    totals, lineData,
  };
}
