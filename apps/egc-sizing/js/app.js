/**
 * Equipment Grounding Conductor Sizing — NEC Table 250.122
 *
 * Given the rating (or setting) of the overcurrent device ahead of the
 * equipment/raceway (or the ampacity of the circuit conductors), finds the
 * minimum copper or aluminum equipment grounding conductor size.
 */

// ==================== TABLE 250.122 ====================
// Each row: OCPD rating not exceeding X amperes -> minimum EGC size.
const TABLE_250_122 = [
  { amp: 15, cu: '14 AWG', al: '12 AWG' },
  { amp: 20, cu: '12 AWG', al: '10 AWG' },
  { amp: 30, cu: '10 AWG', al: '8 AWG' },
  { amp: 40, cu: '10 AWG', al: '8 AWG' },
  { amp: 60, cu: '10 AWG', al: '8 AWG' },
  { amp: 100, cu: '8 AWG', al: '6 AWG' },
  { amp: 200, cu: '6 AWG', al: '4 AWG' },
  { amp: 300, cu: '4 AWG', al: '2 AWG' },
  { amp: 400, cu: '3 AWG', al: '1 AWG' },
  { amp: 500, cu: '2 AWG', al: '1/0 AWG' },
  { amp: 600, cu: '1 AWG', al: '2/0 AWG' },
  { amp: 800, cu: '1/0 AWG', al: '3/0 AWG' },
  { amp: 1000, cu: '2/0 AWG', al: '4/0 AWG' },
  { amp: 1200, cu: '3/0 AWG', al: '250 kcmil' },
  { amp: 1600, cu: '4/0 AWG', al: '350 kcmil' },
  { amp: 2000, cu: '250 kcmil', al: '400 kcmil' },
  { amp: 2500, cu: '350 kcmil', al: '600 kcmil' },
  { amp: 3000, cu: '400 kcmil', al: '600 kcmil' },
  { amp: 4000, cu: '500 kcmil', al: '800 kcmil' },
  { amp: 5000, cu: '700 kcmil', al: '1200 kcmil' },
  { amp: 6000, cu: '800 kcmil', al: '1200 kcmil' },
];

// ==================== DOM SELECTORS ====================

const els = {
  ocpdRating: document.getElementById('ocpdRating'),
  material: document.getElementById('material'),
  sizeResult: document.getElementById('sizeResult'),
  detailRating: document.getElementById('detailRating'),
  detailMaterial: document.getElementById('detailMaterial'),
  refTableBody: document.querySelector('#refTable tbody'),
};

// ==================== CALCULATION ====================

/**
 * Finds the table row to use: the smallest listed rating not less than the
 * given ampere value.
 * @param {number} amps
 * @returns {{ row: object, index: number } | null}
 */
function findRow(amps) {
  for (let i = 0; i < TABLE_250_122.length; i++) {
    if (amps <= TABLE_250_122[i].amp) return { row: TABLE_250_122[i], index: i };
  }
  return null;
}

function getMaterialLabel(material) {
  return material === 'al' ? 'Aluminum / Copper-clad Aluminum' : 'Copper';
}

// ==================== UI UPDATE ====================

function renderReferenceTable(highlightIndex) {
  els.refTableBody.innerHTML = TABLE_250_122
    .map((row, i) => `
      <tr class="${i === highlightIndex ? 'hit' : ''}">
        <td>${row.amp}</td>
        <td>${row.cu}</td>
        <td>${row.al}</td>
      </tr>
    `)
    .join('');
}

function update() {
  const amps = parseFloat(els.ocpdRating.value);
  const material = els.material.value;

  if (!Number.isFinite(amps) || amps <= 0) {
    els.sizeResult.textContent = '—';
    els.detailRating.textContent = '—';
    els.detailMaterial.textContent = getMaterialLabel(material);
    renderReferenceTable(-1);
    return;
  }

  const found = findRow(amps);

  if (!found) {
    els.sizeResult.textContent = '> 6000 A';
    els.detailRating.textContent = 'Exceeds table — engineering analysis required';
    els.detailMaterial.textContent = getMaterialLabel(material);
    renderReferenceTable(-1);
    return;
  }

  const size = material === 'al' ? found.row.al : found.row.cu;
  els.sizeResult.textContent = size;
  els.detailRating.textContent = `${found.row.amp} A`;
  els.detailMaterial.textContent = getMaterialLabel(material);
  renderReferenceTable(found.index);
}

// ==================== INIT ====================

els.ocpdRating.addEventListener('input', update);
els.material.addEventListener('change', update);

update();
