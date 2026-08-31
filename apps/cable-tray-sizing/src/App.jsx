import React, { useEffect, useMemo, useState } from "react";

import {
  sizeLabel, CATEGORIES,
  isSingleConductorCategory, isVfdCategory, isMvCategory,
  arrangementOptions, availableSizes, qtyLabel, computeLine, computeTray,
  suggestWidth, suggestDepth, suggestArrangement, loadCableOdDb,
  STANDARD_WIDTHS_IN, STANDARD_DEPTHS_IN,
  TREFOIL_BUNDLE_MULT, TREFOIL_GROUP_GAP_MULT, AREA1_PER_IN, AREA2_PER_IN,
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

// Category -> accent colour, reusing existing palette tokens only (no new
// hues introduced) so the tool matches the rest of the hub.
const CAT_COLOR = {
  "lv-single": C.accent, "lv-multi": C.accent,
  "mv-single": C.plateEdge, "mv-multi": C.plateEdge,
  "vfd-single": C.warn, "vfd-multi": C.warn,
};

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

// Stacked (one option per row) picker for long descriptive labels — the
// horizontal SegBtns wraps mid-word once labels get longer than a couple of
// words, which is unreadable in a narrow column.
function VertPicker({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map(([v, l]) => {
        const on = String(value) === String(v);
        return (
          <button key={v} type="button" onClick={() => onChange(v)} style={{
            ...mono, textAlign: "left", padding: "9px 11px", borderRadius: 4,
            border: `1px solid ${on ? C.accent : C.line}`,
            background: on ? C.accent : C.field, color: on ? "#fff" : C.mut,
            fontWeight: on ? 600 : 400, fontSize: 12.5, lineHeight: 1.4, cursor: "pointer",
          }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------- cable line defaults --------------------------- */

let nextIdCounter = 1;
const nextId = () => `c${nextIdCounter++}`;

function newLine(overrides = {}) {
  return {
    id: nextId(), label: "", category: "lv-single", size: "4/0",
    conductors: 3, odIn: "", odManual: false, qty: 3, arrangement: "touching",
    ...overrides,
  };
}

function exampleLines() {
  nextIdCounter = 1;
  return [
    newLine({ label: "Feeder A (motor 1)", category: "lv-single", size: "250", qty: 3, arrangement: "trefoil" }),
    newLine({ label: "Feeder B (motor 2)", category: "lv-single", size: "4/0", qty: 3, arrangement: "touching" }),
    newLine({ label: "Branch circuits", category: "lv-multi", size: "8", conductors: 4, odIn: "0.62", odManual: true, qty: 6, arrangement: "auto" }),
    newLine({ label: "VFD output — Pump 3", category: "vfd-single", size: "2/0", qty: 3, arrangement: "trefoil" }),
  ];
}

/* ---------------------------------- app ----------------------------------- */

export default function App() {
  const [odDb, setOdDb] = useState({ lv: {}, mv: {} });
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    loadCableOdDb(import.meta.url)
      .then(setOdDb)
      .catch((e) => setDbError(e.message || "Could not load the cable OD database — enter outer diameters manually."));
  }, []);

  const [lines, setLines] = useState(() => exampleLines());
  const [autoWidth, setAutoWidth] = useState(true);
  const [trayWidth, setTrayWidth] = useState(18);
  const [trayDepth, setTrayDepth] = useState(4);
  const [reservePct, setReservePct] = useState(20);
  const [vfdSeparationIn, setVfdSeparationIn] = useState(12);
  const [lastOptimized, setLastOptimized] = useState([]);

  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.id !== id));
  const addLine = () => setLines((prev) => [...prev, newLine()]);

  // Resolve the outer diameter each line actually uses: auto-looked-up from
  // the cable OD database for single-conductor cables (unless the user
  // overrides it), always manual for multiconductor / VFD-multi cables.
  const resolvedLines = useMemo(() => lines.map((l) => {
    let odIn = parseFloat(l.odIn) || 0;
    let auto = null;
    if (isSingleConductorCategory(l.category) && !l.odManual) {
      const db = isMvCategory(l.category) ? odDb.mv : odDb.lv;
      auto = db[l.size] ?? null;
      odIn = auto || 0;
    }
    return { ...l, odIn, odAuto: auto, qty: Math.max(0, Math.floor(Number(l.qty) || 0)) };
  }), [lines, odDb]);

  const reserveFrac = Math.min(Math.max(reservePct, 0), 90) / 100;

  const rawTotalWidthIn = useMemo(
    () => resolvedLines.reduce((s, l) => s + computeLine(l).widthIn, 0),
    [resolvedLines]
  );
  const suggestedWidth = useMemo(() => suggestWidth(rawTotalWidthIn, reserveFrac), [rawTotalWidthIn, reserveFrac]);
  const effTrayWidth = autoWidth ? (suggestedWidth ?? STANDARD_WIDTHS_IN[STANDARD_WIDTHS_IN.length - 1]) : trayWidth;

  const tray = useMemo(() => computeTray(resolvedLines, effTrayWidth, reserveFrac), [resolvedLines, effTrayWidth, reserveFrac]);
  const suggestedDepth = useMemo(() => suggestDepth(tray.maxDepthNeededIn), [tray.maxDepthNeededIn]);

  const hasAnyCable = tray.rows.some((r) => r.calc.widthIn > 0);
  const overflowsCatalog = autoWidth && suggestedWidth == null;

  function handleOptimize() {
    const result = suggestArrangement(resolvedLines, tray.usableWidthIn);
    setLines((prev) => prev.map((l) => {
      const w = result.lines.find((x) => x.id === l.id);
      return result.changedIds.includes(l.id) ? { ...l, qty: w.qty, arrangement: w.arrangement } : l;
    }));
    setLastOptimized(result.changedIds);
  }

  function loadExample() {
    setLines(exampleLines());
    setAutoWidth(true);
    setReservePct(20);
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
              Smallest standard tray width that physically fits a given set of power / VFD cables
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ ...mono, fontSize: 11, color: C.faint, textAlign: "right", lineHeight: 1.5 }}>
              NEC 2023 · 392.22(A)/(B)<br />Art. 315 · drive mfr. EMI guidance
            </div>
            <a href="../../index.html" style={{ ...mono, fontSize: 12, color: C.accent, textDecoration: "none", border: `1px solid ${C.line}`, background: C.panel, borderRadius: 4, padding: "6px 12px", whiteSpace: "nowrap" }}>
              ← Hub
            </a>
          </div>
        </header>

        <div className="tool-grid" style={{ display: "grid", gridTemplateColumns: "minmax(400px, 30%) 1fr", gap: 24, alignItems: "start" }}>

          {/* ------------------------------ INPUTS ----------------------------- */}
          <div style={{ minWidth: 0 }}>
            <Section tag="Catalog widths / depths" title="1 · Cable tray">
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
                  {overflowsCatalog
                    ? <>Required fill exceeds the largest standard tray (48 in) — split the cables across more than one tray or a wider custom section.</>
                    : <>Smallest standard width that fits: <b style={{ ...mono }}>{suggestedWidth} in</b></>}
                </div>
              )}
              <Field label="Tray depth (in)">
                <Sel value={String(trayDepth)} onChange={(v) => setTrayDepth(Number(v))} options={STANDARD_DEPTHS_IN.map((d) => [String(d), `${d} in`])} />
              </Field>
              {tray.maxDepthNeededIn > trayDepth && (
                <div style={{ fontSize: 12, color: "#9a6b00", background: C.warnWash, borderLeft: `3px solid ${C.warn}`, borderRadius: "0 4px 4px 0", padding: "6px 9px", marginTop: -6, marginBottom: 12 }}>
                  Largest cable/bundle needs ≥ {fmt(tray.maxDepthNeededIn)} in of depth — suggested depth: {suggestedDepth} in.
                </div>
              )}
              <Field label={`Spare capacity reserve (${reservePct}%)`}>
                <input type="range" min="0" max="50" step="1" value={reservePct} onChange={(e) => setReservePct(Number(e.target.value))} style={{ width: "100%", accentColor: C.accent }} />
              </Field>
              <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
                Reserved width is subtracted from the tray before checking fill, so future cables can be added without re-sizing the tray.
              </div>
            </Section>

            <Section tag="drive mfr. EMI guidance" title="2 · VFD cable separation">
              <Field label="Recommended min. separation from other cables (in)">
                <Num value={vfdSeparationIn} onChange={(v) => setVfdSeparationIn(Number(v) || 0)} min="0" step="1" />
              </Field>
              <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>
                NEC does not set a universal numeric separation for VFD (drive output) cables. 12 in (300 mm) is common adjustable-speed-drive
                manufacturer guidance to limit high-frequency noise coupling into adjacent circuits — verify with the drive's installation manual.
                Where separation can't be maintained, use a grounded metallic divider strip or a dedicated tray.
              </div>
            </Section>

            <Section tag={`${lines.length} line(s)`} title="3 · Cables in this tray">
              {dbError && (
                <div style={{ fontSize: 12, color: C.err, marginBottom: 10 }}>{dbError}</div>
              )}
              {lines.map((l) => (
                <CableLineEditor key={l.id} line={l} resolved={resolvedLines.find((r) => r.id === l.id)} odDb={odDb}
                  onChange={(patch) => updateLine(l.id, patch)} onRemove={() => removeLine(l.id)}
                  highlighted={lastOptimized.includes(l.id)} />
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
                  <div style={{ ...mono, fontSize: 30, fontWeight: 600, lineHeight: 1.15, marginTop: 4, color: hasAnyCable ? (tray.fits ? "#7fd6a3" : "#ff8f87") : C.plateMut }}>
                    {overflowsCatalog ? "> 48 in" : `${effTrayWidth} × ${trayDepth} in`}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4, color: C.plateMut }}>
                    {hasAnyCable
                      ? (tray.fits ? "Cables fit within the usable width." : "Cables do NOT fit — widen the tray, add a divider, or optimize arrangement.")
                      : "Add cables to size the tray."}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: C.plateMut, textTransform: "uppercase" }}>Fill</div>
                  <div style={{ ...mono, fontSize: 26, fontWeight: 600, marginTop: 4 }}>{fmt(tray.fillPct, 1)} %</div>
                  <div style={{ fontSize: 11.5, marginTop: 4, color: C.plateMut }}>of {effTrayWidth} in ({reservePct}% reserved)</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {[
                  ["Required width", `${fmt(tray.totalWidthIn)} in`],
                  ["Usable width", `${fmt(tray.usableWidthIn)} in`],
                  ["Depth needed", `${fmt(tray.maxDepthNeededIn)} in`],
                  ["Status", tray.fits ? "FITS" : "OVER"],
                ].map(([lbl, v]) => (
                  <div key={lbl} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10.5, color: C.plateMut, textTransform: "uppercase", letterSpacing: ".5px" }}>{lbl}</div>
                    <div style={{ ...mono, fontSize: 15, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>

              {!tray.fits && hasAnyCable && (
                <button type="button" onClick={handleOptimize} style={{
                  ...mono, marginTop: 14, padding: "9px 14px", borderRadius: 4, border: `1px solid ${C.warn}`,
                  background: C.warn, color: "#241a00", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                  Suggest arrangement to fit (auto trefoil-group eligible cables)
                </button>
              )}
            </div>

            {tray.mixesVfdWithOthers && (
              <div style={{ fontSize: 12.5, color: "#9a6b00", background: C.warnWash, border: `1px solid ${C.warn}`, borderRadius: 4, padding: "10px 12px", marginBottom: 16, lineHeight: 1.5 }}>
                This tray mixes VFD (drive output) cables with other circuits. Maintain ≥ {vfdSeparationIn} in separation, use a grounded metallic
                divider strip between groups, or route VFD cables in a dedicated tray to limit noise coupling.
              </div>
            )}

            <Section tag="to scale within this tray" title="Cross-section fill diagram">
              <TrayCrossSection tray={tray} reservePct={reservePct} />
              <Legend />
            </Section>

            <Section tag="392.22(A)/(B) — per line" title="Breakdown">
              <BreakdownTable rows={tray.rows} />
              <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.6, marginTop: 10 }}>
                Single-conductor cables and multiconductor cables 4/0 AWG or larger are sized single layer — sum of diameters (plus arrangement
                spacing) ≤ tray width [392.22(A)(1)(a) / (B)]. Smaller multiconductor cables use the area-fill rule against Table 392.22(A) —
                Column 1 (1/0–3/0 AWG, {AREA1_PER_IN.toFixed(3)} in²/in of width) or Column 2 (smaller than 1/0 AWG, {AREA2_PER_IN.toFixed(3)} in²/in) —
                approximated here as a linear formula for standard widths ≥ 6 in and NOT independently verified against an official NEC scan; verify
                against the code edition adopted in your jurisdiction. Trefoil bundle OD ≈ {TREFOIL_BUNDLE_MULT.toFixed(3)}×OD, groups spaced
                ≥ {TREFOIL_GROUP_GAP_MULT}×OD apart.
              </div>
            </Section>

            <div style={{ ...mono, fontSize: 11, color: C.faint, textAlign: "center", marginTop: 6, lineHeight: 1.6 }}>
              Support tool only — final tray selection must be verified by the responsible engineer.<br />
              Table data transcribed/approximated for engineering study purposes; verify against the code edition adopted in your jurisdiction.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- cable line editor --------------------------- */

function CableLineEditor({ line, resolved, odDb, onChange, onRemove, highlighted }) {
  const single = isSingleConductorCategory(line.category);
  const vfd = isVfdCategory(line.category);
  const calc = resolved ? computeLine(resolved) : { widthIn: 0, depthIn: 0 };
  const arrOpts = arrangementOptions(line.category);
  const qLabel = qtyLabel(line.category, line.arrangement);
  const sizes = useMemo(() => availableSizes(line.category, odDb), [line.category, odDb]);

  // Keep the selected size valid whenever the category changes or the OD
  // database finishes loading (it starts empty, so the size list widens
  // once real data arrives — correct a now-invalid selection automatically
  // instead of silently resolving to a blank OD).
  useEffect(() => {
    if (single && sizes.length && !sizes.includes(line.size)) onChange({ size: sizes[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single, sizes, line.size]);

  return (
    <div style={{
      border: `1px solid ${highlighted ? C.warn : C.lineSoft}`, borderRadius: 5, padding: 14, marginBottom: 12,
      background: highlighted ? C.warnWash : C.field,
    }}>
      <div className="flex items-center gap-2 mb-2">
        <input value={line.label} placeholder="Label (optional)" onChange={(e) => onChange({ label: e.target.value })}
          style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: "6px 8px" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLOR[line.category], flex: "0 0 auto" }} />
        <button type="button" onClick={onRemove} title="Remove" style={{
          ...mono, border: `1px solid ${C.line}`, background: C.panel, color: C.err, borderRadius: 4,
          width: 26, height: 26, cursor: "pointer", fontSize: 14, lineHeight: 1,
        }}>×</button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <Sel value={line.category} onChange={(v) => {
          const nowSingle = isSingleConductorCategory(v);
          const patch = { category: v, arrangement: nowSingle ? "touching" : "auto" };
          if (nowSingle) {
            const newSizes = availableSizes(v, odDb);
            if (newSizes.length && !newSizes.includes(line.size)) patch.size = newSizes[0];
          }
          onChange(patch);
        }} options={CATEGORIES} />
        <Sel value={sizes.includes(line.size) ? line.size : (sizes[0] ?? line.size)} onChange={(v) => onChange({ size: v })} options={sizes.map((s) => [s, sizeLabel(s)])} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="block">
          <Label>{qLabel}</Label>
          <Num value={line.qty} onChange={(v) => onChange({ qty: v })} min="0" step="1" />
        </label>
        {!single && (
          <label className="block">
            <Label>Conductors</Label>
            <Sel value={String(line.conductors)} onChange={(v) => onChange({ conductors: Number(v) })} options={[["3", "3C"], ["4", "4C"]]} />
          </label>
        )}
        {single && (
          <label className="block">
            <Label>Outer diameter (in)</Label>
            <Num value={resolved?.odAuto && !line.odManual ? resolved.odIn : line.odIn}
              onChange={(v) => onChange({ odIn: v, odManual: true })}
              min="0" step="0.001" placeholder={resolved?.odAuto ? undefined : "enter OD"} />
          </label>
        )}
      </div>

      {!single && (
        <label className="block mb-2">
          <Label>Outer diameter (in) — manufacturer datasheet</Label>
          <Num value={line.odIn} onChange={(v) => onChange({ odIn: v, odManual: true })} min="0" step="0.001" placeholder="enter cable OD" />
        </label>
      )}

      {single && resolved?.odAuto && !line.odManual && (
        <div style={{ fontSize: 10.5, color: C.faint, margin: "-4px 0 8px" }}>from cable OD database (elec.db / apps/neher/data/cables.json) — edit to override</div>
      )}

      <label className="block mb-1">
        <Label>Arrangement</Label>
        <VertPicker value={line.arrangement} onChange={(v) => onChange({ arrangement: v })} options={arrOpts} />
      </label>

      <div className="flex items-center justify-between mt-2" style={{ fontSize: 11.5, color: C.mut }}>
        <span>{vfd ? "VFD — separate from other circuits" : isMvCategory(line.category) ? "MV cable" : "LV cable"}</span>
        <span style={{ ...mono }}>{calc.widthIn > 0 ? `${calc.widthIn.toFixed(2)} in of width` : "—"}</span>
      </div>
    </div>
  );
}

/* -------------------------------- breakdown table --------------------------- */

function BreakdownTable({ rows }) {
  const active = rows.filter((r) => r.calc.widthIn > 0);
  if (!active.length) return <div style={{ fontSize: 12.5, color: C.faint }}>No cables yet.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: "left", color: C.faint, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".5px" }}>
            <th style={{ padding: "4px 6px" }}>Cable</th>
            <th style={{ padding: "4px 6px" }}>Qty</th>
            <th style={{ padding: "4px 6px" }}>OD (in)</th>
            <th style={{ padding: "4px 6px" }}>Rule</th>
            <th style={{ padding: "4px 6px", textAlign: "right" }}>Width (in)</th>
          </tr>
        </thead>
        <tbody>
          {active.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <td style={{ padding: "6px 6px" }}>
                {r.label || `${sizeLabel(r.size)} — ${CATEGORIES.find(([v]) => v === r.category)?.[1]}`}
              </td>
              <td style={{ padding: "6px 6px", ...mono }}>{r.qty}</td>
              <td style={{ padding: "6px 6px", ...mono }}>{r.odIn ? r.odIn.toFixed(3) : "—"}</td>
              <td style={{ padding: "6px 6px", color: C.mut }}>
                {r.arrangement === "trefoil" ? "Trefoil group" : r.calc.cls === "large" ? "Single layer (Σ diameters)"
                  : r.calc.cls === "col1" ? "Area fill — Col. 1" : r.calc.cls === "col2" ? "Area fill — Col. 2"
                  : r.arrangement === "spaced1" ? "Single layer, spaced ≥1×OD" : "Touching, single layer"}
              </td>
              <td style={{ padding: "6px 6px", textAlign: "right", ...mono, fontWeight: 600 }}>{r.calc.widthIn.toFixed(2)}</td>
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
    [C.accent, "LV power"],
    [C.plateEdge, "MV power"],
    [C.warn, "VFD (drive output)"],
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

// Hard cap on individually-drawn items per line, purely to protect the
// browser from a pathological quantity (e.g. a typo like 5000) — any
// realistic tray design (a few to a few dozen cables/groups per line) is
// always drawn in full, one shape per cable/group, never collapsed.
const MAX_DRAWN_ITEMS = 150;

function TrayCrossSection({ tray, reservePct }) {
  const { trayWidthIn, rows, totalWidthIn } = tray;
  if (!(trayWidthIn > 0)) return null;

  // The drawing domain covers whichever is larger — the tray itself, or the
  // cables' actual required width — so an over-fill tray still renders
  // fully on-canvas (as an "overflow" zone past the tray edge) instead of
  // drawing off the visible viewBox.
  const domainIn = Math.max(trayWidthIn, totalWidthIn, 0.01);
  const VB_W = 960;
  const pxPerIn = VB_W / domainIn;
  const trayPxW = trayWidthIn * pxPerIn;
  const topY = 26;
  const depthPx = Math.min(220, Math.max(110, tray.maxDepthNeededIn * pxPerIn * 0.95 || 130));
  const railT = 6;
  const floorY = topY + depthPx;
  const VB_H = floorY + 30;

  let cursorIn = 0;
  const blocks = rows.filter((r) => r.calc.widthIn > 0).map((r) => {
    const xIn = cursorIn;
    cursorIn += r.calc.widthIn;
    return { r, xPx: xIn * pxPerIn, wPx: r.calc.widthIn * pxPerIn };
  });
  const reserveStartPx = Math.max(0, trayWidthIn - trayWidthIn * (reservePct / 100)) * pxPerIn;
  const overflowPxW = Math.max(0, cursorIn - trayWidthIn) * pxPerIn;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(0,0,0,.28)" strokeWidth="2" />
        </pattern>
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

      {/* cable blocks — drawn to true relative scale */}
      {blocks.map(({ r, xPx, wPx }) => (
        <CableBlock key={r.id} r={r} x={xPx} w={wPx} floorY={floorY} topY={topY} depthPx={depthPx} pxPerIn={pxPerIn} />
      ))}

      {/* width axis */}
      <line x1="0" y1={floorY + 16} x2={Math.max(trayPxW, trayPxW + overflowPxW)} y2={floorY + 16} stroke={C.lineSoft} strokeWidth="1" />
      <text x="2" y={floorY + 14} fontSize="11" fill={C.faint} fontFamily="IBM Plex Mono, monospace">0 in</text>
      <text x={trayPxW - 2} y={floorY + 14} fontSize="11" fill={C.faint} fontFamily="IBM Plex Mono, monospace" textAnchor="end">{trayWidthIn} in (tray edge)</text>
    </svg>
  );
}

function CableBlock({ r, x, w, floorY, topY, depthPx, pxPerIn }) {
  const color = CAT_COLOR[r.category] || C.accent;
  const isAreaFill = r.calc.cls === "col1" || r.calc.cls === "col2";
  const simpleLabel = `${r.qty}× ${sizeLabel(r.size)}`;

  // Area-fill (randomly stacked) multiconductor cables genuinely aren't a
  // knowable discrete layout — drawn as one hatched block spanning their
  // equivalent width, sized against Table 392.22(A).
  if (isAreaFill) {
    return (
      <g>
        <rect x={x} y={topY + 3} width={Math.max(w, 1)} height={depthPx - 6} fill={color} opacity="0.16" />
        <rect x={x} y={topY + 3} width={Math.max(w, 1)} height={depthPx - 6} fill="url(#hatch)" opacity="0.5" />
        <rect x={x} y={topY + 3} width={Math.max(w, 1)} height={depthPx - 6} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray="3 2" />
        {w > 60 && (
          <text x={x + w / 2} y={topY + depthPx / 2} fontSize="11" fill={C.text} textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
            {simpleLabel} (area fill)
          </text>
        )}
      </g>
    );
  }

  // Everything else is a real, single-layer, physically discrete item —
  // always drawn one shape per cable/trefoil group, never collapsed into a
  // plain block, regardless of quantity (capped only against pathological
  // input counts, see MAX_DRAWN_ITEMS). Outline is a translucent dark line
  // (not white — the tray floor/background is itself near-white, so a white
  // stroke used to vanish exactly where it mattered most) so cable edges
  // stay visible both against the tray and against a neighbouring cable of
  // the same colour.
  const strokeColor = "rgba(15,20,28,0.45)";

  if (r.arrangement === "trefoil") {
    const od = r.odIn || 0;
    const bundleOD = od * TREFOIL_BUNDLE_MULT;
    const bundleW = bundleOD * pxPerIn;
    const gapW = od * TREFOIL_GROUP_GAP_MULT * pxPerIn;
    const groups = r.calc.groups || r.qty;
    const drawn = Math.min(groups, MAX_DRAWN_ITEMS);
    const cR = Math.max(2.2, (od * pxPerIn) / 2);
    const sw = Math.max(0.6, cR * 0.08);
    // Three mutually TANGENT (touching, never overlapping) equal circles:
    // centers of the bottom pair are exactly 2×cR apart (tangent to each
    // other, resting on the tray floor), and the top circle's center sits
    // cR×√3 above the line joining them (tangent to both) — real-world
    // trefoil cables stack like tangent circles/oranges, not overlapping
    // disks floating above the floor.
    const SQRT3 = Math.sqrt(3);
    return (
      <g>
        {Array.from({ length: drawn }).map((_, gi) => {
          const gx = x + gi * (bundleW + gapW);
          const ccx = gx + bundleW / 2;
          const yBot = floorY - 2 - cR;
          const yTop = yBot - cR * SQRT3;
          return (
            <g key={gi}>
              <circle cx={ccx - cR} cy={yBot} r={cR} fill={color} stroke={strokeColor} strokeWidth={sw} />
              <circle cx={ccx + cR} cy={yBot} r={cR} fill={color} stroke={strokeColor} strokeWidth={sw} />
              <circle cx={ccx} cy={yTop} r={cR} fill={color} stroke={strokeColor} strokeWidth={sw} />
            </g>
          );
        })}
        {groups > drawn && (
          <text x={x + drawn * (bundleW + gapW) + 4} y={floorY - cR} fontSize="11" fill={C.mut} fontFamily="IBM Plex Mono, monospace">
            +{groups - drawn} more
          </text>
        )}
      </g>
    );
  }

  // Touching / spaced single-conductor cables (round), or 4/0-and-larger /
  // forced-single-layer multiconductor cables (jacketed — drawn as a
  // rounded rectangle rather than a bare-conductor circle). All rest on the
  // tray floor, same as the trefoil bundles above.
  const od = r.odIn || 0;
  const odPx = od * pxPerIn;
  const step = r.arrangement === "spaced1" ? odPx * 2 : odPx;
  const isJacketedMulti = r.calc.cls === "large";
  const drawn = Math.min(r.qty, MAX_DRAWN_ITEMS);
  return (
    <g>
      {Array.from({ length: drawn }).map((_, i) => {
        const ix = x + i * step;
        const cx = ix + odPx / 2;
        const cy = floorY - odPx / 2 - 2;
        return isJacketedMulti ? (
          <rect key={i} x={ix} y={floorY - odPx - 2} width={Math.max(odPx, 3)} height={odPx} rx={Math.min(4, odPx * 0.18)} fill={color} stroke={strokeColor} strokeWidth={Math.max(0.6, odPx * 0.06)} />
        ) : (
          <circle key={i} cx={cx} cy={cy} r={Math.max(2.2, odPx / 2)} fill={color} stroke={strokeColor} strokeWidth={Math.max(0.6, odPx * 0.06)} />
        );
      })}
      {r.qty > drawn && (
        <text x={x + drawn * step + 4} y={floorY - odPx / 2} fontSize="11" fill={C.mut} fontFamily="IBM Plex Mono, monospace">
          +{r.qty - drawn} more
        </text>
      )}
    </g>
  );
}
