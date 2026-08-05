import { calculateConduitFill, NEC_PVC_SCH40_CONDUITS, SUPPORTED_CONDUIT_SIZES } from './engine.js';

const $ = (selector) => document.querySelector(selector);
const rows = $('#cable-rows');
const addRowButton = $('#add-row');
let cables = [];
let conduits = [];
let selectedSize = '3';
const format = (value, digits = 3) => `${value.toFixed(digits)} in²`;
const inch = (value) => `${value.toFixed(3)} in`;
function selectedCable(select) { return cables.find((cable) => cable.id === select.value); }
function addCableRow(initialCableId = '', initialQuantity = 1) {
  const row = document.createElement('div'); row.className = 'cable-row';
  row.innerHTML = `<input class="quantity" type="number" min="0" step="1" value="${initialQuantity}" aria-label="Cable quantity"><select class="cable" aria-label="Cable"></select><span class="diameter">-</span><button class="remove-row" type="button" title="Remove cable" aria-label="Remove cable">&times;</button>`;
  const select = row.querySelector('.cable'); select.append(new Option('Select a cable', ''));
  for (const cable of cables) select.append(new Option(cable.label, cable.id));
  select.value = initialCableId || cables[0]?.id || '';
  const update = () => { const cable = selectedCable(select); row.querySelector('.diameter').textContent = cable ? `${cable.od.toFixed(3)} in` : '-'; renderResults(); };
  row.querySelector('.quantity').addEventListener('input', renderResults); select.addEventListener('change', update);
  row.querySelector('.remove-row').addEventListener('click', () => { row.remove(); renderResults(); }); rows.append(row); update();
}
function currentCableRows() { return [...rows.querySelectorAll('.cable-row')].map((row) => { const cable = selectedCable(row.querySelector('.cable')); return { quantity: Math.max(0, Number.parseInt(row.querySelector('.quantity').value, 10) || 0), diameter: cable?.od || 0 }; }); }
function renderSizeButtons() { const container = $('#size-buttons'); container.innerHTML = ''; for (const size of SUPPORTED_CONDUIT_SIZES) { const button = document.createElement('button'); button.type = 'button'; button.className = `size-button${size === selectedSize ? ' active' : ''}`; button.textContent = `${size} in`; button.addEventListener('click', () => { selectedSize = size; renderSizeButtons(); renderResults(); }); container.append(button); } }
function metric(label, value) { return `<dt>${label}</dt><dd>${value}</dd>`; }
function renderSelected(result) {
  const status = $('#status'); const metrics = $('#metrics'); const note = $('#result-note');
  if (!result.conductorCount) { status.className = 'status empty'; status.textContent = 'Add cables'; metrics.innerHTML = metric('Internal area', format(result.conduitArea)) + metric('Allowed fill', 'Waiting for cables'); note.textContent = 'The fill rule is selected automatically from the total number of cables.'; return; }
  status.className = `status ${result.fits ? 'ok' : 'fail'}`; status.textContent = result.fits ? 'Fits in conduit' : 'Does not fit in conduit';
  metrics.innerHTML = [metric('Total cables', String(result.conductorCount)), metric('Inside diameter', inch(result.insideDiameter)), metric('Internal area', format(result.conduitArea)), metric('Allowed fill', `${(result.fillFactor * 100).toFixed(0)}% / ${format(result.allowedArea)}`), metric('Used area', format(result.usedArea)), metric(result.fits ? 'Available space' : 'Fill overage', format(Math.abs(result.remainingArea)))].join('');
  note.textContent = result.fits ? `${result.fillPercent.toFixed(1)}% of the internal area is occupied.` : `Calculated fill is ${result.fillPercent.toFixed(1)}% of the internal area and exceeds the applicable limit.`;
}
function renderSummary(results) { $('#summary-body').innerHTML = results.map(({ conduit, result }) => { const selected = conduit.Size === selectedSize ? 'selected' : ''; if (!result.conductorCount) return `<tr class="${selected}"><td>${conduit.Size} in</td><td>${inch(result.insideDiameter)}</td><td>${format(result.conduitArea)}</td><td>-</td><td>-</td><td>-</td><td class="not-calculated">Waiting</td></tr>`; const status = result.fits ? '<span class="fit">FITS</span>' : '<span class="no-fit">DOES NOT FIT</span>'; return `<tr class="${selected}"><td>${conduit.Size} in</td><td>${inch(result.insideDiameter)}</td><td>${format(result.conduitArea)}</td><td>${format(result.allowedArea)} (${(result.fillFactor * 100).toFixed(0)}%)</td><td>${format(result.usedArea)}</td><td>${format(Math.max(result.remainingArea, 0))}</td><td>${status}</td></tr>`; }).join(''); }
function renderResults() { const cableRows = currentCableRows(); const results = conduits.map((conduit) => ({ conduit, result: calculateConduitFill(conduit, cableRows) })); renderSelected(results.find(({ conduit }) => conduit.Size === selectedSize).result); renderSummary(results); }
async function initialize() {
  const response = await fetch('../neher/data/cables.json'); if (!response.ok) throw new Error('Unable to load the cable database.'); const data = await response.json();
  conduits = SUPPORTED_CONDUIT_SIZES.map((size) => NEC_PVC_SCH40_CONDUITS[size]);
  cables = [...data.low_voltage.map((cable, index) => ({ id: `lv-${index}`, label: `LV · ${cable.size} ${Number(cable.size) >= 250 ? 'kcmil' : 'AWG'}`, od: cable.OD })), ...data.medium_voltage.map((cable, index) => ({ id: `mv-${index}`, label: `MV · ${cable.size} ${Number(cable.size) >= 250 ? 'kcmil' : 'AWG'}`, od: cable.OD }))].filter((cable) => cable.od > 0);
  renderSizeButtons(); addCableRow(); addRowButton.addEventListener('click', () => addCableRow());
}
initialize().catch((error) => { $('#status').className = 'status fail'; $('#status').textContent = 'Data loading error'; $('#result-note').textContent = error.message; });