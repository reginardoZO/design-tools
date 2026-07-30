/* ============================================================================
   NEC CABLE TRAY AMPACITY & CABLE SIZING TOOL — COPPER CONDUCTORS ONLY
   ----------------------------------------------------------------------------
   Scope (NEC 2023 numbering, with 2017 equivalents noted):
   - NEC 392.80(A): cables rated 2000 V or less in cable tray
   - NEC 392.80(B): cables rated 2001 V to 35 kV in cable tray (here: up to 15 kV)
   - Base ampacity tables: 310.16, 310.17, 310.20 (LV) and Article 315 MV
     tables 315.60(C)(1)/(C)(3)/(C)(5) [2014-2020 legacy numbering:
     310.60/311.60(C)(67)/(C)(69)/(C)(71)]
   - Ambient correction 310.15(B)(1) / 315.60(D)(4)
   - Adjustment factors 310.15(C)(1) (only where 392.80(A)(1)(a) invokes them)
   - Termination limits 110.14(C) (low voltage)
   - Parallel conductors 310.10(G) (1/0 AWG and larger)
   - Load rules: 430.22 & 430.250/430.248 (motors), 445.13 (generators),
     450 + 215.2 (transformers/feeders), 424.3(B) (fixed electric heating)
   ----------------------------------------------------------------------------
   IMPORTANT: table data transcribed for engineering study purposes. Always
   verify against the official NEC edition adopted in your jurisdiction before
   using results in a real design.
   ========================================================================== */

/* ----------------------------- AMPACITY DATA ----------------------------- */

// NEC Table 310.16 — Insulated conductors in raceway/cable/earth, 30°C ambient.
// [60°C, 75°C, 90°C] — copper.
const T310_16 = {
  "14": [15, 20, 25], "12": [20, 25, 30], "10": [30, 35, 40], "8": [40, 50, 55],
  "6": [55, 65, 75], "4": [70, 85, 95], "3": [85, 100, 115], "2": [95, 115, 130],
  "1": [110, 130, 145], "1/0": [125, 150, 170], "2/0": [145, 175, 195],
  "3/0": [165, 200, 225], "4/0": [195, 230, 260], "250": [215, 255, 290],
  "300": [240, 285, 320], "350": [260, 310, 350], "400": [280, 335, 380],
  "500": [320, 380, 430], "600": [350, 420, 475], "700": [385, 460, 520],
  "750": [400, 475, 535], "800": [410, 490, 555], "900": [435, 520, 585],
  "1000": [455, 545, 615],
};

// NEC Table 310.17 — Single insulated conductors in free air, 30°C ambient.
const T310_17 = {
  "14": [25, 30, 35], "12": [30, 35, 40], "10": [40, 50, 55], "8": [60, 70, 80],
  "6": [80, 95, 105], "4": [105, 125, 140], "3": [120, 145, 165], "2": [140, 170, 190],
  "1": [165, 195, 220], "1/0": [195, 230, 260], "2/0": [225, 265, 300],
  "3/0": [260, 310, 350], "4/0": [300, 360, 405], "250": [340, 405, 455],
  "300": [375, 445, 500], "350": [420, 505, 570], "400": [455, 545, 615],
  "500": [515, 620, 700], "600": [575, 690, 780], "700": [630, 755, 850],
  "750": [655, 785, 885], "800": [680, 815, 920], "900": [730, 870, 980],
  "1000": [780, 935, 1055],
};

// NEC Table 310.20 — Bare/covered messenger-supported (triplexed) — 40°C ambient.
// [75°C, 90°C] — copper. Used by 392.80(A)(2)(d) for trefoil @ 2.15×OD spacing.
const T310_20 = {
  "8": [57, 66], "6": [76, 89], "4": [101, 117], "3": [118, 138], "2": [135, 158],
  "1": [158, 185], "1/0": [183, 214], "2/0": [212, 247], "3/0": [245, 287],
  "4/0": [287, 335], "250": [320, 374], "300": [359, 419], "350": [397, 464],
  "400": [430, 503], "500": [496, 580], "600": [553, 647], "700": [610, 714],
  "750": [638, 747], "800": [660, 773], "900": [704, 826], "1000": [748, 879],
};

// NEC 2023 Table 315.60(C)(3) [legacy 310.60/311.60(C)(69)] — Single insulated
// copper conductor ISOLATED IN AIR, 40°C ambient. v5 = 2001–5000 V,
// v15 = 5001–15,000 V column. [90°C, 105°C]. VALUES VERIFIED against the
// official NEC 2023 table (user-provided scan, Jul 2026).
const MV_SINGLE_AIR = {
  //            2001-5000 V     5001-15,000 V (app scope <= 15 kV; the NEC
  //            [90, 105]       table has a third 15,001-35,000 V column and
  //                            sizes up to 2000 kcmil, not implemented here)
  "8":   { v5: [83, 93],    v15: null },
  "6":   { v5: [110, 120],  v15: [110, 125] },
  "4":   { v5: [145, 160],  v15: [150, 165] },
  "2":   { v5: [190, 215],  v15: [195, 215] },
  "1":   { v5: [225, 250],  v15: [225, 250] },
  "1/0": { v5: [260, 290],  v15: [260, 290] },
  "2/0": { v5: [300, 330],  v15: [300, 335] },
  "3/0": { v5: [345, 385],  v15: [345, 385] },
  "4/0": { v5: [400, 445],  v15: [400, 445] },
  "250": { v5: [445, 495],  v15: [445, 495] },
  "350": { v5: [550, 615],  v15: [550, 610] },
  "500": { v5: [695, 775],  v15: [685, 765] },
  "750": { v5: [900, 1000], v15: [885, 990] },
  "1000":{ v5: [1075, 1200],v15: [1060, 1185] },
};

// NEC 2023 Table 315.60(C)(1) [legacy 310.60/311.60(C)(67)] — Insulated copper
// conductors TRIPLEXED IN AIR, 40°C ambient. Used by 392.80(B)(2)(d) for
// trefoil groups spaced ≥ 2.15×OD. VALUES VERIFIED against the official
// NEC 2023 table (user-provided scan, Jul 2026).
const MV_TRIPLEXED_AIR = {
  //            2001-5000 V     5001-35,000 V
  "8":   { v5: [65, 74],   v15: null },
  "6":   { v5: [90, 99],   v15: [100, 110] },
  "4":   { v5: [120, 130], v15: [130, 140] },
  "2":   { v5: [160, 175], v15: [170, 195] },
  "1":   { v5: [185, 205], v15: [195, 225] },
  "1/0": { v5: [215, 240], v15: [225, 255] },
  "2/0": { v5: [250, 275], v15: [260, 295] },
  "3/0": { v5: [290, 320], v15: [300, 340] },
  "4/0": { v5: [335, 375], v15: [345, 390] },
  "250": { v5: [375, 415], v15: [380, 430] },
  "350": { v5: [465, 515], v15: [470, 525] },
  "500": { v5: [580, 645], v15: [580, 650] },
  "750": { v5: [750, 835], v15: [730, 820] },
  "1000":{ v5: [880, 980], v15: [850, 950] },
};

// NEC 2023 Table 315.60(C)(5) [legacy 310.60/311.60(C)(71)] — THREE-CONDUCTOR
// copper cable isolated in air, 40°C ambient. VALUES VERIFIED against the
// official NEC 2023 table (user-provided scan, Jul 2026).
const MV_3C_AIR = {
  //            2001-5000 V     5001-35,000 V
  "8":   { v5: [59, 66],   v15: null },
  "6":   { v5: [79, 88],   v15: [93, 105] },
  "4":   { v5: [105, 115], v15: [120, 135] },
  "2":   { v5: [140, 154], v15: [165, 185] },
  "1":   { v5: [160, 180], v15: [185, 210] },
  "1/0": { v5: [185, 205], v15: [215, 240] },
  "2/0": { v5: [215, 240], v15: [245, 275] },
  "3/0": { v5: [250, 280], v15: [285, 315] },
  "4/0": { v5: [285, 320], v15: [325, 360] },
  "250": { v5: [320, 355], v15: [360, 400] },
  "350": { v5: [395, 440], v15: [435, 490] },
  "500": { v5: [485, 545], v15: [535, 600] },
  "750": { v5: [615, 685], v15: [670, 745] },
  "1000":{ v5: [705, 790], v15: [770, 860] },
};

// Copper cross-section in kcmil for comparison of parallel alternatives.
const KCMIL = {
  "14": 4.11, "12": 6.53, "10": 10.38, "8": 16.51, "6": 26.24, "4": 41.74,
  "3": 52.62, "2": 66.36, "1": 83.69, "1/0": 105.6, "2/0": 133.1, "3/0": 167.8,
  "4/0": 211.6, "250": 250, "300": 300, "350": 350, "400": 400, "500": 500,
  "600": 600, "700": 700, "750": 750, "800": 800, "900": 900, "1000": 1000,
};

// NEC Chapter 9, Table 9 — AC resistance (75°C) and reactance for copper
// conductors, ohms per 1000 ft, PVC-conduit columns (closest to nonmagnetic
// cable tray). [R_ac, X_L]. 700/800/900 kcmil are not listed in Table 9 and
// were interpolated between adjacent sizes.
const Z_TABLE9 = {
  "14": [3.1, 0.058], "12": [2.0, 0.054], "10": [1.2, 0.050], "8": [0.78, 0.052],
  "6": [0.49, 0.051], "4": [0.31, 0.048], "3": [0.25, 0.047], "2": [0.19, 0.045],
  "1": [0.15, 0.046], "1/0": [0.12, 0.044], "2/0": [0.10, 0.043],
  "3/0": [0.077, 0.042], "4/0": [0.062, 0.041], "250": [0.052, 0.041],
  "300": [0.044, 0.041], "350": [0.038, 0.040], "400": [0.033, 0.040],
  "500": [0.027, 0.039], "600": [0.023, 0.039], "700": [0.021, 0.038],
  "750": [0.019, 0.038], "800": [0.018, 0.038], "900": [0.017, 0.037],
  "1000": [0.015, 0.037],
};

// Voltage drop (%) for `n` conductors per phase, using effective impedance
// Zeff = R·cosφ + X·sinφ [NEC Ch.9 Table 9 note]. Length in feet (one-way).
// 3-phase: VD = √3·I·(L/1000)·Zeff/n ; 1-phase: VD = 2·I·(L/1000)·Zeff/n.
export function vdPercent(size, n, vd) {
  if (!vd || !vd.on) return null;
  const z = Z_TABLE9[size];
  if (!z || !(vd.volts > 0) || !(vd.amps > 0)) return null;
  const pf = Math.min(Math.max(vd.pf || 1, 0.05), 1);
  const sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
  const zeff = z[0] * pf + z[1] * sinPhi;
  const mult = vd.phases === 3 ? Math.sqrt(3) : 2;
  const dropV = (mult * vd.amps * (vd.lengthFt / 1000) * zeff) / n;
  return (dropV / vd.volts) * 100;
}

const LV_SIZE_ORDER = ["14","12","10","8","6","4","3","2","1","1/0","2/0","3/0","4/0","250","300","350","400","500","600","700","750","800","900","1000"];
const MV_SIZE_ORDER = ["8","6","4","2","1","1/0","2/0","3/0","4/0","250","350","500","750","1000"];
const sizeIdx = (s) => LV_SIZE_ORDER.indexOf(s) >= 0 ? LV_SIZE_ORDER.indexOf(s) : MV_SIZE_ORDER.indexOf(s);
const isKcmil = (s) => !isNaN(parseInt(s, 10)) && parseInt(s, 10) >= 250;
const sizeLabel = (s) => isKcmil(s) ? `${s} kcmil` : `${s} AWG`;

/* --------------------------- MOTOR FLC TABLES ---------------------------- */

// NEC Table 430.250 — Full-load current, three-phase AC motors (amperes).
// Columns: 200 V, 208 V, 230 V, 460 V, 575 V, 2300 V.
const FLC_3PH = {
  "0.5": [2.5, 2.4, 2.2, 1.1, 0.9, null],
  "0.75": [3.7, 3.5, 3.2, 1.6, 1.3, null],
  "1": [4.8, 4.6, 4.2, 2.1, 1.7, null],
  "1.5": [6.9, 6.6, 6.0, 3.0, 2.4, null],
  "2": [7.8, 7.5, 6.8, 3.4, 2.7, null],
  "3": [11.0, 10.6, 9.6, 4.8, 3.9, null],
  "5": [17.5, 16.7, 15.2, 7.6, 6.1, null],
  "7.5": [25.3, 24.2, 22, 11, 9, null],
  "10": [32.2, 30.8, 28, 14, 11, null],
  "15": [48.3, 46.2, 42, 21, 17, null],
  "20": [62.1, 59.4, 54, 27, 22, null],
  "25": [78.2, 74.8, 68, 34, 27, null],
  "30": [92, 88, 80, 40, 32, null],
  "40": [120, 114, 104, 52, 41, null],
  "50": [150, 143, 130, 65, 52, null],
  "60": [177, 169, 154, 77, 62, 16],
  "75": [221, 211, 192, 96, 77, 20],
  "100": [285, 273, 248, 124, 99, 26],
  "125": [359, 343, 312, 156, 125, 31],
  "150": [414, 396, 360, 180, 144, 37],
  "200": [552, 528, 480, 240, 192, 49],
  "250": [null, null, null, 302, 242, 60],
  "300": [null, null, null, 361, 289, 72],
  "350": [null, null, null, 414, 336, 83],
  "400": [null, null, null, 477, 382, 95],
  "450": [null, null, null, 515, 412, 103],
  "500": [null, null, null, 590, 472, 118],
};
const V_COLS_3PH = [200, 208, 230, 460, 575, 2300];

// NEC Table 430.248 — Full-load current, single-phase AC motors (amperes).
// Columns: 115 V, 230 V.
const FLC_1PH = {
  "0.5": [9.8, 4.9], "0.75": [13.8, 6.9], "1": [16, 8], "1.5": [20, 10],
  "2": [24, 12], "3": [34, 17], "5": [56, 28], "7.5": [80, 40], "10": [100, 50],
};
const V_COLS_1PH = [115, 230];

// NEC Table 250.122 — Minimum size equipment grounding conductors (COPPER
// column). [max OCPD rating (A), copper EGC size].
const T250_122 = [
  [15, "14"], [20, "12"], [60, "10"], [100, "8"], [200, "6"], [300, "4"],
  [400, "3"], [500, "2"], [600, "1"], [800, "1/0"], [1000, "2/0"],
  [1200, "3/0"], [1600, "4/0"], [2000, "250"], [2500, "350"], [3000, "400"],
  [4000, "500"], [5000, "700"], [6000, "800"],
];

// Equipment grounding conductor sizing, copper [250.122].
// - Base size from Table 250.122 by OCPD rating.
// - 250.122(B): if the ungrounded conductors were increased beyond the
//   minimum size with adequate ampacity (e.g., for voltage drop), the EGC
//   area increases at least proportionally (kcmil ratio).
// - 250.122(A): the EGC is not required to be larger than the circuit
//   conductors supplying the equipment.
export function egcSizing(ocpdA, selectedPhaseSize, minAmpacityPhaseSize) {
  if (!(ocpdA > 0)) return null;
  const entry = T250_122.find(([a]) => ocpdA <= a);
  if (!entry) return { error: "OCPD above 6000 A — Table 250.122 does not cover this rating." };
  const tableSize = entry[1];
  let finalSize = tableSize, upsized = false, ratio = 1;
  if (
    selectedPhaseSize && minAmpacityPhaseSize &&
    KCMIL[selectedPhaseSize] > KCMIL[minAmpacityPhaseSize]
  ) {
    ratio = KCMIL[selectedPhaseSize] / KCMIL[minAmpacityPhaseSize];
    const reqArea = KCMIL[tableSize] * ratio;
    const bigger = LV_SIZE_ORDER.find((s) => KCMIL[s] >= reqArea);
    finalSize = bigger || "1000";
    upsized = finalSize !== tableSize;
  }
  if (selectedPhaseSize && KCMIL[finalSize] > KCMIL[selectedPhaseSize]) {
    finalSize = selectedPhaseSize; // 250.122(A) cap
  }
  return { tableSize, finalSize, upsized, ratio };
}
// NEC Table 310.15(C)(1) — Adjustment factors for more than 3 CCC.
export function adjustmentFactor(ccc) {
  if (ccc <= 3) return 1.0;
  if (ccc <= 6) return 0.8;
  if (ccc <= 9) return 0.7;
  if (ccc <= 20) return 0.5;
  if (ccc <= 30) return 0.45;
  if (ccc <= 40) return 0.4;
  return 0.35;
}

/* ----------------------------- CALC ENGINE ------------------------------- */

// Ambient temperature correction.
// method "table": reproduces NEC Table 310.15(B)(1)(1)/(2) — the ambient is
//   taken at the top of its 5°C band and the factor is rounded to 2 decimals,
//   matching the printed table values (e.g. 42°C, 90°C col, 30°C basis → 0.87).
//   This is the (conservative) method used in IEEE PCIC-2023-14.
// method "equation": exact formula of 310.15(B)(1) / 315.60(D)(4):
//   K = sqrt((Tc − Ta)/(Tc − Tbase)).
export function ambientCorrection(condTempC, ambientC, tableBaseC, method = "table") {
  if (ambientC >= condTempC) return 0;
  if (method === "table") {
    const taBandTop = Math.ceil(ambientC / 5) * 5;
    if (taBandTop >= condTempC) return 0;
    const f = Math.sqrt((condTempC - taBandTop) / (condTempC - tableBaseC));
    return Math.round(f * 100) / 100;
  }
  return Math.sqrt((condTempC - ambientC) / (condTempC - tableBaseC));
}

// Returns { sizes, base(size), baseTableName, tableBaseAmbient, trayFactor,
//           trayRef, adjApplies, notes[] } for the selected installation.
function resolveMethod(cfg) {
  const { vClass, construction, arrangement, covered, insTemp } = cfg;
  const notes = [];

  if (vClass === "lv") {
    const col = insTemp === 60 ? 0 : insTemp === 75 ? 1 : 2;

    if (construction === "multi") {
      if (arrangement === "spaced1") {
        return {
          sizes: LV_SIZE_ORDER,
          base: (s) => T310_17[s]?.[col] ?? null,
          baseTableName: "Table 310.17 (free air)",
          tableBaseAmbient: 30,
          trayFactor: 1.0,
          trayRef: "392.80(A)(1)(c) — single layer, maintained spacing ≥ 1 cable diameter, uncovered tray",
          adjApplies: false,
          notes,
        };
      }
      // Touching / no maintained spacing
      const tf = covered ? 0.95 : 1.0;
      return {
        sizes: LV_SIZE_ORDER,
        base: (s) => T310_16[s]?.[col] ?? null,
        baseTableName: "Table 310.16",
        tableBaseAmbient: 30,
        trayFactor: tf,
        trayRef: covered
          ? "392.80(A)(1)(b) — covered tray (solid cover > 1.8 m): 95% of Table 310.16"
          : "392.80(A)(1)(a) — uncovered tray: Table 310.16 ampacities",
        adjApplies: true,
        notes,
      };
    }

    // LV single-conductor cables — 392.10(B)(1): 1/0 AWG and larger only.
    const sglSizes = LV_SIZE_ORDER.filter((s) => sizeIdx(s) >= LV_SIZE_ORDER.indexOf("1/0"));
    notes.push("Single-conductor cables in tray must be 1/0 AWG or larger [392.10(B)(1)].");

    if (arrangement === "trefoil215") {
      const col20 = insTemp === 75 ? 0 : 1;
      if (insTemp === 60) notes.push("Table 310.20 has no 60°C column — 75°C column used conservatively.");
      return {
        sizes: sglSizes.filter((s) => T310_20[s]),
        base: (s) => T310_20[s]?.[insTemp === 60 ? 0 : col20] ?? null,
        baseTableName: "Table 310.20 (triplexed, messenger-supported)",
        tableBaseAmbient: 40,
        trayFactor: 1.0,
        trayRef: "392.80(A)(2)(d) — trefoil (triangular) groups, spacing ≥ 2.15 × OD between groups, uncovered tray",
        adjApplies: false,
        notes,
      };
    }
    if (arrangement === "spaced1") {
      const col = insTemp === 60 ? 0 : insTemp === 75 ? 1 : 2;
      return {
        sizes: sglSizes,
        base: (s) => T310_17[s]?.[col] ?? null,
        baseTableName: "Table 310.17 (free air)",
        tableBaseAmbient: 30,
        trayFactor: 1.0,
        trayRef: "392.80(A)(2)(c) — single layer, maintained spacing ≥ 1 cable diameter, uncovered tray",
        adjApplies: false,
        notes,
      };
    }
    // Touching single conductors: factor depends on size (600+ vs 1/0–500).
    return {
      sizes: sglSizes,
      base: (s) => T310_17[s]?.[col] ?? null,
      baseTableName: "Table 310.17 (free air)",
      tableBaseAmbient: 30,
      trayFactor: (s) => {
        const big = KCMIL[s] >= 600;
        if (big) return covered ? 0.70 : 0.75;
        return covered ? 0.60 : 0.65;
      },
      trayRef: covered
        ? "392.80(A)(2)(a)/(b) — covered tray: 70% (≥600 kcmil) or 60% (1/0–500 kcmil) of Table 310.17"
        : "392.80(A)(2)(a)/(b) — uncovered tray: 75% (≥600 kcmil) or 65% (1/0–500 kcmil) of Table 310.17",
      adjApplies: false,
      notes,
    };
  }

  /* ------------------------------ MEDIUM VOLTAGE ------------------------- */
  const vk = vClass === "mv5" ? "v5" : "v15";
  const colMV = insTemp === 105 ? 1 : 0;
  const pick = (tbl) => (s) => tbl[s]?.[vk]?.[colMV] ?? null;
  // NEC 110.40: MV termination provisions are based on the 90°C column
  // unless the equipment is identified otherwise.
  const pick90 = (tbl) => (s) => tbl[s]?.[vk]?.[0] ?? null;
  const mvSizes = MV_SIZE_ORDER;

  if (construction === "multi") {
    if (arrangement === "spaced1") {
      return {
        sizes: mvSizes,
        base: pick(MV_3C_AIR),
        base90: pick90(MV_3C_AIR),
        baseTableName: "Table 315.60(C)(5) (3-conductor cable in air)",
        tableBaseAmbient: 40,
        trayFactor: 1.0,
        trayRef: "392.80(B)(1)(c) — single layer, maintained spacing ≥ 1 cable diameter, uncovered tray",
        adjApplies: false,
        notes,
      };
    }
    const tf = covered ? 0.70 : 0.95;
    return {
      sizes: mvSizes,
      base: pick(MV_3C_AIR),
      base90: pick90(MV_3C_AIR),
      baseTableName: "Table 315.60(C)(5) (3-conductor cable in air)",
      tableBaseAmbient: 40,
      trayFactor: tf,
      trayRef: covered
        ? "392.80(B)(1)(b) — covered tray (solid cover > 1.8 m): 70% of Table 315.60(C)(5)"
        : "392.80(B)(1)(a) — uncovered tray: 95% of Table 315.60(C)(5)",
      adjApplies: false,
      notes,
    };
  }

  // MV single-conductor cables — 1/0 AWG and larger in tray [392.10 / 392.80(B)(2)(a)].
  const mvSglSizes = mvSizes.filter((s) => sizeIdx(s) >= MV_SIZE_ORDER.indexOf("1/0"));
  notes.push("Single-conductor MV cables in tray must be 1/0 AWG or larger [392.80(B)(2)(a)].");

  if (arrangement === "trefoil215") {
    return {
      sizes: mvSglSizes,
      base: pick(MV_TRIPLEXED_AIR),
      base90: pick90(MV_TRIPLEXED_AIR),
      baseTableName: "Table 315.60(C)(1) (triplexed in air)",
      tableBaseAmbient: 40,
      trayFactor: 1.0,
      trayRef: "392.80(B)(2)(d) — trefoil groups, spacing ≥ 2.15 × OD between groups, uncovered tray",
      adjApplies: false,
      notes,
    };
  }
  if (arrangement === "spaced1") {
    return {
      sizes: mvSglSizes,
      base: pick(MV_SINGLE_AIR),
      base90: pick90(MV_SINGLE_AIR),
      baseTableName: "Table 315.60(C)(3) (single conductor in air)",
      tableBaseAmbient: 40,
      trayFactor: 1.0,
      trayRef: "392.80(B)(2)(c) — single layer, maintained spacing ≥ 1 cable diameter, uncovered tray",
      adjApplies: false,
      notes,
    };
  }
  const tf = covered ? 0.70 : 0.75;
  return {
    sizes: mvSglSizes,
    base: pick(MV_SINGLE_AIR),
    base90: pick90(MV_SINGLE_AIR),
    baseTableName: "Table 315.60(C)(3) (single conductor in air)",
    tableBaseAmbient: 40,
    trayFactor: tf,
    trayRef: covered
      ? "392.80(B)(2)(b) — covered tray: 70% of Table 315.60(C)(3)"
      : "392.80(B)(2)(a) — uncovered tray: 75% of Table 315.60(C)(3)",
    adjApplies: false,
    notes,
  };
}

export function computeSizing(cfg) {
  const method = resolveMethod(cfg);
  const { designI, ambient, insTemp, termTemp, vClass, ccc, maxSets } = cfg;
  const applyNec11014TerminationLimit = cfg.applyNec11014TerminationLimit !== false;

  // LV: user-selectable method (NEC band tables exist for both 30°C and 40°C
  // bases — 310.15(B)(1)(1)/(2)). MV: 315.60(D)(4) prescribes the equation.
  const ambMethod = vClass === "lv" ? (cfg.ambMethod || "table") : "equation";
  const kAmb = ambientCorrection(insTemp, ambient, method.tableBaseAmbient, ambMethod);
  const kAdj = method.adjApplies ? adjustmentFactor(ccc) : 1.0;

  const rows = method.sizes
    .map((s) => {
      const base = method.base(s);
      if (base == null) return null;
      const tf = typeof method.trayFactor === "function" ? method.trayFactor(s) : method.trayFactor;
      const derated = base * tf * kAmb * kAdj;
      let termAmp = null;
      let allowed = derated;
      if (vClass === "lv") {
        const tCol = termTemp === 60 ? 0 : termTemp === 75 ? 1 : 2;
        termAmp = T310_16[s]?.[tCol] ?? null;
        if (termAmp != null && applyNec11014TerminationLimit) {
          allowed = Math.min(derated, termAmp);
        }
      } else if (method.base90) {
        // 110.40: unless identified otherwise, MV terminations are evaluated
        // on the 90°C column (underated table value) of the same base table.
        termAmp = method.base90(s);
        if (termAmp != null) allowed = Math.min(derated, termAmp);
      }
      return { size: s, base, tf, derated, termAmp, allowed };
    })
    .filter(Boolean);

  const solutions = [];
  const oneZeroIdx = rows.findIndex((r) => r.size === "1/0");
  const rank = (s) => LV_SIZE_ORDER.indexOf(s);
  const maxRank = cfg.maxSize ? rank(cfg.maxSize) : Infinity;
  const vd = cfg.vd || { on: false };

  for (let n = 1; n <= maxSets; n++) {
    const req = designI / n;
    let eligible = n === 1 ? rows : rows.filter((_, i) => oneZeroIdx >= 0 && i >= oneZeroIdx);
    eligible = eligible.filter((r) => rank(r.size) <= maxRank);

    // Criterion 1 — ampacity: smallest size whose allowed ampacity ≥ required.
    const ampHit = eligible.find((r) => r.allowed >= req && r.allowed > 0) || null;
    // Criterion 2 — voltage drop: smallest size with VD ≤ limit.
    const vdHit = vd.on
      ? eligible.find((r) => {
          const p = vdPercent(r.size, n, vd);
          return p != null && p <= vd.maxPct;
        }) || null
      : null;
    // Combined — smallest size satisfying BOTH active criteria.
    const hit = vd.on
      ? eligible.find((r) => {
          const p = vdPercent(r.size, n, vd);
          return r.allowed >= req && r.allowed > 0 && p != null && p <= vd.maxPct;
        }) || null
      : ampHit;

    let governing = null;
    if (hit) {
      if (!vd.on) governing = "ampacity";
      else if (ampHit && vdHit) {
        const ra = rank(ampHit.size), rv = rank(vdHit.size);
        governing = ra === rv ? "both" : rv > ra ? "voltage drop" : "ampacity";
      } else governing = ampHit ? "ampacity" : "voltage drop";
    }

    solutions.push({
      n,
      requiredPerCond: req,
      ampRow: ampHit,
      vdRow: vdHit,
      row: hit,
      governing,
      vdPct: hit ? vdPercent(hit.size, n, vd) : null,
      ampVdPct: ampHit ? vdPercent(ampHit.size, n, vd) : null,
      totalAmp: hit ? hit.allowed * n : null,
      totalKcmil: hit ? (KCMIL[hit.size] || 0) * n : null,
      utilization: hit ? req / hit.allowed : null,
    });
  }
  const recommended = solutions.find((s) => s.row) || null;
  const bestCopper = solutions.filter((s) => s.row).sort((a, b) => a.totalKcmil - b.totalKcmil)[0] || null;

  return { method, kAmb, kAdj, rows, solutions, recommended, bestCopper, vd };
}

/* ------------------------------ LOAD ENGINE ------------------------------ */

export function computeLoad(load) {
  const w = [];
  const num = (x) => (isFinite(parseFloat(x)) ? parseFloat(x) : 0);
  let fla = 0, design = 0, basis = "", flaBasis = "";

  const threePhI = (kva, v) => (v > 0 ? (kva * 1000) / (Math.sqrt(3) * v) : 0);
  const onePhI = (kva, v) => (v > 0 ? (kva * 1000) / v : 0);

  switch (load.type) {
    case "motor": {
      if (load.motorMode === "table") {
        const tbl = load.phases === 3 ? FLC_3PH : FLC_1PH;
        const cols = load.phases === 3 ? V_COLS_3PH : V_COLS_1PH;
        const ci = cols.indexOf(Number(load.motorV));
        const v = tbl[load.hp]?.[ci];
        if (v == null) {
          w.push("No FLC listed in Table 430.250/430.248 for this HP/voltage combination — pick another combination or enter FLC manually.");
        } else fla = v;
        flaBasis = load.phases === 3 ? "Table 430.250 (3-phase FLC)" : "Table 430.248 (1-phase FLC)";
      } else {
        fla = num(load.customA);
        flaBasis = "user-entered FLC";
        w.push("NEC 430.6(A)(1): conductor sizing must use table FLC values (430.250/430.248), not nameplate current — verify your entry.");
      }
      design = fla * 1.25;
      basis = "125% of motor FLC [430.22]";
      break;
    }
    case "generator": {
      const kva = load.ratingUnit === "kW" ? num(load.rating) / (num(load.pf) || 1) : num(load.rating);
      fla = load.phases === 3 ? threePhI(kva, num(load.voltage)) : onePhI(kva, num(load.voltage));
      flaBasis = `computed from ${load.rating || 0} ${load.ratingUnit}${load.ratingUnit === "kW" ? ` @ PF ${load.pf}` : ""} at ${load.voltage} V`;
      design = fla * 1.15;
      basis = "115% of generator nameplate current [445.13]";
      break;
    }
    case "transformer": {
      const kva = num(load.rating);
      fla = load.phases === 3 ? threePhI(kva, num(load.voltage)) : onePhI(kva, num(load.voltage));
      flaBasis = `computed from ${load.rating || 0} kVA at ${load.voltage} V`;
      design = fla * 1.25;
      basis = "125% of transformer full-load current (continuous) [215.2(A)(1)]";
      break;
    }
    case "heater": {
      if (load.heaterMode === "kw") {
        const kw = num(load.rating);
        fla = load.phases === 3 ? threePhI(kw, num(load.voltage)) : onePhI(kw, num(load.voltage));
        flaBasis = `computed from ${load.rating || 0} kW (resistive, PF = 1) at ${load.voltage} V`;
      } else {
        fla = num(load.customA);
        flaBasis = "user-entered current";
      }
      design = fla * 1.25;
      basis = "125% — fixed electric heating is a continuous load [424.3(B)]";
      break;
    }
    case "feeder": {
      const ic = num(load.contA), inc = num(load.nonContA);
      fla = ic + inc;
      flaBasis = `${ic} A continuous + ${inc} A non-continuous`;
      design = 1.25 * ic + inc;
      basis = "125% of continuous + 100% of non-continuous load [215.2(A)(1)]";
      break;
    }
    default: {
      fla = num(load.customA);
      flaBasis = "user-entered current";
      design = load.continuous ? fla * 1.25 : fla;
      basis = load.continuous ? "125% — continuous load [210.19 / 215.2]" : "100% — non-continuous load";
    }
  }
  return { fla, design, basis, flaBasis, warnings: w };
}


export {
  T310_16, T310_17, T310_20,
  MV_SINGLE_AIR, MV_TRIPLEXED_AIR, MV_3C_AIR,
  KCMIL, Z_TABLE9,
  FLC_3PH, FLC_1PH, V_COLS_3PH, V_COLS_1PH, T250_122,
  LV_SIZE_ORDER, MV_SIZE_ORDER, sizeIdx, isKcmil, sizeLabel,
  resolveMethod,
};
