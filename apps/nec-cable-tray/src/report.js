/* ============================================================================
   STEP-BY-STEP CALCULATION REPORT — NEC CABLE TRAY AMPACITY & SIZING
   ----------------------------------------------------------------------------
   Builds a self-contained HTML document (no external assets) that walks through
   HOW the conductor was sized: every NEC article invoked, the rule text applied,
   the numeric substitution, and the engineering considerations/assumptions made
   at each step. Opened in a new tab; the reader prints it to PDF from there.
   ========================================================================== */

import { sizeLabel, Z_TABLE9, vdPercent } from "./engine.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const f = (x, d = 1) => (x == null || !isFinite(x) ? "—" : Number(x).toFixed(d));

const vClassLabel = (v) => (v === "lv" ? "≤ 2000 V (low voltage)" : v === "mv5" ? "2001–5000 V" : "5001–15,000 V");

const arrangementLabel = (a, construction) => {
  if (a === "trefoil215") return "Trefoil (triangular) groups, groups spaced ≥ 2.15 × cable OD";
  if (a === "spaced1") return "Single layer, maintained free-air spacing ≥ 1 × cable OD";
  return construction === "multi" ? "Touching / random fill (no maintained spacing)" : "Touching (contiguous single conductors)";
};

/* --------------------------- document scaffolding ------------------------- */

function step(n, title, ref, body) {
  return `
  <section class="step">
    <div class="step-head">
      <span class="step-n">Step ${n}</span>
      <h2>${esc(title)}</h2>
      <span class="step-ref">${esc(ref)}</span>
    </div>
    ${body}
  </section>`;
}

const rule = (html) => `<div class="rule"><span class="rule-tag">Code rule</span>${html}</div>`;
const applied = (html) => `<div class="applied"><span class="blk-tag">Applied to this circuit</span>${html}</div>`;
const considerations = (items) =>
  !items.length
    ? ""
    : `<div class="cons"><span class="blk-tag">Considerations &amp; assumptions</span><ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`;
const eqn = (html) => `<div class="eqn">${html}</div>`;
const kv = (rows) =>
  `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join("")}</table>`;

/* --------------------------------- steps ---------------------------------- */

function stepInputs(i, inp, load) {
  const rows = [];
  rows.push(["Load type", esc(
    { motor: "Motor", generator: "Generator", transformer: "Transformer feeder", heater: "Fixed electric heater", feeder: "Feeder", custom: "Other / direct current input" }[inp.loadType] || inp.loadType
  )]);
  rows.push(["System", `${inp.phases === 3 ? "Three-phase" : "Single-phase"}`]);
  if (inp.loadType === "motor")
    rows.push(inp.motorMode === "table"
      ? ["Motor rating", `${esc(inp.hp)} HP at ${esc(inp.motorV)} V (NEC FLC table)`]
      : ["Motor FLC entered", `${esc(inp.customA)} A (manual)`]);
  if (inp.loadType === "generator")
    rows.push(["Generator rating", `${esc(inp.rating)} ${esc(inp.ratingUnit)}${inp.ratingUnit === "kW" ? ` at PF ${esc(inp.pf)}` : ""} · ${esc(inp.voltage)} V`]);
  if (inp.loadType === "transformer") rows.push(["Transformer rating", `${esc(inp.rating)} kVA · ${esc(inp.voltage)} V`]);
  if (inp.loadType === "heater")
    rows.push(inp.heaterMode === "kw" ? ["Heater rating", `${esc(inp.rating)} kW · ${esc(inp.voltage)} V`] : ["Heater current", `${esc(inp.customA)} A`]);
  if (inp.loadType === "feeder") rows.push(["Feeder load", `${esc(inp.contA)} A continuous + ${esc(inp.nonContA)} A non-continuous`]);
  if (inp.loadType === "custom") rows.push(["Load current", `${esc(inp.customA)} A · ${inp.continuous ? "continuous" : "non-continuous"}`]);

  rows.push(["Voltage class", esc(vClassLabel(inp.vClass))]);
  rows.push(["Cable construction", inp.construction === "multi" ? (inp.vClass === "lv" ? "Multiconductor (Type TC)" : "Three-conductor MV cable") : "Single-conductor cables"]);
  rows.push(["Conductor material", "Copper (the only material implemented by this tool)"]);
  rows.push(["Insulation rating", `${esc(inp.insTemp)} °C`]);
  if (inp.vClass === "lv") rows.push(["Termination rating", `${esc(inp.termTemp)} °C${inp.applyTermLimit ? "" : " — 110.14(C) limit intentionally NOT applied"}`]);
  if (inp.vClass === "lv" && inp.construction === "multi") rows.push(["Current-carrying conductors", `${esc(inp.ccc)} per cable`]);
  rows.push(["Arrangement in tray", esc(arrangementLabel(inp.arrangement, inp.construction))]);
  rows.push(["Tray cover", inp.covered ? "Solid cover over more than 1.8 m (6 ft)" : "Uncovered"]);
  rows.push(["Ambient temperature", `${esc(inp.ambient)} °C`]);
  rows.push(["Ambient correction method", inp.vClass === "lv" ? (inp.ambMethod === "table" ? "NEC table bands" : "Exact equation") : "Exact equation [315.60(D)(4)]"]);
  rows.push(["Search limits", `up to ${esc(inp.maxSets)} parallel set(s) per phase, conductors up to ${esc(sizeLabel(inp.maxSize))}`]);
  if (inp.vdOn) rows.push(["Voltage-drop criterion", `≤ ${esc(inp.vdMax)} % over ${esc(inp.vdLength)} ${esc(inp.vdUnit)} (one way) at ${esc(inp.vdVolts)} V, PF ${esc(inp.vdPf)}`]);
  else rows.push(["Voltage-drop criterion", "not evaluated (disabled by the user)"]);
  if (inp.ocpd) rows.push(["Upstream OCPD", `${esc(inp.ocpd)} A`]);

  return step(i, "Design data taken as given", "inputs", `
    ${kv(rows)}
    ${considerations([
      "Every value above was supplied by the user; this report does not verify them against drawings, nameplates or the actual installation.",
      "The tray is assumed to be a ladder or ventilated-trough type. Solid-bottom trays are covered by separate provisions of 392.80 that this tool does not implement.",
      "Only copper conductors are considered. Aluminium ampacity tables are not implemented.",
    ])}`);
}

function stepLoad(i, inp, load) {
  const ref = load.basis.match(/\[(.*)\]/)?.[1] || "";
  const mult = load.fla > 0 ? load.design / load.fla : 0;
  const bits = [];

  if (inp.loadType === "motor" && inp.motorMode === "table") {
    bits.push(rule(`Conductors supplying a single motor must have an ampacity of at least <b>125 % of the motor full-load current</b> [430.22(A)]. The full-load current used for conductor sizing is the value from <b>Table 430.250</b> (three-phase) or <b>Table 430.248</b> (single-phase) — <b>not</b> the motor nameplate current [430.6(A)(1)].`));
  } else if (inp.loadType === "motor") {
    bits.push(rule(`Conductors supplying a single motor must be rated at least <b>125 % of the motor full-load current</b> [430.22(A)]. NEC 430.6(A)(1) requires the FLC value to come from Table 430.250/430.248; a manually entered current was used here.`));
  } else if (inp.loadType === "generator") {
    bits.push(rule(`Conductors from the generator terminals to the first overcurrent device must have an ampacity of at least <b>115 % of the nameplate current rating</b> of the generator [445.13(A)].`));
  } else if (inp.loadType === "transformer") {
    bits.push(rule(`The feeder is sized as a continuous load: <b>125 % of the transformer full-load current</b> [215.2(A)(1)], the transformer rated current being derived from its kVA rating and winding voltage.`));
  } else if (inp.loadType === "heater") {
    bits.push(rule(`Fixed electric space-heating equipment is considered a <b>continuous load</b>; branch-circuit conductors are sized at <b>125 %</b> of the total heating load [424.3(B)].`));
  } else if (inp.loadType === "feeder") {
    bits.push(rule(`Feeder conductors must have an ampacity of at least <b>125 % of the continuous load plus 100 % of the non-continuous load</b> [215.2(A)(1)].`));
  } else {
    bits.push(rule(`A continuous load (three hours or more) is sized at <b>125 %</b> of the load current [210.19(A)/215.2(A)(1)]; a non-continuous load at 100 %.`));
  }

  let sub = "";
  const V = esc(inp.voltage), R = esc(inp.rating);
  if (inp.loadType === "generator" || inp.loadType === "transformer" || (inp.loadType === "heater" && inp.heaterMode === "kw")) {
    const unit = inp.loadType === "heater" ? "kW" : inp.loadType === "transformer" ? "kVA" : inp.ratingUnit;
    const sym = unit === "kW" && inp.loadType === "heater" ? "P" : "S";
    // Back-computed from the engine result so the printed substitution can never drift from it.
    const kva = (load.fla * (inp.phases === 3 ? Math.sqrt(3) : 1) * (parseFloat(inp.voltage) || 0)) / 1000;
    const kvaLine = inp.loadType === "generator" && inp.ratingUnit === "kW"
      ? `S = P / PF = ${R} kW / ${esc(inp.pf)} = ${f(kva, 1)} kVA<br>`
      : "";
    sub = eqn(`${kvaLine}I<sub>FL</sub> = ${sym} × 1000 / (${inp.phases === 3 ? "√3 × " : ""}V) = ${f(kva, 1)} × 1000 / (${inp.phases === 3 ? "√3 × " : ""}${V}) = ${f(load.fla, 1)} A`);
  } else if (inp.loadType === "feeder") {
    sub = eqn(`I<sub>FL</sub> = ${esc(inp.contA)} A + ${esc(inp.nonContA)} A = ${f(load.fla, 1)} A`);
  } else {
    sub = eqn(`I<sub>FL</sub> = ${f(load.fla, 1)} A &nbsp;<span class="dim">(${esc(load.flaBasis)})</span>`);
  }

  const designEq = inp.loadType === "feeder"
    ? `I<sub>design</sub> = 1.25 × ${esc(inp.contA)} A + 1.00 × ${esc(inp.nonContA)} A = <b>${f(load.design, 1)} A</b>`
    : `I<sub>design</sub> = ${f(mult, 2)} × ${f(load.fla, 1)} A = <b>${f(load.design, 1)} A</b>`;

  const cons = [
    `The design current <b>${f(load.design, 1)} A</b> is the minimum <i>allowable ampacity</i> the conductors must show <i>after</i> all derating — it is not the current the cable actually carries.`,
    "Overcurrent protection, motor short-circuit and ground-fault protection, and starting/inrush behaviour are outside the scope of this calculation.",
  ];
  if (inp.loadType === "motor" && inp.motorMode === "manual")
    cons.push("A manually entered FLC was used. NEC 430.6(A)(1) requires conductor sizing to be based on the table FLC value; confirm the entry matches the table.");
  if (inp.loadType === "motor")
    cons.push("Only one motor is assumed on this circuit. For several motors on a common feeder, 430.24 (125 % of the largest motor + 100 % of the others) applies instead.");
  if (inp.loadType === "generator")
    cons.push("The 115 % rule of 445.13 applies to the conductors from the generator terminals up to the first overcurrent device.");
  if (inp.loadType === "transformer")
    cons.push("The whole transformer load is treated as continuous. Primary/secondary conductor and overcurrent protection rules of Article 450 must be checked separately.");

  return step(i, "Design (minimum required) current", ref || "Load rules", `
    ${bits.join("")}
    ${applied(`${sub}${designEq}`)}
    ${considerations(cons)}`);
}

function stepMethod(i, inp, method) {
  const path = [];
  path.push(inp.vClass === "lv"
    ? "Cable rated <b>2000 V or less</b> → the ampacity provisions of <b>392.80(A)</b> apply."
    : "Cable rated <b>2001 V to 35 kV</b> → the ampacity provisions of <b>392.80(B)</b> apply.");
  path.push(inp.construction === "multi"
    ? `The cable is a <b>multiconductor cable</b> → subsection <b>${inp.vClass === "lv" ? "392.80(A)(1)" : "392.80(B)(1)"}</b>.`
    : `The circuit uses <b>single-conductor cables</b> → subsection <b>${inp.vClass === "lv" ? "392.80(A)(2)" : "392.80(B)(2)"}</b>.`);
  path.push(`Arrangement declared: <b>${esc(arrangementLabel(inp.arrangement, inp.construction))}</b>${inp.covered ? ", tray with a solid cover over more than 1.8 m" : ", uncovered tray"} → <b>${esc(method.trayRef)}</b>.`);
  path.push(`Base ampacity table selected: <b>${esc(method.baseTableName)}</b>, whose values are tabulated at a <b>${method.tableBaseAmbient} °C</b> ambient basis.`);

  const cons = [
    "The declared arrangement is a physical commitment: maintained-spacing and trefoil ampacities are only valid if the spacing is actually built and maintained along the whole tray run.",
    "Cable tray fill (NEC 392.22) is a separate check and is not performed here — the tray must still be wide enough for the selected cables.",
    "Tray support, bonding and use as an equipment grounding conductor (392.60) are not covered.",
  ];
  if (inp.arrangementRaw !== inp.arrangement)
    cons.push("A solid cover was selected together with a maintained-spacing/trefoil arrangement. Those free-air-based ampacities require an <b>uncovered</b> tray, so the calculation reverted to the touching-cable rule.");
  if (inp.construction === "single")
    cons.push("Single-conductor cables installed in a cable tray must be <b>1/0 AWG or larger</b> [392.10(B)(1)], so smaller sizes were removed from the search.");
  if (method.adjApplies)
    cons.push("This tray rule reproduces the ampacity tables of Article 310, so the adjustment factors of 310.15(C)(1) for more than three current-carrying conductors still apply (see the step below).");
  else
    cons.push("This tray rule is based on free-air / spaced-cable tables, which already account for the mutual heating of the declared arrangement — the 310.15(C)(1) adjustment factors are therefore <b>not</b> applied again.");

  return step(i, "Installation method and base ampacity table", method.trayRef.split(" — ")[0], `
    ${rule(`NEC 392.80 assigns a different ampacity basis to each combination of voltage class, cable construction, arrangement in the tray and presence of a solid cover. The decision path taken here was:`)}
    ${applied(`<ol class="path">${path.map((p) => `<li>${p}</li>`).join("")}</ol>`)}
    ${considerations(cons)}`);
}

function stepBase(i, inp, method, row) {
  return step(i, "Base ampacity of the selected conductor", method.baseTableName, `
    ${rule(`The starting point is the tabulated ampacity of one conductor of the selected size, read from <b>${esc(method.baseTableName)}</b>, copper column, ${inp.insTemp} °C insulation, at the table's own ambient basis of ${method.tableBaseAmbient} °C.`)}
    ${applied(eqn(`I<sub>table</sub> ( ${esc(sizeLabel(row.size))} Cu, ${inp.insTemp} °C ) = <b>${row.base} A</b>`))}
    ${considerations([
      `The table value is valid only at ${method.tableBaseAmbient} °C ambient — the correction to the project ambient is made in a later step.`,
      "Table values were transcribed from the NEC for engineering study; verify them against the edition adopted by the authority having jurisdiction before use in a released design.",
    ])}`);
}

function stepTray(i, inp, method, row) {
  const pct = `${f(row.tf * 100, 0)} %`;
  const cons = [];
  if (row.tf === 1)
    cons.push("No tray reduction factor applies to this arrangement — the selected table already represents the installed condition.");
  else
    cons.push(`The reduction accounts for the mutual heating of cables lying in the tray and, where applicable, for the reduced convection under a solid cover.`);
  if (inp.covered) cons.push("The cover penalty applies where the solid cover runs for more than 1.8 m (6 ft); short covers used only for mechanical protection do not trigger it.");
  if (inp.construction === "single" && inp.vClass === "lv")
    cons.push("For touching single conductors the factor depends on the conductor size band (600 kcmil and larger vs. 1/0 AWG through 500 kcmil).");

  return step(i, "Cable tray reduction factor", method.trayRef.split(" — ")[0], `
    ${rule(`<b>${esc(method.trayRef)}</b>`)}
    ${applied(eqn(`F<sub>tray</sub> = <b>${f(row.tf, 2)}</b> &nbsp;(${pct} of the table value)`))}
    ${considerations(cons)}`);
}

function stepAmbient(i, inp, method, kAmb) {
  const Ta = parseFloat(inp.ambient) || 0;
  const Tc = inp.insTemp;
  const Tb = method.tableBaseAmbient;
  const useTable = inp.vClass === "lv" && inp.ambMethod === "table";
  const band = Math.ceil(Ta / 5) * 5;
  const exact = Math.sqrt(Math.max(0, (Tc - (useTable ? band : Ta)) / (Tc - Tb)));

  const ref = inp.vClass === "lv" ? (useTable ? "Table 310.15(B)(1)" : "310.15(B)(1)") : "315.60(D)(4)";
  const cons = [
    `Ambient means the temperature of the air around the tray in the worst operating condition, not the average outdoor temperature. ${Ta} °C was taken as given.`,
    "Solar radiation on outdoor trays, hot-spot locations near process equipment and enclosed pathways can raise the effective ambient well above the design figure.",
  ];
  if (useTable)
    cons.push(`The table method places the ambient in its 5 °C band and uses the band's upper limit (${Ta} °C → ${band} °C), then rounds the factor to two decimals — the printed-table behaviour, slightly conservative compared with the equation.`);
  else cons.push("The exact equation was used, which is what the NEC prescribes when the ambient is not one of the tabulated bands.");
  if (kAmb === 0) cons.push("The ambient reaches or exceeds the conductor temperature rating: no current may be carried at all.");

  return step(i, "Ambient temperature correction", ref, `
    ${rule(`Where the ambient differs from the table basis, the tabulated ampacity is multiplied by the correction factor<br>
      <span class="inl">F<sub>amb</sub> = √( (T<sub>c</sub> − T<sub>a</sub>) / (T<sub>c</sub> − T<sub>base</sub>) )</span>,
      with T<sub>c</sub> the conductor temperature rating, T<sub>a</sub> the ambient and T<sub>base</sub> the ambient basis of the table.`)}
    ${applied(eqn(`F<sub>amb</sub> = √( (${Tc} − ${useTable ? band : Ta}) / (${Tc} − ${Tb}) ) = ${f(exact, 4)} → <b>${f(kAmb, useTable ? 2 : 4)}</b>${useTable ? ` <span class="dim">(rounded as printed in the table)</span>` : ""}`))}
    ${considerations(cons)}`);
}

function stepAdjust(i, inp, method, kAdj) {
  if (!method.adjApplies) {
    return step(i, "Adjustment for number of current-carrying conductors", "310.15(C)(1) — not applicable", `
      ${rule(`Where more than three current-carrying conductors are bundled or share a raceway/cable, the ampacity is reduced by the factors of Table 310.15(C)(1).`)}
      ${applied(eqn(`F<sub>adj</sub> = <b>1.00</b> — not applied`))}
      ${considerations([
        "The tray rule selected in the previous steps uses free-air or spaced-cable ampacities, which already represent the installed heat dissipation; applying 310.15(C)(1) on top of them would double-count the same effect.",
        "If the arrangement in the field ends up different from the one declared (for example, cables that are supposed to be spaced end up touching), the applicable rule — and the factors — change.",
      ])}`);
  }
  const cons = [
    "The count is the number of <b>current-carrying</b> conductors: a neutral carrying only the unbalanced current of a balanced 3-wire circuit is not counted, and a grounding conductor is never counted [310.15(E) and (F)].",
    "Under 392.80(A)(1)(a) the adjustment is applied to the conductors <i>within each multiconductor cable</i>, not to the total number of conductors in the tray.",
    "Harmonic-rich loads can make a neutral a current-carrying conductor, which increases the count and lowers the factor.",
  ];
  return step(i, "Adjustment for number of current-carrying conductors", "Table 310.15(C)(1) via 392.80(A)(1)(a)", `
    ${rule(`With more than three current-carrying conductors, the ampacity is multiplied by the factor of Table 310.15(C)(1): 4–6 → 0.80, 7–9 → 0.70, 10–20 → 0.50, 21–30 → 0.45, 31–40 → 0.40, 41 and above → 0.35.`)}
    ${applied(eqn(`${esc(inp.ccc)} current-carrying conductors → F<sub>adj</sub> = <b>${f(kAdj, 2)}</b>`))}
    ${considerations(cons)}`);
}

function stepDerated(i, inp, method, row, kAmb, kAdj) {
  const parts = [`${row.base} A`, f(row.tf, 2), f(kAmb, 3)];
  if (method.adjApplies) parts.push(f(kAdj, 2));
  return step(i, "Derated (installation) ampacity", "392.80 · 310.15", `
    ${rule(`The ampacity of the conductor as installed is the tabulated value multiplied by every applicable correction and adjustment factor.`)}
    ${applied(eqn(`I<sub>derated</sub> = I<sub>table</sub> × F<sub>tray</sub> × F<sub>amb</sub>${method.adjApplies ? " × F<sub>adj</sub>" : ""} = ${parts.join(" × ")} = <b>${f(row.derated, 1)} A</b> per conductor`))}
    ${considerations([
      "This is the thermal capability of one conductor in the declared installation, before any equipment-terminal limitation.",
      "It is a steady-state value: no credit is taken for cyclic or short-time duty, and no allowance is made for future load growth.",
    ])}`);
}

function stepTermination(i, inp, row) {
  if (row.termAmp == null)
    return step(i, "Termination temperature limitation", "110.14(C)", `
      ${rule(`Conductor ampacity used for sizing may not exceed the temperature rating of the terminations to which it connects.`)}
      ${applied(`<p>No termination limit could be evaluated for this size/table combination; the derated ampacity was used directly.</p>`)}
      ${considerations(["Confirm the temperature rating marked on the terminals of both equipment ends before accepting this result."])}`);

  if (inp.vClass !== "lv")
    return step(i, "Termination temperature limitation", "110.40", `
      ${rule(`Unless the equipment is identified for a higher temperature, terminations of conductors rated above 2000 V are evaluated at the <b>90 °C</b> column of the applicable ampacity table [110.40].`)}
      ${applied(eqn(`I<sub>term</sub> ( 90 °C column ) = ${row.termAmp} A<br>
        I<sub>allowable</sub> = min( ${f(row.derated, 1)} A ; ${row.termAmp} A ) = <b>${f(row.allowed, 1)} A</b>`))}
      ${considerations([
        inp.insTemp === 105
          ? "MV-105 insulation was selected: the extra headroom is usable for derating, but the termination check is still made on the 90 °C column unless the equipment is identified otherwise."
          : "The 90 °C column of the same base table is used as the termination limit.",
        "The limit is a property of the equipment terminals, not of the cable — verify the rating marked on the switchgear, terminator or splice kit.",
      ])}`);

  const applyIt = inp.applyTermLimit;
  return step(i, "Termination temperature limitation", "110.14(C) · Table 310.16", `
    ${rule(`The ampacity used to size the conductor must not exceed the ampacity of that size taken from <b>Table 310.16</b> at the temperature rating of the lowest-rated termination, device or conductor of the circuit [110.14(C)(1)].`)}
    ${applied(eqn(`I<sub>term</sub> ( ${esc(sizeLabel(row.size))}, ${inp.termTemp} °C column of Table 310.16 ) = ${row.termAmp} A<br>
      ${applyIt
        ? `I<sub>allowable</sub> = min( ${f(row.derated, 1)} A ; ${row.termAmp} A ) = <b>${f(row.allowed, 1)} A</b>`
        : `Limit <b>not applied</b> (engineering override) → I<sub>allowable</sub> = ${f(row.derated, 1)} A`}`))}
    ${considerations(applyIt
      ? [
          "The termination limit only caps the ampacity used for sizing; the 90 °C (or higher) insulation rating may still be used for the derating calculation itself [110.14(C)].",
          "Equipment rated 100 A or less, or marked for 14–1 AWG conductors, is generally limited to the 60 °C column unless it is listed and identified for higher temperatures.",
          "Both ends of the circuit must be checked — the lowest-rated termination governs.",
        ]
      : [
          "The user disabled the 110.14(C) limitation. The result is based on installation ampacity only and is <b>not</b> a code-compliant selection unless the suitability of every termination is confirmed with the manufacturer and accepted by the authority having jurisdiction.",
        ])}`);
}

function stepSearch(i, inp, result, rec, vd) {
  const scan = rec.scan || [];
  const cap = 40;
  const shown = scan.slice(0, cap);
  const vdOn = !!(vd && vd.on);

  const head = `<tr><th>Size</th><th>Base</th><th>×F<sub>tray</sub></th><th>×F<sub>amb</sub>${result.method.adjApplies ? "×F<sub>adj</sub>" : ""}</th><th>Derated</th><th>Term. limit</th><th>Allowable</th>${vdOn ? "<th>VD %</th>" : ""}<th>Verdict</th></tr>`;
  const body = shown.map((r) => {
    const okA = r.allowed >= rec.requiredPerCond && r.allowed > 0;
    const p = vdOn ? vdPercent(r.size, rec.n, vd) : null;
    const okV = !vdOn || (p != null && p <= vd.maxPct);
    const ok = okA && okV;
    const isSel = r.size === rec.row.size;
    const why = isSel
      ? "✔ selected — smallest size meeting every criterion"
      : ok
      ? "✔ acceptable, but larger than needed"
      : !okA
      ? `✘ ${f(r.allowed, 1)} A &lt; ${f(rec.requiredPerCond, 1)} A required`
      : `✘ VD ${f(p, 2)} % &gt; ${f(vd.maxPct, 2)} % limit`;
    return `<tr class="${isSel ? "sel" : ok ? "hit" : ""}">
      <td>${esc(sizeLabel(r.size))}</td><td>${r.base} A</td><td>${f(r.tf, 2)}</td>
      <td>${f(result.kAmb, 3)}${result.method.adjApplies ? ` × ${f(result.kAdj, 2)}` : ""}</td>
      <td>${f(r.derated, 1)} A</td><td>${r.termAmp == null ? "—" : `${r.termAmp} A`}</td>
      <td><b>${f(r.allowed, 1)} A</b></td>${vdOn ? `<td>${p == null ? "—" : f(p, 2)}</td>` : ""}
      <td>${why}</td></tr>`;
  }).join("");

  const cons = [
    `Sets are increased only when no acceptable size is found: the search starts at one set per phase and stops at the first combination that satisfies every active criterion — here <b>${rec.n} set(s)</b> of <b>${esc(sizeLabel(rec.row.size))}</b>.`,
    "The result is the smallest compliant conductor, not necessarily the most economical or the most practical to pull and terminate.",
  ];
  if (rec.n > 1) {
    cons.push("Conductors in parallel must be <b>1/0 AWG or larger</b> and, in each phase, be the same length, material, size and insulation, and terminate in the same manner [310.10(G)].");
    cons.push("Each parallel set must see the same magnetic environment; unbalanced spacing between sets causes unequal current sharing that this calculation does not model.");
  }
  if (result.bestCopper && result.bestCopper.n !== rec.n)
    cons.push(`A lower total copper cross-section would be obtained with ${result.bestCopper.n} × ${esc(sizeLabel(result.bestCopper.row.size))} (${f(result.bestCopper.totalKcmil, 0)} kcmil per phase vs. ${f(rec.totalKcmil, 0)} kcmil) — worth comparing on cost and installation effort.`);
  if (inp.maxSize) cons.push(`The search was limited to conductors of ${esc(sizeLabel(inp.maxSize))} and smaller, as requested.`);

  return step(i, "Size search and number of parallel sets", "310.10(G)", `
    ${rule(`Each conductor of a parallel set must carry its share of the load: with <i>n</i> sets per phase the required allowable ampacity per conductor is I<sub>design</sub> / n. Sizes are scanned from the smallest upward and the first one whose allowable ampacity ${vdOn ? "and voltage drop both satisfy the criteria" : "reaches the requirement"} is selected.`)}
    ${applied(`${eqn(`I<sub>required</sub> = I<sub>design</sub> / n = ${f(rec.requiredPerCond * rec.n, 1)} A / ${rec.n} = <b>${f(rec.requiredPerCond, 1)} A</b> per conductor`)}
      <table class="scan">${head}${body}</table>
      ${scan.length > cap ? `<p class="dim">(${scan.length - cap} larger size(s) omitted — the search stopped at the first acceptable one.)</p>` : ""}`)}
    ${considerations(cons)}`);
}

function stepVd(i, inp, rec, vd) {
  if (!vd.on)
    return step(i, "Voltage drop", "210.19(A) IN / 215.2(A) IN", `
      ${rule(`The NEC states voltage drop limits as informational notes — 3 % on a branch circuit or feeder and 5 % on the combination — rather than as mandatory requirements.`)}
      ${applied(`<p>The voltage-drop criterion was <b>disabled</b> by the user, so the selection above is based on ampacity alone.</p>`)}
      ${considerations(["Motor starting, transformer inrush and process requirements often govern the conductor size through voltage drop rather than through ampacity — a separate check is recommended."])}`);

  const z = Z_TABLE9[rec.row.size] || [null, null];
  const pf = Math.min(Math.max(vd.pf || 1, 0.05), 1);
  const sinPhi = Math.sqrt(Math.max(0, 1 - pf * pf));
  const zeff = z[0] * pf + z[1] * sinPhi;
  const mult = vd.phases === 3 ? Math.sqrt(3) : 2;
  const dropV = (mult * vd.amps * (vd.lengthFt / 1000) * zeff) / rec.n;
  const meters = vd.lengthFt / 3.28084;

  return step(i, "Voltage drop check", "Chapter 9, Table 9", `
    ${rule(`Voltage drop is computed with the effective impedance of the conductor,
      <span class="inl">Z<sub>eff</sub> = R·cosφ + X·sinφ</span>, using the alternating-current resistance and reactance of NEC Chapter 9, Table 9 (copper, 75 °C, PVC-conduit column as the closest match to a non-magnetic tray):<br>
      <span class="inl">ΔV = ${vd.phases === 3 ? "√3" : "2"} · I · (L / 1000) · Z<sub>eff</sub> / n</span>.`)}
    ${applied(eqn(`R = ${z[0]} Ω/kft &nbsp; X = ${z[1]} Ω/kft &nbsp; cosφ = ${f(pf, 2)} &nbsp; sinφ = ${f(sinPhi, 3)}<br>
      Z<sub>eff</sub> = ${z[0]} × ${f(pf, 2)} + ${z[1]} × ${f(sinPhi, 3)} = ${f(zeff, 5)} Ω/kft<br>
      ΔV = ${vd.phases === 3 ? "√3" : "2"} × ${f(vd.amps, 1)} A × ${f(vd.lengthFt / 1000, 4)} kft × ${f(zeff, 5)} / ${rec.n} = <b>${f(dropV, 2)} V</b><br>
      ΔV % = ${f(dropV, 2)} / ${f(vd.volts, 0)} = <b>${f(rec.vdPct, 2)} %</b> &nbsp; (limit ${f(vd.maxPct, 2)} %)`))}
    ${considerations([
      `The drop is evaluated at the operating (full-load) current ${f(vd.amps, 1)} A over ${f(meters, 1)} m (${f(vd.lengthFt, 0)} ft) one way — not at the 125 % design current.`,
      "Table 9 values apply to 600 V cables at 75 °C; reactance depends on the actual conductor spacing and cable construction, so a manufacturer's R/X data gives a more accurate result, especially for medium voltage.",
      "The impedances of 700, 800 and 900 kcmil are not listed in Table 9 and were interpolated by this tool.",
      "Voltage drop during motor starting, which can be several times larger, is not evaluated.",
    ])}`);
}

function stepEgc(i, inp, egc, rec) {
  if (!egc)
    return step(i, "Equipment grounding conductor", "Table 250.122", `
      ${rule(`The minimum size of a copper equipment grounding conductor is taken from Table 250.122 according to the rating of the overcurrent device ahead of the circuit.`)}
      ${applied(`<p>No overcurrent device rating was entered, so the equipment grounding conductor was <b>not</b> sized in this study.</p>`)}
      ${considerations(["Size the equipment grounding conductor before issuing the design; it is required in every cable tray circuit unless the tray itself is listed and installed as the equipment grounding conductor [392.60(B)]."])}`);

  if (egc.error)
    return step(i, "Equipment grounding conductor", "Table 250.122", `${applied(`<p>${esc(egc.error)}</p>`)}`);

  const cons = [
    "The equipment grounding conductor is selected from the rating of the overcurrent device, not from the load current.",
    "It is never required to be larger than the ungrounded (phase) conductors of the circuit [250.122(A)].",
  ];
  if (egc.upsized)
    cons.push(`The phase conductors were increased beyond the size required for ampacity, so the equipment grounding conductor area was increased in the same proportion (× ${f(egc.ratio, 2)}) [250.122(B)].`);
  if (inp.egcLinked && rec && rec.n > 1)
    cons.push("With conductors in parallel, a full-size equipment grounding conductor is required in <b>each</b> parallel set / raceway / tray [250.122(F)].");
  if (!inp.egcLinked)
    cons.push("Standalone mode: the table value alone is shown, with no relation to the conductors sized above. If the real circuit's conductors are upsized, 250.122(B) still applies to it.");

  return step(i, "Equipment grounding conductor", "250.122", `
    ${rule(`Table 250.122 gives the minimum copper equipment grounding conductor for each overcurrent device rating; 250.122(B) requires it to be increased proportionally where the ungrounded conductors are upsized, and 250.122(A) caps it at the size of those conductors.`)}
    ${applied(eqn(`OCPD ${esc(inp.ocpd)} A → Table 250.122 minimum = ${esc(sizeLabel(egc.tableSize))} Cu<br>
      Selected equipment grounding conductor = <b>${inp.egcLinked && rec && rec.n > 1 ? `${rec.n} × ` : ""}${esc(sizeLabel(egc.finalSize))} Cu</b>`))}
    ${considerations(cons)}`);
}

function stepLimits(i, warnings) {
  const notCovered = [
    "Cable tray fill and tray width selection [392.22].",
    "Short-circuit withstand of the conductor and of the shield/armour, and protective-device coordination.",
    "Overcurrent protection sizing [240, 430.52, 450.3].",
    "Cable tray as an equipment grounding conductor, bonding and tray sizing/support [392.18, 392.60].",
    "Conductor withstand during motor starting, harmonic loading and derating for direct sunlight.",
    "Cable bending radius, pulling tension, sidewall pressure and manufacturer installation limits.",
  ];
  return step(i, "Scope, warnings and what this study does not cover", "limitations", `
    ${warnings.length ? `<div class="warn"><span class="blk-tag">Notes raised during the calculation</span><ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
    <div class="cons"><span class="blk-tag">Not covered by this report</span><ul>${notCovered.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
    <p class="disclaimer">Engineering aid only. The NEC tables used here were transcribed for study purposes; all values, exceptions and local amendments must be verified against the official edition of NFPA 70 adopted by the authority having jurisdiction before this calculation is used in a released design.</p>`);
}

/* ------------------------------ entry points ------------------------------ */

export function buildReportHtml(ctx) {
  const { inputs, load, result, rec, egc, warnings, vd } = ctx;
  const now = new Date();
  const stamp = now.toLocaleString();

  const summary = rec
    ? kv([
        ["Selected conductor", `<b>${rec.n} × ${esc(sizeLabel(rec.row.size))} copper per phase</b>`],
        ["Design current", `${f(load.design, 1)} A`],
        ["Required per conductor", `${f(rec.requiredPerCond, 1)} A`],
        ["Allowable per conductor", `${f(rec.row.allowed, 1)} A (utilization ${f(rec.utilization * 100, 0)} %)`],
        ["Total allowable ampacity", `${f(rec.totalAmp, 1)} A`],
        ["Governing criterion", esc(rec.governing || "ampacity")],
        rec.vdPct != null ? ["Voltage drop", `${f(rec.vdPct, 2)} % (limit ${f(vd.maxPct, 2)} %)`] : ["Voltage drop", "not evaluated"],
        egc && !egc.error ? ["Equipment grounding conductor", `${inputs.egcLinked && rec.n > 1 ? `${rec.n} × ` : ""}${esc(sizeLabel(egc.finalSize))} Cu`] : ["Equipment grounding conductor", "not sized"],
        ["Copper per phase", `${f(rec.totalKcmil, 0)} kcmil`],
      ])
    : `<p class="nores">No conductor within the declared limits satisfies the criteria. The steps below still document the method, the factors and the sizes that were examined.</p>`;

  let i = 0;
  const steps = [];
  steps.push(stepInputs(++i, inputs, load));
  steps.push(stepLoad(++i, inputs, load));
  if (result) {
    steps.push(stepMethod(++i, inputs, result.method));
    if (rec) {
      steps.push(stepBase(++i, inputs, result.method, rec.row));
      steps.push(stepTray(++i, inputs, result.method, rec.row));
      steps.push(stepAmbient(++i, inputs, result.method, result.kAmb));
      steps.push(stepAdjust(++i, inputs, result.method, result.kAdj));
      steps.push(stepDerated(++i, inputs, result.method, rec.row, result.kAmb, result.kAdj));
      steps.push(stepTermination(++i, inputs, rec.row));
      steps.push(stepSearch(++i, inputs, result, rec, vd));
      steps.push(stepVd(++i, inputs, rec, vd));
    } else {
      steps.push(stepAmbient(++i, inputs, result.method, result.kAmb));
      steps.push(stepAdjust(++i, inputs, result.method, result.kAdj));
    }
  }
  steps.push(stepEgc(++i, inputs, egc, rec));
  steps.push(stepLimits(++i, warnings || []));

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Cable tray conductor sizing — calculation report</title>
<style>
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 0 40px; background: #eceff2; color: #1d2530;
         font: 13px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif; }
  .sheet { max-width: 900px; margin: 0 auto; background: #fff; padding: 26px 30px 34px; }
  code, .mono, .eqn, table.scan, table.kv td { font-family: "IBM Plex Mono", ui-monospace, Consolas, monospace; }
  .toolbar { max-width: 900px; margin: 0 auto; padding: 12px 0; display: flex; gap: 12px; align-items: center; }
  .toolbar button { font: 600 13px "Segoe UI", system-ui, sans-serif; background: #0e5da8; color: #fff;
                    border: 0; border-radius: 4px; padding: 9px 16px; cursor: pointer; }
  .toolbar span { font-size: 12px; color: #5c6875; }
  header.doc { border-bottom: 3px solid #1d2530; padding-bottom: 10px; margin-bottom: 18px; }
  header.doc h1 { margin: 0; font-size: 21px; letter-spacing: .4px; text-transform: uppercase; }
  header.doc .sub { font-size: 12px; color: #5c6875; margin-top: 4px; }
  header.doc .meta { font-size: 11px; color: #7d8894; margin-top: 6px; font-family: "IBM Plex Mono", monospace; }
  h2 { font-size: 15px; margin: 0; }
  .summary { border: 1px solid #0e5da8; background: #eef4fb; border-radius: 5px; padding: 12px 14px; margin-bottom: 20px; }
  .summary h3, .intro h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .9px; color: #0e5da8; }
  .intro { border: 1px dashed #c6cdd4; border-radius: 5px; padding: 12px 14px; margin-bottom: 20px; font-size: 12.5px; color: #3c4753; }
  .intro h3 { color: #5c6875; }
  .step { border: 1px solid #c6cdd4; border-radius: 5px; padding: 0 0 14px; margin-bottom: 16px; page-break-inside: avoid; }
  .step-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
               border-bottom: 1px solid #dfe4e9; background: #f6f8fa; padding: 10px 14px; margin-bottom: 12px; }
  .step-n { font: 600 11px "IBM Plex Mono", monospace; color: #fff; background: #2a323c; border-radius: 3px; padding: 3px 7px; letter-spacing: .5px; }
  .step-ref { margin-left: auto; font: 11px "IBM Plex Mono", monospace; color: #5c6875; }
  .step > div, .step > p, .step > table { margin-left: 14px; margin-right: 14px; }
  .blk-tag, .rule-tag { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #7d8894; margin-bottom: 4px; }
  .rule { border-left: 3px solid #c6cdd4; padding: 2px 0 2px 10px; margin-bottom: 10px; color: #3c4753; }
  .applied { background: #f6f8fa; border: 1px solid #dfe4e9; border-radius: 4px; padding: 9px 11px; margin-bottom: 10px; }
  .cons { margin-bottom: 2px; }
  .cons ul, .warn ul { margin: 0; padding-left: 18px; }
  .cons li, .warn li { margin-bottom: 4px; color: #3c4753; }
  .warn { background: #fdf6e3; border-left: 4px solid #d99a00; border-radius: 0 4px 4px 0; padding: 8px 11px; margin-bottom: 10px; }
  .eqn { font-size: 12.5px; line-height: 1.8; }
  .inl { font-family: "IBM Plex Mono", monospace; background: #eef4fb; padding: 1px 5px; border-radius: 3px; }
  ol.path { margin: 0; padding-left: 18px; }
  ol.path li { margin-bottom: 5px; }
  table.kv { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.kv th { text-align: left; font-weight: 600; color: #5c6875; padding: 5px 10px 5px 0;
                border-bottom: 1px solid #eef0f3; width: 34%; vertical-align: top;
                font-family: "Segoe UI", system-ui, sans-serif; }
  table.kv td { padding: 5px 0; border-bottom: 1px solid #eef0f3; }
  table.scan { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 8px; }
  table.scan th { text-align: left; font-weight: 400; font-size: 10px; text-transform: uppercase; letter-spacing: .6px;
                  color: #7d8894; border-bottom: 1px solid #c6cdd4; padding: 4px 6px 4px 0; }
  table.scan td { padding: 4px 6px 4px 0; border-bottom: 1px solid #eef0f3; white-space: nowrap; }
  table.scan tr.hit { color: #1e7d46; }
  table.scan tr.sel { background: #eef4fb; color: #0e5da8; font-weight: 600; }
  .dim { color: #7d8894; }
  .nores { color: #b3261e; font-weight: 600; margin: 0; }
  .disclaimer { font-size: 11.5px; color: #5c6875; border: 1px dashed #c6cdd4; border-radius: 4px; padding: 10px 12px; }
  @media print {
    body { background: #fff; }
    .no-print { display: none !important; }
    .sheet { max-width: none; padding: 0; }
  }
</style></head>
<body>
<div class="toolbar no-print">
  <button onclick="window.print()">Print / Save as PDF</button>
  <span>Use your browser's &ldquo;Save as PDF&rdquo; destination to file this report.</span>
</div>
<div class="sheet">
  <header class="doc">
    <h1>Cable tray conductor sizing — calculation report</h1>
    <div class="sub">Step-by-step record of the ampacity, derating, parallel-set, voltage-drop and grounding calculation for conductors installed in cable tray.</div>
    <div class="meta">NEC 2023 basis · Art. 392.80 · 310.15/.16/.17/.20 · Art. 315 · 430 / 445 / 424 / 215 · 250.122 · Ch. 9 Table 9 &nbsp;|&nbsp; generated ${esc(stamp)}</div>
  </header>

  <div class="summary">
    <h3>Result</h3>
    ${summary}
  </div>

  <div class="intro">
    <h3>How to read this report</h3>
    Each step states the code rule that was applied, the numeric substitution made with the project data, and the
    engineering considerations or assumptions behind it. The chain of the calculation is:
    load rule → design current → tray installation method → base ampacity table → tray factor → ambient correction →
    conductor-count adjustment → derated ampacity → termination limit → number of parallel sets and size search →
    voltage drop → equipment grounding conductor.
  </div>

  ${steps.join("\n")}
</div>
</body></html>`;
}

export function openReport(html) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("The report window was blocked by the browser. Allow pop-ups for this page and try again.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
