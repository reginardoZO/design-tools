import { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────
// Cable parameters — Southwire / NEC Chapter 9, Table 9
// R (AC, 75°C) and X in ohms per 1000 ft, conductors in PVC conduit
// Ampacity: NEC 310.16, 75°C column
// ─────────────────────────────────────────────────────────────
const CABLES = [
  { size: "14 AWG",    rCu: 3.1,   rAl: null,  x: 0.058, ampCu: 20,  ampAl: null },
  { size: "12 AWG",    rCu: 2.0,   rAl: 3.2,   x: 0.054, ampCu: 25,  ampAl: 20 },
  { size: "10 AWG",    rCu: 1.2,   rAl: 2.0,   x: 0.050, ampCu: 35,  ampAl: 30 },
  { size: "8 AWG",     rCu: 0.78,  rAl: 1.3,   x: 0.052, ampCu: 50,  ampAl: 40 },
  { size: "6 AWG",     rCu: 0.49,  rAl: 0.81,  x: 0.051, ampCu: 65,  ampAl: 50 },
  { size: "4 AWG",     rCu: 0.31,  rAl: 0.51,  x: 0.048, ampCu: 85,  ampAl: 65 },
  { size: "3 AWG",     rCu: 0.25,  rAl: 0.40,  x: 0.047, ampCu: 100, ampAl: 75 },
  { size: "2 AWG",     rCu: 0.19,  rAl: 0.32,  x: 0.045, ampCu: 115, ampAl: 90 },
  { size: "1 AWG",     rCu: 0.15,  rAl: 0.25,  x: 0.046, ampCu: 130, ampAl: 100 },
  { size: "1/0 AWG",   rCu: 0.12,  rAl: 0.20,  x: 0.044, ampCu: 150, ampAl: 120 },
  { size: "2/0 AWG",   rCu: 0.10,  rAl: 0.16,  x: 0.043, ampCu: 175, ampAl: 135 },
  { size: "3/0 AWG",   rCu: 0.077, rAl: 0.13,  x: 0.042, ampCu: 200, ampAl: 155 },
  { size: "4/0 AWG",   rCu: 0.062, rAl: 0.10,  x: 0.041, ampCu: 230, ampAl: 180 },
  { size: "250 kcmil", rCu: 0.052, rAl: 0.085, x: 0.041, ampCu: 255, ampAl: 205 },
  { size: "300 kcmil", rCu: 0.044, rAl: 0.071, x: 0.041, ampCu: 285, ampAl: 230 },
  { size: "350 kcmil", rCu: 0.038, rAl: 0.061, x: 0.040, ampCu: 310, ampAl: 250 },
  { size: "400 kcmil", rCu: 0.033, rAl: 0.054, x: 0.040, ampCu: 335, ampAl: 270 },
  { size: "500 kcmil", rCu: 0.027, rAl: 0.043, x: 0.039, ampCu: 380, ampAl: 310 },
  { size: "600 kcmil", rCu: 0.023, rAl: 0.036, x: 0.039, ampCu: 420, ampAl: 340 },
  { size: "750 kcmil", rCu: 0.019, rAl: 0.029, x: 0.038, ampCu: 475, ampAl: 385 },
  { size: "1000 kcmil",rCu: 0.015, rAl: 0.023, x: 0.037, ampCu: 545, ampAl: 445 },
];


// NEC Table 430.250 — Full-Load Current, three-phase AC induction motors,
// squirrel cage, 460 V column (amperes)
const MOTOR_FLC_460 = [
  { hp: "1/2", a: 1.1 }, { hp: "3/4", a: 1.6 }, { hp: "1", a: 2.1 },
  { hp: "1-1/2", a: 3.0 }, { hp: "2", a: 3.4 }, { hp: "3", a: 4.8 },
  { hp: "5", a: 7.6 }, { hp: "7-1/2", a: 11 }, { hp: "10", a: 14 },
  { hp: "15", a: 21 }, { hp: "20", a: 27 }, { hp: "25", a: 34 },
  { hp: "30", a: 40 }, { hp: "40", a: 52 }, { hp: "50", a: 65 },
  { hp: "60", a: 77 }, { hp: "75", a: 96 }, { hp: "100", a: 124 },
  { hp: "125", a: 156 }, { hp: "150", a: 180 }, { hp: "200", a: 240 },
  { hp: "250", a: 302 }, { hp: "300", a: 361 }, { hp: "350", a: 414 },
  { hp: "400", a: 477 }, { hp: "450", a: 515 }, { hp: "500", a: 590 },
];

function calcVD(cable, { material, phases, current, lengthFt, pf, n, voltage }) {
  const r = material === "cu" ? cable.rCu : cable.rAl;
  const amp = material === "cu" ? cable.ampCu : cable.ampAl;
  if (r == null) return null;
  const sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
  const zEff = r * pf + cable.x * sinPhi; // effective Ω/1000 ft
  const k = phases === 3 ? Math.sqrt(3) : 2;
  const vd = (k * current * zEff * (lengthFt / 1000)) / n;
  const pct = (vd / voltage) * 100;
  return { vd, pct, zEff, amp, ampOk: amp != null && current / n <= amp };
}

export default function App() {
  const [tag, setTag] = useState("");
  const [sizeIdx, setSizeIdx] = useState(8); // 1 AWG
  const [material, setMaterial] = useState("cu");
  const [phases, setPhases] = useState(3);
  const [voltage, setVoltage] = useState(480);
  const [current, setCurrent] = useState(100);
  const [length, setLength] = useState(400);
  const [pf, setPf] = useState(0.85);
  const [n, setN] = useState(1);
  const [limit, setLimit] = useState(5); // max voltage drop: 3% or 5%
  const [probePct, setProbePct] = useState(null); // draggable gauge marker (%)

  // Load current calculator
  const [ldType, setLdType] = useState("motor"); // motor | generator | feeder | transformer
  const [motorHpIdx, setMotorHpIdx] = useState(14); // 50 HP
  const [ldValue, setLdValue] = useState(50);
  const [ldUnit, setLdUnit] = useState("hp"); // hp | kva | kw
  const [ldVolt, setLdVolt] = useState(480);
  const [ldPhases, setLdPhases] = useState(3); // 3-phase default
  const [ldPf, setLdPf] = useState(0.85);
  const [ldEff, setLdEff] = useState(0.9);

  const result = useMemo(() => {
    const lengthFt = Number(length);
    const params = { material, phases, current: Number(current), lengthFt, pf: Number(pf), n: Number(n), voltage: Number(voltage) };
    if (!(params.current > 0) || !(lengthFt > 0) || !(params.voltage > 0) || !(params.pf > 0 && params.pf <= 1) || !(params.n >= 1)) {
      return { error: "Enter valid values for current, distance, voltage, power factor (0–1), and conductors per phase." };
    }

    const chosenCable = CABLES[sizeIdx];
    const chosen = calcVD(chosenCable, params);
    if (!chosen) return { error: "This size is not available in aluminum in the Southwire tables (Table 9)." };

    // Full curve (for the chart)
    const curve = CABLES.map((c, i) => ({ i, size: c.size, res: calcVD(c, params) }));

    // Suggestion: smallest cable (from the selected one up) with VD < 5% and
    // adequate ampacity, keeping conductor count; if none pass, add conductors.
    let suggestion = null;
    outer: for (let extra = 0; extra <= 3; extra++) {
      const nTry = params.n + extra;
      const startIdx = extra === 0 ? sizeIdx : 0;
      for (let i = startIdx; i < CABLES.length; i++) {
        const r = calcVD(CABLES[i], { ...params, n: nTry });
        if (r && r.pct < limit && r.ampOk) {
          suggestion = { cable: CABLES[i], idx: i, n: nTry, res: r };
          break outer;
        }
      }
    }

    return { params, chosenCable, chosen, curve, suggestion };
  }, [tag, sizeIdx, material, phases, voltage, current, length, pf, n, limit]);

  // ── Load current calculation ─────────────────────────────
  // kVA: I = S·1000 / (k·V)            (PF not required)
  // kW : I = P·1000 / (k·V·PF)
  // HP : I = HP·746  / (k·V·PF·η)
  // where k = √3 for 3-phase (V = L-L) and 1 for 1-phase.
  const loadCalc = useMemo(() => {
    // Motors: FLC looked up in NEC Table 430.250 (460 V, three-phase) — not calculated
    if (ldType === "motor") {
      const m = MOTOR_FLC_460[motorHpIdx];
      return { amps: m.a, motor: m };
    }
    const val = Number(ldValue), V = Number(ldVolt);
    const pfv = Number(ldPf), eff = Number(ldEff);
    const k = ldPhases === 3 ? Math.sqrt(3) : 1;
    if (!(val > 0) || !(V > 0)) return { error: "Enter a valid load value and voltage." };
    if (ldUnit !== "kva" && !(pfv > 0 && pfv <= 1)) return { error: "Power factor must be between 0 and 1." };
    if (ldUnit === "hp" && !(eff > 0 && eff <= 1)) return { error: "Efficiency must be between 0 and 1." };
    let amps;
    if (ldUnit === "kva") amps = (val * 1000) / (k * V);
    else if (ldUnit === "kw") amps = (val * 1000) / (k * V * pfv);
    else amps = (val * 746) / (k * V * pfv * eff);
    return { amps };
  }, [ldType, motorHpIdx, ldValue, ldUnit, ldVolt, ldPhases, ldPf, ldEff]);

  const applyLoadCurrent = () => {
    if (!loadCalc.amps) return;
    setCurrent(Number(loadCalc.amps.toFixed(1)));
    if (ldType === "motor") {
      setVoltage(460);
      setPhases(3);
      setPf(Number(ldPf));
    } else {
      setVoltage(Number(ldVolt));
      setPhases(ldPhases);
      if (ldUnit !== "kva") setPf(Number(ldPf));
    }
  };

  const ok = result.chosen && result.chosen.pct < limit;

  // Smallest cable meeting the dragged gauge threshold (probePct), same n + ampacity
  const probe = useMemo(() => {
    if (probePct == null || result.error) return null;
    for (let i = 0; i < CABLES.length; i++) {
      const r = calcVD(CABLES[i], result.params);
      if (r && r.pct < probePct && r.ampOk) return { cable: CABLES[i], res: r };
    }
    return { none: true };
  }, [probePct, result]);

  const dragGauge = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = Math.min(8, Math.max(0.25, (x / rect.width) * 8));
    setProbePct(Number(pct.toFixed(2)));
  };
  const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        :root {
          --bg: #eceff2; --panel: #ffffff; --ink: #1d2530; --muted: #5c6875;
          --steel: #c6cdd4; --accent: #0e5da8; --ok: #1e7d46; --bad: #b3261e;
          --plate: #2a323c; --plate-edge: #3d4854;
        }
        * { box-sizing: border-box; }
        .app { min-height: 100vh; background: var(--bg); color: var(--ink);
          font-family: 'Saira Semi Condensed', system-ui, sans-serif; padding: 24px 16px 48px; }
        .wrap { max-width: 980px; margin: 0 auto; }
        header { border-bottom: 3px solid var(--ink); padding-bottom: 12px; margin-bottom: 20px;
          display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 8px; }
        h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
        .sub { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); }
        .hublink { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--accent);
          text-decoration: none; border: 1px solid var(--steel); background: var(--panel);
          border-radius: 4px; padding: 6px 12px; white-space: nowrap; }
        .hublink:hover { background: #eef4fb; border-color: var(--accent); }
        .grid { display: grid; grid-template-columns: 380px 1fr; gap: 20px; }
        @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
        .card { background: var(--panel); border: 1px solid var(--steel); border-radius: 6px; padding: 18px; }
        .card h2 { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--muted); }
        label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .6px; color: var(--muted); margin-bottom: 4px; }
        input, select { width: 100%; padding: 8px 10px; border: 1px solid var(--steel); border-radius: 4px;
          font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: var(--ink); background: #fbfcfd; }
        input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .row3 { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px; }
        .seg { display: flex; border: 1px solid var(--steel); border-radius: 4px; overflow: hidden; }
        .seg button { flex: 1; padding: 8px 4px; border: 0; background: #fbfcfd; cursor: pointer;
          font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--muted); }
        .seg button.on { background: var(--accent); color: #fff; font-weight: 600; }
        /* ── Nameplate ──────────────────────────────────── */
        .plate { background: linear-gradient(160deg, var(--plate-edge), var(--plate) 40%);
          border-radius: 8px; padding: 20px 22px; color: #e8edf2; position: relative;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.15), 0 4px 14px rgba(0,0,0,.25);
          border: 1px solid #171c22; margin-bottom: 16px; }
        .screw { position: absolute; width: 10px; height: 10px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #cfd6dd, #6b747d 70%); }
        .screw::after { content: ""; position: absolute; left: 1px; right: 1px; top: 4px; height: 1.5px; background: #3a4149; }
        .plate .tagline { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 2px;
          color: #9fb0c0; text-transform: uppercase; }
        .plate .tagname { font-size: 24px; font-weight: 700; letter-spacing: 1px; margin: 2px 0 12px; }
        .plate table { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono', monospace; font-size: 13px; }
        .plate td { padding: 5px 0; border-top: 1px solid rgba(255,255,255,.12); }
        .plate td:last-child { text-align: right; font-weight: 600; }
        .vdbig { font-family: 'IBM Plex Mono', monospace; font-size: 40px; font-weight: 600; line-height: 1; }
        .status { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 12px;
          font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .st-ok { background: var(--ok); color: #fff; } .st-bad { background: var(--bad); color: #fff; }
        .gauge { height: 10px; background: rgba(255,255,255,.15); border-radius: 5px; margin: 12px 0 4px; position: relative; }
        .gauge-drag { cursor: ew-resize; touch-action: none; }
        .gauge .fill { height: 100%; border-radius: 5px; pointer-events: none; }
        .gauge .lim { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #ffd23f; pointer-events: none; }
        .gauge .lim-handle { position: absolute; top: -9px; width: 12px; height: 12px; margin-left: -5px;
          border-radius: 50%; background: #ffd23f; border: 2px solid #2a323c; pointer-events: none;
          box-shadow: 0 1px 3px rgba(0,0,0,.4); }
        .probe { margin-top: 8px; padding: 7px 10px; background: rgba(255,210,63,.12);
          border-left: 3px solid #ffd23f; border-radius: 0 4px 4px 0;
          font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #e8edf2; }
        .probe-pct { color: #ffd23f; font-weight: 600; }
        .sug { border: 1px dashed var(--accent); background: #eef4fb; border-radius: 6px; padding: 14px 16px; margin-top: 14px; }
        .sug .stitle { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
        .sug .sname { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; margin: 4px 0; }
        .warn { margin-top: 10px; padding: 8px 12px; border-left: 4px solid #d99a00; background: #fdf6e3;
          font-size: 13px; border-radius: 0 4px 4px 0; }
        .loadcalc { margin-top: 18px; padding-top: 16px; border-top: 2px dashed var(--steel); }
        .loadcalc h2 { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--muted); }
        .ld-out { display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: #f2f6fa; border: 1px solid var(--steel); border-radius: 6px; padding: 10px 14px; margin-top: 4px; }
        .ld-err { color: var(--bad); font-size: 13px; }
        .ld-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); }
        .ld-amps { font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 600; color: var(--accent); line-height: 1.1; }
        .ld-apply { border: 0; background: var(--accent); color: #fff; padding: 9px 14px; border-radius: 4px;
          font-family: 'Saira Semi Condensed', sans-serif; font-weight: 600; font-size: 13px; cursor: pointer;
          text-transform: uppercase; letter-spacing: .5px; }
        .ld-apply:hover { background: #0b4c8a; }
        .ld-note { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); margin-top: 8px; }
        .chart-note { font-size: 11px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; margin-top: 6px; }
        .foot { margin-top: 20px; font-size: 11.5px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; line-height: 1.6; }
      `}</style>

      <div className="wrap">
        <header>
          <div>
            <h1>LV Cable Voltage Drop</h1>
            <div className="sub">Southwire / NEC Ch.9 Table 9 · R and X (75°C, PVC) · limit {limit.toFixed(1)}%</div>
          </div>
          <a className="hublink" href="../../index.html">← Hub</a>
        </header>

        <div className="grid">
          {/* ── Inputs ───────────────────────────────────── */}
          <div className="card">
            <h2>Circuit data</h2>

            <div className="row3">
              <div>
                <label>Circuit tag</label>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. PP-01 / MCC-3" />
              </div>
              <div>
                <label>Material</label>
                <div className="seg">
                  <button className={material === "cu" ? "on" : ""} onClick={() => setMaterial("cu")}>Cu</button>
                  <button className={material === "al" ? "on" : ""} onClick={() => setMaterial("al")}>Al</button>
                </div>
              </div>
            </div>

            <div className="row">
              <div>
                <label>Cable size</label>
                <select value={sizeIdx} onChange={(e) => setSizeIdx(Number(e.target.value))}>
                  {CABLES.map((c, i) => (
                    <option key={c.size} value={i} disabled={material === "al" && c.rAl == null}>{c.size}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Conductors per phase</label>
                <input type="number" min="1" max="8" value={n} onChange={(e) => setN(e.target.value)} />
              </div>
            </div>

            <div className="row">
              <div>
                <label>System</label>
                <div className="seg">
                  <button className={phases === 3 ? "on" : ""} onClick={() => setPhases(3)}>3-phase</button>
                  <button className={phases === 1 ? "on" : ""} onClick={() => setPhases(1)}>1-phase</button>
                </div>
              </div>
              <div>
                <label>Voltage (V)</label>
                <input type="number" min="1" value={voltage} onChange={(e) => setVoltage(e.target.value)} />
              </div>
            </div>

            <div className="row">
              <div>
                <label>Current (A)</label>
                <input type="number" min="0" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div>
                <label>Power factor</label>
                <input type="number" min="0.05" max="1" step="0.01" value={pf} onChange={(e) => setPf(e.target.value)} />
              </div>
            </div>

            <div className="row" style={{ marginBottom: 0 }}>
              <div>
                <label>Run length (ft)</label>
                <input type="number" min="0" value={length} onChange={(e) => setLength(e.target.value)} />
              </div>
              <div>
                <label>Max VD limit</label>
                <div className="seg">
                  <button className={limit === 3 ? "on" : ""} onClick={() => setLimit(3)}>3%</button>
                  <button className={limit === 5 ? "on" : ""} onClick={() => setLimit(5)}>5%</button>
                </div>
              </div>
            </div>

            {/* ── Load current calculator ─────────────────── */}
            <div className="loadcalc">
              <h2>Load current calculator</h2>

              <div style={{ marginBottom: 12 }}>
                <label>Load type</label>
                <div className="seg">
                  <button className={ldType === "motor" ? "on" : ""} onClick={() => setLdType("motor")}>Motor</button>
                  <button className={ldType === "generator" ? "on" : ""} onClick={() => setLdType("generator")}>Generator</button>
                  <button className={ldType === "feeder" ? "on" : ""} onClick={() => setLdType("feeder")}>Feeder</button>
                  <button className={ldType === "transformer" ? "on" : ""} onClick={() => setLdType("transformer")}>Transformer</button>
                </div>
              </div>

              {ldType === "motor" ? (
                <>
                  <div className="row">
                    <div>
                      <label>Motor rating (HP)</label>
                      <select value={motorHpIdx} onChange={(e) => setMotorHpIdx(Number(e.target.value))}>
                        {MOTOR_FLC_460.map((m, i) => (
                          <option key={m.hp} value={i}>{m.hp} HP</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Voltage (V, L-L)</label>
                      <input type="number" value={460} disabled style={{ background: "#eef1f4", color: "#7d8894" }} />
                    </div>
                  </div>
                  <div className="row">
                    <div>
                      <label>Power factor (for VD calc)</label>
                      <input type="number" min="0.05" max="1" step="0.01" value={ldPf} onChange={(e) => setLdPf(e.target.value)} />
                    </div>
                    <div />
                  </div>
                </>
              ) : (
                <>
                  <div className="row">
                    <div>
                      <label>Load</label>
                      <input type="number" min="0" value={ldValue} onChange={(e) => setLdValue(e.target.value)} />
                    </div>
                    <div>
                      <label>Unit</label>
                      <div className="seg">
                        <button className={ldUnit === "hp" ? "on" : ""} onClick={() => setLdUnit("hp")}>HP</button>
                        <button className={ldUnit === "kva" ? "on" : ""} onClick={() => setLdUnit("kva")}>kVA</button>
                        <button className={ldUnit === "kw" ? "on" : ""} onClick={() => setLdUnit("kw")}>kW</button>
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div>
                      <label>System</label>
                      <div className="seg">
                        <button className={ldPhases === 3 ? "on" : ""} onClick={() => setLdPhases(3)}>3-phase</button>
                        <button className={ldPhases === 1 ? "on" : ""} onClick={() => setLdPhases(1)}>1-phase</button>
                      </div>
                    </div>
                    <div>
                      <label>Voltage (V{ldPhases === 3 ? ", L-L" : ""})</label>
                      <input type="number" min="1" value={ldVolt} onChange={(e) => setLdVolt(e.target.value)} />
                    </div>
                  </div>

                  {ldUnit !== "kva" && (
                    <div className="row">
                      <div>
                        <label>Power factor</label>
                        <input type="number" min="0.05" max="1" step="0.01" value={ldPf} onChange={(e) => setLdPf(e.target.value)} />
                      </div>
                      {ldUnit === "hp" ? (
                        <div>
                          <label>Efficiency (η)</label>
                          <input type="number" min="0.05" max="1" step="0.01" value={ldEff} onChange={(e) => setLdEff(e.target.value)} />
                        </div>
                      ) : <div />}
                    </div>
                  )}
                </>
              )}

              {loadCalc.error ? (
                <div className="ld-out ld-err">{loadCalc.error}</div>
              ) : (
                <div className="ld-out">
                  <div>
                    <div className="ld-label">{ldType === "motor" ? "Full-load current (FLC)" : "Calculated current"}</div>
                    <div className="ld-amps">{fmt(loadCalc.amps, 1)} <span style={{ fontSize: 14 }}>A</span></div>
                  </div>
                  <button className="ld-apply" onClick={applyLoadCurrent}>Use in circuit ↑</button>
                </div>
              )}
              <div className="ld-note">
                {ldType === "motor"
                  ? "FLC per NEC Table 430.250 — three-phase induction motor, 460 V (fixed)."
                  : (ldUnit === "kva"
                      ? "I = kVA·1000 / (√3·V) — power factor not required for kVA."
                      : ldUnit === "kw"
                        ? "I = kW·1000 / (√3·V·PF)"
                        : "I = HP·746 / (√3·V·PF·η)") + (ldPhases === 1 ? " (single-phase: √3 replaced by 1)" : "")}
              </div>
            </div>
          </div>

          {/* ── Results ──────────────────────────────────── */}
          <div>
            {result.error ? (
              <div className="card">{result.error}</div>
            ) : (
              <>
                {/* Nameplate */}
                <div className="plate">
                  <span className="screw" style={{ top: 8, left: 8 }} />
                  <span className="screw" style={{ top: 8, right: 8 }} />
                  <span className="screw" style={{ bottom: 8, left: 8 }} />
                  <span className="screw" style={{ bottom: 8, right: 8 }} />
                  <div className="tagline">Circuit</div>
                  <div className="tagname">{tag.trim() || "NO TAG"}</div>

                  <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div className="tagline">Voltage drop</div>
                      <div className="vdbig" style={{ color: ok ? "#7fd6a3" : "#ff8f87" }}>
                        {fmt(result.chosen.pct)}<span style={{ fontSize: 20 }}>%</span>
                      </div>
                    </div>
                    <div style={{ paddingBottom: 6 }}>
                      <span className={"status " + (ok ? "st-ok" : "st-bad")}>
                        {ok ? `Pass · < ${limit}%` : `Fail · ≥ ${limit}%`}
                      </span>
                    </div>
                  </div>

                  <div className="gauge gauge-drag"
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragGauge(e); }}
                    onPointerMove={(e) => { if (e.buttons === 1) dragGauge(e); }}>
                    <div className="fill" style={{
                      width: Math.min(100, (result.chosen.pct / 8) * 100) + "%",
                      background: ok ? "#4caf7d" : "#e05d55" }} />
                    <div className="lim" style={{ left: ((probePct ?? limit) / 8) * 100 + "%" }} />
                    <div className="lim-handle" style={{ left: ((probePct ?? limit) / 8) * 100 + "%" }} />
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#9fb0c0",
                    display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>scale 0–8% · drag the yellow marker {probePct == null ? `(at ${limit}% limit)` : ""}</span>
                    {probePct != null && (
                      <button onClick={() => setProbePct(null)}
                        style={{ border: 0, background: "none", color: "#ffd23f", cursor: "pointer",
                          fontFamily: "inherit", fontSize: 11, padding: 0, textDecoration: "underline" }}>
                        reset to {limit}% limit
                      </button>
                    )}
                  </div>
                  {probePct != null && probe && (
                    <div className="probe">
                      <span className="probe-pct">{fmt(probePct, 2)}%</span>
                      {probe.none
                        ? <> — no cable meets this threshold with {result.params.n}× per phase</>
                        : <> — smallest cable: <b>{result.params.n > 1 ? result.params.n + "× " : ""}{probe.cable.size}</b> ({fmt(probe.res.pct)}% drop, {fmt(result.params.current / result.params.n, 1)} A ≤ {probe.res.amp} A)</>}
                    </div>
                  )}

                  <table style={{ marginTop: 12 }}>
                    <tbody>
                      <tr><td>Selected cable</td><td>{result.params.n > 1 ? result.params.n + "× " : ""}{result.chosenCable.size} ({material === "cu" ? "copper" : "aluminum"})</td></tr>
                      <tr><td>Absolute drop</td><td>{fmt(result.chosen.vd)} V</td></tr>
                      <tr><td>Effective Z (R·cosφ + X·sinφ)</td><td>{fmt(result.chosen.zEff, 4)} Ω/1000 ft</td></tr>
                      <tr><td>Current per conductor</td><td>{fmt(result.params.current / result.params.n, 1)} A / {result.chosen.amp ?? "—"} A (75°C)</td></tr>
                    </tbody>
                  </table>
                </div>

                {!result.chosen.ampOk && (
                  <div className="warn">
                    ⚠ Current per conductor exceeds the 75°C ampacity (NEC 310.16) of the selected cable.
                  </div>
                )}

                {/* Suggestion */}
                <div className="card">
                  <h2>Automatic suggestion</h2>
                  {result.suggestion ? (
                    result.suggestion.idx === sizeIdx && result.suggestion.n === result.params.n && ok && result.chosen.ampOk ? (
                      <div>The selected cable already meets the &lt; {limit.toFixed(0)}% voltage-drop criterion and the ampacity requirement — no change needed.</div>
                    ) : (
                      <div className="sug">
                        <div className="stitle">Suggested cable</div>
                        <div className="sname">
                          {result.suggestion.n > 1 ? result.suggestion.n + "× " : ""}{result.suggestion.cable.size} ({material === "cu" ? "Cu" : "Al"})
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                          Drop: <b style={{ color: "var(--ok)" }}>{fmt(result.suggestion.res.pct)}%</b>
                          {" · "}{fmt(result.suggestion.res.vd)} V
                          {" · "}{fmt(result.params.current / result.suggestion.n, 1)} A/cond. ≤ {result.suggestion.res.amp} A
                        </div>
                        {result.suggestion.n > result.params.n && (
                          <div style={{ fontSize: 12.5, marginTop: 6, color: "var(--muted)" }}>
                            No single size passed — conductors per phase were increased to {result.suggestion.n}.
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div>No combination (up to {result.params.n + 3} conductors per phase, up to 1000 kcmil) meets the {limit.toFixed(0)}% limit. Review the run length or voltage, or consider medium voltage.</div>
                  )}
                </div>

                {/* Curve by size */}
                <div className="card" style={{ marginTop: 16 }}>
                  <h2>Voltage drop by size ({result.params.n}× per phase)</h2>
                  <svg viewBox="0 0 720 200" width="100%" role="img" aria-label="Voltage drop by cable size">
                    {(() => {
                      // Window: 1 size below and 3 above the selected one
                      const lo = Math.max(0, sizeIdx - 1);
                      const hi = Math.min(CABLES.length - 1, sizeIdx + 3);
                      const data = result.curve.filter((d) => d.res && d.i >= lo && d.i <= hi);
                      const maxPct = Math.max(limit * 1.4, ...data.map((d) => Math.min(d.res.pct, 20)));
                      const bw = 720 / data.length;
                      const yLim = 170 - (limit / maxPct) * 150;
                      return (
                        <>
                          {data.map((d, k) => {
                            const h = Math.min((d.res.pct / maxPct) * 150, 150);
                            const isSel = d.i === sizeIdx;
                            const isSug = result.suggestion && d.i === result.suggestion.idx && result.suggestion.n === result.params.n;
                            const pass = d.res.pct < limit;
                            return (
                              <g key={d.size}>
                                <rect x={k * bw + 12} y={170 - h} width={bw - 24} height={h}
                                  fill={isSel ? "#0e5da8" : isSug ? "#1e7d46" : pass ? "#b9c6d2" : "#e3b3af"}
                                  stroke={isSel || isSug ? "#1d2530" : "none"} strokeWidth="1.5" rx="2" />
                                <text x={k * bw + bw / 2} y={Math.min(166, 170 - h - 5)} textAnchor="middle"
                                  fontSize="11" fontFamily="IBM Plex Mono, monospace"
                                  fill={pass ? "#3f6e53" : "#a3423c"} fontWeight="600">
                                  {d.res.pct.toFixed(2)}%
                                </text>
                                <text x={k * bw + bw / 2} y={188} textAnchor="middle"
                                  fontSize="12" fontFamily="IBM Plex Mono, monospace"
                                  fill={isSel || isSug ? "#1d2530" : "#7d8894"}
                                  fontWeight={isSel || isSug ? 700 : 400}>
                                  {d.size}
                                </text>
                              </g>
                            );
                          })}
                          <line x1="0" x2="720" y1={yLim} y2={yLim} stroke="#d99a00" strokeWidth="2" strokeDasharray="6 4" />
                          <text x="714" y={yLim - 5} textAnchor="end" fontSize="10"
                            fontFamily="IBM Plex Mono, monospace" fill="#a87700">{limit.toFixed(0)}% limit</text>
                        </>
                      );
                    })()}
                  </svg>
                  <div className="chart-note">■ blue = selected · ■ green = suggested · light bars = pass · reddish = fail</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="foot">
          Southwire method (effective impedance): VD = k · I · (R·cosφ + X·sinφ) · L / (1000 · n), with k = √3 (3-phase, L-L) or 2 (1-phase).
          R and X per NEC Chapter 9 Table 9 (conductors at 75°C in PVC conduit). Reference ampacity: NEC 310.16, 75°C, no correction factors.
          Support tool — final sizing must be verified by the responsible engineer.
        </div>
      </div>
    </div>
  );
}
