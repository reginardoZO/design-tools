import React, { useEffect, useMemo, useState } from "react";

import {
  STANDARD_WIDTHS_IN, STANDARD_DEPTHS_IN,
  ADJACENT_SPACING_MULT, EDGE_CLEARANCE_IN,
  isPowerTray, usesTrefoilLayout,
  loadCableTrayDb, cascadeOptions, findCable,
  layoutItems, spacingBetween, standardizeTraySize, suggestDepth, suggestSpacingToggles,
} from "./engine.js";

/* --------------------------------- THEME ---------------------------------
   Palette and typography come from shared/theme.css — the same tokens every
   tool in the hub uses. Mirrored here as constants because this component
   styles inline, following the apps/nec-cable-tray convention.
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
  accentDark: "#0b4c8a",
  ok: "#1e7d46",
  warn: "#d99a00",
  warnWash: "#fdf6e3",
  err: "#b3261e",
  plate: "#2a323c",
  plateEdge: "#3d4854",
  plateInk: "#e8edf2",
  plateMut: "#9fb0c0",
};

// Load -> accent colour, reusing existing palette tokens only (no new hues
// introduced) so the tool matches the rest of the hub.
const LOAD_COLOR = { Power: C.accent, VFD: C.warn, "Power-Tray": C.plateEdge };

const mono = { fontFamily: "'IBM Plex Mono', ui-monospace, Consolas, monospace" };
const ui = { fontFamily: "'Saira Semi Condensed', system-ui, sans-serif" };

function Label({ children }) {
  return (
    <div className="mb-1" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px", color: C.mut }}>
      {children}
    </div>
  );
}

function Section({ tag, title, children }) {
  return (
    <div className="mb-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18 }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.2px", color: C.mut }}>{title}</div>
        {tag && <div style={{ ...mono, fontSize: 11, color: C.faint, whiteSpace: "nowrap" }}>{tag}</div>}
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
  ...mono, background: C.field, border: `1px solid ${C.line}`, color: C.text,
  width: "100%", padding: "8px 10px", borderRadius: 4, fontSize: 14, outline: "none",
};

function Num({ value, onChange, step = "any", min, placeholder, disabled }) {
  return (
    <input type="number" value={value} step={step} min={min} placeholder={placeholder} disabled={disabled}
      onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, opacity: disabled ? 0.55 : 1 }} />
  );
}

function Sel({ value, onChange, options, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ ...inputStyle, opacity: disabled ? 0.55 : 1 }}>
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
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            ...mono, flex: "1 1 auto", padding: "8px 6px", border: 0,
            borderLeft: i === 0 ? 0 : `1px solid ${C.line}`,
            background: on ? C.accent : C.field, color: on ? "#fff" : C.mut,
            fontWeight: on ? 600 : 400, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({ checked, onChange, label, hint, highlighted }) {
  return (
    <div style={{ marginBottom: 14, borderRadius: 4, padding: highlighted ? 8 : 0, background: highlighted ? C.warnWash : "transparent", border: highlighted ? `1px solid ${C.warn}` : "1px solid transparent" }}>
      <label className="flex items-start gap-2" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          style={{ width: 14, height: 14, marginTop: 2, accentColor: C.accent }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
      </label>
      <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.45, margin: "4px 0 0 22px" }}>{hint}</div>
    </div>
  );
}

/* --------------------------- cable line defaults --------------------------- */

let nextIdCounter = 1;
const nextId = () => `c${nextIdCounter++}`;

function newLine(overrides = {}) {
  return { id: nextId(), tag: "", load: "Power", type: "Single", voltage: "600V", size: "", qty: 3, ...overrides };
}

function exampleLines() {
  nextIdCounter = 1;
  return [
    newLine({ tag: "Feeder A (motor 1)", load: "Power", type: "Single", voltage: "600V", size: "250 KCMIL", qty: 3 }),
    newLine({ tag: "Feeder B (motor 2)", load: "Power", type: "Single", voltage: "600V", size: "4/0 AWG", qty: 1 }),
    newLine({ tag: "Branch circuits", load: "Power", type: "Multiple", voltage: "600V", size: "8 AWG", qty: 6 }),
    newLine({ tag: "VFD output — Pump 3", load: "VFD", type: "Multiple", voltage: "600V", size: "2/0 AWG", qty: 3 }),
  ];
}

/* ---------------------------------- app ----------------------------------- */

export default function App() {
  const [db, setDb] = useState([]);
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    loadCableTrayDb()
      .then(setDb)
      .catch((e) => setDbError(e.message || "Could not load the cable tray database (data/cableTray.json)."));
  }, []);

  const [lines, setLines] = useState(() => exampleLines());
  const [autoWidth, setAutoWidth] = useState(true);
  const [trayWidth, setTrayWidth] = useState(18);
  const [trayDepth, setTrayDepth] = useState(4);
  const [reservePct, setReservePct] = useState(20);
  const [opts, setOpts] = useState({ trefoilSpacing: true, vfdSpacing: true, powerBundled: false });
  const [lastOptimized, setLastOptimized] = useState([]);

  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.id !== id));
  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const moveLine = (id, dir) => setLines((prev) => {
    const i = prev.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  // Resolve each line's OD/Weight from the database (exact combo lookup —
  // every selectable Load/Type/Voltage/Size always has a match, so there is
  // no manual-OD-override path anymore), then expand each line's quantity
  // into a flat, ORDER-PRESERVING sequence of atomic items (one trefoil
  // group, or one multiconductor cable, per array entry) — order matters
  // here, since spacing depends on which two items are actually adjacent.
  const flatItems = useMemo(() => {
    const out = [];
    for (const l of lines) {
      const cable = findCable(db, l);
      const od = cable?.OD ?? 0;
      const weight = cable?.Weight ?? 0;
      const qty = Math.max(0, Math.floor(Number(l.qty) || 0));
      if (!(od > 0) || qty <= 0) continue;
      for (let i = 0; i < qty; i++) {
        out.push({ lineId: l.id, tag: l.tag, load: l.load, type: l.type, voltage: l.voltage, size: l.size, od, weight });
      }
    }
    return out;
  }, [lines, db]);

  const reserveFrac = Math.min(Math.max(reservePct, 0), 90) / 100;
  const layout = useMemo(() => layoutItems(flatItems, opts), [flatItems, opts]);
  const stdAuto = useMemo(
    () => standardizeTraySize(layout.totalIn > 0 ? layout.totalIn / (1 - reserveFrac) : 0),
    [layout.totalIn, reserveFrac]
  );
  const effTrayWidth = autoWidth ? stdAuto.size : trayWidth;
  const usableWidthIn = effTrayWidth * (1 - reserveFrac);
  const fits = layout.totalIn <= usableWidthIn + 1e-9;
  const fillPct = effTrayWidth > 0 ? (layout.totalIn / effTrayWidth) * 100 : 0;
  const suggestedDepth = useMemo(() => suggestDepth(layout.maxDepthIn), [layout.maxDepthIn]);
  const hasAnyCable = flatItems.length > 0;
  const nonCommercial = autoWidth && hasAnyCable && !stdAuto.commercial;

  const hasVfd = flatItems.some((it) => it.load === "VFD");
  const hasNonVfd = flatItems.some((it) => it.load !== "VFD");

  function handleOptimize() {
    const result = suggestSpacingToggles(flatItems, opts, usableWidthIn);
    setOpts(result.opts);
    setLastOptimized(result.changed);
  }

  function loadExample() {
    setLines(exampleLines());
    setAutoWidth(true);
    setReservePct(20);
    setOpts({ trefoilSpacing: true, vfdSpacing: true, powerBundled: false });
    setLastOptimized([]);
  }

  const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d));

  return (
    <div style={{ ...ui, minHeight: "100vh", background: C.bg, color: C.text, padding: "24px clamp(12px, 2.5vw, 36px) 48px" }}>
      <div style={{ maxWidth: 1760, width: "100%", margin: "0 auto" }}>

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3" style={{ borderBottom: `3px solid ${C.text}`, paddingBottom: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" }}>
              Cable Tray Fill Sizing
            </h1>
            <div style={{ ...mono, fontSize: 12, color: C.mut, marginTop: 3 }}>
              Smallest standard tray width that physically fits a given, ordered set of power / VFD cables
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ ...mono, fontSize: 11, color: C.faint, textAlign: "right", lineHeight: 1.5 }}>
              Same width/spacing model as the AutoCAD reference tool<br />max. standard width 36 in
            </div>
            <a href="../../index.html" style={{ ...mono, fontSize: 12, color: C.accent, textDecoration: "none", border: `1px solid ${C.line}`, background: C.panel, borderRadius: 4, padding: "6px 12px", whiteSpace: "nowrap" }}>
              ← Hub
            </a>
          </div>
        </header>

        <div className="tool-grid" style={{ display: "grid", gridTemplateColumns: "minmax(400px, 30%) 1fr", gap: 24, alignItems: "start" }}>

          {/* ------------------------------ INPUTS ----------------------------- */}
          <div style={{ minWidth: 0 }}>
            <Section tag="max. 36 in — same as reference tool" title="1 · Cable tray">
              <Field label="Sizing mode">
                <SegBtns value={autoWidth} onChange={(v) => setAutoWidth(v === "true" || v === true)} options={[[true, "Auto — smallest that fits"], [false, "Fixed width"]]} />
              </Field>
              {!autoWidth && (
                <Field label="Tray width (in)">
                  <Sel value={String(trayWidth)} onChange={(v) => setTrayWidth(Number(v))} options={STANDARD_WIDTHS_IN.map((w) => [String(w), `${w} in`])} />
                </Field>
              )}
              {autoWidth && (
                <div style={{ fontSize: 12.5, color: C.mut, background: C.wash, border: `1px solid ${C.line}`, borderRadius: 4, padding: "8px 10px", marginBottom: 12 }}>
                  Smallest standard width that fits: <b style={{ ...mono }}>{stdAuto.size} in</b>
                  {!stdAuto.commercial && <> — exceeds the largest standard tray (36 in); rounded up to the next inch.</>}
                </div>
              )}
              <Field label="Tray depth (in)">
                <Sel value={String(trayDepth)} onChange={(v) => setTrayDepth(Number(v))} options={STANDARD_DEPTHS_IN.map((d) => [String(d), `${d} in`])} />
              </Field>
              {layout.maxDepthIn > trayDepth && (
                <div style={{ fontSize: 12, color: "#9a6b00", background: C.warnWash, borderLeft: `3px solid ${C.warn}`, borderRadius: "0 4px 4px 0", padding: "6px 9px", marginTop: -6, marginBottom: 12 }}>
                  Tallest cable/bundle needs ≥ {fmt(layout.maxDepthIn)} in of depth — suggested depth: {suggestedDepth} in.
                </div>
              )}
              <Field label={`Spare capacity reserve (${reservePct}%)`}>
                <input type="range" min="0" max="50" step="1" value={reservePct} onChange={(e) => setReservePct(Number(e.target.value))} style={{ width: "100%", accentColor: C.accent }} />
              </Field>
              <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
                Reserved width is subtracted from the tray before checking fill, so future cables can be added without re-sizing the tray. Not
                part of the reference tool — this app's own addition.
              </div>
            </Section>

            <Section tag="global — applies to every adjacent pair" title="2 · Spacing rules">
              <ToggleRow
                checked={opts.trefoilSpacing} onChange={(v) => setOpts((o) => ({ ...o, trefoilSpacing: v }))}
                label={`Trefoil spacing — ${ADJACENT_SPACING_MULT}×OD between groups`}
                hint="Applies between two adjacent trefoil-layout items (Single-conductor or Power-Tray cables). Uncheck for contiguous (touching) groups."
                highlighted={lastOptimized.includes("trefoilSpacing")}
              />
              <ToggleRow
                checked={opts.vfdSpacing} onChange={(v) => setOpts((o) => ({ ...o, vfdSpacing: v }))}
                label="VFD spacing — 1×OD between VFD cables"
                hint="Applies only between two adjacent VFD (Multiple) cables. Uncheck for contiguous VFD cables."
                highlighted={lastOptimized.includes("vfdSpacing")}
              />
              <ToggleRow
                checked={opts.powerBundled} onChange={(v) => setOpts((o) => ({ ...o, powerBundled: v }))}
                label="Power cables bundled (encangado)"
                hint="When checked, adjacent multiconductor Power cables sit wall-to-wall with no spacing between them."
                highlighted={lastOptimized.includes("powerBundled")}
              />
              <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
                Any other adjacent pair (e.g. a trefoil group next to a multiconductor cable, or a VFD cable next to a Power cable) always uses
                the fixed rule for that combination — see the breakdown table below.
              </div>
            </Section>

            <Section tag={`${lines.length} line(s) · order = tray order`} title="3 · Cables in this tray">
              {dbError && <div style={{ fontSize: 12, color: C.err, marginBottom: 10 }}>{dbError}</div>}
              {!db.length && !dbError && <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10 }}>Loading cable database…</div>}
              {lines.map((l, i) => (
                <CableLineEditor key={l.id} line={l} db={db}
                  onChange={(patch) => updateLine(l.id, patch)} onRemove={() => removeLine(l.id)}
                  onMoveUp={() => moveLine(l.id, -1)} onMoveDown={() => moveLine(l.id, 1)}
                  canMoveUp={i > 0} canMoveDown={i < lines.length - 1} />
              ))}
              <button type="button" onClick={addLine} className="w-full" style={{
                ...mono, marginTop: 4, padding: "10px 12px", borderRadius: 4, border: `1px dashed ${C.line}`,
                background: C.field, color: C.accent, fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
                + Add cable
              </button>
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={loadExample} style={{ ...mono, flex: 1, padding: "8px 10px", borderRadius: 4, border: `1px solid ${C.line}`, background: C.field, color: C.mut, fontSize: 12, cursor: "pointer" }}>
                  Load example
                </button>
                <button type="button" onClick={() => setLines([])} style={{ ...mono, flex: 1, padding: "8px 10px", borderRadius: 4, border: `1px solid ${C.line}`, background: C.field, color: C.mut, fontSize: 12, cursor: "pointer" }}>
                  Clear all
                </button>
              </div>
            </Section>
          </div>

          {/* ------------------------------ RESULTS ---------------------------- */}
          <div style={{ minWidth: 0 }}>

            {/* Nameplate */}
            <div style={{
              background: `linear-gradient(160deg, ${C.plateEdge}, ${C.plate} 40%)`, borderRadius: 8, padding: "20px 22px",
              color: C.plateInk, position: "relative", boxShadow: "inset 0 1px 0 rgba(255,255,255,.15), 0 4px 14px rgba(0,0,0,.25)",
              border: "1px solid #171c22", marginBottom: 16,
            }}>
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: C.plateMut, textTransform: "uppercase" }}>
                    {autoWidth ? "Suggested tray" : "Selected tray"}
                  </div>
                  <div style={{ ...mono, fontSize: 30, fontWeight: 600, lineHeight: 1.15, marginTop: 4, color: hasAnyCable ? (fits ? "#7fd6a3" : "#ff8f87") : C.plateMut }}>
                    {effTrayWidth} × {trayDepth} in
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, color: C.plateMut }}>
                    {hasAnyCable
                      ? (fits ? "Cables fit within the usable width." : "Cables do NOT fit — widen the tray, add a divider, or relax spacing rules.")
                      : "Add cables to size the tray."}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: C.plateMut, textTransform: "uppercase" }}>Fill</div>
                  <div style={{ ...mono, fontSize: 26, fontWeight: 600, marginTop: 4 }}>{fmt(fillPct, 1)} %</div>
                  <div style={{ fontSize: 11.5, marginTop: 4, color: C.plateMut }}>of {effTrayWidth} in ({reservePct}% reserved)</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {[
                  ["Required width", `${fmt(layout.totalIn)} in`],
                  ["Usable width", `${fmt(usableWidthIn)} in`],
                  ["Weight", `${fmt(layout.totalWeight / 1000, 2)} lb/ft`],
                  ["Status", fits ? "FITS" : "OVER"],
                ].map(([lbl, v]) => (
                  <div key={lbl} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10.5, color: C.plateMut, textTransform: "uppercase", letterSpacing: ".5px" }}>{lbl}</div>
                    <div style={{ ...mono, fontSize: 15, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>

              {!fits && hasAnyCable && (
                <button type="button" onClick={handleOptimize} style={{
                  ...mono, marginTop: 14, padding: "9px 14px", borderRadius: 4, border: `1px solid ${C.warn}`,
                  background: C.warn, color: "#241a00", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Suggest spacing rules to fit
                </button>
              )}
            </div>

            {nonCommercial && (
              <div style={{ fontSize: 12.5, color: C.err, background: "#fbeceb", border: `1px solid ${C.err}`, borderRadius: 4, padding: "10px 12px", marginBottom: 16, lineHeight: 1.5, ...mono, textTransform: "uppercase", letterSpacing: ".4px" }}>
                This size is not commercial — split across more than one tray, or verify a custom-width tray is available.
              </div>
            )}

            {hasVfd && hasNonVfd && (
              <div style={{ fontSize: 12.5, color: "#9a6b00", background: C.warnWash, border: `1px solid ${C.warn}`, borderRadius: 4, padding: "10px 12px", marginBottom: 16, lineHeight: 1.5 }}>
                This tray mixes VFD (drive output) cables with other circuits. Where a divider or dedicated tray isn't used, keep VFD spacing on
                to limit high-frequency noise coupling into adjacent circuits.
              </div>
            )}

            <Section tag="to scale within this tray" title="Cross-section fill diagram">
              <TrayCrossSection layout={layout} trayWidthIn={effTrayWidth} reservePct={reservePct} />
              <Legend />
            </Section>

            <Section tag="ordered, left to right" title="Breakdown">
              <BreakdownTable placements={layout.placements} opts={opts} />
              <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.6, marginTop: 10 }}>
                Width model mirrors the reference AutoCAD tool: trefoil-layout items (Single-conductor or Power-Tray cables, always grouped in
                3) occupy 2×OD; multiconductor ("Multiple") cables occupy 1×OD each. Tray-wall clearance is 0.2 in each side (or the cable's own
                OD if a Power-Tray cable sits at that edge). Trefoil bundle circles are mutually tangent (touching, never overlapping): bottom
                pair 2×r apart, top circle offset (r, r·√3) from the bottom-left circle. Standard tray widths: {STANDARD_WIDTHS_IN.join(", ")} in
                — same maximum (36 in) as the reference tool; above that, sizes are rounded up to the next inch and flagged non-commercial.
              </div>
            </Section>

            <div style={{ ...mono, fontSize: 11, color: C.faint, textAlign: "center", marginTop: 6, lineHeight: 1.6 }}>
              Support tool only — final tray selection must be verified by the responsible engineer.<br />
              Cable OD/weight data and layout rules mirror the reference AutoCAD tool's own cableTray.json and drawing logic.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- cable line editor --------------------------- */

function CableLineEditor({ line, db, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const trefoil = usesTrefoilLayout(line.type, line.load);
  const qtyLabel = trefoil ? "Trefoil groups (packages of 3)" : "Cables";
  const cable = findCable(db, line);

  const opts1 = useMemo(() => cascadeOptions(db, {}), [db]);
  const opts2 = useMemo(() => cascadeOptions(db, { load: line.load }), [db, line.load]);
  const opts3 = useMemo(() => cascadeOptions(db, { load: line.load, type: line.type }), [db, line.load, line.type]);
  const opts4 = useMemo(() => cascadeOptions(db, { load: line.load, type: line.type, voltage: line.voltage }), [db, line.load, line.type, line.voltage]);

  // Re-validate the whole Load -> Type -> Voltage -> Size chain whenever any
  // link changes or the database finishes loading — mirrors the reference
  // tool's SetComboBoxSelection fallback (keep the current value if still
  // valid, else fall back to a preferred default, else the first option).
  useEffect(() => {
    if (!db.length) return;
    const patch = {};
    let { load, type, voltage, size } = line;

    if (!opts1.loads.includes(load)) { load = opts1.loads.includes("Power") ? "Power" : opts1.loads[0]; patch.load = load; }
    const t = cascadeOptions(db, { load }).types;
    if (!t.includes(type)) { type = t.includes("Single") ? "Single" : t[0]; patch.type = type; }
    const v = cascadeOptions(db, { load, type }).voltages;
    if (!v.includes(voltage)) { voltage = v.includes("600V") ? "600V" : v[0]; patch.voltage = voltage; }
    const s = cascadeOptions(db, { load, type, voltage }).sizes;
    if (!s.includes(size)) { size = s[0] ?? ""; patch.size = size; }

    if (Object.keys(patch).length) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, line.load, line.type, line.voltage, line.size]);

  const unitWidthIn = cable ? (trefoil ? cable.OD * 2 : cable.OD) : 0;
  const qty = Math.max(0, Math.floor(Number(line.qty) || 0));

  return (
    <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 5, padding: 14, marginBottom: 12, background: C.field }}>
      <div className="flex items-center gap-2 mb-2">
        <input value={line.tag} placeholder="Tag (optional)" onChange={(e) => onChange({ tag: e.target.value })}
          style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: "6px 8px" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: LOAD_COLOR[line.load] || C.accent, flex: "0 0 auto" }} />
        <div className="flex" style={{ gap: 2 }}>
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} title="Move up" style={{
            ...mono, border: `1px solid ${C.line}`, background: C.panel, color: canMoveUp ? C.mut : C.lineSoft, borderRadius: 4,
            width: 24, height: 26, cursor: canMoveUp ? "pointer" : "default", fontSize: 12, lineHeight: 1,
          }}>▲</button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} title="Move down" style={{
            ...mono, border: `1px solid ${C.line}`, background: C.panel, color: canMoveDown ? C.mut : C.lineSoft, borderRadius: 4,
            width: 24, height: 26, cursor: canMoveDown ? "pointer" : "default", fontSize: 12, lineHeight: 1,
          }}>▼</button>
        </div>
        <button type="button" onClick={onRemove} title="Remove" style={{
          ...mono, border: `1px solid ${C.line}`, background: C.panel, color: C.err, borderRadius: 4,
          width: 26, height: 26, cursor: "pointer", fontSize: 14, lineHeight: 1,
        }}>×</button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="block">
          <Label>Load</Label>
          <Sel value={line.load} onChange={(v) => onChange({ load: v })} options={opts1.loads.map((v) => [v, v])} disabled={!opts1.loads.length} />
        </label>
        <label className="block">
          <Label>Type</Label>
          <Sel value={line.type} onChange={(v) => onChange({ type: v })} options={opts2.types.map((v) => [v, v])} disabled={!opts2.types.length} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="block">
          <Label>Voltage</Label>
          <Sel value={line.voltage} onChange={(v) => onChange({ voltage: v })} options={opts3.voltages.map((v) => [v, v])} disabled={!opts3.voltages.length} />
        </label>
        <label className="block">
          <Label>Size</Label>
          <Sel value={line.size} onChange={(v) => onChange({ size: v })} options={opts4.sizes.map((v) => [v, v])} disabled={!opts4.sizes.length} />
        </label>
      </div>

      <label className="block mb-2">
        <Label>{qtyLabel}</Label>
        <Num value={line.qty} onChange={(v) => onChange({ qty: v })} min="0" step="1" />
      </label>

      <div className="flex items-center justify-between mt-2" style={{ fontSize: 11.5, color: C.mut }}>
        <span>{trefoil ? "Trefoil layout (2×OD)" : "Single-file (1×OD)"}{isPowerTray(line.load) && " · edge clearance = own OD"}</span>
        <span style={{ ...mono }}>
          {cable ? `OD ${cable.OD.toFixed(3)} in · ${qty} × ${unitWidthIn.toFixed(2)} in = ${(qty * unitWidthIn).toFixed(2)} in (before spacing)` : "no data for this selection"}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------- breakdown table --------------------------- */

function ruleLabel(curr, next, opts) {
  if (!next) return "—";
  const gap = spacingBetween(curr, next, opts);
  if (isPowerTray(curr.load) || isPowerTray(next.load)) return `Power-Tray forced 1×OD (${gap.toFixed(2)} in)`;
  const currT = usesTrefoilLayout(curr.type, curr.load);
  const nextT = usesTrefoilLayout(next.type, next.load);
  if (currT && nextT) return gap > 0 ? `Trefoil spacing ${ADJACENT_SPACING_MULT}×OD (${gap.toFixed(2)} in)` : "Trefoil contiguous (0 in)";
  if (!currT && !nextT) return gap > 0 ? `1×OD (${gap.toFixed(2)} in)` : "Bundled/contiguous (0 in)";
  return `Mixed trefoil/multiple, ${ADJACENT_SPACING_MULT}×OD (${gap.toFixed(2)} in)`;
}

function BreakdownTable({ placements, opts }) {
  if (!placements.length) return <div style={{ fontSize: 12.5, color: C.faint }}>No cables yet.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: C.faint, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".5px" }}>
            <th style={{ padding: "4px 6px" }}>Cable</th>
            <th style={{ padding: "4px 6px" }}>OD (in)</th>
            <th style={{ padding: "4px 6px", textAlign: "right" }}>Width (in)</th>
            <th style={{ padding: "4px 6px" }}>Spacing to next</th>
          </tr>
        </thead>
        <tbody>
          {placements.map((p, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <td style={{ padding: "6px 6px" }}>
                {p.item.tag || `${p.item.size} — ${p.item.load} ${p.item.type} ${p.item.voltage}`}
                {p.trefoil && <span style={{ color: C.faint }}> (trefoil)</span>}
              </td>
              <td style={{ padding: "6px 6px", ...mono }}>{p.item.od.toFixed(3)}</td>
              <td style={{ padding: "6px 6px", textAlign: "right", ...mono, fontWeight: 600 }}>{p.widthIn.toFixed(2)}</td>
              <td style={{ padding: "6px 6px", color: C.mut }}>{ruleLabel(p.item, placements[i + 1]?.item, opts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------- legend ----------------------------------- */

function Legend() {
  const items = [
    [C.accent, "Power"],
    [C.warn, "VFD"],
    [C.plateEdge, "Power-Tray"],
    [C.lineSoft, "Reserved spare capacity"],
  ];
  return (
    <div className="flex flex-wrap gap-4 mt-3" style={{ fontSize: 11.5, color: C.mut }}>
      {items.map(([color, lbl]) => (
        <span key={lbl} className="flex items-center gap-1.5">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
          {lbl}
        </span>
      ))}
    </div>
  );
}

/* ---------------------------- cross-section drawing -------------------------- */

// Hard cap on individually-drawn items, purely to protect the browser from
// a pathological quantity (e.g. a typo like 5000) — any realistic tray
// design (a few to a few dozen items) is always drawn in full, one shape
// per trefoil group / cable, never collapsed.
const MAX_DRAWN_ITEMS = 200;

function TrayCrossSection({ layout, trayWidthIn, reservePct }) {
  if (!(trayWidthIn > 0)) return null;
  const { totalIn, maxDepthIn, placements } = layout;

  // The drawing domain covers whichever is larger — the tray itself, or the
  // cables' actual required width — so an over-fill tray still renders
  // fully on-canvas (as an "overflow" zone past the tray edge) instead of
  // drawing off the visible viewBox.
  const domainIn = Math.max(trayWidthIn, totalIn, 0.01);
  const VB_W = 960;
  const pxPerIn = VB_W / domainIn;
  const trayPxW = trayWidthIn * pxPerIn;
  const topY = 26;
  const depthPx = Math.min(220, Math.max(110, maxDepthIn * pxPerIn * 0.95 || 130));
  const railT = 6;
  const floorY = topY + depthPx;
  const VB_H = floorY + 30;

  const reserveStartPx = Math.max(0, trayWidthIn - trayWidthIn * (reservePct / 100)) * pxPerIn;
  const overflowPxW = Math.max(0, totalIn - trayWidthIn) * pxPerIn;
  const drawn = placements.slice(0, MAX_DRAWN_ITEMS);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <pattern id="hatchReserve" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={C.faint} strokeWidth="2" opacity="0.5" />
        </pattern>
        <pattern id="hatchOverflow" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={C.err} strokeWidth="2" opacity="0.45" />
        </pattern>
      </defs>

      {/* tray body (only as wide as the actual tray — not the full canvas) */}
      <rect x="0" y={topY} width={trayPxW} height={depthPx} fill={C.panel} stroke={C.line} strokeWidth="1.5" rx="2" />
      {/* rails */}
      <rect x="0" y={topY} width={trayPxW} height={railT} fill={C.lineSoft} />
      <rect x="0" y={floorY - railT} width={trayPxW} height={railT} fill={C.lineSoft} />
      {/* rungs */}
      {Array.from({ length: Math.max(2, Math.round(trayWidthIn / 4)) }).map((_, i, arr) => {
        const x = ((i + 0.5) / arr.length) * trayPxW;
        return <line key={i} x1={x} y1={topY + railT} x2={x} y2={floorY - railT} stroke={C.lineSoft} strokeWidth="3" />;
      })}

      {/* reserve zone, within the tray */}
      {reservePct > 0 && (
        <>
          <rect x={reserveStartPx} y={topY} width={Math.max(0, trayPxW - reserveStartPx)} height={depthPx} fill="url(#hatchReserve)" opacity="0.9" />
          <line x1={reserveStartPx} y1={topY} x2={reserveStartPx} y2={floorY} stroke={C.mut} strokeDasharray="4 3" strokeWidth="1.5" />
        </>
      )}

      {/* overflow zone, beyond the tray edge */}
      {overflowPxW > 0 && (
        <>
          <rect x={trayPxW} y={topY} width={overflowPxW} height={depthPx} fill="url(#hatchOverflow)" stroke={C.err} strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={trayPxW + overflowPxW / 2} y={topY - 8} fontSize="11" fontWeight="700" fill={C.err} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
            beyond tray edge
          </text>
        </>
      )}

      {/* cable/trefoil-group shapes — drawn to true relative scale, ports of
          the reference tool's DrawTrifoilCable / DrawMulticonductorCable */}
      {drawn.map((p, i) => (
        <PlacementShape key={i} p={p} xPx={p.xIn * pxPerIn} floorY={floorY} pxPerIn={pxPerIn} />
      ))}
      {placements.length > drawn.length && (
        <text x={trayPxW - 6} y={topY + 14} fontSize="11" fill={C.mut} textAnchor="end" fontFamily="IBM Plex Mono, monospace">
          +{placements.length - drawn.length} more not drawn
        </text>
      )}

      {/* width axis */}
      <line x1="0" y1={floorY + 16} x2={Math.max(trayPxW, trayPxW + overflowPxW)} y2={floorY + 16} stroke={C.lineSoft} strokeWidth="1" />
      <text x="2" y={floorY + 14} fontSize="11" fill={C.faint} fontFamily="IBM Plex Mono, monospace">0 in</text>
      <text x={trayPxW - 2} y={floorY + 14} fontSize="11" fill={C.faint} fontFamily="IBM Plex Mono, monospace" textAnchor="end">{trayWidthIn} in (tray edge)</text>
    </svg>
  );
}

// Outline is a translucent dark line (not white — the tray floor/background
// is itself near-white, so a white stroke used to vanish exactly where it
// mattered most) so cable edges stay visible both against the tray and
// against a neighbouring cable of the same colour.
const STROKE = "rgba(15,20,28,0.45)";
const SQRT3 = Math.sqrt(3);

function PlacementShape({ p, xPx, floorY, pxPerIn }) {
  const color = LOAD_COLOR[p.item.load] || C.accent;
  const r = Math.max(2.2, (p.item.od * pxPerIn) / 2);
  const sw = Math.max(0.6, r * 0.08);

  if (p.trefoil) {
    // Direct port of DrawTrifoilCable: bottom pair centers 2×r apart
    // (tangent to each other, resting on the floor), top circle center
    // offset (r, r·√3) from the bottom-left circle (tangent to both).
    const yBot = floorY - 2 - r;
    const yTop = yBot - r * SQRT3;
    const cxLeft = xPx + r;
    return (
      <g>
        <circle cx={cxLeft} cy={yBot} r={r} fill={color} stroke={STROKE} strokeWidth={sw} />
        <circle cx={cxLeft + 2 * r} cy={yBot} r={r} fill={color} stroke={STROKE} strokeWidth={sw} />
        <circle cx={cxLeft + r} cy={yTop} r={r} fill={color} stroke={STROKE} strokeWidth={sw} />
      </g>
    );
  }

  // Direct port of DrawMulticonductorCable: one circle, bottom wall resting on the tray floor.
  return <circle cx={xPx + r} cy={floorY - 2 - r} r={r} fill={color} stroke={STROKE} strokeWidth={sw} />;
}

