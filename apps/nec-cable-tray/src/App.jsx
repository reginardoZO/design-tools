import React, { useState, useMemo } from "react";

/* The NEC data tables and the pure calculation engine live in engine.js so
   they can be unit-tested from Node without a JSX transform. The split is
   mechanical — no calculation was changed. */
import {
  FLC_3PH, FLC_1PH, V_COLS_3PH, V_COLS_1PH,
  LV_SIZE_ORDER, MV_SIZE_ORDER, sizeLabel,
  vdPercent, egcSizing, computeSizing, computeLoad,
} from "./engine.js";

/* --------------------------------- THEME ---------------------------------
   Palette and typography come from shared/theme.css (imported by index.css) —
   the same tokens the LV Cable Voltage Drop tool uses. They are mirrored here
   as constants because this component styles inline.
   ------------------------------------------------------------------------ */

const C = {
  bg: "#eceff2",
  panel: "#ffffff",
  field: "#fbfcfd",
  wash: "#eef4fb",
  line: "#c6cdd4",
  lineSoft: "#dfe4e9",
  text: "#1d2530",
  mut: "#5c6875",
  faint: "#7d8894",
  accent: "#0e5da8",
  ok: "#1e7d46",
  warn: "#d99a00",
  warnWash: "#fdf6e3",
  err: "#b3261e",
  plate: "#2a323c",
  plateEdge: "#3d4854",
  plateInk: "#e8edf2",
  plateMut: "#9fb0c0",
};

const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Consolas, monospace" };
const ui = { fontFamily: "'Saira Semi Condensed', system-ui, sans-serif" };

function Label({ children }) {
  return (
    <div
      className="mb-1"
      style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px", color: C.mut }}
    >
      {children}
    </div>
  );
}

function Section({ tag, title, children }) {
  return (
    <div className="mb-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18 }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.2px", color: C.mut }}>
          {title}
        </div>
        <div style={{ ...mono, fontSize: 11, color: C.faint, whiteSpace: "nowrap" }}>{tag}</div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

const inputStyle = {
  ...mono,
  background: C.field,
  border: `1px solid ${C.line}`,
  color: C.text,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 4,
  fontSize: 14,
  outline: "none",
};

function Num({ value, onChange, step = "any", min }) {
  return <input type="number" value={value} step={step} min={min} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function SegBtns({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap" style={{ border: `1px solid ${C.line}`, borderRadius: 4, overflow: "hidden" }}>
      {options.map(([v, l], i) => {
        const on = String(value) === String(v);
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              ...mono,
              flex: "1 1 auto",
              padding: "8px 6px",
              border: 0,
              borderLeft: i === 0 ? 0 : `1px solid ${C.line}`,
              background: on ? C.accent : C.field,
              color: on ? "#fff" : C.mut,
              fontWeight: on ? 600 : 400,
              fontSize: 12.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function FactorNode({ label, value, refText, muted = false }) {
  return (
    <div
      className="flex flex-col items-center px-2 py-2 min-w-0"
      style={{
        background: C.field,
        border: `1px ${muted ? "dashed" : "solid"} ${C.lineSoft}`,
        borderRadius: 4,
        flex: "1 1 92px",
        opacity: muted ? 0.62 : 1,
      }}
    >
      <div className="text-center mb-1" style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
      {refText && <div className="text-center mt-1" style={{ ...mono, color: C.faint, fontSize: 10 }}>{refText}</div>}
    </div>
  );
}

/* ---------------------------------- APP ---------------------------------- */

export default function App() {
  // Load
  const [loadType, setLoadType] = useState("motor");
  const [phases, setPhases] = useState(3);
  const [motorMode, setMotorMode] = useState("table");
  const [hp, setHp] = useState("100");
  const [motorV, setMotorV] = useState(460);
  const [voltage, setVoltage] = useState("480");
  const [rating, setRating] = useState("500");
  const [ratingUnit, setRatingUnit] = useState("kVA");
  const [pf, setPf] = useState("0.8");
  const [customA, setCustomA] = useState("200");
  const [contA, setContA] = useState("150");
  const [nonContA, setNonContA] = useState("50");
  const [continuous, setContinuous] = useState(true);
  const [heaterMode, setHeaterMode] = useState("kw");

  // System / cable
  const [vClass, setVClass] = useState("lv");
  const [construction, setConstruction] = useState("multi");
  const [insTemp, setInsTemp] = useState(90);
  const [termTemp, setTermTemp] = useState(75);
  const [applyNec11014TerminationLimit, setApplyNec11014TerminationLimit] = useState(true);
  const [ccc, setCcc] = useState("3");

  // Installation / environment
  const [arrangement, setArrangement] = useState("touching");
  const [covered, setCovered] = useState(false);
  const [ambient, setAmbient] = useState("40");
  const [maxSets, setMaxSets] = useState("4");
  const [maxSize, setMaxSize] = useState("500");
  const [ambMethod, setAmbMethod] = useState("table");
  const [ocpd, setOcpd] = useState("");
  const [egcLinked, setEgcLinked] = useState(true);

  // Voltage drop
  const [vdOn, setVdOn] = useState(true);
  const [vdLength, setVdLength] = useState("100");
  const [vdUnit, setVdUnit] = useState("m");
  const [vdMax, setVdMax] = useState("3");
  const [vdVolts, setVdVolts] = useState("480");
  const [vdPf, setVdPf] = useState("0.85");

  const load = useMemo(
    () =>
      computeLoad({
        type: loadType, phases, motorMode, hp, motorV, voltage, rating,
        ratingUnit, pf, customA, contA, nonContA, continuous, heaterMode,
      }),
    [loadType, phases, motorMode, hp, motorV, voltage, rating, ratingUnit, pf, customA, contA, nonContA, continuous, heaterMode]
  );

  const effArrangement = covered && arrangement !== "touching" ? "touching" : arrangement;
  const effInsTemp = vClass === "lv" ? insTemp : insTemp < 90 ? 90 : insTemp;

  // Sizes selectable as "largest acceptable conductor" for the current setup.
  const sizeOptions = useMemo(() => {
    let list = vClass === "lv" ? LV_SIZE_ORDER : MV_SIZE_ORDER;
    if (construction === "single") list = list.filter((s) => LV_SIZE_ORDER.indexOf(s) >= LV_SIZE_ORDER.indexOf("1/0"));
    return list;
  }, [vClass, construction]);
  const effMaxSize = sizeOptions.includes(maxSize) ? maxSize : sizeOptions[sizeOptions.length - 1];

  const vdCfg = useMemo(() => {
    const lenRaw = parseFloat(vdLength) || 0;
    return {
      on: vdOn && lenRaw > 0,
      lengthFt: vdUnit === "m" ? lenRaw * 3.28084 : lenRaw,
      maxPct: parseFloat(vdMax) || 3,
      volts: parseFloat(vdVolts) || 0,
      pf: parseFloat(vdPf) || 1,
      phases,
      amps: load.fla, // VD is evaluated at operating (full-load) current
    };
  }, [vdOn, vdLength, vdUnit, vdMax, vdVolts, vdPf, phases, load.fla]);

  const result = useMemo(() => {
    if (!(load.design > 0)) return null;
    return computeSizing({
      designI: load.design,
      ambient: parseFloat(ambient) || 0,
      insTemp: effInsTemp,
      termTemp,
      applyNec11014TerminationLimit,
      vClass,
      construction,
      arrangement: effArrangement,
      covered,
      ccc: parseInt(ccc, 10) || 3,
      maxSets: Math.min(Math.max(parseInt(maxSets, 10) || 1, 1), 12),
      maxSize: effMaxSize,
      ambMethod,
      vd: vdCfg,
    });
  }, [load.design, ambient, effInsTemp, termTemp, applyNec11014TerminationLimit, vClass, construction, effArrangement, covered, ccc, maxSets, effMaxSize, ambMethod, vdCfg]);

  const warnings = [...load.warnings];
  if (covered && arrangement !== "touching")
    warnings.push("Maintained-spacing / trefoil ampacities require an UNCOVERED tray. With a solid cover selected, the calculation reverts to the touching-cables rule.");
  if (vClass !== "lv" && insTemp < 90)
    warnings.push("MV cables per NEC tables are rated 90°C (MV-90) or 105°C (MV-105) — 90°C assumed.");
  const amb = parseFloat(ambient) || 0;
  if (amb >= effInsTemp) warnings.push("Ambient temperature ≥ conductor rating: ampacity is zero. Reduce ambient or increase insulation rating.");
  if (result?.method?.notes) warnings.push(...result.method.notes);
  if (result && !result.recommended)
    warnings.push(`No solution up to ${sizeLabel(effMaxSize)} with ${maxSets} parallel set(s) per phase${vdCfg.on ? ` meeting both ampacity and ≤${vdCfg.maxPct}% voltage drop` : ""} — increase the largest acceptable conductor, allow more sets, shorten the run, or relax the VD limit.`);
  if (vClass !== "lv") {
    if (effInsTemp === 105)
      warnings.push("NEC 110.40: MV-105 gives derating headroom, but terminations are evaluated on the 90°C column unless the equipment is identified otherwise — the app caps the allowable ampacity accordingly.");
  }
  if (vdCfg.on) {
    warnings.push("Voltage drop uses NEC Chapter 9, Table 9 impedances (600 V cables, 75°C, PVC column) at operating (full-load) current. NEC treats VD limits as recommendations [210.19 IN / 215.2 IN — 3% branch / 5% total]. 700/800/900 kcmil impedances are interpolated.");
    if (vClass !== "lv")
      warnings.push("For MV cables, Table 9 impedances are an approximation — reactance depends on cable construction and spacing. Verify VD with manufacturer R/X data.");
  }

  const rec = result?.recommended;
  const terminationOverrideActive = vClass === "lv" && !applyNec11014TerminationLimit;
  const fmt = (x, d = 1) => (x == null ? "—" : Number(x).toFixed(d));

  const egc = useMemo(() => {
    const a = parseFloat(ocpd);
    if (!(a > 0)) return null;
    if (!egcLinked) return egcSizing(a, null, null); // standalone: table only
    return egcSizing(a, rec?.row?.size || null, rec?.ampRow?.size || null);
  }, [ocpd, rec, egcLinked]);

  const arrangementOptions =
    construction === "multi"
      ? [
          ["touching", "Touching / random fill"],
          ["spaced1", "Single layer, spaced ≥ 1×OD"],
        ]
      : [
          ["touching", "Touching (contiguous)"],
          ["spaced1", "Single layer, spaced ≥ 1×OD"],
          ["trefoil215", "Trefoil, groups spaced ≥ 2.15×OD"],
        ];

  const screw = (pos) => (
    <span
      style={{
        position: "absolute",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, #cfd6dd, #6b747d 70%)",
        ...pos,
      }}
    />
  );

  return (
    <div style={{ ...ui, minHeight: "100vh", background: C.bg, color: C.text, padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        {/* Header */}
        <header
          className="flex flex-wrap items-end justify-between gap-3"
          style={{ borderBottom: `3px solid ${C.text}`, paddingBottom: 12, marginBottom: 20 }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" }}>
              Cable Tray Ampacity &amp; Sizing
            </h1>
            <div style={{ ...mono, fontSize: 12, color: C.mut, marginTop: 3 }}>
              LV (≤ 2 kV) and MV (2.001–15 kV) in ladder / ventilated tray · copper · AWG &amp; kcmil
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ ...mono, fontSize: 11, color: C.faint, textAlign: "right", lineHeight: 1.5 }}>
              NEC 2023 · 392.80 · 310.16/.17/.20<br />Art. 315 · 430 · 445 · 424 · 215 · 250
            </div>
            <a
              href="../../index.html"
              style={{
                ...mono, fontSize: 12, color: C.accent, textDecoration: "none",
                border: `1px solid ${C.line}`, background: C.panel, borderRadius: 4,
                padding: "6px 12px", whiteSpace: "nowrap",
              }}
            >
              ← Hub
            </a>
          </div>
        </header>

        <div className="tool-grid" style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20, alignItems: "start" }}>

          {/* ------------------------------ INPUTS ----------------------------- */}
          <div style={{ minWidth: 0 }}>
            <Section tag="Art. 430 / 445 / 450 / 424 / 215" title="1 · Load">
              <Field label="Load type">
                <Sel
                  value={loadType}
                  onChange={setLoadType}
                  options={[
                    ["motor", "Motor (430.22 — 125% of table FLC)"],
                    ["generator", "Generator (445.13 — 115%)"],
                    ["transformer", "Transformer feeder (125% FLA)"],
                    ["heater", "Fixed electric heater (424.3(B) — 125%)"],
                    ["feeder", "Feeder (215.2 — 125% cont. + 100% non-cont.)"],
                    ["custom", "Other / direct current input"],
                  ]}
                />
              </Field>

              {loadType !== "feeder" && (
                <Field label="Phases">
                  <SegBtns value={phases} onChange={(v) => setPhases(Number(v))} options={[[3, "Three-phase"], [1, "Single-phase"]]} />
                </Field>
              )}

              {loadType === "motor" && (
                <>
                  <Field label="FLC source">
                    <SegBtns
                      value={motorMode}
                      onChange={setMotorMode}
                      options={[["table", "NEC Table 430.250/.248"], ["manual", "Enter FLC"]]}
                    />
                  </Field>
                  {motorMode === "table" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Motor rating (HP)">
                        <Sel value={hp} onChange={setHp} options={Object.keys(phases === 3 ? FLC_3PH : FLC_1PH).map((h) => [h, `${h} HP`])} />
                      </Field>
                      <Field label="Motor voltage">
                        <Sel
                          value={motorV}
                          onChange={(v) => setMotorV(Number(v))}
                          options={(phases === 3 ? V_COLS_3PH : V_COLS_1PH).map((v) => [v, `${v} V`])}
                        />
                      </Field>
                    </div>
                  ) : (
                    <Field label="Full-load current (A)">
                      <Num value={customA} onChange={setCustomA} min="0" />
                    </Field>
                  )}
                </>
              )}

              {loadType === "generator" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Rating (${ratingUnit})`}>
                    <Num value={rating} onChange={setRating} min="0" />
                  </Field>
                  <Field label="Unit">
                    <SegBtns value={ratingUnit} onChange={setRatingUnit} options={[["kVA", "kVA"], ["kW", "kW"]]} />
                  </Field>
                  {ratingUnit === "kW" && (
                    <Field label="Power factor">
                      <Num value={pf} onChange={setPf} step="0.01" min="0.1" />
                    </Field>
                  )}
                  <Field label="Voltage (V)">
                    <Num value={voltage} onChange={setVoltage} min="1" />
                  </Field>
                </div>
              )}

              {loadType === "transformer" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rating (kVA)">
                    <Num value={rating} onChange={setRating} min="0" />
                  </Field>
                  <Field label="Winding voltage (V)">
                    <Num value={voltage} onChange={setVoltage} min="1" />
                  </Field>
                </div>
              )}

              {loadType === "heater" && (
                <>
                  <Field label="Input mode">
                    <SegBtns value={heaterMode} onChange={setHeaterMode} options={[["kw", "kW rating"], ["amps", "Current (A)"]]} />
                  </Field>
                  {heaterMode === "kw" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Rating (kW)">
                        <Num value={rating} onChange={setRating} min="0" />
                      </Field>
                      <Field label="Voltage (V)">
                        <Num value={voltage} onChange={setVoltage} min="1" />
                      </Field>
                    </div>
                  ) : (
                    <Field label="Current (A)">
                      <Num value={customA} onChange={setCustomA} min="0" />
                    </Field>
                  )}
                </>
              )}

              {loadType === "feeder" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Continuous load (A)">
                    <Num value={contA} onChange={setContA} min="0" />
                  </Field>
                  <Field label="Non-continuous load (A)">
                    <Num value={nonContA} onChange={setNonContA} min="0" />
                  </Field>
                </div>
              )}

              {loadType === "custom" && (
                <>
                  <Field label="Load current (A)">
                    <Num value={customA} onChange={setCustomA} min="0" />
                  </Field>
                  <Field label="Duty">
                    <SegBtns value={continuous} onChange={(v) => setContinuous(v === "true" || v === true)} options={[[true, "Continuous (×1.25)"], [false, "Non-continuous (×1.00)"]]} />
                  </Field>
                </>
              )}
            </Section>

            <Section tag="Art. 310 / 315" title="2 · Cable">
              <Field label="Voltage class">
                <SegBtns
                  value={vClass}
                  onChange={(v) => {
                    setVClass(v);
                    if (v !== "lv" && insTemp < 90) setInsTemp(90);
                    if (v !== "lv" && insTemp === 60) setInsTemp(90);
                  }}
                  options={[["lv", "≤ 2 kV"], ["mv5", "2.001–5 kV"], ["mv15", "5.001–15 kV"]]}
                />
              </Field>
              <Field label="Cable construction">
                <SegBtns
                  value={construction}
                  onChange={(v) => { setConstruction(v); setArrangement("touching"); }}
                  options={[["multi", vClass === "lv" ? "Multiconductor (TC)" : "3-conductor MV"], ["single", "Single-conductor"]]}
                />
              </Field>
              <Field label="Insulation rating">
                <SegBtns
                  value={effInsTemp}
                  onChange={(v) => setInsTemp(Number(v))}
                  options={vClass === "lv" ? [[60, "60°C"], [75, "75°C"], [90, "90°C"]] : [[90, "MV-90"], [105, "MV-105"]]}
                />
              </Field>
              {vClass === "lv" && (
                <>
                  <Field label="Termination rating (110.14(C))">
                    <SegBtns value={termTemp} onChange={(v) => setTermTemp(Number(v))} options={[[60, "60°C"], [75, "75°C"], [90, "90°C"]]} />
                  </Field>
                  <div style={{ margin: "-2px 0 14px" }}>
                    <label
                      className="flex items-start gap-2"
                      title="Engineering override — sizes conductors using installation ampacity without applying the standard equipment termination limit."
                      style={{ cursor: "pointer", color: C.mut }}
                    >
                      <input
                        type="checkbox"
                        checked={terminationOverrideActive}
                        onChange={(e) => setApplyNec11014TerminationLimit(!e.target.checked)}
                        aria-describedby="termination-override-help"
                        style={{ width: 14, height: 14, marginTop: 2, accentColor: C.accent }}
                      />
                      <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                        Ignore NEC 110.14(C) termination limit
                      </span>
                    </label>
                    <div id="termination-override-help" style={{ fontSize: 11, color: C.faint, lineHeight: 1.45, margin: "4px 0 0 22px" }}>
                      Engineering override — sizes conductors using installation ampacity without applying the standard equipment termination limit.
                    </div>
                    {terminationOverrideActive && (
                      <div style={{ fontSize: 11.5, color: "#9a6b00", background: C.warnWash, borderLeft: `3px solid ${C.warn}`, borderRadius: "0 4px 4px 0", lineHeight: 1.5, margin: "8px 0 0 22px", padding: "6px 9px" }}>
                        NEC 110.14(C) termination ampacity limitation is not being applied. Verify equipment and terminal suitability with the manufacturer and AHJ.
                      </div>
                    )}
                  </div>
                </>
              )}
              {vClass === "lv" && construction === "multi" && (
                <Field label="Current-carrying conductors in the cable (310.15(C)(1))">
                  <Num value={ccc} onChange={setCcc} step="1" min="1" />
                </Field>
              )}
            </Section>

            <Section tag="Art. 392.80" title="3 · Installation &amp; environment">
              <Field label="Arrangement in tray">
                <SegBtns value={arrangement} onChange={setArrangement} options={arrangementOptions} />
              </Field>
              <Field label="Tray cover">
                <SegBtns
                  value={covered}
                  onChange={(v) => setCovered(v === "true" || v === true)}
                  options={[[false, "Uncovered"], [true, "Solid cover > 1.8 m"]]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ambient temperature (°C)">
                  <Num value={ambient} onChange={setAmbient} step="1" />
                </Field>
                <Field label="Max. parallel sets">
                  <Sel value={maxSets} onChange={setMaxSets} options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => [String(n), `${n}`])} />
                </Field>
              </div>
              <Field label="Ambient correction method (310.15(B)(1))">
                <SegBtns
                  value={ambMethod}
                  onChange={setAmbMethod}
                  options={[["table", "Table bands"], ["equation", "Exact equation"]]}
                />
              </Field>
              <Field label="Largest acceptable conductor">
                <Sel value={effMaxSize} onChange={setMaxSize} options={sizeOptions.map((s) => [s, sizeLabel(s)])} />
              </Field>
              <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
                Search order: for each set count, sizes are tried from the smallest up to this limit; if none fits, one more conductor per phase is added and the search restarts from the smallest size — up to the maximum sets above.
              </div>
            </Section>

            <Section tag="Ch. 9, Table 9" title="4 · Voltage drop">
              <Field label="Include voltage drop criterion">
                <SegBtns value={vdOn} onChange={(v) => setVdOn(v === "true" || v === true)} options={[[true, "Yes"], [false, "No"]]} />
              </Field>
              {vdOn && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="One-way circuit length">
                      <Num value={vdLength} onChange={setVdLength} min="0" />
                    </Field>
                    <Field label="Unit">
                      <SegBtns value={vdUnit} onChange={setVdUnit} options={[["m", "meters"], ["ft", "feet"]]} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Max. drop (%)">
                      <Num value={vdMax} onChange={setVdMax} step="0.1" min="0.1" />
                    </Field>
                    <Field label="System volts">
                      <Num value={vdVolts} onChange={setVdVolts} min="1" />
                    </Field>
                    <Field label="Load PF">
                      <Num value={vdPf} onChange={setVdPf} step="0.01" min="0.05" />
                    </Field>
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
                    VD = {phases === 3 ? "√3" : "2"} · I · L · (R·cosφ + X·sinφ) / n, with R/X from NEC Chapter 9, Table 9 (copper, 75°C) and I = full-load current.
                  </div>
                </>
              )}
            </Section>
          </div>

          {/* ------------------------------ RESULTS ---------------------------- */}
          <div style={{ minWidth: 0 }}>

            {/* Selection nameplate */}
            <div
              style={{
                background: `linear-gradient(160deg, ${C.plateEdge}, ${C.plate} 40%)`,
                borderRadius: 8,
                padding: "20px 22px",
                color: C.plateInk,
                position: "relative",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.15), 0 4px 14px rgba(0,0,0,.25)",
                border: "1px solid #171c22",
                marginBottom: 16,
              }}
            >
              {screw({ top: 9, left: 9 })}
              {screw({ top: 9, right: 9 })}
              {screw({ bottom: 9, left: 9 })}
              {screw({ bottom: 9, right: 9 })}

              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: C.plateMut, textTransform: "uppercase" }}>
                    Selected cable — minimum section
                  </div>
                  <div style={{ ...mono, fontSize: 30, fontWeight: 600, lineHeight: 1.15, marginTop: 4, color: rec ? "#7fd6a3" : "#ff8f87" }}>
                    {rec ? `${rec.n} × ${sizeLabel(rec.row.size)} Cu / phase` : "No solution"}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, color: C.plateMut }}>
                    {rec
                      ? `${effInsTemp}°C copper · ${construction === "multi" ? (vClass === "lv" ? "multiconductor cable" : "3/C MV cable") : "single-conductor cables"} · ${vClass === "lv" ? "≤2 kV" : vClass === "mv5" ? "5 kV class" : "15 kV class"}`
                      : "Adjust parallel sets, insulation rating or arrangement."}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: C.plateMut, textTransform: "uppercase" }}>Design current</div>
                  <div style={{ ...mono, fontSize: 26, fontWeight: 600, marginTop: 4 }}>{fmt(load.design)} A</div>
                  <div style={{ fontSize: 11.5, marginTop: 4, color: C.plateMut, maxWidth: 240 }}>{load.basis}</div>
                </div>
              </div>

              {rec && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                  {[
                    ["Required / conductor", `${fmt(rec.requiredPerCond)} A`],
                    ["Allowable / conductor", `${fmt(rec.row.allowed)} A`],
                    ["Total allowable", `${fmt(rec.totalAmp)} A`],
                    rec.vdPct != null ? ["Voltage drop", `${fmt(rec.vdPct, 2)} %`] : ["Utilization", `${fmt(rec.utilization * 100)} %`],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10.5, color: C.plateMut, textTransform: "uppercase", letterSpacing: ".5px" }}>{l}</div>
                      <div style={{ ...mono, fontSize: 15, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Criteria comparison */}
            {result && rec && (
              <Section tag={vdCfg.on ? "ampacity ∧ voltage drop" : "ampacity"} title="Sizing criteria — which cable each requirement demands">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div style={{ background: C.field, border: `1px solid ${rec.governing === "ampacity" || rec.governing === "both" ? C.accent : C.lineSoft}`, borderRadius: 4, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".8px", color: C.faint, marginBottom: 4 }}>By ampacity (NEC 392.80)</div>
                    <div style={{ ...mono, fontSize: 17, fontWeight: 600 }}>
                      {rec.ampRow ? `${rec.n} × ${sizeLabel(rec.ampRow.size)}` : "—"}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, color: C.mut }}>
                      {rec.ampRow ? `${fmt(rec.ampRow.allowed)} A ≥ ${fmt(rec.requiredPerCond)} A required` : "no size within limit"}
                    </div>
                  </div>
                  {vdCfg.on && (
                    <div style={{ background: C.field, border: `1px solid ${rec.governing === "voltage drop" || rec.governing === "both" ? C.accent : C.lineSoft}`, borderRadius: 4, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".8px", color: C.faint, marginBottom: 4 }}>By voltage drop (≤ {vdCfg.maxPct}%)</div>
                      <div style={{ ...mono, fontSize: 17, fontWeight: 600 }}>
                        {rec.vdRow ? `${rec.n} × ${sizeLabel(rec.vdRow.size)}` : "—"}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, color: C.mut }}>
                        {rec.vdRow ? `${fmt(vdPercent(rec.vdRow.size, rec.n, vdCfg), 2)} % over ${fmt(vdCfg.lengthFt / 3.28084, 0)} m` : "no size within limit"}
                      </div>
                    </div>
                  )}
                  <div style={{ background: C.wash, border: `1px solid ${C.accent}`, borderRadius: 4, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".8px", color: C.accent, marginBottom: 4 }}>Selected — meets {vdCfg.on ? "both" : "criterion"}</div>
                    <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: C.accent }}>
                      {rec.n} × {sizeLabel(rec.row.size)}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, color: C.mut }}>
                      governing: <span style={{ color: C.accent, fontWeight: 600 }}>{rec.governing}</span>
                      {rec.vdPct != null && <> · VD = {fmt(rec.vdPct, 2)}%</>}
                    </div>
                    {terminationOverrideActive && (
                      <div style={{ fontSize: 11.5, color: "#9a6b00", marginTop: 5 }}>
                        Engineering override active
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* Derating chain */}
            {result && rec && (
              <Section tag={result.method.trayRef.split(" — ")[0]} title="Derating chain (per conductor)">
                <div className="flex items-stretch gap-1 flex-wrap">
                  <FactorNode label={`Base · ${result.method.baseTableName}`} value={`${rec.row.base} A`} refText={`amb. ${result.method.tableBaseAmbient}°C`} />
                  <div className="self-center" style={{ color: C.faint }}>×</div>
                  <FactorNode label="Tray factor" value={fmt(rec.row.tf, 2)} refText="392.80" />
                  <div className="self-center" style={{ color: C.faint }}>×</div>
                  <FactorNode label={`Ambient ${ambient}°C`} value={fmt(result.kAmb, ambMethod === "table" && vClass === "lv" ? 2 : 3)} refText={vClass !== "lv" ? "315.60(D)(4) eq." : ambMethod === "table" ? "T.310.15(B)(1)" : "310.15(B)(1) eq."} />
                  {result.method.adjApplies && result.kAdj < 1 && (
                    <>
                      <div className="self-center" style={{ color: C.faint }}>×</div>
                      <FactorNode label={`${ccc} CCC in cable`} value={fmt(result.kAdj, 2)} refText="310.15(C)(1)" />
                    </>
                  )}
                  <div className="self-center" style={{ color: C.faint }}>=</div>
                  <FactorNode label="Derated ampacity" value={`${fmt(rec.row.derated)} A`} />
                  {rec.row.termAmp != null && (
                    <>
                      <div className="self-center" style={{ color: C.faint }}>∧</div>
                      <FactorNode
                        label={vClass === "lv" ? `Termination ${termTemp}°C` : "Termination (90°C col)"}
                        value={`${rec.row.termAmp} A`}
                        refText={terminationOverrideActive ? "Not applied — engineering override enabled" : vClass === "lv" ? "110.14(C) · T.310.16" : "110.40"}
                        muted={terminationOverrideActive}
                      />
                    </>
                  )}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 12, color: C.mut, lineHeight: 1.6 }}>
                  {terminationOverrideActive
                    ? "Allowable ampacity per conductor = derated installation ampacity. NEC 110.14(C) termination limitation excluded by user selection"
                    : `Allowable ampacity per conductor = min(derated ampacity${vClass === "lv" ? ", termination limit" : ""})`} ={" "}
                  <span style={{ ...mono, color: C.accent, fontWeight: 600 }}>{fmt(rec.row.allowed)} A</span>
                  {" "}· Ambient correction = √((Tc − Ta)/(Tc − {result.method.tableBaseAmbient})) with Tc = {effInsTemp}°C, Ta = {ambient}°C.
                </div>
              </Section>
            )}

            {/* Alternatives */}
            {result && (
              <Section tag="310.10(G)" title="Alternatives by number of parallel sets per phase">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ ...mono, width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                    <thead>
                      <tr style={{ color: C.faint }}>
                        {(vdCfg.on
                          ? ["Sets", "Amp. size", "VD size", "Selected", "VD %", "Util.", "Copper/phase"]
                          : ["Sets", "Size (min.)", "Req./cond.", "Allow./cond.", "Total", "Copper/phase", "Util."]
                        ).map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 12px 8px 0", fontSize: 10.5, fontWeight: 400, textTransform: "uppercase", letterSpacing: ".8px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.solutions.map((s) => {
                        const isRec = rec && s.n === rec.n;
                        const cells = vdCfg.on
                          ? [
                              `${s.n}${isRec ? " ◄" : ""}`,
                              s.ampRow ? sizeLabel(s.ampRow.size) : "—",
                              s.vdRow ? sizeLabel(s.vdRow.size) : "—",
                              s.row ? sizeLabel(s.row.size) : "—",
                              s.vdPct != null ? `${fmt(s.vdPct, 2)}%` : "—",
                              s.utilization != null ? `${fmt(s.utilization * 100, 0)}%` : "—",
                              s.totalKcmil != null ? `${fmt(s.totalKcmil, 0)} kcmil` : "—",
                            ]
                          : [
                              `${s.n}${isRec ? " ◄" : ""}`,
                              s.row ? sizeLabel(s.row.size) : "—",
                              `${fmt(s.requiredPerCond)} A`,
                              s.row ? `${fmt(s.row.allowed)} A` : "—",
                              s.row ? `${fmt(s.row.allowed * s.n)} A` : "—",
                              s.totalKcmil != null ? `${fmt(s.totalKcmil, 0)} kcmil` : "—",
                              s.utilization != null ? `${fmt(s.utilization * 100, 0)}%` : "—",
                            ];
                        return (
                          <tr key={s.n} style={{ background: isRec ? C.wash : "transparent", color: s.row ? C.text : C.faint }}>
                            {cells.map((c, i) => (
                              <td key={i} style={{ padding: "8px 12px 8px 0", borderBottom: `1px solid ${C.lineSoft}`, color: i === 0 && isRec ? C.accent : undefined, fontWeight: i === 0 && isRec ? 700 : undefined, whiteSpace: "nowrap" }}>{c}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11.5, marginTop: 10, color: C.faint, lineHeight: 1.6 }}>
                  Sizes limited to ≤ {sizeLabel(effMaxSize)}; “—” means no size within that limit carries the required current for that set count. Parallel sets require conductors 1/0 AWG or larger [310.10(G)]. “◄” = recommended (fewest sets).
                  {result.bestCopper && rec && result.bestCopper.n !== rec.n && (
                    <> Lowest total copper: {result.bestCopper.n} × {sizeLabel(result.bestCopper.row.size)}.</>
                  )}
                </div>
              </Section>
            )}

            {/* Equipment grounding conductor */}
            <Section tag="Table 250.122" title="Equipment grounding conductor (copper)">
              <Field label="Mode">
                <SegBtns
                  value={egcLinked}
                  onChange={(v) => setEgcLinked(v === "true" || v === true)}
                  options={[[true, "Tied to this circuit"], [false, "Standalone — table only"]]}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <Field label="Upstream OCPD rating (A)">
                  <Num value={ocpd} onChange={setOcpd} step="1" min="1" />
                </Field>
                {egc && !egc.error && (
                  <>
                    <div style={{ background: C.field, border: `1px solid ${C.lineSoft}`, borderRadius: 4, padding: "8px 12px", marginBottom: 12 }}>
                      <div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: ".5px" }}>Table 250.122 minimum</div>
                      <div style={{ ...mono, fontSize: 14, fontWeight: 600 }}>{sizeLabel(egc.tableSize)} Cu</div>
                    </div>
                    {egc.upsized && (
                      <div style={{ background: C.field, border: `1px solid ${C.lineSoft}`, borderRadius: 4, padding: "8px 12px", marginBottom: 12 }}>
                        <div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: ".5px" }}>250.122(B) ×{fmt(egc.ratio, 2)} area</div>
                        <div style={{ ...mono, fontSize: 13, fontWeight: 600 }}>phase upsized for VD</div>
                      </div>
                    )}
                    <div style={{ background: C.wash, border: `1px solid ${C.accent}`, borderRadius: 4, padding: "8px 12px", marginBottom: 12 }}>
                      <div style={{ fontSize: 10.5, color: C.accent, textTransform: "uppercase", letterSpacing: ".5px" }}>EGC selected</div>
                      <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.accent }}>
                        {egcLinked && rec && rec.n > 1 ? `${rec.n} × ` : ""}{sizeLabel(egc.finalSize)} Cu
                      </div>
                    </div>
                  </>
                )}
                {egc && egc.error && (
                  <div className="sm:col-span-3" style={{ fontSize: 13, color: C.err, marginBottom: 12 }}>{egc.error}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.mut, lineHeight: 1.6 }}>
                {egc && !egc.error ? (
                  egcLinked ? (
                    <>
                      {egc.upsized && <>Phase conductors were increased beyond the ampacity minimum (voltage drop), so the EGC area was raised proportionally [250.122(B)]. </>}
                      {rec && rec.n > 1 && <>Parallel runs: one full-size EGC must be installed with EACH parallel set / tray [250.122(F)]. </>}
                      The EGC is not required to be larger than the phase conductors [250.122(A)].
                    </>
                  ) : (
                    <>Standalone lookup: minimum copper EGC directly from Table 250.122 for the OCPD rating, independent of this circuit's conductors. Where the ungrounded conductors of the actual circuit are upsized, remember 250.122(B) still applies to that design.</>
                  )
                ) : (
                  <>Enter the rating of the overcurrent device ahead of this circuit to size the copper EGC per Table 250.122.</>
                )}
              </div>
            </Section>

            {/* Load summary */}
            <Section tag={load.basis.match(/\[(.*)\]/)?.[1] || "load"} title="Load evaluation">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  ["Full-load current", `${fmt(load.fla)} A`, load.flaBasis],
                  ["Sizing rule", load.basis.split("[")[0].trim(), load.basis.match(/\[(.*)\]/)?.[1] || ""],
                  ["Design current", `${fmt(load.design)} A`, "minimum conductor ampacity target"],
                ].map(([l, v, s]) => (
                  <div key={l} style={{ background: C.field, border: `1px solid ${C.lineSoft}`, borderRadius: 4, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10.5, color: C.faint, textTransform: "uppercase", letterSpacing: ".5px" }}>{l}</div>
                    <div style={{ ...mono, fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v}</div>
                    <div style={{ fontSize: 11.5, marginTop: 4, color: C.mut, lineHeight: 1.5 }}>{s}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Warnings */}
            {warnings.length > 0 && (
              <Section tag="review" title="Code notes &amp; warnings">
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {warnings.map((w, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12.5,
                        color: C.text,
                        background: C.warnWash,
                        borderLeft: `4px solid ${C.warn}`,
                        borderRadius: "0 4px 4px 0",
                        padding: "8px 12px",
                        marginBottom: 6,
                        lineHeight: 1.55,
                      }}
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Method reference */}
            {result && (
              <Section tag="method" title="Applied NEC method">
                <div style={{ fontSize: 12.5, color: C.mut, lineHeight: 1.7 }}>
                  <div><span style={{ color: C.faint }}>Base table: </span>{result.method.baseTableName} (ambient basis {result.method.tableBaseAmbient}°C).</div>
                  <div><span style={{ color: C.faint }}>Tray rule: </span>{result.method.trayRef}.</div>
                  <div><span style={{ color: C.faint }}>Ambient correction: </span>{vClass !== "lv" ? "315.60(D)(4) equation" : ambMethod === "table" ? "Table 310.15(B)(1) band values (5°C bands, as in IEEE PCIC-2023-14)" : "exact 310.15(B)(1) equation"} applied for {ambient}°C with {effInsTemp}°C insulation.</div>
                  {result.method.adjApplies && (
                    <div><span style={{ color: C.faint }}>Adjustment: </span>310.15(C)(1) applied to the number of current-carrying conductors within each multiconductor cable, per 392.80(A)(1)(a).</div>
                  )}
                  <div>
                    <span style={{ color: C.faint }}>{vClass === "lv" ? "NEC 110.14(C) termination limit: " : "Terminations: "}</span>
                    {vClass === "lv"
                      ? terminationOverrideActive
                        ? "Not applied — engineering override."
                        : `Applied — Table 310.16 at ${termTemp}°C (underated).`
                      : "limited per 110.40 using the underated 90°C column of the MV base table (unless equipment is identified for higher rating)."}
                  </div>
                </div>
              </Section>
            )}

            <div style={{ ...mono, fontSize: 11.5, color: C.mut, lineHeight: 1.6, border: `1px dashed ${C.line}`, borderRadius: 6, padding: 16 }}>
              Engineering aid only. Ampacity and FLC tables were transcribed for study purposes — always verify values, exceptions and local amendments against the official NEC edition adopted by the authority having jurisdiction. Short-circuit withstand, voltage drop, tray fill (392.22) and EGC sizing (250.122) must be checked separately.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .tool-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
