import {MULTI_LAYOUTS, SINGLE_LAYOUTS, drawLayout} from './arrangement.js';
import {blankTray, compartmentsOf, validateTray, resizeTray, evaluateTray, suggestSize, cableSnapshot, TRAY_TYPES} from './project.js';
import {formatNumber as fmt, formatInteger as integer, dimension, cableSize} from './format.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const uid = () => crypto.randomUUID?.() || `tl-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(2)).join('-')}`;
const colors = {power: 'var(--accent)', control: 'var(--warn)', vfd: 'var(--plate-edge)', mv: 'var(--ok)'};
const labels = {power: 'LV power', control: 'Control', vfd: 'VFD', mv: 'Medium voltage'};
const ICONS = {
  tray: 'M3 5v14h18V5M8 7v12M16 7v12M3 12h18', plus: 'M12 5v14M5 12h14', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  close: 'm6 6 12 12M6 18 18 6', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', check: 'm5 12 4 4L19 6',
  alert: 'm12 3 10 18H2zM12 9v5M12 17h.01', info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  cable: 'M8 3v6a4 4 0 0 0 8 0V3M12 13v8M5 3h6M13 3h6', scale: 'M4 17h16M6 17 8 7h8l2 10M12 7V4', chevron: 'm9 5 7 7-7 7',
  refresh: 'M20 7a9 9 0 1 0 1 7M20 3v5h-5', print: 'M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6z',
  move: 'M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3m-9-9-3 3 3 3m12-6 3 3-3 3', settings: 'M4 7h16M4 17h16M8 4v6M16 14v6'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.info}"/></svg>`;
const btn = (action, text, cls = '', extra = '') => `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const opt = (v, l, current) => `<option value="${esc(v)}" ${String(v) === String(current) ? 'selected' : ''}>${esc(l)}</option>`;
const field = (label, input) => `<label class="field"><span>${label}</span>${input}</label>`;
const numberInput = (key, value, min, max, step = 'any', unit = '') => `<div class="input-unit"><input type="number" data-tray="${key}" value="${value}" min="${min}" max="${max}" step="${step}">${unit ? `<span>${unit}</span>` : ''}</div>`;
const voltageText = v => v >= 1000 ? fmt(v / 1000, v % 1000 ? 1 : 0) + ' kV' : v ? v + ' V' : 'Bare';
const pdfOf = c => c.pdfUrl || c.sourceUrl;

const STORE = 'traylab-tray-v2';
let catalog = [], meta = {}, tray, selectedComp, selectedCable = null, evaluation, toastTimer, smallHandler = null, lastAdded = '';
let filter = {q: '', category: '', voltage: '', conductors: '', page: 0};

function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('visible'), 3500); }
function save() { try { localStorage.setItem(STORE, JSON.stringify(tray)); } catch { /* storage is a convenience only */ } }
function commit(change) {
  try {
    const next = structuredClone(tray);
    const result = change(next) || next;
    validateTray(result);
    tray = result; render(); return true;
  } catch (e) { toast(e.message); render(); return false; }
}

/* ---------- page ---------- */
function render() {
  if (!tray.compartments.some(c => c.id === selectedComp)) selectedComp = tray.compartments[0].id;
  save();
  evaluation = evaluateTray(tray);
  $('#app').innerHTML = `<main class="page">${heading()}${reportSummary()}${metrics()}<div class="main-grid"><div>${layoutCard()}${cableTable()}${resultsCard()}</div>${configPanel()}</div><footer class="footer"><span>TrayLab · NEC 2023 392.22 fill and physical layout</span><span>Southwire catalog snapshot ${esc(meta.extendedRetrievedAt || meta.initialRetrievedAt || '')} · ${integer(catalog.length)} copper items · nominal dimensions</span></footer></main>`;
  bindTrayDrag();
}

function heading() {
  return `<div class="page-heading"><div><div class="eyebrow">Southwire catalog · NEC 2023</div><h1>Cable tray sizing</h1><p>Add cables, choose how each compartment is arranged and find the tray size.</p></div><div class="heading-actions">${btn('clear', icon('refresh') + 'Clear')}${btn('print', icon('print') + 'Issue report')}${btn('catalog', icon('plus') + 'Add cable', 'primary')}</div></div>`;
}

function reportSummary() {
  const rows = [['Tray tag', tray.trayTag || '—'], ['Inside width', dimension(tray.widthIn)], ['Usable depth', dimension(tray.depthIn)], ['Tray type', TRAY_TYPES[tray.trayType]],
    ['Cover', tray.covered ? 'Yes' : 'No'], ['Dividers', tray.dividers.length ? `${tray.dividers.length} × ${dimension(tray.dividerThicknessIn)} at ${tray.dividers.map(d => fmt(d, 3)).join(', ')} in` : 'None'],
    ['Spare reserve', `${fmt(tray.reserve, 0)}%`], ['Result', evaluation.ok ? 'All compartments fit' : 'Over capacity']];
  return `<section class="report-only report-summary"><div class="report-title"><strong>TrayLab · Cable tray sizing report</strong><span>${esc(new Date().toLocaleString('en-US', {dateStyle: 'long', timeStyle: 'short'}))}</span></div><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
}

function metrics() {
  const ev = evaluation, limit = 100 - tray.reserve, over = ev.results.filter(r => r.status === 'over').length;
  const noRule = ev.cableCount > 0 && !ev.results.some(r => r.fill.rule);
  return `<div class="metrics"><div class="metric accent"><div class="metric-label">Highest NEC fill</div><div class="metric-value">${noRule ? '—' : fmt(ev.maxRatio * 100, 1)}<small>${noRule ? 'no NEC rule' : '%'}</small></div><div class="meter"><span style="width:${Math.min(100, ev.maxRatio * 100)}%;${ev.maxRatio * 100 > limit + 1e-9 ? 'background:var(--bad)' : ''}"></span></div><div class="metric-foot">Limit ${fmt(limit, 0)}%${tray.reserve ? ` · ${fmt(tray.reserve, 0)}% spare reserve` : ''}</div></div>`
    + `<div class="metric"><div class="metric-label">Cables in tray</div><span class="metric-ico">${icon('cable')}</span><div class="metric-value">${integer(ev.cableCount)}<small>cables</small></div><div class="metric-foot">${tray.cables.length} ${tray.cables.length === 1 ? 'cable type' : 'cable types'}</div></div>`
    + `<div class="metric"><div class="metric-label">Cable weight</div><span class="metric-ico">${icon('scale')}</span><div class="metric-value">${fmt(ev.weightLbFt, 2)}<small>lb/ft</small></div><div class="metric-foot">Catalog nominal weights · tray excluded</div></div>`
    + `<div class="metric ${over ? 'bad' : ''}"><div class="metric-label">Tray size</div><span class="metric-ico">${icon('tray')}</span><div class="metric-value">${fmt(tray.widthIn, 2).replace(/\.00$/, '')} × ${fmt(tray.depthIn, 2).replace(/\.00$/, '')}<small>in</small></div><div class="metric-foot">${!ev.cableCount ? 'Add cables to check the size' : over ? `${over} ${over === 1 ? 'compartment' : 'compartments'} over capacity` : 'All compartments fit'}</div></div></div>`;
}

const statusPill = r => r.status === 'empty' ? '<span class="pill neutral">Empty</span>' : r.status === 'over' ? '<span class="pill fail">Over capacity</span>' : '<span class="pill">Fits</span>';

function layoutSelect(comp, kind, compact = false) {
  const key = kind === 'multi' ? 'multiLayout' : 'singleLayout';
  const options = kind === 'multi' ? MULTI_LAYOUTS : SINGLE_LAYOUTS;
  return field(kind === 'multi' ? 'Multiconductor cables' : 'Single-conductor cables', `<select data-comp-id="${comp.id}" data-comp-field="${key}" ${compact ? 'data-compact' : ''} aria-label="${kind === 'multi' ? 'Multiconductor' : 'Single-conductor'} arrangement for ${esc(comp.name)}">${Object.entries(options).map(([v, o]) => opt(v, o.label, comp[key])).join('')}</select>`);
}

function layoutCard() {
  const n = tray.compartments.length;
  return `<section class="card"><div class="card-head"><div><h2>Tray layout</h2><div class="sub">${esc(tray.trayTag || 'Tray')} · ${dimension(tray.widthIn)} × ${dimension(tray.depthIn)} · ${TRAY_TYPES[tray.trayType]}${tray.covered ? ' · covered' : ''}</div></div>${btn('add-divider', icon('plus') + 'Add divider', 'quiet small-btn')}</div><div class="tray-stage">${traySvg()}</div><div class="viewer-note"><div class="legend">${Object.entries(labels).map(([c, l]) => `<span><i style="background:${colors[c]}"></i>${l}</span>`).join('')}</div><span class="drag-hint">${icon('move')}Drag a divider to resize compartments</span></div><div class="comp-cards" style="grid-template-columns:repeat(${Math.min(n, 4)},minmax(0,1fr))">${evaluation.results.map(compCard).join('')}</div></section>`;
}

function compCard(r, i) {
  const {comp, fill, plan, fit} = r;
  const stat = r.status === 'empty' ? '0' : fill.rule ? fmt(fill.ratio * 100, 1) : '—';
  const bar = Math.min(100, (fill.rule ? fill.ratio : fit.usedWidthIn / comp.widthIn) * 100 || 0);
  return `<div class="comp-card ${comp.id === selectedComp ? 'selected' : ''}" data-comp="${comp.id}" role="group" aria-label="${esc(comp.name)}"><button class="comp-title comp-select" type="button" data-comp="${comp.id}" aria-pressed="${comp.id === selectedComp}"><strong>${esc(comp.name)}</strong><span class="tag">${String.fromCharCode(65 + i)}</span></button><div class="comp-stat">${stat}<small>${fill.rule || r.status === 'empty' ? '% NEC fill' : ' no NEC fill rule'}</small></div><div class="comp-bar ${r.status === 'over' ? 'fail' : bar > 85 ? 'warn' : ''}"><span style="width:${bar}%"></span></div><div class="comp-rule">${dimension(comp.widthIn)} clear · ${plan.cableCount} cables</div>${statusPill(r)}${plan.cableCount ? `<div class="arrangement-summary">Layout width <strong>${dimension(fit.usedWidthIn)}</strong> · ${fmt(r.widthUse * 100, 0)}% of clear width${plan.trefoils ? `<br>${plan.trefoils} ${plan.trefoils === 1 ? 'trefoil' : 'trefoils'}` : ''}${plan.looseSingles ? `${plan.trefoils ? ' · ' : '<br>'}${plan.looseSingles} single(s) not in a trefoil` : ''}</div>` : ''}<div class="comp-spacing-controls">${layoutSelect(comp, 'multi', true)}${layoutSelect(comp, 'single', true)}</div></div>`;
}

function traySvg() {
  const W = 850, margin = 52, usable = W - margin * 2, s = usable / tray.widthIn, dep = Math.max(45, tray.depthIn * s), top = 72, base = top + dep, H = base + 62;
  const limit = 1 - tray.reserve / 100;
  const label = new Map(tray.cables.map(r => [r.id, r.cable]));
  let sv = `<svg id="traySvg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tray cross section with cables and dividers"><defs><pattern id="spare" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" x2="0" y1="0" y2="6" stroke="var(--steel)" stroke-width="1.2"/></pattern></defs>`;
  sv += `<line x1="${margin}" y1="24" x2="${W - margin}" y2="24" stroke="var(--steel)"/><path d="M${margin} 19v10M${W - margin} 19v10" stroke="var(--steel)"/><rect x="${W / 2 - 60}" y="13" width="120" height="20" fill="var(--field)"/><text x="${W / 2}" y="28" text-anchor="middle" font-size="12" fill="var(--muted)">${esc(dimension(tray.widthIn))}</text>`;
  sv += `<line x1="${margin - 22}" y1="${top}" x2="${margin - 22}" y2="${base}" stroke="var(--steel)"/><path d="M${margin - 27} ${top}h10M${margin - 27} ${base}h10" stroke="var(--steel)"/><text transform="translate(${margin - 28} ${top + dep / 2}) rotate(-90)" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(dimension(tray.depthIn))}</text>`;
  for (const r of evaluation.results) {
    const {comp} = r, x = margin + comp.startIn * s, w = comp.widthIn * s;
    sv += `<g data-comp="${comp.id}" class="tray-compartment"><rect x="${x}" y="${top}" width="${Math.max(0, w)}" height="${dep}" fill="${comp.id === selectedComp ? 'var(--accent-wash)' : 'var(--field)'}" opacity=".7"/>`;
    if (tray.reserve > 0) sv += `<rect x="${x + w * limit}" y="${top}" width="${w * (1 - limit)}" height="${dep}" fill="url(#spare)" opacity=".8"><title>Spare reserve ${fmt(tray.reserve, 0)}%</title></rect>`;
    sv += `<text x="${x + w / 2}" y="${top - 10}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(comp.name.length > 22 ? comp.name.slice(0, 20) + '…' : comp.name)}</text>`;
    const layout = drawLayout(r.plan, comp.widthIn * limit, tray.depthIn); // same width the fit check uses
    for (const d of layout.placed) {
      const R = d.d * s / 2, X = x + (d.x + d.d / 2) * s, Y = base - (d.y + d.d / 2) * s, color = colors[d.cat] || colors.power, c = label.get(d.id);
      sv += `<circle cx="${X}" cy="${Y}" r="${R}" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-width="1.1"><title>${esc(c ? cableSize(c) : '')}${d.phase ? ' · trefoil phase ' + d.phase : ''} · Ø ${fmt(d.d, 3)} in</title></circle>`;
      if (d.phase && R > 6) sv += `<text x="${X}" y="${Y + 3}" text-anchor="middle" font-size="${Math.min(11, R)}" fill="var(--ink)">${d.phase}</text>`;
      else if (R > 10) sv += `<circle cx="${X}" cy="${Y}" r="${R * .23}" fill="${color}" opacity=".45"/>`;
    }
    for (const g of layout.gaps) {
      if (g.width * s < 18) continue;
      const gx = x + g.x * s, gw = g.width * s;
      sv += `<g><title>Clear gap ${dimension(g.width)}</title><path d="M${gx + 2} ${base - 5}h${Math.max(0, gw - 4)}M${gx + 2} ${base - 9}v8M${gx + gw - 2} ${base - 9}v8" stroke="var(--muted)" fill="none"/><text x="${gx + gw / 2}" y="${base - 13}" text-anchor="middle" font-size="9" fill="var(--muted)">${g.factor}D</text></g>`;
    }
    sv += `<line x1="${x + 2}" y1="${base + 23}" x2="${x + w - 2}" y2="${base + 23}" stroke="var(--steel)"/><path d="M${x + 2} ${base + 19}v8M${x + w - 2} ${base + 19}v8" stroke="var(--steel)"/><rect x="${x + w / 2 - 40}" y="${base + 13}" width="80" height="18" fill="var(--field)"/><text x="${x + w / 2}" y="${base + 26}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(dimension(comp.widthIn))}</text>${layout.omitted ? `<text x="${x + w / 2}" y="${base + 44}" text-anchor="middle" font-size="9" fill="var(--bad)">+${layout.omitted} cables do not fit</text>` : ''}</g>`;
  }
  sv += `<path d="M${margin - 3} ${top - 2}v${dep + 7}H${W - margin + 3}v-${dep + 7}" fill="none" stroke="var(--muted)" stroke-width="5" stroke-linejoin="round"/>`;
  if (tray.covered) sv += `<rect x="${margin - 8}" y="${top - 9}" width="${usable + 16}" height="5" rx="1.5" fill="var(--muted)"><title>Cover (drawing only)</title></rect>`;
  tray.dividers.forEach((d, i) => {
    const x = margin + d * s, t = Math.max(tray.dividerThicknessIn * s, 2);
    sv += `<g class="drag-divider" data-drag-divider="${i}"><rect x="${x - 8}" y="${top - 10}" width="16" height="${dep + 14}" fill="transparent"/><rect x="${x - t / 2}" y="${top}" width="${t}" height="${dep}" fill="var(--muted)"/><rect x="${x - 7}" y="${top + 3}" width="14" height="22" rx="4" fill="var(--bg)" stroke="var(--muted)"/><path d="M${x - 2} ${top + 9}v10M${x + 2} ${top + 9}v10" stroke="var(--muted)"/></g>`;
  });
  return sv + '</svg>';
}

function cableTable() {
  if (!tray.cables.length) return `<section class="card schedule"><div class="card-head"><h2>Cables</h2></div><div class="empty-state"><strong>No cables yet</strong>Pick Southwire cables and set how many go in each compartment.<br>${btn('catalog', icon('plus') + 'Add cable', 'primary')}</div></section>`;
  const comps = tray.compartments;
  return `<section class="card schedule"><div class="card-head"><div class="flex"><h2>Cables</h2><span class="pill neutral">${tray.cables.length}</span></div>${btn('catalog', icon('plus') + 'Add cable', 'quiet small-btn')}</div><div class="table-wrap"><table><thead><tr><th>Cable</th><th>SPEC · Stock</th><th>Ø (in)</th><th>Qty.</th><th>Compartment</th><th>Weight (lb/ft)</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>${tray.cables.map(r => {
    const c = r.cable;
    return `<tr><td><div class="cable-title"><span class="category-dot" style="background:${colors[c.category] || colors.power}"></span><a href="${esc(pdfOf(c))}" target="_blank" rel="noreferrer" title="Open the Southwire PDF data sheet">${esc(cableSize(c))} <span aria-hidden="true">↗</span></a></div><div class="cable-sub wrap">${esc(c.title)}</div></td><td class="mono">${esc(c.spec)}<div class="cable-sub">${esc(c.stock || '—')}</div></td><td class="mono">${fmt(c.odIn, 3)}</td><td><input class="table-input" type="number" min="1" max="9999" step="1" data-row="${r.id}" data-key="qty" value="${r.qty}" aria-label="Quantity of ${esc(cableSize(c))}"></td><td><select class="assign" data-row="${r.id}" data-key="compartmentId" aria-label="Compartment for ${esc(cableSize(c))}">${comps.map(co => opt(co.id, co.name, r.compartmentId)).join('')}</select></td><td class="mono">${Number.isFinite(c.weightLbKft) ? fmt(r.qty * c.weightLbKft / 1000, 3) : '—'}</td><td>${btn('delete-row', icon('trash'), 'quiet icon-btn', `data-id="${r.id}" aria-label="Remove ${esc(cableSize(c))}"`)}</td></tr>`;
  }).join('')}</tbody></table></div><div class="schedule-footer"><span>Qty. = number of physical cables. Single conductors are grouped in threes when the compartment uses trefoil.</span></div></section>`;
}

function resultsCard() {
  const items = evaluation.results.map(r => {
    const {comp, fill, fit, layout, plan} = r;
    const fillLine = r.status === 'empty' ? 'No cables.' : fill.rule
      ? `NEC ${esc(fill.rule)}: ${fmt(fill.used, 3)} / ${fmt(fill.allowed, 3)} ${esc(fill.unit)} allowed → <strong>${fmt(fill.ratio * 100, 1)}%</strong>`
      : 'No NEC fill rule for this mix of cables. The physical layout governs.';
    const layoutLine = plan.cableCount ? `Layout: ${esc(layout.multi.label)} (multiconductor) · ${esc(layout.single.label)} (single conductor). Uses ${dimension(fit.usedWidthIn)} of ${dimension(comp.widthIn)} clear width and ${dimension(fit.usedHeightIn)} of ${dimension(tray.depthIn)} depth.` : '';
    const notes = [...r.problems.map(p => `<span class="policy-error">${esc(p)}</span>`), ...fill.notes.map(esc)];
    return `<div class="validation-item ${r.status === 'over' ? 'fail' : r.status === 'ok' ? 'pass' : 'review'}"><span class="status-icon">${icon(r.status === 'over' ? 'close' : r.status === 'ok' ? 'check' : 'info')}</span><div><p><strong>${esc(comp.name)}</strong> · ${dimension(comp.widthIn)} clear · ${plan.cableCount} cables · ${fmt(r.weightLbFt, 2)} lb/ft</p><small>${fillLine}${layoutLine ? '<br>' + layoutLine : ''}${notes.length ? '<br>' + notes.join('<br>') : ''}</small></div></div>`;
  }).join('');
  return `<section class="card validation"><div class="card-head"><h2>Sizing check</h2></div><div class="card-body">${items}<p class="config-note">Fill follows NEC 2023 392.22 using catalog outside diameters; D is one cable's outside diameter, gaps are edge to edge. Cable sizing is assumed done elsewhere.</p></div></section>`;
}

function configPanel() {
  const c = tray.compartments.find(x => x.id === selectedComp);
  return `<aside class="card config-card"><div class="card-head"><h2>Tray</h2>${icon('settings')}</div><div class="card-body">`
    + `<div class="form-row">${field('Tray tag', `<input data-tray="trayTag" value="${esc(tray.trayTag)}" maxlength="50">`)}</div>`
    + `<div class="form-row">${field('Inside width', numberInput('widthIn', tray.widthIn, .5, 120, 'any', 'in'))}${field('Usable depth', numberInput('depthIn', tray.depthIn, .25, 24, 'any', 'in'))}</div>`
    + `<div class="form-row">${field('Tray type', `<select data-tray="trayType">${Object.entries(TRAY_TYPES).map(([v, l]) => opt(v, l, tray.trayType)).join('')}</select>`)}</div>`
    + `<div class="form-row">${field('Divider thickness', numberInput('dividerThicknessIn', tray.dividerThicknessIn, 0, 1, 'any', 'in'))}${field('Spare reserve', numberInput('reserve', tray.reserve, 0, 75, '1', '%'))}</div>`
    + `<label class="check"><input type="checkbox" data-tray="covered" ${tray.covered ? 'checked' : ''}>Show cover on the drawing</label>`
    + `<div class="section-line"></div><div class="section-title">Dividers <span class="tiny">centerline from left wall</span></div><div class="divider-block">${tray.dividers.length ? tray.dividers.map((d, i) => `<div class="divider-row"><span class="divider-index">D${i + 1}</span><div class="input-unit"><input aria-label="Divider ${i + 1} position" type="number" step="any" data-divider="${i}" value="${Math.round(d * 10000) / 10000}"><span>in</span></div>${btn('remove-divider', icon('trash'), 'quiet icon-btn', `data-index="${i}" aria-label="Remove divider ${i + 1}"`)}</div>`).join('') : '<div class="tiny muted" style="margin:6px 0 10px">No dividers. The whole tray is one compartment.</div>'}${btn('add-divider', icon('plus') + 'Split selected compartment', 'quiet dashed-btn')}</div>`
    + `<div class="section-line"></div><div class="section-title">Compartment</div><div class="form-row">${field('Selected', `<select data-select-comp>${tray.compartments.map(co => opt(co.id, co.name, selectedComp)).join('')}</select>`)}</div><div class="form-row">${field('Name', `<input data-comp-field="name" data-comp-id="${c.id}" value="${esc(c.name)}" maxlength="40">`)}</div><div class="form-row">${layoutSelect(c, 'multi')}</div><div class="form-row">${layoutSelect(c, 'single')}</div><p class="config-note">Random fill stacks multiconductor cables. Single-layer and flat options lay cables side by side; trefoil groups three single conductors. D = one cable's outside diameter.</p>`
    + `<div class="section-line"></div>${btn('suggest', icon('tray') + 'Suggest tray size', 'lime full-btn')}<p class="config-note">Smallest standard width (6–48 in) at this depth, then deeper trays (3–6 in). Compartment proportions and arrangements are kept.</p></div></aside>`;
}

/* ---------- dividers ---------- */
function addDivider() {
  if (tray.dividers.length >= 11) { toast('Maximum of 12 compartments per tray.'); return; }
  const i = tray.compartments.findIndex(c => c.id === selectedComp);
  const c = compartmentsOf(tray)[i];
  if (c.widthIn < tray.dividerThicknessIn + .5) { toast('This compartment is too narrow to split.'); return; }
  const used = new Set(tray.compartments.map(x => x.name));
  let letter = 0; while (used.has(`Compartment ${String.fromCharCode(65 + letter)}`)) letter++;
  const nextId = uid();
  if (commit(t => {
    t.dividers.splice(i, 0, c.startIn + c.widthIn / 2);
    t.compartments.splice(i + 1, 0, {id: nextId, name: `Compartment ${String.fromCharCode(65 + letter)}`, multiLayout: c.multiLayout, singleLayout: c.singleLayout});
  })) { selectedComp = nextId; render(); toast('Divider added. Existing cables stay in the left compartment.'); }
}
function removeDivider(i) {
  if (!Number.isInteger(i) || i < 0 || i >= tray.dividers.length) return;
  const left = tray.compartments[i], right = tray.compartments[i + 1];
  selectedComp = left.id;
  if (commit(t => {
    t.dividers.splice(i, 1); t.compartments.splice(i + 1, 1);
    t.cables.forEach(r => { if (r.compartmentId === right.id) r.compartmentId = left.id; });
  })) toast(`Divider removed. Cables from ${right.name} moved to ${left.name}.`);
}
function bindTrayDrag() {
  const svg = $('#traySvg'); if (!svg) return;
  svg.addEventListener('pointerdown', e => {
    const handle = e.target.closest('[data-drag-divider]'); if (!handle || e.button !== 0) return;
    e.preventDefault();
    const i = +handle.dataset.dragDivider, rect = svg.getBoundingClientRect(), half = tray.dividerThicknessIn / 2;
    const toX = px => ((px - rect.left) / rect.width * 850 - 52) / 746 * tray.widthIn;
    const min = (i === 0 ? 0 : tray.dividers[i - 1] + half) + half + .25;
    const max = (i === tray.dividers.length - 1 ? tray.widthIn : tray.dividers[i + 1] - half) - half - .25;
    const move = ev => { ev.preventDefault(); tray.dividers[i] = Math.max(min, Math.min(max, toX(ev.clientX))); render(); };
    const stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', stop); document.removeEventListener('pointercancel', stop); render(); };
    document.addEventListener('pointermove', move, {passive: false}); document.addEventListener('pointerup', stop); document.addEventListener('pointercancel', stop);
  });
}

/* ---------- catalog ---------- */
function catalogContent() {
  const voltages = [...new Set(catalog.map(c => c.voltage))].sort((a, b) => a - b);
  const counts = [...new Set(catalog.map(c => c.conductors))].sort((a, b) => a - b);
  return `<div class="catalog-layout"><div class="catalog-main"><div class="catalog-tools"><div class="search-box">${icon('search')}<input type="search" data-filter="q" value="${esc(filter.q)}" placeholder="Search stock, SPEC, AWG/kcmil, insulation…" aria-label="Search catalog"></div></div><div class="filters"><select data-filter="category" aria-label="Application">${opt('', 'All applications', filter.category)}${Object.entries(labels).map(([k, v]) => opt(k, v, filter.category)).join('')}</select><select data-filter="voltage" aria-label="Voltage rating">${opt('', 'All voltages', filter.voltage)}${voltages.map(v => opt(v, voltageText(v), filter.voltage)).join('')}</select><select data-filter="conductors" aria-label="Conductor count">${opt('', 'All conductor counts', filter.conductors)}${counts.map(v => opt(v, v + (v === 1 ? ' conductor' : ' conductors'), filter.conductors)).join('')}</select></div><div data-catalog-results></div></div><aside class="catalog-detail" data-catalog-detail></aside></div>`;
}
function filteredCatalog() {
  const q = filter.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.filter(c => (!filter.category || c.category === filter.category) && (!filter.voltage || c.voltage === +filter.voltage) && (!filter.conductors || c.conductors === +filter.conductors)
    && q.every(t => `${c.stock} ${c.spec} ${cableSize(c)} ${c.title} ${c.insulation} ${c.conductors}C ${labels[c.category]}`.toLowerCase().includes(t)));
}
function updateCatalog(root) {
  const all = filteredCatalog(), pages = Math.max(1, Math.ceil(all.length / 40));
  filter.page = Math.max(0, Math.min(filter.page, pages - 1));
  const items = all.slice(filter.page * 40, filter.page * 40 + 40);
  $('[data-catalog-results]', root).innerHTML = `<div class="catalog-count"><span>${integer(all.length)} items found</span><span>Click a row to add it · click the size for the PDF</span></div><div class="table-wrap"><table class="catalog-table"><thead><tr><th>Cable / application</th><th>SPEC · Stock</th><th>Ø (in)</th><th class="hide-mobile">Voltage</th><th></th></tr></thead><tbody>${items.map(c => `<tr data-select-cable="${esc(c.id)}" class="${selectedCable?.id === c.id ? 'chosen' : ''}" tabindex="0"><td><div class="catalog-size"><span class="category-dot" style="background:${colors[c.category]}"></span><a class="catalog-pdf" href="${esc(pdfOf(c))}" target="_blank" rel="noreferrer" title="Open Southwire PDF data sheet (SPEC ${esc(c.spec)})">${esc(cableSize(c))} <span aria-hidden="true">↗</span></a></div><div class="title-wrap muted">${esc(c.title)}</div></td><td class="mono">${esc(c.spec)}<div class="cable-sub">${esc(c.stock || '—')}</div></td><td class="mono">${fmt(c.odIn, 3)}</td><td class="hide-mobile mono">${voltageText(c.voltage)}</td><td>${icon('plus')}</td></tr>`).join('')}</tbody></table>${items.length ? '' : '<div class="empty-state">No items match these filters.</div>'}</div><div class="pagination">${btn('catalog-prev', icon('chevron'), 'icon-btn flip', `${filter.page === 0 ? 'disabled' : ''} aria-label="Previous page"`)}<span>${filter.page + 1} / ${pages}</span>${btn('catalog-next', icon('chevron'), 'icon-btn', `${filter.page === pages - 1 ? 'disabled' : ''} aria-label="Next page"`)}</div>`;
}
function renderCatalogDetail(root) {
  const c = selectedCable, el = $('[data-catalog-detail]', root);
  if (!c) { el.innerHTML = `<span class="brand-symbol">${icon('cable')}</span><h3>Choose a cable</h3><p class="description">Select a catalog row, then set the quantity and the compartment. Add as many cable types as you need; this window stays open.</p>${lastAdded ? `<p class="added-note">${icon('check')}${esc(lastAdded)}</p>` : ''}`; return; }
  const single = c.conductors === 1;
  el.innerHTML = `<span class="pill neutral">${esc(labels[c.category])} · SPEC ${esc(c.spec)}</span><h3>${esc(cableSize(c))}</h3><p class="description">${esc(c.title)}</p><div class="specs"><div><small>OUTSIDE DIAMETER</small><strong class="mono">${dimension(c.odIn)}</strong></div><div><small>VOLTAGE RATING</small><strong>${voltageText(c.voltage)}</strong></div><div><small>NOMINAL WEIGHT</small><strong>${c.weightLbKft != null ? fmt(c.weightLbKft / 1000, 3) + ' lb/ft' : '—'}</strong></div><div><small>STOCK</small><strong class="mono">${esc(c.stock || '—')}</strong></div></div><div class="flex links"><a href="${esc(pdfOf(c))}" target="_blank" rel="noreferrer">Southwire PDF ↗</a><a href="${esc(c.sourceUrl)}" target="_blank" rel="noreferrer">Product page ↗</a></div><div class="section-line"></div><div class="form-row">${field('Compartment', `<select name="newComp">${tray.compartments.map(co => opt(co.id, co.name, selectedComp)).join('')}</select>`)}</div><div class="form-row">${field('Quantity (cables)', `<input name="newQty" type="number" min="1" max="9999" step="1" value="${single ? 3 : 1}">`)}</div>${single ? '<p class="config-note">Single conductor: each 3 cables form one trefoil when the compartment uses a trefoil arrangement.</p>' : ''}${btn('add-cable', icon('plus') + 'Add to tray', 'primary full-btn')}${lastAdded ? `<p class="added-note">${icon('check')}${esc(lastAdded)}</p>` : ''}`;
}
function addCable(root) {
  if (!selectedCable) return;
  const qty = Number($('[name="newQty"]', root)?.value), compartmentId = $('[name="newComp"]', root)?.value;
  if (!Number.isInteger(qty) || qty < 1 || qty > 9999) { lastAdded = ''; renderCatalogDetail(root); $('[name="newQty"]', root).focus(); return; }
  const comp = tray.compartments.find(c => c.id === compartmentId);
  if (commit(t => {
    const existing = t.cables.find(r => r.cable.id === selectedCable.id && r.compartmentId === compartmentId);
    if (existing) existing.qty = Math.min(9999, existing.qty + qty);
    else t.cables.push({id: uid(), cable: cableSnapshot(selectedCable), qty, compartmentId});
  })) {
    selectedComp = compartmentId;
    lastAdded = `Added ${qty} × ${cableSize(selectedCable)} to ${comp?.name}.`;
    renderCatalogDetail(root);
  }
}
function openCatalog() {
  const d = $('#catalogDialog');
  lastAdded = '';
  d.innerHTML = `<div class="dialog-header"><div><h2>Add cables</h2><p>Southwire catalog · ${integer(catalog.length)} copper items · multiconductor up to 2/0 AWG</p></div>${btn('close-catalog', icon('close'), 'quiet icon-btn', 'aria-label="Close catalog"')}</div>${catalogContent()}`;
  updateCatalog(d); renderCatalogDetail(d); d.showModal(); $('[data-filter="q"]', d).focus();
}

/* ---------- dialogs ---------- */
function smallDialog(title, body, actionLabel, onSubmit) {
  const d = $('#smallDialog'); smallHandler = onSubmit;
  d.innerHTML = `<div class="dialog-header"><h2>${title}</h2>${btn('close-small', icon('close'), 'quiet icon-btn', 'aria-label="Close"')}</div><form id="smallForm"><div class="small-body">${body}<p class="form-error" role="alert"></p></div><div class="small-footer">${btn('close-small', 'Cancel', '', 'type="button"')}<button class="primary" type="submit">${actionLabel}</button></div></form>`;
  if (!d.open) d.showModal();
  $('button[type="submit"]', d)?.focus();
}
function suggest() {
  const found = suggestSize(tray);
  if (!found) {
    smallDialog('Suggested tray size', `<p>${tray.cables.length ? 'No standard tray up to 48 × 6 in fits these cables with the current dividers, arrangements and spare reserve. Try more compartments, another arrangement or a lower reserve, or enter a larger width manually.' : 'Add cables first.'}</p>`, 'OK', () => {});
    return;
  }
  const t = found.tray;
  smallDialog('Suggested tray size', `<div class="suggested-width">${fmt(t.widthIn, 0)} × ${fmt(t.depthIn, 2).replace(/\.00$/, '')} in</div><p>Smallest standard size that fits every compartment${tray.reserve ? ` with ${fmt(tray.reserve, 0)}% spare reserve` : ''}.</p><ul>${found.evaluation.results.map(r => `<li>${esc(r.comp.name)}: ${dimension(r.comp.widthIn)} clear · ${r.fill.rule ? fmt(r.fill.ratio * 100, 1) + '% NEC fill' : 'layout only'} · layout ${dimension(r.fit.usedWidthIn)}</li>`).join('')}</ul>`, 'Apply size', () => { commit(() => t); toast(`Tray set to ${fmt(t.widthIn, 0)} × ${fmt(t.depthIn, 2).replace(/\.00$/, '')} in.`); });
}

const actions = {
  'catalog': openCatalog,
  'close-catalog': () => $('#catalogDialog').close(),
  'close-small': () => $('#smallDialog').close(),
  'add-cable': el => addCable(el.closest('#catalogDialog')),
  'catalog-prev': el => { filter.page--; updateCatalog(el.closest('#catalogDialog')); },
  'catalog-next': el => { filter.page++; updateCatalog(el.closest('#catalogDialog')); },
  'add-divider': addDivider,
  'remove-divider': el => removeDivider(+el.dataset.index),
  'delete-row': el => { commit(t => { t.cables = t.cables.filter(r => r.id !== el.dataset.id); }); },
  'suggest': suggest,
  'print': () => window.print(),
  'clear': () => smallDialog('Clear tray', '<p>Remove all cables and dividers and reset the tray to its defaults?</p>', 'Clear', () => { tray = blankTray(uid); selectedComp = tray.compartments[0].id; render(); toast('Tray cleared.'); })
};

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  if (action) { event.preventDefault(); actions[action.dataset.action]?.(action); return; }
  if (event.target.closest('a[href], select, input, label')) return;
  const comp = event.target.closest('[data-comp]');
  if (comp) { selectedComp = comp.dataset.comp; render(); return; }
  const row = event.target.closest('[data-select-cable]');
  if (row) { const root = row.closest('#catalogDialog'); selectedCable = catalog.find(c => c.id === row.dataset.selectCable); lastAdded = ''; updateCatalog(root); renderCatalogDetail(root); if (matchMedia('(max-width:580px)').matches) $('[data-catalog-detail]', root).scrollIntoView({behavior: 'smooth', block: 'start'}); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-comp],[data-select-cable]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-filter="q"]')) { filter.q = e.target.value; filter.page = 0; updateCatalog(e.target.closest('#catalogDialog')); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.matches('[data-filter]')) { filter[el.dataset.filter] = el.value; filter.page = 0; updateCatalog(el.closest('#catalogDialog')); return; }
  if (el.matches('[data-tray]')) {
    const key = el.dataset.tray;
    if (el.type === 'number' && (el.value === '' || !el.checkValidity())) { toast('Enter a value within the limits shown.'); render(); return; }
    const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
    commit(t => key === 'widthIn' ? resizeTray(t, value) : void (t[key] = value));
    return;
  }
  if (el.matches('[data-divider]')) { commit(t => { t.dividers[+el.dataset.divider] = Number(el.value); }); return; }
  if (el.matches('[data-select-comp]')) { selectedComp = el.value; render(); return; }
  if (el.matches('[data-comp-field]')) {
    const id = el.dataset.compId, key = el.dataset.compField, compact = el.hasAttribute('data-compact');
    selectedComp = id;
    if (commit(t => { t.compartments.find(c => c.id === id)[key] = el.value.trim(); })) {
      [...document.querySelectorAll(`[data-comp-id="${id}"][data-comp-field="${key}"]`)].find(x => x.hasAttribute('data-compact') === compact)?.focus({preventScroll: true});
    }
    return;
  }
  if (el.matches('[data-row]')) {
    const value = el.dataset.key === 'qty' ? Number(el.value) : el.value;
    commit(t => { t.cables.find(r => r.id === el.dataset.row)[el.dataset.key] = value; });
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'smallForm') return;
  e.preventDefault();
  try { if (smallHandler?.(e.target) !== false) $('#smallDialog').close(); } catch (error) { $('.form-error', e.target).textContent = error.message; }
});

async function start() {
  try {
    [catalog, meta] = await Promise.all(['catalog.json', 'catalog-metadata.json'].map(async path => { const r = await fetch(path); if (!r.ok) throw new Error('Unable to load ' + path); return r.json(); }));
    try { const raw = localStorage.getItem(STORE); if (raw) tray = validateTray(JSON.parse(raw)); } catch { tray = null; }
    tray ||= blankTray(uid);
    selectedComp = tray.compartments[0].id;
    render();
  } catch (error) {
    $('#app').innerHTML = `<div class="boot"><h1>TrayLab</h1><p>${esc(error.message)}</p><button onclick="location.reload()">Try again</button></div>`;
  }
}
start();
