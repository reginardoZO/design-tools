// NFPA 780-2020, Annex L, Section L.6 — detailed risk assessment engine.
// Isomorphic (browser + `node --test`), extracted from the standalone
// NFPA780AnnexLdetailedLRA.html reference page so the math is unit-testable
// and shared with the hub-styled apps/lightning-risk/detailed.html page.
//
// This engine deliberately follows the BODY TEXT of NFPA 780-2020 Annex L
// §L.6.6 rather than the printed Figure L.6.8 worksheet, which contradicts
// the body text in three places (see the "Honest note about the 2020
// edition" section rendered in detailed.html). R2/R3/R4 reuse the SAME
// RA-RZ components computed for R1 (per §L.6.5 and confirmed against a real
// third-party LPS design report, apps/lightning-risk/detailed.pdf) rather
// than introducing separate per-risk loss factors.
"use strict";

/* Table L.6.2 — tolerable risk */
export const RT = { R1: 1e-5, R2: 1e-3, R3: 1e-3 };

/* feet -> metres, used by the UI so every distance input stays in ft/ft2
   while the NFPA formulas (which are metric, N_g is flashes/km2/yr) run
   internally in metres/m2. */
export const FT = 0.3048;
export const FT2 = FT * FT;

/* Table L.6.7.5 — KS -> PM, descending KS breakpoints */
export const PM_KS_ROWS = [
  { ks: 0.4, pm: 1, t: "K_S > 0.4" },
  { ks: 0.15, pm: 0.9 },
  { ks: 0.07, pm: 0.5 },
  { ks: 0.035, pm: 0.1 },
  { ks: 0.021, pm: 0.01 },
  { ks: 0.016, pm: 0.005 },
  { ks: 0.015, pm: 0.003 },
  { ks: 0.014, pm: 0.001 },
  { ks: 0.013, pm: 0.0001, t: "K_S < 0.013" },
];

/* Table L.6.7.7 columns (kV) shared by PU and PZ lookups */
export const UW_COLUMNS = [1, 1.5, 2.5, 4, 6];

export const clamp1 = (x) => Math.min(1, x);

// Equivalent collection area of a rectangular structure/service-end structure
// (§L.4.1.1): footprint + 2*(offset)*(L+W) straight bands + pi*offset^2 corners,
// with offset = 3H for the structure itself.
export function collectionArea(L, W, H) {
  return L * W + 6 * H * (L + W) + 9 * Math.PI * H * H;
}

// §L.6.6.1.2 — collection area for flashes landing within `radius` metres of
// the perimeter (500 m per the 2020 body text), same shape as collectionArea
// but with a fixed radius instead of 3H.
export function nearStructureArea(L, W, radius) {
  return L * W + 2 * radius * (L + W) + Math.PI * radius * radius;
}

// Table L.6.7.5 — KS -> PM, read as a step function (no interpolation).
export function pmFromKs(ks) {
  if (ks > 0.4) return { pm: 1, row: "K_S > 0.4" };
  for (let i = PM_KS_ROWS.length - 1; i >= 0; i -= 1) {
    if (ks <= PM_KS_ROWS[i].ks) return { pm: PM_KS_ROWS[i].pm, row: "K_S \u2264 " + PM_KS_ROWS[i].ks };
  }
  return { pm: 1, row: "K_S > 0.4" };
}

// Column index into a 5-value PU/PZ table row for a given withstand voltage.
export function uwIndex(uw) {
  const i = UW_COLUMNS.indexOf(uw);
  if (i >= 0) return i;
  return uw >= 6 ? 4 : uw >= 4 ? 3 : uw >= 2.5 ? 2 : uw >= 1.5 ? 1 : 0;
}

/**
 * Full detailed-method computation, §L.6.6.
 *
 * `s` (state) shape:
 *   Ng, L, W, H, CD, radius (m, 500 for the 2020 edition), ADmanualM2 (m2, CAD override),
 *   adj, adjL, adjW, adjH, adjCD, adjManualM2 (m2, CAD override),
 *   PA, PB, PC,
 *   ks1metal | (WM1, ks1close), ks2mode('none'|'mesh'|'metal'), WM2, ks2close, ks2metal,
 *   KS3, ks3conduit, UW, spdCoord,
 *   lossMode('typical'|'persons'), LT, LF, LO, nZ, nT, tZ,
 *   rt, rp, rf, hZ,
 *   r1extra, useR2, useR3, animals,
 *   services: [{ LL, CE, CT, shield(row key into puRow/table), spdEB, PAline, mesh, adjEnd }]
 *
 * Service PU/PZ table rows must be resolved by the caller into `puRow`/`pzRow`
 * (5-value arrays keyed by UW_COLUMNS) — this keeps the engine itself free of
 * table-row lookups, mirroring the caller/engine split already used by
 * apps/lightning-risk/js/detailed-risk-calc.js.
 */
export function computeDetailedRisk(s) {
  const o = {};
  const Ng = s.Ng;

  // §L.4.1.2 permits a CAD-measured A_D for an irregular footprint instead
  // of the L*W*H rectangular equation (mirrors the adjacent-structure override below).
  o.AD = s.ADmanualM2 > 0 ? s.ADmanualM2 : collectionArea(s.L, s.W, s.H);
  o.AM = nearStructureArea(s.L, s.W, s.radius);
  o.ND = Ng * o.AD * s.CD * 1e-6;
  o.NM = Math.max(0, Ng * (o.AM - o.AD) * s.CD * 1e-6);
  o.ADJ = s.adj
    ? (s.adjManualM2 > 0 ? s.adjManualM2 : collectionArea(s.adjL, s.adjW, s.adjH))
    : 0;

  o.PA = s.PA;
  o.PB = s.PB;
  o.PC = s.PC;

  o.KS1 = s.ks1mode === "metal" ? s.ks1metal : clamp1(0.12 * s.WM1 * (s.ks1close ? 2 : 1));
  o.KS2 = s.ks2mode === "none" ? 1
    : s.ks2mode === "metal" ? s.ks2metal
    : clamp1(0.12 * s.WM2 * (s.ks2close ? 2 : 1));
  o.KS3 = s.KS3 * (s.ks3conduit ? 0.1 : 1);
  o.KS4 = clamp1(1.5 / s.UW);
  o.KS = o.KS1 * o.KS2 * o.KS3 * o.KS4;
  const pmk = pmFromKs(o.KS);
  o.PM_KS = pmk.pm;
  o.PM_row = pmk.row;

  if (s.UW < 1.5) {
    o.PM = 1;
    o.PM_why = "U_W below 1.5 kV \u2192 L.6.6.2.4 fixes P_M = 1";
  } else if (!s.spdCoord) {
    o.PM = 1;
    o.PM_why = "no coordinated SPDs at the utilization equipment \u2192 worksheet L.6.8 fixes P_M = 1";
  } else {
    o.PM = Math.min(o.PC, o.PM_KS);
    o.PM_why = "coordinated SPDs installed \u2192 P_M = lower of P_C and P_M(K_S)";
  }

  const ui = uwIndex(s.UW);
  o.svc = s.services.map((v) => {
    const r = { name: v.name, type: v.type };
    r.AL = v.mesh ? 0 : 40 * v.LL;
    r.AI = v.mesh ? 0 : 4000 * v.LL;
    r.NL = Ng * r.AL * v.CE * v.CT * 1e-6;
    r.NI = Ng * r.AI * v.CE * v.CT * 1e-6;
    r.NDJ = v.adjEnd && s.adj ? Ng * o.ADJ * s.adjCD * v.CT * 1e-6 : 0;
    r.NLJ = r.NL + r.NDJ;
    r.NIZ = Math.max(0, r.NI - r.NL);

    r.PUtab = v.puRow[ui];
    r.PZtab = v.pzRow[ui];
    r.PVW = v.spdEB ? Math.min(o.PC, r.PUtab) : r.PUtab;
    r.PU = r.PVW * v.PAline;
    r.PV = r.PVW;
    r.PW = r.PVW;
    r.PZ = v.spdEB ? Math.min(o.PC, r.PZtab) : r.PZtab;
    return r;
  });

  const f = s.lossMode === "persons" ? (s.nZ / s.nT) * (s.tZ / 8760) : 1;
  o.f = f;
  o.LT = s.LT; o.LF = s.LF; o.LO = s.LO;
  o.LA = o.LU = s.rt * s.LT * f;
  o.LB = o.LV = s.rp * s.rf * s.hZ * s.LF * f;
  o.LC = o.LM = o.LW = o.LZ = s.LO * f;

  o.RA = o.ND * o.PA * o.LA;
  o.RB = o.ND * o.PB * o.LB;
  o.RC = o.ND * o.PC * o.LC;
  o.RM = o.NM * o.PM * o.LM;
  o.RU = o.RV = o.RW = o.RZ = 0;
  o.svc.forEach((r) => {
    r.RU = r.NLJ * r.PU * o.LU; o.RU += r.RU;
    r.RV = r.NLJ * r.PV * o.LV; o.RV += r.RV;
    r.RW = r.NLJ * r.PW * o.LW; o.RW += r.RW;
    r.RZ = r.NIZ * r.PZ * o.LZ; o.RZ += r.RZ;
  });

  o.R1 = o.RA + o.RB + o.RU + o.RV + (s.r1extra ? o.RC + o.RM + o.RW + o.RZ : 0);
  o.R2 = o.RB + o.RC + o.RM + o.RV + o.RW + o.RZ;
  o.R3 = o.RB + o.RV;
  o.R4 = o.RB + o.RC + o.RM + o.RV + o.RW + o.RZ + (s.animals ? o.RA + o.RU : 0);
  o.R = o.R1 + o.R2 + o.R3 + o.R4;

  o.pass = { R1: o.R1 <= RT.R1, R2: o.R2 <= RT.R2, R3: o.R3 <= RT.R3 };
  return o;
}
