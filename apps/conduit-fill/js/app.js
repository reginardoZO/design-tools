import {
  calculateConduitFill,
  NEC_PVC_SCH40_CONDUITS,
  SUPPORTED_CONDUIT_SIZES,
} from './engine.js';

const FALLBACK_CABLES = {
  single_lv: [
    { id: '1c-lv-14', size: '14 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.111, label: '14 AWG · 1/C Single (Cu THHN, 600V)' },
    { id: '1c-lv-12', size: '12 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.130, label: '12 AWG · 1/C Single (Cu THHN, 600V)' },
    { id: '1c-lv-10', size: '10 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.164, label: '10 AWG · 1/C Single (Cu THHN, 600V)' },
    { id: '1c-lv-8', size: '8 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.278, label: '8 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-6', size: '6 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.342, label: '6 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-4', size: '4 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.390, label: '4 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-2', size: '2 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.455, label: '2 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-1', size: '1 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.536, label: '1 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-1-0', size: '1/0 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.578, label: '1/0 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-2-0', size: '2/0 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.622, label: '2/0 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-3-0', size: '3/0 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.663, label: '3/0 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-4-0', size: '4/0 AWG', voltage: '600V', type: 'single', cores: 1, od: 0.728, label: '4/0 AWG · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-250', size: '250 kcmil', voltage: '600V', type: 'single', cores: 1, od: 0.836, label: '250 kcmil · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-350', size: '350 kcmil', voltage: '600V', type: 'single', cores: 1, od: 0.939, label: '350 kcmil · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-500', size: '500 kcmil', voltage: '600V', type: 'single', cores: 1, od: 1.062, label: '500 kcmil · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-600', size: '600 kcmil', voltage: '600V', type: 'single', cores: 1, od: 1.203, label: '600 kcmil · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-750', size: '750 kcmil', voltage: '600V', type: 'single', cores: 1, od: 1.278, label: '750 kcmil · 1/C Single (Cu XHHW-2, 600V)' },
    { id: '1c-lv-1000', size: '1000 kcmil', voltage: '600V', type: 'single', cores: 1, od: 1.443, label: '1000 kcmil · 1/C Single (Cu XHHW-2, 600V)' },
  ],
  single_mv: [
    { id: '1c-mv-2', size: '2 AWG', voltage: '15kV', type: 'mv', cores: 1, od: 0.986, label: '2 AWG · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-1', size: '1 AWG', voltage: '15kV', type: 'mv', cores: 1, od: 1.016, label: '1 AWG · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-1-0', size: '1/0 AWG', voltage: '15kV', type: 'mv', cores: 1, od: 1.054, label: '1/0 AWG · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-2-0', size: '2/0 AWG', voltage: '15kV', type: 'mv', cores: 1, od: 1.094, label: '2/0 AWG · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-3-0', size: '3/0 AWG', voltage: '15kV', type: 'mv', cores: 1, od: 1.140, label: '3/0 AWG · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-4-0', size: '4/0 AWG', voltage: '15kV', type: 'mv', cores: 1, od: 1.193, label: '4/0 AWG · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-250', size: '250 kcmil', voltage: '15kV', type: 'mv', cores: 1, od: 1.246, label: '250 kcmil · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-350', size: '350 kcmil', voltage: '15kV', type: 'mv', cores: 1, od: 1.342, label: '350 kcmil · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-500', size: '500 kcmil', voltage: '15kV', type: 'mv', cores: 1, od: 1.470, label: '500 kcmil · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-600', size: '600 kcmil', voltage: '15kV', type: 'mv', cores: 1, od: 1.548, label: '600 kcmil · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-750', size: '750 kcmil', voltage: '15kV', type: 'mv', cores: 1, od: 1.735, label: '750 kcmil · 1/C Shielded MV (15kV EPR)' },
    { id: '1c-mv-1000', size: '1000 kcmil', voltage: '15kV', type: 'mv', cores: 1, od: 1.856, label: '1000 kcmil · 1/C Shielded MV (15kV EPR)' },
  ],
  multi_lv: [
    { id: '3c-lv-12', size: '3x #12 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 0.469, label: '3x #12 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-10', size: '3x #10 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 0.560, label: '3x #10 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-8', size: '3x #8 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 0.724, label: '3x #8 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-6', size: '3x #6 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 0.816, label: '3x #6 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-4', size: '3x #4 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 0.936, label: '3x #4 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-2', size: '3x #2 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 1.123, label: '3x #2 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-1', size: '3x #1 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 1.279, label: '3x #1 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-1-0', size: '3x 1/0 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 1.357, label: '3x 1/0 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-2-0', size: '3x 2/0 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 1.464, label: '3x 2/0 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-4-0', size: '3x 4/0 AWG', voltage: '600V', type: 'multiconductor', cores: 4, od: 1.740, label: '3x 4/0 AWG + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-250', size: '3x 250 kcmil', voltage: '600V', type: 'multiconductor', cores: 4, od: 1.939, label: '3x 250 kcmil + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-350', size: '3x 350 kcmil', voltage: '600V', type: 'multiconductor', cores: 4, od: 2.202, label: '3x 350 kcmil + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-500', size: '3x 500 kcmil', voltage: '600V', type: 'multiconductor', cores: 4, od: 2.580, label: '3x 500 kcmil + 1 GND · 3/C MC/TC (600V)' },
    { id: '3c-lv-600', size: '3x 600 kcmil', voltage: '600V', type: 'multiconductor', cores: 4, od: 2.790, label: '3x 600 kcmil + 1 GND · 3/C MC/TC (600V)' },
  ],
  multi_vfd: [
    { id: 'vfd-14', size: '3x #14 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 0.571, label: '3x #14 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-12', size: '3x #12 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 0.606, label: '3x #12 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-10', size: '3x #10 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 0.657, label: '3x #10 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-8', size: '3x #8 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 0.772, label: '3x #8 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-6', size: '3x #6 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 0.883, label: '3x #6 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-4', size: '3x #4 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 0.985, label: '3x #4 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-2', size: '3x #2 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 1.106, label: '3x #2 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-1-0', size: '3x 1/0 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 1.380, label: '3x 1/0 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-2-0', size: '3x 2/0 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 1.471, label: '3x 2/0 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-3-0', size: '3x 3/0 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 1.579, label: '3x 3/0 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-4-0', size: '3x 4/0 AWG', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 1.736, label: '3x 4/0 AWG + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-250', size: '3x 250 kcmil', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 1.895, label: '3x 250 kcmil + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-350', size: '3x 350 kcmil', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 2.109, label: '3x 350 kcmil + 3 GND · VFD 3/C Shielded' },
    { id: 'vfd-500', size: '3x 500 kcmil', voltage: '600V/2kV', type: 'multiconductor', cores: 6, od: 2.379, label: '3x 500 kcmil + 3 GND · VFD 3/C Shielded' },
  ],
  ground: [
    { id: 'gnd-14', size: '14 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.111, label: '14 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-12', size: '12 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.130, label: '12 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-10', size: '10 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.164, label: '10 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-8', size: '8 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.204, label: '8 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-6', size: '6 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.249, label: '6 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-4', size: '4 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.320, label: '4 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-3', size: '3 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.355, label: '3 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-2', size: '2 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.384, label: '2 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-1', size: '1 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.441, label: '1 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-1-0', size: '1/0 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.482, label: '1/0 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-2-0', size: '2/0 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.526, label: '2/0 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-3-0', size: '3/0 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.571, label: '3/0 AWG · Ground (Cu THHN/THWN-2)' },
    { id: 'gnd-4-0', size: '4/0 AWG', voltage: '600V', type: 'ground', cores: 1, od: 0.625, label: '4/0 AWG · Ground (Cu THHN/THWN-2)' },
  ],
};

const CATEGORIES = [
  { key: 'single_lv', label: 'Single Conductors (1/C · LV 600V)' },
  { key: 'single_mv', label: 'Single Conductors (1/C Shielded · MV 15kV)' },
  { key: 'multi_lv', label: 'Multiconductor (3/C · LV 600V Power)' },
  { key: 'multi_vfd', label: 'Multiconductor (3/C Shielded · VFD)' },
  { key: 'ground', label: 'Grounding / EGC (1/C · Cu THHN/THWN-2)' },
];

const $ = (selector) => document.querySelector(selector);
const rows = $('#cable-rows');
const addRowButton = $('#add-row');

let cableDb = FALLBACK_CABLES;
let allCablesList = [];
let conduits = [];
let selectedSize = '3';

const format = (value, digits = 3) => `${value.toFixed(digits)} in²`;
const inch = (value) => `${value.toFixed(3)} in`;

function flattenCables(db) {
  const list = [];
  for (const cat of CATEGORIES) {
    if (db[cat.key]) {
      list.push(...db[cat.key]);
    }
  }
  return list;
}

function getBadgeHtml(cable, isCustom) {
  if (isCustom) return '<span class="type-badge badge-custom">Custom</span>';
  if (!cable) return '<span class="type-badge">-</span>';
  if (cable.type === 'multiconductor') return '<span class="type-badge badge-multi">3/C Multi</span>';
  if (cable.type === 'mv') return '<span class="type-badge badge-mv">1/C MV</span>';
  if (cable.type === 'ground') return '<span class="type-badge badge-ground">1/C GND</span>';
  return '<span class="type-badge badge-single">1/C Single</span>';
}

function populateSelect(select) {
  select.innerHTML = '';
  select.append(new Option('Select a cable', ''));

  for (const cat of CATEGORIES) {
    const items = cableDb[cat.key] || [];
    if (items.length === 0) continue;
    const group = document.createElement('optgroup');
    group.label = cat.label;
    for (const cable of items) {
      group.append(new Option(cable.label || `${cable.size} (${cable.od} in)`, cable.id));
    }
    select.append(group);
  }

  const customGroup = document.createElement('optgroup');
  customGroup.label = 'Custom';
  customGroup.append(new Option('Custom outer diameter...', 'custom'));
  select.append(customGroup);
}

function addCableRow(initialCableId = '1c-lv-500', initialQuantity = 3) {
  const row = document.createElement('div');
  row.className = 'cable-row';
  row.innerHTML = `
    <input class="quantity" type="number" min="0" step="1" value="${initialQuantity}" aria-label="Cable quantity">
    <select class="cable" aria-label="Cable"></select>
    <div class="badge-slot"></div>
    <div class="diameter-slot"></div>
    <button class="remove-row" type="button" title="Remove cable" aria-label="Remove cable">&times;</button>
  `;

  const select = row.querySelector('.cable');
  populateSelect(select);
  select.value = initialCableId || '1c-lv-500';

  const badgeSlot = row.querySelector('.badge-slot');
  const diameterSlot = row.querySelector('.diameter-slot');
  const qtyInput = row.querySelector('.quantity');

  const update = () => {
    const isCustom = select.value === 'custom';
    const cable = allCablesList.find((c) => c.id === select.value);

    badgeSlot.innerHTML = getBadgeHtml(cable, isCustom);

    if (isCustom) {
      diameterSlot.innerHTML = `<input class="diameter-input" type="number" min="0.01" max="10" step="0.001" value="0.750" placeholder="OD (in)" aria-label="Custom diameter">`;
      const customInput = diameterSlot.querySelector('.diameter-input');
      customInput.addEventListener('input', renderResults);
    } else {
      diameterSlot.innerHTML = `<span class="diameter">${cable ? `${cable.od.toFixed(3)} in` : '-'}</span>`;
    }

    renderResults();
  };

  qtyInput.addEventListener('input', renderResults);
  select.addEventListener('change', () => {
    const cable = allCablesList.find((c) => c.id === select.value);
    // Auto-adjust default quantity suggestion: 3 for 1/C Single, 1 for 3/C Multi
    if (cable && cable.type === 'multiconductor' && qtyInput.value === '3') {
      qtyInput.value = '1';
    } else if (cable && cable.type === 'single' && qtyInput.value === '1') {
      qtyInput.value = '3';
    }
    update();
  });

  row.querySelector('.remove-row').addEventListener('click', () => {
    row.remove();
    renderResults();
  });

  rows.append(row);
  update();
}

function currentCableRows() {
  return [...rows.querySelectorAll('.cable-row')].map((row) => {
    const select = row.querySelector('.cable');
    const isCustom = select.value === 'custom';
    const cable = allCablesList.find((c) => c.id === select.value);
    const quantity = Math.max(0, Number.parseInt(row.querySelector('.quantity').value, 10) || 0);

    let diameter = 0;
    if (isCustom) {
      const customInput = row.querySelector('.diameter-input');
      diameter = customInput ? Number.parseFloat(customInput.value) || 0 : 0;
    } else {
      diameter = cable?.od || 0;
    }

    return {
      quantity,
      diameter,
      type: isCustom ? 'custom' : cable?.type || 'single',
      cores: isCustom ? 1 : cable?.cores || 1,
    };
  });
}

function renderSizeButtons() {
  const container = $('#size-buttons');
  container.innerHTML = '';
  for (const size of SUPPORTED_CONDUIT_SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `size-button${size === selectedSize ? ' active' : ''}`;
    button.textContent = `${size} in`;
    button.addEventListener('click', () => {
      selectedSize = size;
      renderSizeButtons();
      renderResults();
    });
    container.append(button);
  }
}

function metric(label, value) {
  return `<dt>${label}</dt><dd>${value}</dd>`;
}

function renderSelected(result) {
  const status = $('#status');
  const metrics = $('#metrics');
  const note = $('#result-note');
  const jammingBanner = $('#jamming-banner');

  if (!result.cableCount) {
    status.className = 'status empty';
    status.textContent = 'Add cables';
    if (jammingBanner) jammingBanner.innerHTML = '';
    metrics.innerHTML =
      metric('Conduit inside Ø', inch(result.insideDiameter)) +
      metric('Internal area', format(result.conduitArea)) +
      metric('Allowed fill', 'Waiting for cables');
    note.textContent = 'Select cables above. Note: Multiconductor cables (3/C) count as 1 cable under NEC Note 9.';
    return;
  }

  status.className = `status ${result.fits ? 'ok' : 'fail'}`;
  status.textContent = result.fits ? 'Fits in conduit' : 'Does not fit in conduit';

  // Jamming Alert rendering
  if (jammingBanner) {
    if (result.jamming && result.jamming.applies) {
      const jStatus = result.jamming.status;
      const title =
        jStatus === 'critical'
          ? '⚠ High Jamming Risk in Bends'
          : jStatus === 'caution'
            ? 'ℹ Caution: Jamming Proximity'
            : '✔ Jamming Ratio Safe';
      jammingBanner.innerHTML = `
        <div class="jamming-alert ${jStatus}">
          <strong>${title}</strong>
          ${result.jamming.message}
        </div>
      `;
    } else {
      jammingBanner.innerHTML = '';
    }
  }

  const metricItems = [
    metric('Total cables in conduit', `${result.cableCount} cable${result.cableCount > 1 ? 's' : ''}`),
    metric('Total internal conductors', String(result.totalConductors)),
    metric('Conduit inside Ø (D)', inch(result.insideDiameter)),
    metric('Conduit internal area', format(result.conduitArea)),
    metric('Allowed fill limit', `${(result.fillFactor * 100).toFixed(0)}% / ${format(result.allowedArea)}`),
    metric('Used area', format(result.usedArea)),
    metric(result.fits ? 'Available remaining area' : 'Fill overage', format(Math.abs(result.remainingArea))),
  ];

  if (result.jamming && result.jamming.applies) {
    metricItems.push(metric('Jamming Ratio (D/d)', result.jamming.ratio.toFixed(2)));
  }

  metrics.innerHTML = metricItems.join('');

  note.textContent = result.fits
    ? `${result.fillPercent.toFixed(1)}% of the internal area is occupied (${(result.fillFactor * 100).toFixed(0)}% allowed max).`
    : `Calculated fill is ${result.fillPercent.toFixed(1)}% of the internal area and exceeds the applicable ${(result.fillFactor * 100).toFixed(0)}% limit.`;
}

function renderSummary(results) {
  $('#summary-body').innerHTML = results
    .map(({ conduit, result }) => {
      const selected = conduit.Size === selectedSize ? 'selected' : '';
      if (!result.cableCount) {
        return `<tr class="${selected}">
          <td>${conduit.Size} in</td>
          <td>${inch(result.insideDiameter)}</td>
          <td>${format(result.conduitArea)}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td class="not-calculated">Waiting</td>
        </tr>`;
      }

      let statusHtml = result.fits
        ? '<span class="fit">FITS</span>'
        : '<span class="no-fit">DOES NOT FIT</span>';

      if (result.jamming && result.jamming.status === 'critical') {
        statusHtml += ' <small title="Jamming risk in bends" style="color:#e11d48;font-weight:bold;">(JAM!)</small>';
      }

      return `<tr class="${selected}">
        <td>${conduit.Size} in</td>
        <td>${inch(result.insideDiameter)}</td>
        <td>${format(result.conduitArea)}</td>
        <td>${format(result.allowedArea)} (${(result.fillFactor * 100).toFixed(0)}%)</td>
        <td>${format(result.usedArea)}</td>
        <td>${format(Math.max(result.remainingArea, 0))}</td>
        <td>${statusHtml}</td>
      </tr>`;
    })
    .join('');
}

function renderResults() {
  const cableRows = currentCableRows();
  const results = conduits.map((conduit) => ({
    conduit,
    result: calculateConduitFill(conduit, cableRows),
  }));
  renderSelected(results.find(({ conduit }) => conduit.Size === selectedSize).result);
  renderSummary(results);
}

async function initialize() {
  try {
    const response = await fetch('data/cables.json');
    if (response.ok) {
      const data = await response.json();
      cableDb = data;
    }
  } catch (err) {
    console.warn('Using fallback cables dataset:', err);
  }

  allCablesList = flattenCables(cableDb);
  conduits = SUPPORTED_CONDUIT_SIZES.map((size) => NEC_PVC_SCH40_CONDUITS[size]);

  renderSizeButtons();
  addCableRow('1c-lv-500', 3);
  addRowButton.addEventListener('click', () => addCableRow('1c-lv-500', 3));
}

initialize().catch((error) => {
  $('#status').className = 'status fail';
  $('#status').textContent = 'Data loading error';
  $('#result-note').textContent = error.message;
});